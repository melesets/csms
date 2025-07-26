import React, { useState, useEffect } from 'react';
import { User, DEPARTMENTS } from '../../types/auth';

interface UserFormProps {
  user: User | null;
  onSave: (userData: Omit<User, 'id' | 'lastLogin'>) => void;
  onCancel: () => void;
}

export const UserForm: React.FC<UserFormProps> = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user' as 'admin' | 'user',
    department: 'NICU' as string,
    isActive: true
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: user.password,
        name: user.name,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const getPermissionsForRole = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      return [
        { module: 'dashboard', actions: ['view'] },
        { module: 'isbar', actions: ['view', 'create', 'edit', 'delete'] },
        { module: 'staff', actions: ['view', 'create', 'edit', 'delete'] },
        { module: 'resources', actions: ['view', 'create', 'edit', 'delete'] },
        { module: 'database', actions: ['view', 'export'] },
        { module: 'trends', actions: ['view'] },
        { module: 'form-builder', actions: ['view', 'create', 'edit', 'delete'] },
        { module: 'user-management', actions: ['view', 'create', 'edit', 'delete'] }
      ];
    } else {
      return [
        { module: 'dashboard', actions: ['view'] },
        { module: 'isbar', actions: ['view', 'create'] },
        { module: 'staff', actions: ['view', 'create'] },
        { module: 'resources', actions: ['view', 'create', 'edit'] },
        { module: 'database', actions: ['view'] },
        { module: 'trends', actions: ['view'] }
      ];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userData = {
      ...formData,
      permissions: getPermissionsForRole(formData.role)
    };
    
    onSave(userData);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {user ? 'Edit User' : 'Add New User'}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="user">Department User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department *
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={formData.role === 'admin'}
            >
              {formData.role === 'admin' ? (
                <option value="All">All Departments</option>
              ) : (
                DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Active User
            </label>
          </div>
        </div>

        {/* Permissions Preview */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Permissions for {formData.role === 'admin' ? 'Administrator' : 'Department User'}:
          </h4>
          <div className="flex flex-wrap gap-2">
            {getPermissionsForRole(formData.role).map((permission, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {permission.module}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {user ? 'Update' : 'Create'} User
          </button>
        </div>
      </form>
    </div>
  );
};