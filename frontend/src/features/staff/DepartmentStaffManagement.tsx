// Department staff management - staff list with activity feed and shift status
import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Search, CheckCircle, Trash2, ChevronDown, ChevronRight, Activity, Clock, X, Camera } from 'lucide-react';

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

const compressImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const max = 200;
      const w = img.width > img.height ? max : (img.width / img.height) * max;
      const h = img.width > img.height ? (img.height / img.width) * max : max;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }));
      }, 'image/webp', 0.8);
    };
    img.src = URL.createObjectURL(file);
  });

import { useAuth } from '../../hooks/useAuth';
import { Staff } from '../../types';
import { User } from '../../types/auth';
import { ActivityFeed } from './ActivityFeed';
import { DepartmentStaffPanel } from './DepartmentStaffPanel';
import { useDepartments } from '../../hooks/useDepartments';
import { getMediaUrl } from '../../api';

export const DepartmentStaffManagement = () => {
  const { user } = useAuth();
  const { departments } = useDepartments();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [targetDept, setTargetDept] = useState(user?.department || 'General');
  const [users, setUsers] = useState<User[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('staff');

  useEffect(() => {
    if (user?.role !== 'admin' && user?.department) {
      setTargetDept(user.department);
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, usersRes] = await Promise.all([
          fetch('/api/department-staff'),
          fetch('/api/users')
        ]);
        if (staffRes.ok) setStaff(await staffRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());
      } catch (err) {
        console.error('Error fetching department data:', err);
      }
    };
    fetchData();
  }, []);

  const filteredStaff = staff.filter(member => {
    const matchesDepartment = targetDept === 'All' || member.department === targetDept;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const filteredUsers = users.filter(u => {
    if (u.role === 'staff' || u.role === 'admin') return false;
    const matchesDepartment = targetDept === 'All' || u.department === targetDept;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const combinedMembers = [
    ...filteredStaff.map(s => ({ ...s, isSystemUser: false, uniqueId: `staff-${s.id}` })),
    ...filteredUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      username: u.username,
      department: u.department,
      isSystemUser: true,
      uniqueId: `user-${u.id}`
    }))
  ];

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: user?.department || 'General'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const duplicateCheck = staff.find(member =>
      member.name.toLowerCase() === formData.name.toLowerCase() &&
      member.department === (user?.department || 'General') &&
      (!editingStaff || member.id !== editingStaff.id)
    );
    if (duplicateCheck) {
      alert('A staff member with this name already exists in this department!');
      return;
    }
    const fd = new FormData();
    fd.append('name', formData.name);
    fd.append('role', formData.role);
    fd.append('department', user?.department || 'General');
    fd.append('createdBy', user?.username || '');
    if (photoFile) fd.append('photo', photoFile);

    if (editingStaff) {
      const res = await fetch(`/api/department-staff/${editingStaff.id}`, { method: 'PUT', body: fd });
      if (res.ok) {
        const updatedRes = await fetch('/api/department-staff');
        if (updatedRes.ok) setStaff(await updatedRes.json());
        window.dispatchEvent(new Event('staff-updated'));
      }
    } else {
      const res = await fetch('/api/department-staff', { method: 'POST', body: fd });
      if (res.ok) {
        const updatedRes = await fetch('/api/department-staff');
        if (updatedRes.ok) setStaff(await updatedRes.json());
        window.dispatchEvent(new Event('staff-updated'));
      }
    }
    setFormData({ name: '', role: '', department: user?.department || 'General' });
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(false);
    setEditingStaff(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({ name: staffMember.name, role: staffMember.role, department: staffMember.department });
    setPhotoPreview((staffMember as any).profile_picture || null);
    setPhotoFile(null);
    setShowForm(true);
  };

  const handleDelete = async (staffMember: Staff) => {
    if (!staffMember?.id) return;
    if (!window.confirm(`Delete staff member "${staffMember.name}"?`)) return;
    try {
      const res = await fetch(`/api/department-staff/${staffMember.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to delete staff member');
      }
      setStaff(prev => prev.filter(s => s.id !== staffMember.id));
    } catch (err: any) {
      alert(err?.message || 'Error deleting staff member');
    }
  };

  const tabs = [
    { id: 'staff', label: 'Staff', icon: Users, count: combinedMembers.length },
    { id: 'activity', label: 'Activity', icon: Activity, count: 0 },
  ];

  return (
    <div className="space-y-5">
      {showSuccess && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">Staff member {editingStaff ? 'updated' : 'added'} successfully!</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingStaff(null); setPhotoFile(null); setPhotoPreview(null); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {photoPreview && photoPreview !== 'null' && photoPreview !== 'undefined' ? (
                    <img
                      src={photoPreview.startsWith('blob:') || photoPreview.startsWith('data:') ? photoPreview : getMediaUrl(photoPreview)}
                      alt="Profile preview"
                      className="w-20 h-20 rounded-full object-cover border-4 border-gray-100"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="35" r="20" fill="%23d1d5db"/><ellipse cx="50" cy="85" rx="32" ry="20" fill="%23e5e7eb"/></svg>'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-100">
                      <Users className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-7 h-7 bg-[#003153] text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-[#002640] transition shadow-lg">
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressImage(file);
                          setPhotoFile(compressed);
                          setPhotoPreview(URL.createObjectURL(compressed));
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400">Tap the camera icon to upload a photo</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input
                    type="text" name="name" value={formData.name}
                    onChange={handleInputChange} required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#003153] focus:border-transparent transition"
                    placeholder="e.g. Desta Kebede"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role/Position *</label>
                  <select
                    name="role" value={formData.role}
                    onChange={handleInputChange} required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#003153] focus:border-transparent transition"
                  >
                    <option value="">Select...</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Midwife">Midwife</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Other Coordinators">Other Coordinators</option>
                    <option value="Shift Focal">Shift Focal</option>
                    <option value="Head Nurse">Head Nurse</option>
                    <option value="Head Midwife">Head Midwife</option>
                    <option value="GP">GP</option>
                    <option value="GP Coordinator">GP Coordinator</option>
                    <option value="Senior">Senior</option>
                    <option value="Department Head">Department Head</option>
                  </select>
                </div>
              </div>

              {user?.department !== 'All' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                  <input
                    type="text" value={user?.department || 'General'} disabled
                    className="w-full px-4 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingStaff(null); setPhotoFile(null); setPhotoPreview(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors"
                >
                  {editingStaff ? 'Update Staff' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1 overflow-x-auto items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#003153] text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        {user?.role === 'admin' && (
          <select
            value={targetDept}
            onChange={(e) => setTargetDept(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#003153] focus:border-transparent mr-1"
          >
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <>
          <DepartmentStaffPanel />

          {/* Search */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Search staff by name or role..."
                className="pl-10 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#003153] focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">
                Department Members ({combinedMembers.length})
              </h2>
              <button
                onClick={() => {
                  setShowForm(prev => !prev);
                  setEditingStaff(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setFormData({
                    name: '',
                    role: '',
                    department: targetDept === 'All' ? 'General' : targetDept
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003153] text-white text-xs font-medium rounded-lg hover:bg-[#002640] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />{showForm ? 'Cancel' : 'Add Staff'}
              </button>
            </div>

            {combinedMembers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">No Members Found</h3>
                <p className="text-sm text-gray-500">No staff or users registered for this department.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {combinedMembers.map((member: any) => {
                  const isExpanded = expandedId === member.uniqueId;
                  return (
                    <div key={member.uniqueId} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div
                        className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
                        onClick={() => setExpandedId(isExpanded ? null : member.uniqueId)}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}

                        {(() => {
                          const hasPhoto = member.profile_picture && member.profile_picture !== 'null' && member.profile_picture !== 'undefined' && member.profile_picture.length > 5;
                          return (
                            <div className={`w-10 h-10 rounded-full ${getAvatarColor(member.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                              {hasPhoto ? (
                                <img
                                  src={getMediaUrl(member.profile_picture)}
                                  alt={member.name}
                                  className="w-full h-full rounded-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                                />
                              ) : null}
                              <span className={hasPhoto ? 'hidden' : ''}>{member.name.charAt(0).toUpperCase()}</span>
                            </div>
                          );
                        })()}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                            {member.isSystemUser && <span className="text-[10px] text-gray-400 italic">(App User)</span>}
                          </div>
                          <p className="text-xs text-gray-500">{member.role}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            member.isSystemUser ? 'bg-[#003153]/10 text-[#003153]' : 'bg-blue-50 text-blue-700'
                          }`}>{member.role}</span>

                          {member.currentShift ? (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              member.currentShift === 'Morning' ? 'bg-amber-50 text-amber-700' :
                              member.currentShift === 'Afternoon' ? 'bg-blue-50 text-blue-700' :
                              'bg-purple-50 text-purple-700'
                            }`}>
                              {member.currentShift}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" />Off Duty
                            </span>
                          )}

                          {!member.isSystemUser && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                                className="p-1.5 text-gray-400 hover:text-[#003153] hover:bg-[#003153]/5 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(member); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                          <div className="text-xs text-gray-400 mb-2">
                            <span className="font-medium">{member.department}</span>
                            {member.createdBy && <span className="ml-2">· Created by {member.createdBy}</span>}
                          </div>
                          <ActivityFeed username={member.username || member.name} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#003153]/10 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#003153]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Live Audit Trail</p>
            </div>
          </div>
          <ActivityFeed department={targetDept} />
        </div>
      )}
    </div>
  );
};
