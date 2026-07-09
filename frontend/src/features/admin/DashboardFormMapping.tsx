// Dashboard form mapping - admin config for form-to-dashboard field mapping
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Settings, Eye, EyeOff, ChevronDown, ChevronRight, Copy, Search, X } from 'lucide-react';
import { PROFESSIONS } from '../../types/auth';
import { useDepartments } from '../../hooks/useDepartments';

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
    primary: string;
    secondary: string;
    status: string;
    identifier: string;
    nurse?: string;
    extraFields?: string[];
    statusValueMap?: Record<string, string>;
  };
  groupByField: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

export const DashboardFormMapping: React.FC = () => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [mappings, setMappings] = useState<DashboardMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMapping, setEditingMapping] = useState<DashboardMapping | null>(null);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [mappingSearch, setMappingSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { departments: remoteDepartments, loading: departmentsLoading } = useDepartments();

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    (remoteDepartments || []).forEach(d => d && set.add(d));
    (templates || []).forEach(t => t.department && set.add(t.department));
    (mappings || []).forEach((m) => {
      if (m.department) set.add(m.department);
      if (Array.isArray(m.departments)) m.departments.forEach(d => d && set.add(d));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [remoteDepartments, templates, mappings]);

  const filteredMappings = useMemo(() => {
    if (!mappingSearch.trim()) return mappings;
    const q = mappingSearch.toLowerCase();
    return mappings.filter(m =>
      m.displayName.toLowerCase().includes(q) ||
      m.formTemplateName.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      (m.identifier || '').toLowerCase().includes(q) ||
      (m.profession || '').toLowerCase().includes(q)
    );
  }, [mappings, mappingSearch]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, mappingsRes] = await Promise.all([
        fetch('/api/form-templates'),
        fetch('/api/dashboard-mappings'),
      ]);

      const templatesData = templatesRes.ok ? await templatesRes.json() : [];
      const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];

      const parsedTemplates = templatesData.map((template: any) => ({
        ...template,
        fields: typeof template.fields === 'string' ? JSON.parse(template.fields) : (template.fields || []),
        sections: template.sections === null ? [] : (typeof template.sections === 'string' ? JSON.parse(template.sections) : (template.sections || []))
      }));

      setTemplates(parsedTemplates);
      setMappings(mappingsData);
    } catch (error) {
      addToast('Error loading data', 'error');
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
      cardFields: { primary: '', secondary: '', status: '', identifier: '', nurse: '' },
      groupByField: '',
      isEnabled: true,
      sortOrder: mappings.length + 1,
      departments: template.department ? [template.department] : []
    };
    setEditingMapping(newMapping);
    setSelectedTemplate(template);
    setValidationErrors([]);
    setShowMappingForm(true);
  };

  const handleCloneMapping = (mapping: DashboardMapping) => {
    const cloned: DashboardMapping = {
      ...mapping,
      id: undefined,
      displayName: `${mapping.displayName} (Copy)`,
      isEnabled: true,
      sortOrder: mappings.length + 1,
    };
    const template = templates.find(t => String(t.id) === String(cloned.formTemplateId));
    setEditingMapping(cloned);
    setSelectedTemplate(template || null);
    setValidationErrors([]);
    setShowMappingForm(true);
  };

  const handleEditMapping = (mapping: DashboardMapping) => {
    const template = templates.find(t => String(t.id) === String(mapping.formTemplateId));
    setEditingMapping({ ...mapping });
    setSelectedTemplate(template || null);
    setValidationErrors([]);
    setShowMappingForm(true);
  };

  const validateMapping = (m: DashboardMapping): string[] => {
    const errors: string[] = [];
    if (!m.displayName?.trim()) errors.push('Display Name is required');
    if (!m.department) errors.push('Primary Department is required');
    if (!m.dashboardType) errors.push('Dashboard Type is required');
    if (!m.cardFields?.primary) errors.push('Primary Field (Main Title) is required');
    return errors;
  };

  const handleSaveMapping = async () => {
    if (!editingMapping) return;
    const errors = validateMapping(editingMapping);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

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
        addToast('Dashboard mapping saved successfully!');
      } else {
        const err = await response.json().catch(() => ({}));
        addToast(err.error || 'Error saving mapping', 'error');
      }
    } catch (error) {
      addToast('Error saving mapping', 'error');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this dashboard mapping?')) return;
    try {
      const response = await fetch(`/api/dashboard-mappings/${mappingId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchData();
        addToast('Mapping deleted successfully!');
      } else {
        addToast('Error deleting mapping', 'error');
      }
    } catch (error) {
      addToast('Error deleting mapping', 'error');
    }
  };

  const toggleMappingStatus = async (mapping: DashboardMapping) => {
    try {
      const response = await fetch(`/api/dashboard-mappings/${mapping.id}/toggle`, { method: 'PATCH' });
      if (response.ok) {
        await fetchData();
      } else {
        addToast('Error updating mapping status', 'error');
      }
    } catch (error) {
      addToast('Error updating mapping status', 'error');
    }
  };

  const getFieldOptions = (template: FormTemplate) => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    (template.fields || []).forEach((field: any) => {
      const value = field?.name || field?.id || '';
      const label = field?.label || field?.name || field?.id || 'Unnamed Field';
      if (value && !seen.has(value)) { options.push({ value, label }); seen.add(value); }
      if (field?.fields && Array.isArray(field.fields)) {
        field.fields.forEach((subField: any) => {
          const sv = subField?.name || subField?.id || '';
          const sl = `${label} > ${subField?.label || subField?.name || subField?.id || 'Subfield'}`;
          if (sv && !seen.has(sv)) { options.push({ value: sv, label: sl }); seen.add(sv); }
        });
      }
    });
    return options;
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-50 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {t.message}
          </div>
        ))}
      </div>

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Dashboard Mappings</h3>
          {mappings.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search mappings..."
                value={mappingSearch}
                onChange={e => setMappingSearch(e.target.value)}
                className="pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent"
              />
              {mappingSearch && (
                <button onClick={() => setMappingSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {filteredMappings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>{mappingSearch ? 'No mappings match your search.' : 'No dashboard mappings configured yet.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMappings.map((mapping) => (
              <div key={mapping.id} className={`border border-gray-200 rounded-lg p-4 ${!mapping.isEnabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${mapping.dashboardType === 'patient' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {mapping.dashboardType?.toUpperCase()}
                      </span>
                      <h4 className="font-medium text-gray-900">{mapping.displayName}</h4>
                      <span className="text-sm text-gray-500">
                        ({mapping.department}{mapping.departments && mapping.departments.length > 1 ? ` +${mapping.departments.length - 1} more` : ''})
                      </span>
                      {mapping.identifier && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {mapping.identifier}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {mapping.profession || 'All'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Primary:</span> {mapping.cardFields?.primary || ''} •
                      <span className="font-medium ml-2">Group By:</span> {mapping.groupByField || ''}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleMappingStatus(mapping)}
                      className={`p-2 rounded-lg transition-colors ${mapping.isEnabled ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
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
                      onClick={() => handleCloneMapping(mapping)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Clone mapping"
                    >
                      <Copy className="w-4 h-4" />
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
                      <button onClick={() => setExpandedTemplate(isExpanded ? null : template.id)} className="p-1 hover:bg-gray-100 rounded">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      </button>
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-500">{template.department} • {template.fields.length} fields</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {hasMapping && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Mapped</span>
                      )}
                      {!hasMapping && (
                        <button
                          onClick={() => handleCreateMapping(template)}
                          className="inline-flex items-center px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create Mapping
                        </button>
                      )}
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
              {editingMapping.id ? 'Edit Dashboard Mapping' : 'Create Dashboard Mapping'}
            </h3>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600">{err}</p>
                ))}
              </div>
            )}

            <div className="space-y-5">
              {/* Section: Basic Settings */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Basic Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                  <input type="text" value={editingMapping.displayName}
                    onChange={(e) => setEditingMapping({ ...editingMapping, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Identifier Tag</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="identifier-suggestions"
                      value={editingMapping.identifier || ''}
                      onChange={(e) => setEditingMapping({ ...editingMapping, identifier: e.target.value })}
                      placeholder="Type or select an identifier..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                    {editingMapping.identifier && (
                      <button
                        type="button"
                        onClick={() => setEditingMapping({ ...editingMapping, identifier: '' })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear identifier"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <datalist id="identifier-suggestions">
                      {[...new Set([
                        ...mappings.map(m => m.identifier).filter(Boolean),
                        ...(() => {
                          try { return JSON.parse(localStorage.getItem('isbar_custom_tabs') || '[]').map((t: any) => t.name?.toLowerCase()); } catch { return []; }
                        })()
                      ])].sort().map(ident => (
                        <option key={ident} value={ident} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Controls which dashboard section this form appears in.
                    Type any name to create a new section, or pick an existing one.
                    <span className="font-medium"> Round</span> and <span className="font-medium">Audit</span> have special grouping.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dashboard Type *</label>
                  <select value={editingMapping.dashboardType}
                    onChange={(e) => setEditingMapping({ ...editingMapping, dashboardType: e.target.value as 'patient' | 'resource' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  >
                    <option value="patient">Patient Handover</option>
                    <option value="resource">Resource Handover</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profession</label>
                  <select value={editingMapping.profession || ''}
                    onChange={(e) => setEditingMapping({ ...editingMapping, profession: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  >
                    <option value="">All</option>
                    {PROFESSIONS.map(p => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Department *</label>
                  <select value={editingMapping.department || ''}
                    onChange={(e) => {
                      const dep = e.target.value;
                      const current = editingMapping.departments || [];
                      const next = dep ? (current.includes(dep) ? current : [dep, ...current.filter(d => d !== dep)]) : current.filter(d => d !== editingMapping.department);
                      setEditingMapping({ ...editingMapping, department: dep, departments: next });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  >
                    <option value="">Select department...</option>
                    {allDepartments.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>

                {/* Departments as checkboxes */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
                  <div className="flex flex-wrap gap-2">
                    {allDepartments.map((d) => {
                      const checked = (editingMapping.departments || []).includes(d);
                      return (
                        <label key={d} className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${checked ? 'bg-brand-50 border-brand text-brand-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          <input type="checkbox" className="sr-only" checked={checked}
                            onChange={() => {
                              const current = editingMapping.departments || [];
                              const next = checked ? current.filter(x => x !== d) : [...current, d];
                              const primary = editingMapping.department;
                              const sorted = primary ? [primary, ...next.filter(x => x !== primary)] : next;
                              setEditingMapping({ ...editingMapping, departments: sorted });
                            }}
                          />
                          {d}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Click to toggle departments. Primary department is always included.</p>
                </div>
                </div>
              </div>

              {/* Section: Field Mappings */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Card Field Mappings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Field (Main Title) *</label>
                    <select value={editingMapping.cardFields.primary}
                      onChange={(e) => setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, primary: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Field (Subtitle)</label>
                    <select value={editingMapping.cardFields.secondary}
                      onChange={(e) => setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, secondary: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Field (Badge)</label>
                    <select value={editingMapping.cardFields.status}
                      onChange={(e) => setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, status: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identifier Field (Bed/ID)</label>
                    <select value={editingMapping.cardFields.identifier}
                      onChange={(e) => setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, identifier: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nurse Name Field</label>
                    <select value={editingMapping.cardFields.nurse || ''}
                      onChange={(e) => setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, nurse: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Group By */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Grouping</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group Records By Field</label>
                <select value={editingMapping.groupByField}
                  onChange={(e) => setEditingMapping({ ...editingMapping, groupByField: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  <option value="">Select field...</option>
                  {getFieldOptions(selectedTemplate).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Records will be grouped by this field (e.g., patient MRN)</p>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900">Advanced Options</h4>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Highlights (expanded card fields)</label>
                  <select multiple value={editingMapping.cardFields.extraFields || []}
                    onChange={(e) => {
                      const values = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
                      setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, extraFields: values } });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent h-32"
                  >
                    {getFieldOptions(selectedTemplate).map((o, idx) => (<option key={`${o.value}-${idx}`} value={o.value}>{o.label}</option>))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple.</p>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Status Value Mapping</label>
                    <div className="space-x-2">
                      <button type="button" onClick={() => {
                        setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, statusValueMap: { Critical: 'critical', Subcritical: 'unstable', Stable: 'stable' } } });
                      }} className="text-xs px-2 py-1 bg-brand text-white rounded hover:bg-brand-600">Apply Defaults</button>
                      <button type="button" onClick={() => {
                        const current = editingMapping.cardFields.statusValueMap || {};
                        setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, statusValueMap: { ...current, [`Value ${Object.keys(current).length + 1}`]: 'stable' } } });
                      }} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Add Row</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(editingMapping.cardFields.statusValueMap || {}).map(([k, v], idx) => (
                      <div key={`${k}-${idx}`} className="flex items-center space-x-2">
                        <input type="text" value={k} onChange={(e) => {
                          const current = { ...editingMapping.cardFields.statusValueMap! };
                          const val = current[k]; delete current[k]; current[e.target.value] = val;
                          setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, statusValueMap: current } });
                        }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Dropdown value" />
                        <select value={v} onChange={(e) => {
                          const current = { ...editingMapping.cardFields.statusValueMap! };
                          current[k] = e.target.value;
                          setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, statusValueMap: current } });
                        }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="critical">Critical (red)</option>
                          <option value="unstable">Subcritical (yellow)</option>
                          <option value="stable">Stable (green)</option>
                        </select>
                        <button type="button" onClick={() => {
                          const current = { ...editingMapping.cardFields.statusValueMap! };
                          delete current[k];
                          setEditingMapping({ ...editingMapping, cardFields: { ...editingMapping.cardFields, statusValueMap: current } });
                        }} className="px-2 py-2 text-red-600 hover:bg-red-50 rounded" title="Remove">✕</button>
                      </div>
                    ))}
                    {Object.keys(editingMapping.cardFields.statusValueMap || {}).length === 0 && (
                      <p className="text-xs text-gray-500">No value mappings yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => { setShowMappingForm(false); setEditingMapping(null); setSelectedTemplate(null); setValidationErrors([]); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSaveMapping}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center">
                <Save className="w-4 h-4 mr-2" /> Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
