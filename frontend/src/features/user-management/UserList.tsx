// User list - table view of all users with actions
import React, { useState } from 'react';
import { Edit2, Trash2, UserCheck, UserX, Shield, User as UserIcon, KeyRound, RefreshCw, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { User } from '../../types/auth';

interface UserListProps {
  users: User[];
  currentUser: User | null;
  onEdit: (user: User) => void;
  onToggleStatus: (userId: string) => void;
  onDelete: (userId: string) => void;
  onSetPin: (user: User) => void;
  onRotateUnit: (user: User) => void;
  onAddStaff?: (parentUserId: string) => void;
  hasEditPermission: boolean;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  currentUser,
  onEdit,
  onToggleStatus,
  onDelete,
  onSetPin,
  onRotateUnit,
  onAddStaff,
  hasEditPermission
}) => {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'superadmin':
        return <Shield className="w-4 h-4 text-purple-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'staff':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'superadmin':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'admin':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'staff':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-600 border border-gray-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
  };

  // Check if a user is the hardcoded limited admin
  const isLimitedAdmin = (user: User) => user.id === 'limited-admin-local';

  const getShiftBaseLabel = (user: User) => {
    if (user.role !== 'user') return null;
    const base = user.shiftType || '8H';
    const map: Record<string, string> = {
      '4H': '4-Hour (6/day)', '8H': '8-Hour (3/day)', '12H': '12-Hour (2/day)',
      '24H': '24-Hour', '36H': '36-Hour', '48H': '48-Hour', '72H': '72-Hour',
    };
    return map[base] || base;
  };

  // Separate users by role for nested display
  // Parent users: role='user' (service units)
  // Staff: role='staff' with parentUserId
  // Others: superadmin, admin, viewer
  const parentUsers = users.filter(u => u.role === 'user');
  const staffUsers = users.filter(u => u.role === 'staff');
  const otherUsers = users.filter(u => u.role !== 'user' && u.role !== 'staff');

  // Get staff for a specific parent user
  const getStaffForParent = (parentId: string) => {
    return staffUsers.filter(s => String(s.parentUserId) === String(parentId));
  };

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const renderActions = (user: User) => {
    if (!hasEditPermission) return null;
    return (
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-1">
          {user.role === 'user' && onAddStaff && (
            <button
              onClick={() => onAddStaff(user.id)}
              className="text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
              title="Add Staff to this Service Unit"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onSetPin(user)}
            className={`${isLimitedAdmin(user) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-[#003153] hover:bg-gray-100'} p-1.5 rounded-lg transition-colors`}
            disabled={!hasEditPermission || isLimitedAdmin(user)}
            title={isLimitedAdmin(user) ? 'Limited admin PIN cannot be changed' : 'Set Unit Access PIN'}
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRotateUnit(user)}
            className={`${isLimitedAdmin(user) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'} p-1.5 rounded-lg transition-colors`}
            disabled={!hasEditPermission || isLimitedAdmin(user)}
            title={isLimitedAdmin(user) ? 'Limited admin cannot be rotated' : 'Rotate Unit (Change Department)'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(user)}
            className={`${isLimitedAdmin(user) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-[#003153] hover:bg-gray-100'} p-1.5 rounded-lg transition-colors`}
            disabled={!hasEditPermission || isLimitedAdmin(user)}
            title={isLimitedAdmin(user) ? 'Limited admin cannot be edited' : 'Edit user'}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleStatus(user.id)}
            className={`${isLimitedAdmin(user) ? 'text-gray-300 cursor-not-allowed' : user.isActive ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'} p-1.5 rounded-lg transition-colors`}
            disabled={!hasEditPermission || isLimitedAdmin(user)}
            title={isLimitedAdmin(user) ? 'Limited admin status cannot be changed' : user.isActive ? 'Deactivate user' : 'Activate user'}
          >
            {user.isActive ? (
              <UserX className="w-4 h-4" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onDelete(user.id)}
            className={`${isLimitedAdmin(user) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'} p-1.5 rounded-lg transition-colors`}
            disabled={!hasEditPermission || isLimitedAdmin(user)}
            title={isLimitedAdmin(user) ? 'Limited admin cannot be deleted' : 'Delete user'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    );
  };

  const renderUserRow = (user: User, isStaffRow = false) => {
    const childStaff = user.role === 'user' ? getStaffForParent(user.id) : [];
    const isExpanded = expandedUsers.has(user.id);
    const hasChildren = childStaff.length > 0;

    return (
      <React.Fragment key={user.id}>
        <tr className={`hover:bg-gray-50 ${isStaffRow ? 'bg-gray-50/50' : ''}`}>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              {isStaffRow && <div className="w-8" />}
              {user.role === 'user' && hasChildren && (
                <button
                  onClick={() => toggleExpand(user.id)}
                  className="mr-1 p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              )}
              {user.role === 'user' && !hasChildren && <div className="w-6" />}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${isStaffRow ? 'bg-blue-50' : 'bg-gray-100'}`}>
                {getRoleIcon(user.role)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    {user.name}
                    {isLimitedAdmin(user) && (
                      <Shield className="w-3 h-3 ml-1 text-purple-600" />
                    )}
                    {currentUser?.id === user.id && (
                      <span className="ml-2 text-xs text-blue-600">(You)</span>
                    )}
                    {isStaffRow && (
                      <span className="ml-2 text-[10px] text-blue-500 font-normal">staff</span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500">{user.username}</div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeColor(user.role)}`}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {user.department}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {getShiftBaseLabel(user) || user.profession || '—'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center">
              {user.isActive ? (
                <>
                  <UserCheck className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-sm text-green-700">Active</span>
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-sm text-red-700">Inactive</span>
                </>
              )}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {user.createdAt ? new Date(new Date(user.createdAt).getTime() + 3 * 3600 * 1000).toLocaleDateString() : 'N/A'}
          </td>
          {hasEditPermission && renderActions(user)}
        </tr>
        {/* Render nested staff when expanded */}
        {isExpanded && childStaff.map(staff => renderUserRow(staff, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">
          Users ({parentUsers.length + otherUsers.length}) | Staff ({staffUsers.length})
        </h3>
        <div className="text-xs text-gray-400 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Super Admin</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-red-600" />
            <span>Admin</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>User</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Staff</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shift Base / Profession
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              {hasEditPermission && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Render superadmin and admin users first */}
            {otherUsers.map(user => renderUserRow(user))}
            {/* Then render parent users (role='user') with expandable staff */}
            {parentUsers.map(user => renderUserRow(user))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a new user.
          </p>
        </div>
      )}
    </div>
  );
};
