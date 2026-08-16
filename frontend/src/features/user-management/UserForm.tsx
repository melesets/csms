// User form - create/edit user with role and permission settings
import React, { useState } from 'react';
import { User, PROFESSIONS } from '../../types/auth';
import { X } from 'lucide-react';
import { getUniqueModules } from '../../config/pages';

// Normalize legacy shift types (TID=8h, BID=12h) to canonical shift base values
const normalizeShiftType = (value?: string): string => {
  if (!value) return '8H';
  if (value === 'TID') return '8H';
  if (value === 'BID') return '12H';
  return value;
};

const SHIFT_BASE_OPTIONS = [
  { value: '4H', label: '4-Hour / 6 Shifts per day' },
  { value: '8H', label: '8-Hour / 3 Shifts per day' },
  { value: '12H', label: '12-Hour / 2 Shifts per day' },
  { value: '24H', label: '24-Hour Shift' },
  { value: '36H', label: '36-Hour On-Call' },
  { value: '48H', label: '48-Hour On-Call' },
  { value: '72H', label: '72-Hour On-Call' },
];

interface UserFormProps {
  user: User | null;
  onSave: (userData: Omit<User, 'id' | 'lastLogin'>) => void;
  onCancel: () => void;
  allUsers: User[];
  lockDepartment?: boolean;
}

export const UserForm: React.FC<UserFormProps> = ({ user, onSave, onCancel, allUsers, lockDepartment }) => {
  // Derive unique departments from "user" role accounts
  const departments = Array.from(new Set(
    allUsers
      .filter(u => u.role === 'user' && u.department)
      .map(u => u.department)
  )).sort();

  // Available parent users (role='user' accounts that can have staff under them)
  const availableParentUsers = allUsers.filter(u => u.role === 'user' && u.isActive);

  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'user',
    department: user?.department || '',
    profession: user?.profession || 'Nurse',
    isActive: user?.isActive ?? true,
    permissions: user?.permissions || [],
    shiftType: normalizeShiftType((user as any)?.shiftType),
    pin: '',
    removePin: false,
    parentUserId: user?.parentUserId || null,
  });

  const AVAILABLE_MODULES = getUniqueModules();

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!user && !formData.password.trim()) {
      newErrors.password = 'Password is required for new users';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.department.trim()) {
      newErrors.department = 'Department is required';
    }
    if (!formData.profession?.trim()) {
      newErrors.profession = 'Profession is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Ensure all selected modules have a 'view' action at minimum
      const formattedPermissions = formData.permissions;
      onSave({ ...formData, permissions: formattedPermissions, parentUserId: formData.parentUserId } as any);
    }
  };

  const handlePermissionToggle = (moduleId: string) => {
    setFormData((prev: any) => {
      const exists = prev.permissions.find((p: any) => p.module === moduleId);
      if (exists) {
        return {
          ...prev,
          permissions: prev.permissions.filter((p: any) => p.module !== moduleId)
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { module: moduleId, actions: ['view', 'create', 'edit', 'delete'] }]
        };
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.username ? 'border-red-500' : 'border-gray-200'
                }`}
              required
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password {!user && '*'}
            </label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.password ? 'border-red-500' : 'border-gray-200'
                }`}
              placeholder={user ? 'Leave blank to keep current password' : ''}
              required={!user}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kiosk PIN (4 digits)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="pin"
                maxLength={4}
                value={formData.pin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData((prev: any) => ({ ...prev, pin: val }));
                }}
                disabled={formData.removePin}
                className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formData.removePin ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}
                placeholder={user ? ((user as any).has_pin ? 'Leave blank to keep current PIN' : 'Add a 4-digit PIN') : 'Optional 4-digit PIN'}
              />
              {user && (user as any).has_pin && (
                <button
                  type="button"
                  onClick={() => setFormData((prev: any) => ({ ...prev, removePin: !prev.removePin, pin: '' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${formData.removePin ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  title={formData.removePin ? "Will remove user's PIN" : "Remove PIN entirely"}
                >
                  {formData.removePin ? 'Removing PIN' : 'Remove PIN'}
                </button>
              )}
            </div>
            {formData.pin && formData.pin.length !== 4 && <p className="text-amber-500 text-[10px] mt-1 font-bold">PIN must be exactly 4 digits</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-200'
                }`}
              required
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.email ? 'border-red-500' : 'border-gray-200'
                }`}
              required
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="user">User (Service Unit)</option>
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
              <option value="superadmin">Super Administrator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Parent User - only shown when role is 'staff' */}
          {formData.role === 'staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent User (Service Unit) *
              </label>
              <select
                name="parentUserId"
                value={formData.parentUserId || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, parentUserId: e.target.value || null }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Parent User...</option>
                {availableParentUsers.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name} ({parent.department})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1 italic">
                This staff member will be nested under the selected service unit.
              </p>
            </div>
          )}

          {formData.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Base (Cycle) *
              </label>
              <select
                name="shiftType"
                value={formData.shiftType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {SHIFT_BASE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1 italic">
                Determines how the system calculates the shift name, duration, and auto check-out for all staff in this department.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department *
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              list="department-list"
              placeholder="Type or select department"
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.department ? 'border-red-500' : 'border-gray-200'
                } ${lockDepartment ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              required
              disabled={lockDepartment}
            />
            <datalist id="department-list">
              {departments.map((dept) => (
                <option key={dept} value={dept} />
              ))}
            </datalist>
            {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Professionals *
            </label>
            <select
              name="profession"
              value={formData.profession}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.profession ? 'border-red-500' : 'border-gray-200'
                }`}
              required
            >
              {PROFESSIONS.map(prof => (
                <option key={prof} value={prof}>{prof}</option>
              ))}
              <option value="Admin">Admin</option>
            </select>
            {errors.profession && <p className="text-red-500 text-xs mt-1">{errors.profession}</p>}
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="isActive"
            id="isActive"
            checked={formData.isActive}
            onChange={handleInputChange}
            className="h-4 w-4 text-[#003153] focus:ring-[#003153] border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 font-medium">
            Active User
          </label>
        </div>

        {/* Page Access Permissions */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Page Access Permissions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {AVAILABLE_MODULES.map((module) => (
              <label key={module.id} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.permissions.some((p: any) => p.module === module.id)}
                  onChange={() => handlePermissionToggle(module.id)}
                  className="h-4 w-4 text-[#003153] focus:ring-[#003153] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 group-hover:text-[#003153] transition-colors">
                  {module.label}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Note: Administrators usually have full access even if not checked here.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#003153] hover:bg-[#002640] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {user ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
