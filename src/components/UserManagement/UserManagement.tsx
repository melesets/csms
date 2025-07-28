import React, { useState } from 'react';
import { Users, Plus, Shield, Search, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/auth';
import { defaultUsers } from '../../data/defaultUsers';
import { UserForm } from './UserForm';
import { UserList } from './UserList';
  const handleDeleteUser = (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    fetch(`/api/users/${userId}`, { method: 'DELETE' })
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result && result.success) {
          setUsers((prev: User[]) => prev.filter((u: User) => u.id !== userId));
          showSuccessMessage('User deleted successfully!');
        }
      });
  };

export const UserManagement = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  // Fetch users from backend on mount
  React.useEffect(() => {
    fetch('/api/users')
      .then(res => res.ok ? res.json() : [])
      .then(data => setUsers(data || []));
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
    if (editingUser) {
      // Update user in backend
      fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
        .then(res => res.ok ? res.json() : null)
        .then(updatedUser => {
          if (updatedUser) {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            showSuccessMessage('User updated successfully!');
          }
        });
    } else {
      // Create user in backend
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
        .then(res => res.ok ? res.json() : null)
        .then(newUser => {
          if (newUser) {
            setUsers(prev => [newUser, ...prev]);
            showSuccessMessage('User created successfully!');
          }
        });
    }
    setShowForm(false);
    setEditingUser(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleToggleUserStatus = (userId: string) => {
    // Toggle user status in backend
    const user = users.find(u => u.id === userId);
    if (!user) return;
    fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, isActive: !user.isActive })
    })
      .then(res => res.ok ? res.json() : null)
      .then(updatedUser => {
        if (updatedUser) {
          setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        }
      });
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
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
            onClick={() => {
              setShowForm(true);
              setEditingUser(null);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
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
          user={editingUser}
          onSave={handleSaveUser}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Users List */}
      <UserList
        users={filteredUsers}
        currentUser={currentUser}
        onEdit={handleEditUser}
        onToggleStatus={handleToggleUserStatus}
        onDelete={handleDeleteUser}
        hasEditPermission={hasPermission('user-management', 'edit')}
      />
    </div>
  );
};