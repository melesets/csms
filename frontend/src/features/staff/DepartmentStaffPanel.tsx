// Department staff panel - compact staff list with shift indicators
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { KeyRound, X, Unlock, Lock, Zap, LogOut, Users } from 'lucide-react';
import { apiGet, apiPost, getMediaUrl } from '../../api';
import { DashboardSection } from '../../components/shared';

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

// Deterministic color from name
const getAvatarColor = (name: string) => {
  const colors = [
    ['#6366F1', '#EEF2FF'], // indigo
    ['#8B5CF6', '#F5F3FF'], // violet
    ['#EC4899', '#FDF2F8'], // pink
    ['#14B8A6', '#F0FDFA'], // teal
    ['#F59E0B', '#FFFBEB'], // amber
    ['#3B82F6', '#EFF6FF'], // blue
    ['#10B981', '#ECFDF5'], // emerald
    ['#EF4444', '#FEF2F2'], // red
  ];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
};

export const DepartmentStaffPanel = () => {
  const { user, activeOperator, setActiveOperator } = useAuth();
  const { shiftContext, refreshShiftContext } = useShift();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [requirePin, setRequirePin] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStaff = async () => {
    if (!user?.department || user.role === 'admin') return;
    try {
      const data = await apiGet(`/shifts/active-staff/${encodeURIComponent(user.department)}`);
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

  if (!user || user.role === 'admin' || !user.department) return null;

  const onlineStaff = staff.filter(s => s.session_id);
  const offlineStaff = staff.filter(s => !s.session_id);

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
    } catch (err: any) {
      setError(err?.message || 'Invalid PIN or server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StaffCard = ({ s, isOnline }: { s: StaffMember; isOnline: boolean }) => {
    const [fg, bg] = getAvatarColor(s.name);
    return (
      <button
        onClick={() => {
          setSelectedStaff(s);
          setRequirePin(!!s.has_pin);
          setPin('');
          setError('');
        }}
        className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
          hover:-translate-y-0.5 active:translate-y-0 text-left w-full
          ${isOnline
              ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm hover:shadow-md ring-1 ring-indigo-100'
              : 'border-gray-200 bg-white hover:bg-gray-50/80 shadow-sm hover:shadow-md'
          }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {s.profile_picture && s.profile_picture !== 'null' && s.profile_picture !== 'undefined' && s.profile_picture.length > 5 ? (
            <img
              src={getMediaUrl(s.profile_picture)}
              alt={s.name}
              className={`w-10 h-10 rounded-full object-cover ring-2 ${isOnline ? 'ring-indigo-200' : 'ring-gray-100'}`}
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="28" r="16" fill="%23c7d2fe"/><ellipse cx="40" cy="68" rx="26" ry="16" fill="%23e0e7ff"/></svg>'; }}
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 ${isOnline ? 'ring-indigo-200' : 'ring-gray-100'}`}
              style={{ background: bg }}
            >
              <svg viewBox="0 0 80 80" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="28" r="16" fill={fg} opacity="0.3" />
                <ellipse cx="40" cy="68" rx="26" ry="16" fill={fg} opacity="0.2" />
                <text x="40" y="34" textAnchor="middle" fontSize="22" fontWeight="bold" fill={fg}>
                  {s.name.charAt(0).toUpperCase()}
                </text>
                <rect x="34" y="44" width="12" height="7" rx="2" fill="white" opacity="0.8" />
                <path d="M36 48h8M40 46v4" stroke={fg} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {/* Status dot */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
            ${isOnline ? 'bg-emerald-400' : 'bg-gray-300'}`}>
            {isOnline && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />}
          </span>
        </div>

        {/* Name, profession & status */}
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl" />
          <div>
            <div className="h-4 bg-gray-100 rounded w-32 mb-1" />
            <div className="h-3 bg-gray-50 rounded w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Panel */}
      <DashboardSection
        title={`Active Staff — ${user.department}`}
        icon={<Users className="w-5 h-5 text-indigo-600" />}
        subtitle="Tap a name to clock in or out"
        collapsible={false}
        defaultCollapsed={false}
        actions={
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-gray-500">{shiftContext?.current || '—'} Shift</span>
            <span className="mx-1 text-gray-300">·</span>
            <span className="text-xs font-semibold text-emerald-600">{onlineStaff.length} on duty</span>
          </div>
        }
        className="mb-6"
      >

        {/* Staff Grid */}
        <div className="p-4">
          {/* On Duty */}
          {onlineStaff.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">On Duty ({onlineStaff.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {onlineStaff.map(s => <StaffCard key={s.id} s={s} isOnline />)}
              </div>
            </div>
          )}

          {/* Off Duty */}
          {offlineStaff.length > 0 && (
            <div>
              {onlineStaff.length > 0 && <div className="border-t border-gray-100 my-4" />}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Off Duty ({offlineStaff.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {offlineStaff.map(s => <StaffCard key={s.id} s={s} isOnline={false} />)}
              </div>
            </div>
          )}

          {staff.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-4">No staff registered in {user.department}.</p>
          )}
        </div>
      </DashboardSection>

      {/* Modal */}
      {selectedStaff && (() => {
        const [fg, bg] = getAvatarColor(selectedStaff.name);
        const isCheckOut = !!selectedStaff.session_id;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">
              {/* Modal header */}
              <div className={`px-5 py-4 flex items-center justify-between ${isCheckOut ? 'bg-orange-50' : 'bg-indigo-50'}`}>
                <div className="flex items-center gap-3">
                  {selectedStaff.profile_picture && selectedStaff.profile_picture !== 'null' && selectedStaff.profile_picture.length > 5 ? (
                    <img
                      src={getMediaUrl(selectedStaff.profile_picture)}
                      alt={selectedStaff.name}
                      className="w-10 h-10 rounded-full object-cover shadow"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="28" r="16" fill="%23c7d2fe"/><ellipse cx="40" cy="68" rx="26" ry="16" fill="%23e0e7ff"/></svg>'; }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shadow overflow-hidden"
                      style={{ background: bg }}
                    >
                      <svg viewBox="0 0 80 80" className="w-9 h-9" fill="none">
                        <circle cx="40" cy="28" r="16" fill={fg} opacity="0.3" />
                        <ellipse cx="40" cy="68" rx="26" ry="16" fill={fg} opacity="0.2" />
                        <text x="40" y="34" textAnchor="middle" fontSize="22" fontWeight="bold" fill={fg}>
                          {selectedStaff.name.charAt(0)}
                        </text>
                        <rect x="34" y="44" width="12" height="7" rx="2" fill="white" opacity="0.8" />
                        <path d="M36 48h8M40 46v4" stroke={fg} strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedStaff.name}</p>
                    <p className="text-xs text-gray-500">{selectedStaff.profession}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedStaff(null); setPin(''); setError(''); }}
                  className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-full hover:bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAction} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className={`text-sm font-bold ${isCheckOut ? 'text-orange-600' : 'text-indigo-600'}`}>
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
                        requirePin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
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
                    maxLength={4}
                    pattern="\d{4}"
                    autoFocus
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-3xl tracking-[0.5em] py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 bg-gray-50 focus:bg-white transition-colors mb-4 shadow-inner"
                    placeholder="••••"
                    disabled={isSubmitting}
                  />
                )}

                <button
                  type="submit"
                  disabled={(requirePin && pin.length !== 4) || isSubmitting}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 disabled:opacity-40
                    ${isCheckOut
                      ? 'bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'
                    }`}
                >
                  {isSubmitting ? 'Verifying...' : isCheckOut ? 'Clock Out' : 'Clock In'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}
    </>
  );
};
