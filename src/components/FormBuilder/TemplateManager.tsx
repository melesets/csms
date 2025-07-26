import React, { useState } from 'react';
import { Search, Filter, Eye, Edit2, Trash2, ToggleLeft, ToggleRight, Settings, FileText } from 'lucide-react';
import { FormTemplate } from '../../types/formBuilder';
import { DEPARTMENTS } from '../../types/auth';

interface TemplateManagerProps {
  templates: FormTemplate[];
  onEdit: (template: FormTemplate) => void;
  onPreview: (template: FormTemplate) => void;
  onDelete: (templateId: string) => void;
  onToggleActive: (templateId: string) => void;
  userRole: string;
  userDepartment: string;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onEdit,
  onPreview,
  onDelete,
  onToggleActive,
  userRole,
  userDepartment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Filter templates based on user permissions and search criteria
  const filteredTemplates = templates.filter(template => {
    const matchesDepartment = userRole === 'admin' || template.department === userDepartment;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDeptFilter = filterDepartment === 'All' || template.department === filterDepartment;
    const matchesStatus = filterStatus === 'All' || 
                         (filterStatus === 'Active' && template.isActive) ||
                         (filterStatus === 'Inactive' && !template.isActive);
    
    return matchesDepartment && matchesSearch && matchesDeptFilter && matchesStatus;
  });

  const getDepartmentColor = (department: string) => {
    const colors: Record<string, string> = {
      'NICU': 'bg-blue-100 text-blue-800',
      'Surgery': 'bg-purple-100 text-purple-800',
      'Pediatrics': 'bg-green-100 text-green-800',
      'ICU': 'bg-red-100 text-red-800',
      'Emergency': 'bg-orange-100 text-orange-800',
      'Cardiology': 'bg-pink-100 text-pink-800',
      'Oncology': 'bg-indigo-100 text-indigo-800'
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {userRole === 'admin' && (
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Active' | 'Inactive')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          Found {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-500">v{template.version}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {template.isActive ? (
                    <ToggleRight className="w-5 h-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {template.description}
              </p>

              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(template.department)}`}>
                  {template.department}
                </span>
                <span className="text-xs text-gray-500">
                  {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="text-xs text-gray-500 mb-4">
                Created by {template.createdBy} • {new Date(template.createdAt).toLocaleDateString()}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => onPreview(template)}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onToggleActive(template.id)}
                    className={`p-1 rounded ${template.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                    title={template.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {template.isActive ? (
                      <ToggleLeft className="w-4 h-4" />
                    ) : (
                      <ToggleRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => onEdit(template)}
                    className="p-1 text-gray-600 hover:text-gray-800"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => onDelete(template.id)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500">
            {searchTerm || filterDepartment !== 'All' || filterStatus !== 'All'
              ? 'Try adjusting your search criteria or filters.'
              : 'Get started by creating your first form template.'
            }
          </p>
        </div>
      )}
    </div>
  );
};