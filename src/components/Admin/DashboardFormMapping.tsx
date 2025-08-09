import React, { useState, useEffect } from 'react';
import IsbarLoader from '../IsbarLoader';
import { Save, Plus, Trash2, Settings, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { PROFESSIONS } from '../../types/auth';

// Default departments to always include in the selector
const DEFAULT_DEPARTMENTS: string[] = [
  'NICU',
  'ICU',
  'Medical Ward',
  'Pediatrics Ward',
  'Gyni Ward',
  'Surgical Ward',
  'OB',
  'TFU',
  'AEOP',
  'PEOPD',
  'Recovery'
];

interface FormTemplate {
  id: string;
  name: string;
  department: string;
  fields: any[];
  sections: any[];
  is_active: boolean;
}

interface DashboardMapping {
  id?: string;
  formTemplateId: string;
  formTemplateName: string;
  department: string;
  departments?: string[];
  profession?: string;
  dashboardType: 'patient' | 'resource';
  displayName: string;
  identifier?: string;
  cardFields: {
    primary: string;    // Main identifier (e.g., patient name, resource name)
    secondary: string;  // Secondary info (e.g., MRN, resource type)
    status: string;     // Status field (e.g., stability, stock level)
    identifier: string; // Unique identifier (e.g., bed number, resource ID)
    nurse?: string;     // Nurse name field (optional)
    extraFields?: string[]; // optional highlights
    statusValueMap?: Record<string, string>; // optional status mapping
  };
  groupByField: string; // Field to group records by (e.g., patient MRN, resource category)
  isEnabled: boolean;
  sortOrder: number;
}

export const DashboardFormMapping: React.FC = () => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [mappings, setMappings] = useState<DashboardMapping[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [editingMapping, setEditingMapping] = useState<DashboardMapping | null>(null);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const allDepartments = React.useMemo(() => {
    const set = new Set<string>();
    // Include defaults first so they are always present
    DEFAULT_DEPARTMENTS.forEach((d) => d && set.add(d));
    (departments || []).forEach(d => d && set.add(d));
    (templates || []).forEach(t => t.department && set.add(t.department));
    (mappings || []).forEach((m: any) => {
      if (m.department) set.add(m.department);
      const arr = (m as any).departments;
      if (Array.isArray(arr)) arr.forEach((d: string) => d && set.add(d));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, templates, mappings]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, mappingsRes, departmentsRes] = await Promise.all([
        fetch('/api/form-templates'),
        fetch('/api/dashboard-mappings'),
        fetch('/api/departments')
      ]);

      const templatesData = templatesRes.ok ? await templatesRes.json() : [];
      const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];
      const departmentsData = departmentsRes.ok ? await departmentsRes.json() : [];

      // Parse template fields
      const parsedTemplates = templatesData.map((template: any) => ({
        ...template,
        fields: typeof template.fields === 'string' ? JSON.parse(template.fields) : (template.fields || []),
        sections: template.sections === null ? [] : (typeof template.sections === 'string' ? JSON.parse(template.sections) : (template.sections || []))
      }));

      setTemplates(parsedTemplates);
      setMappings(mappingsData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = (template: FormTemplate) => {
    const newMapping: DashboardMapping = {
      formTemplateId: template.id,
      formTemplateName: template.name,
      department: template.department,
      profession: '',
      dashboardType: 'patient',
      displayName: template.name,
      cardFields: {
        primary: '',
        secondary: '',
        status: '',
        identifier: '',
        nurse: ''
      },
      groupByField: '',
      isEnabled: true,
      sortOrder: mappings.length + 1,
      departments: template.department ? [template.department] : []
    };
    setEditingMapping(newMapping);
    setSelectedTemplate(template);
    setShowMappingForm(true);
  };

  const handleEditMapping = (mapping: DashboardMapping | any) => {
    // Normalize mapping object to expected camelCase shape for editing
    const normalized: DashboardMapping = {
      id: mapping.id,
      formTemplateId: mapping.formTemplateId || mapping.form_template_id,
      formTemplateName: mapping.formTemplateName || mapping.form_template_name,
      department: mapping.department,
      departments: (mapping as any).departments || [],
      profession: mapping.profession || '',
      identifier: (mapping as any).identifier || '',
      dashboardType: mapping.dashboardType || mapping.dashboard_type,
      displayName: mapping.displayName || mapping.display_name || mapping.formTemplateName || mapping.form_template_name || '',
      cardFields: mapping.cardFields || mapping.card_fields || { primary: '', secondary: '', status: '', identifier: '' },
      groupByField: mapping.groupByField || mapping.group_by_field || '',
      isEnabled: typeof mapping.isEnabled === 'boolean' ? mapping.isEnabled : (typeof mapping.is_enabled === 'boolean' ? mapping.is_enabled : true),
      sortOrder: mapping.sortOrder ?? mapping.sort_order ?? 0,
    };

    const template = templates.find(t => String(t.id) === String(normalized.formTemplateId));
    if ((!normalized.departments || normalized.departments.length === 0) && normalized.department) {
      normalized.departments = [normalized.department];
    }
    setEditingMapping(normalized);
    setSelectedTemplate(template || null);
    setShowMappingForm(true);
  };

  const handleSaveMapping = async () => {
    if (!editingMapping) return;

    try {
      const method = editingMapping.id ? 'PUT' : 'POST';
      const url = editingMapping.id 
        ? `/api/dashboard-mappings/${editingMapping.id}`
        : '/api/dashboard-mappings';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMapping)
      });

      if (response.ok) {
        await fetchData();
        setShowMappingForm(false);
        setEditingMapping(null);
        setSelectedTemplate(null);
        alert('Dashboard mapping saved successfully!');
      } else {
        alert('Error saving mapping');
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      alert('Error saving mapping');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this dashboard mapping?')) return;

    try {
      const response = await fetch(`/api/dashboard-mappings/${mappingId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchData();
        alert('Mapping deleted successfully!');
      } else {
        alert('Error deleting mapping');
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Error deleting mapping');
    }
  };

  const toggleMappingStatus = async (mapping: DashboardMapping) => {
    const updatedMapping = { ...mapping, isEnabled: !mapping.isEnabled };
    
    try {
      const response = await fetch(`/api/dashboard-mappings/${mapping.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMapping)
      });

      if (response.ok) {
        await fetchData();
      } else {
        alert('Error updating mapping status');
      }
    } catch (error) {
      console.error('Error updating mapping status:', error);
      alert('Error updating mapping status');
    }
  };

  const getFieldOptions = (template: FormTemplate) => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    (template.fields || []).forEach((field: any) => {
      const value = field?.name || field?.id || '';
      const label = field?.label || field?.name || field?.id || 'Unnamed Field';
      if (value && !seen.has(value)) {
        options.push({ value, label });
        seen.add(value);
      }

      if (field?.fields && Array.isArray(field.fields)) {
        field.fields.forEach((subField: any) => {
          const sv = subField?.name || subField?.id || '';
          const sl = `${label} > ${subField?.label || subField?.name || subField?.id || 'Subfield'}`;
          if (sv && !seen.has(sv)) {
            options.push({ value: sv, label: sl });
            seen.add(sv);
          }
        });
      }
    });

    return options;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IsbarLoader message="Loading form mappings..." size={72} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Form Mapping</h2>
          <p className="text-gray-600 mt-1">
            Configure which forms appear on user dashboards and how they're displayed
          </p>
        </div>
      </div>

      {/* Current Mappings */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Dashboard Mappings</h3>
        
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No dashboard mappings configured yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ((mapping.dashboardType || (mapping as any).dashboard_type) === 'patient') 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {(mapping.dashboardType || (mapping as any).dashboard_type || 'unknown').toString().toUpperCase()}
                      </span>
                      <h4 className="font-medium text-gray-900">{mapping.displayName}</h4>
                      <span className="text-sm text-gray-500">({mapping.department}{(mapping as any).departments && (mapping as any).departments.length ? ` + ${((mapping as any).departments || []).length} more` : ''})</span>
                      {(mapping as any).identifier && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {(mapping as any).identifier}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {(mapping as any).profession ? (mapping as any).profession : 'All'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Primary:</span> {(mapping.cardFields?.primary || (mapping as any).card_fields?.primary || '')} • 
                      <span className="font-medium ml-2">Group By:</span> {(mapping.groupByField || (mapping as any).group_by_field || '')}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleMappingStatus(mapping)}
                      className={`p-2 rounded-lg transition-colors ${
                        mapping.isEnabled 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={mapping.isEnabled ? 'Disable' : 'Enable'}
                    >
                      {mapping.isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleEditMapping(mapping)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit mapping"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMapping(mapping.id!)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete mapping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Templates */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Active Form Templates</h3>
        
        <div className="space-y-3">
          {templates.filter(t => t.is_active).map((template) => {
            const hasMapping = mappings.some(m => m.formTemplateId === template.id);
            const isExpanded = expandedTemplate === template.id;
            
            return (
              <div key={template.id} className="border border-gray-200 rounded-lg">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-500">
                          {template.department} • {template.fields.length} fields
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {hasMapping && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Mapped
                        </span>
                      )}
                      <button
                        onClick={() => handleCreateMapping(template)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Create Mapping
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Available Fields:</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {template.fields.map((field) => (
                          <div key={field.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {field.label} ({field.type})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mapping Form Modal */}
      {showMappingForm && editingMapping && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configure Dashboard Mapping
            </h3>
            
            <div className="space-y-4">
              {/* Basic Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editingMapping.displayName}
                    onChange={(e) => setEditingMapping({
                      ...editingMapping,
                      displayName: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Identifier (e.g., ISBAR, Round, Resource, Analysis)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter an identifier tag"
                    value={editingMapping.identifier || ''}
                    onChange={(e) => setEditingMapping({
                      ...editingMapping,
                      identifier: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    list="identifier-suggestions"
                  />
                  <datalist id="identifier-suggestions">
                    <option value="ISBAR" />
                    <option value="Round" />
                    <option value="Resource" />
                    <option value="Analysis" />
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">Use this to tag mappings and target sections on the dashboard.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dashboard Type
                  </label>
                  <select
                    value={editingMapping.dashboardType}
                    onChange={(e) => setEditingMapping({
                      ...editingMapping,
                      dashboardType: e.target.value as 'patient' | 'resource'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="patient">Patient Handover</option>
                    <option value="resource">Resource Handover</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profession (optional)
                  </label>
                  <select
                    value={(editingMapping as any).profession || ''}
                    onChange={(e) => setEditingMapping({
                      ...editingMapping,
                      profession: e.target.value
                    } as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    {PROFESSIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">If set, this form mapping will appear only for the selected profession within the department.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Department
                  </label>
                  <select
                    value={editingMapping.department || ''}
                    onChange={(e) => {
                      const dep = e.target.value;
                      const current = editingMapping.departments || [];
                      const next = dep ? (current.includes(dep) ? current : [dep, ...current]) : current;
                      setEditingMapping({ ...editingMapping, department: dep, departments: next });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select department...</option>
                    {allDepartments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Primary department is required; it is used when multi-select is empty.</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departments (multi-select)
                  </label>
                  <select
                    multiple
                    value={(editingMapping.departments || [])}
                    onChange={(e) => {
                      const values = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
                      // Ensure primary department remains first in the list
                      const primary = editingMapping.department;
                      const rest = values.filter(v => v !== primary);
                      const next = primary ? [primary, ...rest] : values;
                      setEditingMapping({ ...editingMapping, departments: next });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                  >
                    {allDepartments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select one or more departments to apply this mapping. The first selected will be used as the primary department.</p>
                </div>
              </div>

              {/* Field Mappings */}
              <div className="space-y-3">
                 <h4 className="text-sm font-semibold text-gray-900">Card Field Mappings</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Field (Main Title)
                    </label>
                    <select
                      value={editingMapping.cardFields.primary}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...editingMapping.cardFields, primary: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Field (Subtitle)
                    </label>
                    <select
                      value={editingMapping.cardFields.secondary}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...editingMapping.cardFields, secondary: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status Field (Badge)
                    </label>
                    <select
                      value={editingMapping.cardFields.status}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...editingMapping.cardFields, status: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identifier Field (Bed/ID)
                    </label>
                    <select
                      value={editingMapping.cardFields.identifier}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...editingMapping.cardFields, identifier: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nurse Name Field
                    </label>
                    <select
                      value={(editingMapping.cardFields as any).nurse || ''}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...editingMapping.cardFields, nurse: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Optional: choose the form field that holds the nurse's name.</p>
                  </div>
                </div>
              </div>

              {/* Group By Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Records By Field
                </label>
                <select
                  value={editingMapping.groupByField}
                  onChange={(e) => setEditingMapping({
                    ...editingMapping,
                    groupByField: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select field...</option>
                  {getFieldOptions(selectedTemplate).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Records will be grouped by this field (e.g., patient MRN, resource category)
                </p>
              </div>

              {/* Advanced Options */}
              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900">Advanced Options</h4>

                {/* Highlights (extraFields) */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Highlights (show these fields in expanded card)
                  </label>
                  <select
                    multiple
                    value={(editingMapping.cardFields as any)?.extraFields || []}
                    onChange={(e) => {
                      const values = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
                      setEditingMapping({
                        ...editingMapping,
                        cardFields: { ...(editingMapping.cardFields || {}), extraFields: values }
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                  >
                    {getFieldOptions(selectedTemplate).map((option, idx) => (
                      <option key={`${option.value}-${idx}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl (Windows) or Cmd (Mac) to select multiple fields.
                  </p>
                </div>

                {/* Status Value Mapping */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Status Value Mapping (map dropdown values to badge state)
                    </label>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const defaults = { Critical: 'critical', Subcritical: 'unstable', Stable: 'stable' } as Record<string, string>;
                          setEditingMapping({
                            ...editingMapping,
                            cardFields: { ...(editingMapping.cardFields || {}), statusValueMap: defaults }
                          });
                        }}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Apply Defaults
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = ((editingMapping.cardFields as any)?.statusValueMap || {}) as Record<string, string>;
                          const newKey = `Custom Value ${Object.keys(current).length + 1}`;
                          const next = { ...current, [newKey]: 'stable' } as Record<string, string>;
                          setEditingMapping({
                            ...editingMapping,
                            cardFields: { ...(editingMapping.cardFields || {}), statusValueMap: next }
                          });
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Add Row
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries((((editingMapping.cardFields as any)?.statusValueMap) || {}) as Record<string, string>).map(([k, v], idx) => (
                      <div key={`${k}-${idx}`} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={k}
                          onChange={(e) => {
                            const current = { ...((((editingMapping.cardFields as any)?.statusValueMap) || {}) as Record<string, string>) };
                            const val = current[k];
                            delete current[k];
                            current[e.target.value] = val;
                            setEditingMapping({
                              ...editingMapping,
                              cardFields: { ...(editingMapping.cardFields || {}), statusValueMap: current }
                            });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Dropdown value (e.g., Critical)"
                        />
                        <select
                          value={v}
                          onChange={(e) => {
                            const current = { ...((((editingMapping.cardFields as any)?.statusValueMap) || {}) as Record<string, string>) };
                            current[k] = e.target.value;
                            setEditingMapping({
                              ...editingMapping,
                              cardFields: { ...(editingMapping.cardFields || {}), statusValueMap: current }
                            });
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="critical">Critical (red)</option>
                          <option value="unstable">Subcritical/Unstable (yellow)</option>
                          <option value="stable">Stable (green)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const current = { ...((((editingMapping.cardFields as any)?.statusValueMap) || {}) as Record<string, string>) };
                            delete current[k];
                            setEditingMapping({
                              ...editingMapping,
                              cardFields: { ...(editingMapping.cardFields || {}), statusValueMap: current }
                            });
                          }}
                          className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {Object.keys((((editingMapping.cardFields as any)?.statusValueMap) || {}) as Record<string, string>).length === 0 && (
                      <div className="text-xs text-gray-500">No value mappings yet. Click "Apply Defaults" or "Add Row" to begin.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowMappingForm(false);
                  setEditingMapping(null);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};