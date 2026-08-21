// Department staff panel - compact staff list with shift indicators
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { X, Unlock, Lock, Zap, LogOut, Users, FileText, Package, Clock, ChevronRight } from 'lucide-react';
import { apiGet, apiPost, getMediaUrl } from '../../api';
import { EthiopianDateTimeDisplay } from '../../components/shared/date/EthiopianDateTimeDisplay';

interface StaffMember {
  id: string;
  username: string;
  name: string;
  profession: string;
  department: string;
  has_pin: boolean;
  session_id: string | null;
  shift_name: string | null;
  start_time: string | null;
  profile_picture?: string | null;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-cyan-500',
];

const getAvatarColor = (name: string) => {
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const getShiftElapsed = (start: string | null) => {
  if (!start) return '';
  const diff = Math.max(0, Date.now() - new Date(start).getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const DepartmentStaffPanel = () => {
  const { user, setActiveOperator } = useAuth();
  const { shiftContext, refreshShiftContext } = useShift();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [requirePin, setRequirePin] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [modalAction, setModalAction] = useState<'choose' | 'checkin' | 'checkout'>('choose');
  const [biometricPolling, setBiometricPolling] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState('');

  const fetchStaff = async () => {
    if (!user) return;
    try {
      const url = user.role === 'admin'
        ? '/shifts/active-staff'
        : `/shifts/active-staff/${encodeURIComponent(user.department)}`;
      const data = await apiGet(url);
      setStaff(data);
    } catch (err) {
      console.error('Failed to fetch department staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    const interval = setInterval(fetchStaff, 30000);
    window.addEventListener('staff-updated', fetchStaff);
    return () => {
      clearInterval(interval);
      window.removeEventListener('staff-updated', fetchStaff);
    };
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const filteredStaff = isAdmin && filterDept
    ? staff.filter(s => s.department === filterDept)
    : staff;
  const onlineStaff = filteredStaff.filter(s => s.session_id);
  const offlineStaff = filteredStaff.filter(s => !s.session_id);
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))].sort();

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || (requirePin && pin.length !== 4)) return;
    setIsSubmitting(true);
    setError('');
    const action = selectedStaff.session_id ? 'check-out' : 'check-in';
    try {
      await apiPost('/shifts/staff-action', {
        userId: selectedStaff.id,
        pin: requirePin ? pin : undefined,
        bypassPin: !requirePin,
        action,
        ward: user.department,
        shiftName: shiftContext?.current || 'Day'
      });
      if (action === 'check-in' && setActiveOperator) {
        setActiveOperator({
          id: selectedStaff.id,
          username: selectedStaff.username,
          name: selectedStaff.name,
          profession: selectedStaff.profession,
          department: selectedStaff.department
        });
      } else if (action === 'check-out' && setActiveOperator) {
        setActiveOperator(null);
      }
      setPin('');
      setRequirePin(true);
      setSelectedStaff(null);
      await fetchStaff();
      refreshShiftContext();
      window.dispatchEvent(new Event('staff-updated'));
    } catch (err: any) {
      setError(err?.message || 'Invalid PIN or server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricCheckIn = async () => {
    if (!selectedStaff) return;
    setBiometricPolling(true);
    setBiometricStatus('Looking up staff in biometrics system...');
    setError('');

    try {
      const lookup = await apiGet(`/shifts/biometric-lookup?name=${encodeURIComponent(selectedStaff.name)}&department=${encodeURIComponent(selectedStaff.department)}`);
      if (!lookup || !lookup.id) {
        setBiometricStatus('');
        setBiometricPolling(false);
        setError('Staff not found in biometrics system.');
        return;
      }

      const kioskData = await apiGet('/shifts/biometric-kiosk-url');
      window.open(kioskData.url, '_blank');

      setBiometricStatus('Kiosk opened — waiting for face/fingerprint scan...');
      let lastEvent = null;
      let attempts = 0;
      const maxAttempts = 90;

      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const event = await apiGet(`/shifts/biometric-last-event/${lookup.id}`);
          if (event && (!lastEvent || event.timestamp !== lastEvent.timestamp)) {
            if (!lastEvent) { lastEvent = event; return; }
            clearInterval(pollInterval);
            const action = event.type === 'in' ? 'check-in' : 'check-out';
            setBiometricStatus(`Biometric verified! Processing ${action}...`);
            await apiPost('/shifts/staff-action', {
              userId: selectedStaff.id, bypassPin: true, action,
              ward: user!.department, shiftName: shiftContext?.current || 'Day'
            });
            if (action === 'check-in' && setActiveOperator) {
              setActiveOperator({ id: selectedStaff.id, username: selectedStaff.username,
                name: selectedStaff.name, profession: selectedStaff.profession, department: selectedStaff.department });
            } else if (action === 'check-out' && setActiveOperator) {
              setActiveOperator(null);
            }
            setBiometricStatus(action === 'check-in' ? '✅ Check-in complete!' : '✅ Check-out complete!');
            setTimeout(() => {
              setSelectedStaff(null);
              setBiometricPolling(false);
              setBiometricStatus('');
              fetchStaff();
              refreshShiftContext();
              window.dispatchEvent(new Event('staff-updated'));
            }, 1500);
          } else if (!lastEvent && event) {
            lastEvent = event;
          }
        } catch { /* biometrics may be temporarily unreachable */ }
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setBiometricPolling(false);
          setBiometricStatus('');
          setError('Timed out waiting for biometric verification.');
        }
      }, 2000);
      (window as any).__biometricPollInterval = pollInterval;
    } catch (err: any) {
      setBiometricPolling(false);
      setBiometricStatus('');
      setError(err?.message || 'Failed to connect to biometrics system');
    }
  };

  const StaffCard = ({ s, isOnline }: { s: StaffMember; isOnline: boolean }) => {
    const avatarColor = getAvatarColor(s.name);
    const hasPhoto = s.profile_picture && s.profile_picture !== 'null' && s.profile_picture !== 'undefined' && s.profile_picture.length > 5;
    return (
      <button
        onClick={() => {
          setSelectedStaff(s);
          setRequirePin(!!s.has_pin);
          setPin('');
          setError('');
          setModalAction(s.session_id ? 'choose' : 'checkin');
        }}
        className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
          hover:-translate-y-0.5 active:translate-y-0 text-left w-full
          ${isOnline
              ? 'border-[#003153]/20 bg-[#003153]/[0.02] hover:bg-[#003153]/[0.05] shadow-sm hover:shadow-md'
              : 'border-gray-200 bg-white hover:bg-gray-50/80 shadow-sm hover:shadow-md'
          }`}
      >
        <div className={`relative w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0 ${isOnline ? 'ring-2 ring-[#003153]/20' : 'ring-1 ring-gray-200'}`}>
          {hasPhoto ? (
            <img
              src={getMediaUrl(s.profile_picture!)}
              alt={s.name}
              className="w-full h-full rounded-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
            />
          ) : null}
          <span className={hasPhoto ? 'hidden' : ''}>{s.name.charAt(0).toUpperCase()}</span>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
            ${isOnline ? 'bg-emerald-400' : 'bg-gray-300'}`}>
            {isOnline && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-tight truncate ${isOnline ? 'text-gray-900' : 'text-gray-700'}`}>{s.name}</p>
          <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{s.profession}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full
              ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {isOnline ? 'On Duty' : 'Off Duty'}
            </span>
            {s.shift_name && (
              <span className="text-[10px] font-medium text-gray-400">{s.shift_name}</span>
            )}
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-gray-100 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 bg-gray-100 rounded w-40 animate-pulse" />
            <div className="h-3 bg-gray-50 rounded w-56 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#003153] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Active Staff — {isAdmin ? (filterDept || 'All Departments') : user.department}
              </h1>
              <p className="text-sm text-gray-500">Tap a name to clock in or out</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && departments.length > 1 && (
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#003153] focus:border-transparent"
              >
                <option value="">All Departments ({staff.length})</option>
                {departments.map(d => {
                  const count = staff.filter(s => s.department === d).length;
                  return <option key={d} value={d}>{d} ({count})</option>;
                })}
              </select>
            )}
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
              <span className="w-2 h-2 rounded-full bg-[#003153] animate-pulse" />
              <span className="text-xs font-semibold text-gray-600">{shiftContext?.current || '—'} Shift</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-xs font-semibold text-emerald-600">{onlineStaff.length} on duty</span>
            </div>
          </div>
        </div>

        {onlineStaff.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">On Duty ({onlineStaff.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {onlineStaff.map(s => <StaffCard key={s.id} s={s} isOnline />)}
            </div>
          </div>
        )}

        {offlineStaff.length > 0 && (
          <div>
            {onlineStaff.length > 0 && <div className="border-t border-gray-100 my-4" />}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Off Duty ({offlineStaff.length})</span>
            </div>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {offlineStaff.map(s => {
                const avatarColor = getAvatarColor(s.name);
                const hasPhoto = s.profile_picture && s.profile_picture !== 'null' && s.profile_picture !== 'undefined' && s.profile_picture.length > 5;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStaff(s); setRequirePin(!!s.has_pin); setPin(''); setError(''); setModalAction('checkin'); }}
                    className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors text-left w-full"
                  >
                    <div className={`relative w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                      {hasPhoto ? (
                        <img src={getMediaUrl(s.profile_picture!)} alt={s.name} className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <span>{s.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 truncate">{s.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{s.profession}</span>
                    </div>
                    {s.department && <span className="text-[10px] text-gray-400 shrink-0">{s.department}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {staff.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {isAdmin
                ? (filterDept ? `No staff registered in ${filterDept}` : 'No staff registered')
                : `No staff registered in ${user.department}`
              }
            </p>
          </div>
        )}
      </div>

      {selectedStaff && (() => {
        const avatarColor = getAvatarColor(selectedStaff.name);
        const isCheckOut = !!selectedStaff.session_id;
        const hasPhoto = selectedStaff.profile_picture && selectedStaff.profile_picture !== 'null' && selectedStaff.profile_picture.length > 5;
        const closeModal = () => { setSelectedStaff(null); setPin(''); setError(''); setModalAction('choose'); };
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className={`px-5 py-4 flex items-center justify-between ${isCheckOut ? 'bg-orange-50' : 'bg-[#003153]/5'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm`}>
                    {hasPhoto ? (
                      <img
                        src={getMediaUrl(selectedStaff.profile_picture!)}
                        alt={selectedStaff.name}
                        className="w-full h-full rounded-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <span className={hasPhoto ? 'hidden' : ''}>{selectedStaff.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedStaff.name}</p>
                    <p className="text-xs text-gray-500">{selectedStaff.profession}</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-full hover:bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCheckOut && modalAction === 'choose' ? (
                <div className="p-5">
                  <div className="rounded-xl bg-[#003153]/[0.04] border border-[#003153]/10 px-4 py-3 mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="w-4 h-4 text-[#003153] shrink-0" />
                        <span className="text-xs font-bold text-[#003153] truncate">{selectedStaff.shift_name || 'On Duty'}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                          ● On Duty
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 shrink-0">{getShiftElapsed(selectedStaff.start_time)} on duty</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Clocked in at <EthiopianDateTimeDisplay date={selectedStaff.start_time} showTime format="long" size="xs" />
                    </p>
                  </div>

                  <p className="text-sm font-bold text-gray-900 mb-3">What would you like to do?</p>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/csms/?reporter=${selectedStaff.id}&reporterName=${encodeURIComponent(selectedStaff.name)}&reporterUsername=${encodeURIComponent(selectedStaff.username)}`;
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#003153] hover:bg-[#002640] text-white shadow-md shadow-[#003153]/20 transition-all transform active:scale-[0.98] group"
                    >
                      <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-bold">Report</span>
                        <span className="block text-[11px] text-white/75 font-medium truncate">File a handover / shift report</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={handleBiometricCheckIn}
                      disabled={biometricPolling}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-200 transition-all transform active:scale-[0.98] group disabled:opacity-60"
                    >
                      <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-bold">Biometric</span>
                        <span className="block text-[11px] text-white/75 font-medium truncate">Scan face or fingerprint on kiosk</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/csms/?dest=inventory&reporter=${selectedStaff.id}&reporterName=${encodeURIComponent(selectedStaff.name)}&reporterUsername=${encodeURIComponent(selectedStaff.username)}`;
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#003153] hover:bg-[#002640] text-white shadow-md shadow-[#003153]/20 transition-all transform active:scale-[0.98] group"
                    >
                      <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5" />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-bold">Inventory</span>
                        <span className="block text-[11px] text-white/75 font-medium truncate">Update stock &amp; equipment</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalAction('checkout')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#003153] hover:bg-[#002640] text-white shadow-md shadow-[#003153]/20 transition-all transform active:scale-[0.98] group"
                    >
                      <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <LogOut className="w-5 h-5" />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-bold">Clock Out</span>
                        <span className="block text-[11px] text-white/75 font-medium truncate">End your shift now</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  </div>
                </div>
              ) : biometricPolling ? (
                <div className="p-5 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-1">Biometric Verification</p>
                  <p className="text-xs text-gray-500 mb-4">{biometricStatus || 'Waiting for scan...'}</p>
                  <div className="flex justify-center">
                    <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" style={{width: '60%'}} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if ((window as any).__biometricPollInterval) clearInterval((window as any).__biometricPollInterval);
                      setBiometricPolling(false);
                      setBiometricStatus('');
                    }}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAction} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-sm font-bold ${isCheckOut ? 'text-orange-600' : 'text-[#003153]'}`}>
                      {isCheckOut ? (
                        <span className="flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Clock Out</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Take Control</span>
                      )}
                    </p>
                    
                    {selectedStaff.has_pin ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (requirePin && pin.length !== 4) return;
                          setRequirePin(!requirePin);
                        }}
                        className={`text-[10px] flex items-center gap-1 font-bold px-2.5 py-1 rounded-full transition-colors ${
                          requirePin ? 'bg-[#003153]/10 text-[#003153]' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {requirePin ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {requirePin ? 'PIN On' : 'No PIN'}
                      </button>
                    ) : (
                      <span className="text-[10px] flex items-center gap-1 font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        <Unlock className="w-3 h-3" /> No PIN Required
                      </span>
                    )}
                  </div>

                  {error && (
                    <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 text-center">
                      {error}
                    </div>
                  )}

                  {requirePin && (
                    <input
                      type="password"
                      autoComplete="one-time-code"
                      maxLength={4}
                      pattern="\d{4}"
                      autoFocus
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center text-3xl tracking-[0.5em] py-4 rounded-xl border-2 border-gray-200 focus:border-[#003153] focus:ring-0 bg-gray-50 focus:bg-white transition-colors mb-4 shadow-inner"
                      placeholder="••••"
                      disabled={isSubmitting}
                    />
                  )}

                  {isCheckOut && (
                    <button
                      type="button"
                      onClick={() => setModalAction('choose')}
                      className="w-full mb-2 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-50 border border-gray-200 transition-colors text-sm"
                    >
                      ← Back
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={(requirePin && pin.length !== 4) || isSubmitting}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 disabled:opacity-40
                      ${isCheckOut
                        ? 'bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-200'
                        : 'bg-[#003153] hover:bg-[#002640] shadow-md shadow-[#003153]/20'
                      }`}
                  >
                    {isSubmitting ? 'Verifying...' : isCheckOut ? 'Clock Out' : 'Clock In'}
                  </button>

                  {!isCheckOut && (
                    <>
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">or</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <button
                        type="button"
                        onClick={handleBiometricCheckIn}
                        disabled={biometricPolling}
                        className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all transform active:scale-95 shadow-md shadow-emerald-200 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                        Scan Face / Fingerprint
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
};
