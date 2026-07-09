
// User management - admin panel for user CRUD and permissions
import React, { useState } from 'react';
import { Plus, Shield, Search, CheckCircle, KeyRound, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDepartments } from '../../hooks/useDepartments';
import { User } from '../../types/auth';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';
import { UserForm } from './UserForm';
import { UserList } from './UserList';

export const UserManagement = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const { departments } = useDepartments();
  const [users, setUsers] = useState<User[]>([]);

  const canManageAllDepartments = currentUser?.role === 'admin';

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

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinSettingUser || newPin.length !== 4) return;

    try {
      await apiPut(`/users/${pinSettingUser.id}/set-pin`, { pin: newPin });
      showSuccessMessage('PIN set successfully!');
      setPinSettingUser(null);
      setNewPin('');
      
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">
            Manage system users and their permissions
          </p>
        </div>
        {hasPermission('user-management', 'create') && (
          <button
            onClick={handleAddUser}
            className="bg-brand hover:bg-brand-600 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name, username, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        }}
        onRotateUnit={(user) => {
          setRotatingUser(user);
          setNewDepartment(user.department || '');
        }}
        hasEditPermission={hasPermission('user-management', 'edit')}
      />

      {/* Set PIN Modal */}
      {pinSettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold flex items-center text-gray-900">
                <KeyRound className="w-5 h-5 mr-2 text-indigo-600" /> Set Access PIN
              </h3>
              <button 
                onClick={() => setPinSettingUser(null)} 
                className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPin} className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Set a 4-digit PIN for <strong>{pinSettingUser.name}</strong>. Staff will use this PIN to access their unit dashboard.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  autoFocus
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-[0.5em] py-3 border"
                  placeholder="••••"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPinSettingUser(null)}
                  className="bg-white px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newPin.length !== 4}
                  className="bg-indigo-600 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rotate Unit Modal */}
      {rotatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold flex items-center text-gray-900">
                <RefreshCw className="w-5 h-5 mr-2 text-emerald-600" /> Rotate Unit
              </h3>
              <button 
                onClick={() => setRotatingUser(null)} 
                className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRotateUnit} className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Move <strong>{rotatingUser.name}</strong> from <span className="font-semibold">{rotatingUser.department}</span> to a new department.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Department</label>
                <select
                  required
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 py-3 px-4 border"
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
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRotatingUser(null)}
                  className="bg-white px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDepartment || newDepartment === rotatingUser.department}
                  className="bg-emerald-600 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Rotate Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
