
// User management - admin panel for user CRUD and permissions
import React, { useState } from 'react';
import { Plus, Shield, Search, CheckCircle, KeyRound, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/auth';
import { apiPut, apiDelete } from '../../api';
import { UserForm } from './UserForm';
import { UserList } from './UserList';

export const UserManagement = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  const canManageAllDepartments = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  const getUserDepartmentFilter = () => {
    if (canManageAllDepartments) {
      return null;
    }
    return currentUser?.department || null;
  };

  React.useEffect(() => {
    const dept = getUserDepartmentFilter();
    const url = dept ? `/api/users?department=${encodeURIComponent(dept)}` : '/api/users';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      });
  }, [canManageAllDepartments, currentUser?.department]);

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pinSettingUser, setPinSettingUser] = useState<User | null>(null);
  const [rotatingUser, setRotatingUser] = useState<User | null>(null);
  const [newDepartment, setNewDepartment] = useState('');
  const [newPin, setNewPin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Password verification for PIN reset
  const [pinVerifyStep, setPinVerifyStep] = useState<'verify' | 'reset'>('verify');
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!hasPermission('user-management', 'view')) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          You don't have permission to access user management.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(user =>
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveUser = (userData: Omit<User, 'id' | 'lastLogin'>) => {
    setError(null);
    if (editingUser) {
      // Update user in backend
      fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
        .then(async res => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to update user');
          }
          return res.json();
        })
        .then(updatedUser => {
          if (updatedUser) {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            showSuccessMessage('User updated successfully!');
            setShowForm(false);
            setEditingUser(null);
          }
        })
        .catch(err => {
          setError(err.message);
        });
    } else {
      // Create user in backend
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, createdBy: currentUser?.username })
      })
        .then(async res => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to create user');
          }
          return res.json();
        })
        .then(newUser => {
          if (newUser) {
            setUsers(prev => [newUser, ...prev]);
            showSuccessMessage('User created successfully!');
            setShowForm(false);
            setEditingUser(null);
          }
        })
        .catch(err => {
          setError(err.message);
        });
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleAddStaff = (parentUserId: string) => {
    setEditingUser(null);
    setShowForm(true);
    // Pre-fill with parent user info
    const parentUser = users.find(u => u.id === parentUserId);
    if (parentUser) {
      setEditingUser({
        role: 'staff',
        department: parentUser.department,
        parentUserId: parentUserId,
        isActive: true,
        permissions: [],
      } as any);
    }
  };

  const getUserForForm = () => {
    if (editingUser) return editingUser;

    // If not a global admin, pre-fill and lock the department
    if (!canManageAllDepartments && currentUser?.department) {
      return {
        department: currentUser.department,
        role: 'user',
        isActive: true,
        permissions: []
      } as any;
    }
    return null;
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleToggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      const updatedUser = await apiPut(`/users/${userId}`, { ...user, isActive: !user.isActive });
      if (updatedUser) {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const result = await apiDelete(`/users/${userId}`);
      if (result && result.success) {
        setUsers((prev: User[]) => prev.filter((u: User) => u.id !== userId));
        showSuccessMessage('User deleted successfully!');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleVerifyForPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinSettingUser || !adminPassword) return;
    setIsVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/users/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, password: adminPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid password');
      }
      setPinVerifyStep('reset');
    } catch (err: any) {
      setVerifyError(err.message || 'Invalid password');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinSettingUser || newPin.length !== 4) return;

    try {
      await apiPut(`/users/${pinSettingUser.id}/set-pin`, { pin: newPin });
      showSuccessMessage('PIN set successfully!');
      setPinSettingUser(null);
      setNewPin('');
      setAdminPassword('');
      setPinVerifyStep('verify');
      
      // Update user has_pin status locally
      setUsers(prev => prev.map(u => u.id === pinSettingUser.id ? { ...u, has_pin: true } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN');
    }
  };

  const handleRotateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotatingUser || !newDepartment) return;

    try {
      const updatedUser = await apiPut(`/users/${rotatingUser.id}`, { department: newDepartment });
      if (updatedUser) {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        showSuccessMessage(`Staff member successfully rotated to ${newDepartment}!`);
        setRotatingUser(null);
        setNewDepartment('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to rotate staff');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#003153] rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">User Management</h2>
            <p className="text-sm text-gray-400">Manage system users and their permissions</p>
          </div>
        </div>
        {hasPermission('user-management', 'create') && (
          <button
            onClick={handleAddUser}
            className="bg-[#003153] hover:bg-[#002640] text-white font-semibold text-xs py-2 px-4 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <Shield className="w-5 h-5 text-red-600 mr-3" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name, username, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <UserForm
          user={getUserForForm()}
          onSave={handleSaveUser}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
          allUsers={users}
          lockDepartment={!canManageAllDepartments}
        />
      )}

      {/* Users List */}
      <UserList
        users={filteredUsers}
        currentUser={currentUser}
        onEdit={handleEditUser}
        onToggleStatus={handleToggleUserStatus}
        onDelete={handleDeleteUser}
        onSetPin={(user) => {
          setPinSettingUser(user);
          setNewPin('');
          setAdminPassword('');
          setPinVerifyStep('verify');
          setVerifyError('');
        }}
        onRotateUnit={(user) => {
          setRotatingUser(user);
          setNewDepartment(user.department || '');
        }}
        onAddStaff={handleAddStaff}
        hasEditPermission={hasPermission('user-management', 'edit')}
      />

      {/* Set PIN Modal */}
      {pinSettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-sm font-bold flex items-center text-gray-900">
                <KeyRound className="w-4 h-4 mr-2 text-[#003153]" /> {pinSettingUser.has_pin ? 'Reset' : 'Set'} Access PIN
              </h3>
              <button 
                onClick={() => { setPinSettingUser(null); setPinVerifyStep('verify'); setAdminPassword(''); }} 
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pinVerifyStep === 'verify' ? (
              <form onSubmit={handleVerifyForPin} className="p-6">
                <p className="text-xs text-gray-500 mb-4">
                  Enter your password to confirm setting a PIN for <strong className="text-gray-900">{pinSettingUser.name}</strong>.
                </p>
                {verifyError && (
                  <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 text-center">
                    {verifyError}
                  </div>
                )}
                <div className="mb-6">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Your Password</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full border-gray-200 rounded-lg text-sm px-4 py-3 border bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setPinSettingUser(null); setPinVerifyStep('verify'); setAdminPassword(''); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!adminPassword || isVerifying}
                    className="bg-[#003153] px-4 py-2 rounded-lg text-xs font-semibold text-white hover:bg-[#002640] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmitPin} className="p-6">
                <p className="text-xs text-gray-500 mb-4">
                  Set a 4-digit PIN for <strong className="text-gray-900">{pinSettingUser.name}</strong>. Staff will use this PIN to clock in/out.
                </p>
                <div className="mb-6">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">New PIN</label>
                  <input
                    type="password"
                    autoComplete="one-time-code"
                    maxLength={4}
                    pattern="\d{4}"
                    required
                    autoFocus
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full border-gray-200 rounded-lg text-center text-2xl tracking-[0.5em] py-3 border bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setPinVerifyStep('verify'); setNewPin(''); setAdminPassword(''); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={newPin.length !== 4}
                    className="bg-[#003153] px-4 py-2 rounded-lg text-xs font-semibold text-white hover:bg-[#002640] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Rotate Unit Modal */}
      {rotatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-sm font-bold flex items-center text-gray-900">
                <RefreshCw className="w-4 h-4 mr-2 text-emerald-600" /> Rotate Unit
              </h3>
              <button 
                onClick={() => setRotatingUser(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRotateUnit} className="p-6">
              <p className="text-xs text-gray-500 mb-4">
                Move <strong className="text-gray-900">{rotatingUser.name}</strong> from <span className="font-semibold text-gray-900">{rotatingUser.department}</span> to a new department.
              </p>
              <div className="mb-6">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">New Department</label>
                <select
                  required
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="w-full border-gray-200 rounded-lg py-2.5 px-4 border bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="" disabled>Select Department...</option>
                  {Array.from(new Set(
                    users
                      .filter(u => u.role === 'user' && u.department)
                      .map(u => u.department)
                  )).sort().map((deptName) => (
                    <option key={deptName} value={deptName} disabled={deptName === rotatingUser.department}>
                      {deptName} {deptName === rotatingUser.department && '(Current)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRotatingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDepartment || newDepartment === rotatingUser.department}
                  className="bg-[#003153] px-4 py-2 rounded-lg text-xs font-semibold text-white hover:bg-[#002640] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rotate Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
