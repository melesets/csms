// Department staff management - staff list with activity feed and shift status
import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Search, UserCheck, CheckCircle, Trash2, ChevronDown, ChevronRight, Activity, Clock } from 'lucide-react';
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

  useEffect(() => {
    if (user?.role !== 'admin' && user?.department) {
      setTargetDept(user.department);
    }
  }, [user]);

  // Fetch staff and users from backend
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

  // Filter staff and users by selected department
  const filteredStaff = staff.filter(member => {
    const matchesDepartment = targetDept === 'All' || member.department === targetDept;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const filteredUsers = users.filter(u => {
    // Staff are already handled in filteredStaff, and admin shouldn't be listed as dept users
    if (u.role === 'staff' || u.role === 'admin') return false;
    const matchesDepartment = targetDept === 'All' || u.department === targetDept;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  // Combine both for the "Activity Hub" view
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
    // Check for duplicate names
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
      const res = await fetch(`/api/department-staff/${editingStaff.id}`, {
        method: 'PUT',
        body: fd,
      });
      if (res.ok) {
        const updatedRes = await fetch('/api/department-staff');
        if (updatedRes.ok) setStaff(await updatedRes.json());
        window.dispatchEvent(new Event('staff-updated'));
      }
    } else {
      const res = await fetch('/api/department-staff', {
        method: 'POST',
        body: fd,
      });
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

  return (
    <div className="space-y-6">
      <DepartmentStaffPanel />
      
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department Activity Hub</h2>
          <p className="text-gray-600 mt-1">
            Track staff and user activities in {targetDept === 'All' ? 'all departments' : targetDept}
          </p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <select
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
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
              setTimeout(() => {
                document.getElementById('staff-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {showForm ? 'Cancel' : 'Add Staff'}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center shadow-sm">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <p className="text-green-800">Staff member {editingStaff ? 'updated' : 'added'} successfully!</p>
        </div>
      )}

      {/* Add/Edit Form */}
      <div id="staff-form-anchor" />
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-indigo-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h3>
            <button
              onClick={() => { setShowForm(false); setEditingStaff(null); setPhotoFile(null); setPhotoPreview(null); }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {photoPreview && photoPreview !== 'null' && photoPreview !== 'undefined' ? (
                  <img
                    src={photoPreview.startsWith('blob:') || photoPreview.startsWith('data:') ? photoPreview : getMediaUrl(photoPreview)}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 shadow-md"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="35" r="20" fill="%23818cf8"/><ellipse cx="50" cy="85" rx="32" ry="20" fill="%23a5b4fc"/></svg>'; }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-md border-4 border-indigo-100">
                    <svg viewBox="0 0 100 100" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="35" r="20" fill="#818cf8" />
                      <ellipse cx="50" cy="85" rx="32" ry="20" fill="#a5b4fc" />
                    </svg>
                  </div>
                )}
                <label className="absolute bottom-1 right-1 bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition shadow-lg">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-400">Tap the camera icon to upload a photo</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text" name="name" value={formData.name}
                  onChange={handleInputChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Desta Kebede"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role/Position *</label>
                <select
                  name="role" value={formData.role}
                  onChange={handleInputChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text" value={user?.department || 'General'} disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingStaff(null); setPhotoFile(null); setPhotoPreview(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-semibold"
              >
                {editingStaff ? 'Update Staff' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Robust Department Activity Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-white to-indigo-50/30">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Recent Department Activity</h3>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Live Audit Trail • {targetDept}</p>
          </div>
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
        </div>
        <div className="p-6 bg-gray-50/30">
          <ActivityFeed department={targetDept} />
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Search staff</h3>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>



      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Department Members ({combinedMembers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Shift
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {combinedMembers.map((member: any) => (
                <React.Fragment key={member.uniqueId}>
                  <tr
                    className={`hover:bg-blue-50 transition-colors cursor-pointer ${expandedId === member.uniqueId ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(expandedId === member.uniqueId ? null : member.uniqueId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {expandedId === member.uniqueId ? <ChevronDown className="w-4 h-4 mr-2 text-blue-500" /> : <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />}
                        {member.profile_picture && member.profile_picture !== 'null' && member.profile_picture !== 'undefined' && member.profile_picture.length > 5 ? (
                          <img
                            src={getMediaUrl(member.profile_picture)}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover mr-3 border-2 border-indigo-100 shadow-sm"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="28" r="16" fill="%23c7d2fe"/><ellipse cx="40" cy="68" rx="26" ry="16" fill="%23e0e7ff"/></svg>'; }}
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 border-2 border-transparent ${member.isSystemUser ? 'bg-indigo-100' : 'bg-blue-100'}`}>
                            <UserCheck className={`w-5 h-5 ${member.isSystemUser ? 'text-indigo-600' : 'text-blue-600'}`} />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          {member.isSystemUser && <div className="text-xs text-indigo-500 italic">{member.username} (App User)</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.isSystemUser ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.currentShift ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${member.currentShift === 'Morning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            member.currentShift === 'Afternoon' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                          {member.currentShift} Shift
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" />
                          Off Duty
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.createdBy || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === member.uniqueId ? null : member.uniqueId); }}
                          className={`p-1.5 rounded-lg transition-colors ${expandedId === member.uniqueId ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
                          title="View Activity"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                        {!member.isSystemUser && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(member); }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === member.uniqueId && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={6} className="px-6 py-4">
                        <ActivityFeed username={member.username || member.name} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {combinedMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No department members found</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no staff or users registered for this department.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
