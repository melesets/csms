import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Search, UserCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Staff } from '../../types';

export const DepartmentStaffManagement = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch staff from backend on mount
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/department-staff');
        if (res.ok) {
          const data = await res.json();
          setStaff(data);
        }
      } catch (err) {
        // Optionally handle error
      }
    };
    fetchStaff();
  }, []);

  // Filter staff by department for non-admin users
  const filteredStaff = staff.filter(member => {
    const matchesDepartment = user?.role === 'admin' || member.department === user?.department;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

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
    const staffData = {
      ...formData,
      department: user?.department || 'General'
    };
    if (editingStaff) {
      // Update staff
      const res = await fetch(`/api/department-staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData),
      });
      if (res.ok) {
        // Refetch staff list after update
        const updatedRes = await fetch('/api/department-staff');
        if (updatedRes.ok) {
          const updatedList = await updatedRes.json();
          setStaff(updatedList);
        }
      }
    } else {
      // Create staff
      const res = await fetch('/api/department-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData),
      });
      if (res.ok) {
        // Refetch staff list after add
        const updatedRes = await fetch('/api/department-staff');
        if (updatedRes.ok) {
          const updatedList = await updatedRes.json();
          setStaff(updatedList);
        }
      }
    }
    setFormData({
      name: '',
      role: '',
      department: user?.department || 'General'
    });
    setShowForm(false);
    setEditingStaff(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      role: staffMember.role,
      department: staffMember.department
    });
    setShowForm(true);
  };

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Department Staff Management</h2>
        <p className="text-gray-600 mt-1">
          Manage nursing staff for {user?.role === 'admin' ? 'all departments' : user?.department}
        </p>
      </div>
      <button
        onClick={() => {
          setShowForm(true);
          setEditingStaff(null);
          setFormData({
            name: '',
            role: '',
            department: user?.department || 'General'
          });
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Staff Member
      </button>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <p className="text-green-800">Staff member {editingStaff ? 'updated' : 'added'} successfully!</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-6">
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

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
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
                  Role/Position *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select...</option>
                  <option value="Nurse">Nurse</option>
                  <option value="Shift Focal">Shift Focal</option>
                  <option value="Head Nurse">Head Nurse</option>
                  <option value="Midwife">Midwife</option>
                  <option value="Head Midwife">Head Midwife</option>
                  <option value="GP">GP</option>
                  <option value="GP Coordinator">GP Coordinator</option>
                  <option value="Senior">Senior</option>
                  <option value="Department Head">Department Head</option>
                </select>
              </div>


              {user?.department !== 'All' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={user?.department || 'General'}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingStaff ? 'Update' : 'Add'} Staff Member
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Current Staff ({filteredStaff.length})
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
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <UserCheck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.department}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.department}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(member)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No staff members found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new staff member.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};