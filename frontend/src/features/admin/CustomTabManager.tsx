// Custom tab manager - full page for creating and managing custom dashboard tabs
import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  X,
  LayoutGrid,
  List,
  TableProperties,
  SquareStack,
  Clock,
  ChevronDown,
  ChevronRight,
  Pencil,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { PROFESSIONS } from '../../types/auth';
import {
  gregorianToEthiopian,
  gregorianToEthiopianTime,
  formatEthiopianDate,
  formatEthiopianTime,
} from '../../utils/ethiopianCalendar';

interface CustomTab {
  id: string;
  name: string;
  displayName: string;
  templateId: string;
  templateName: string;
  department: string;
  departments: string[];
  profession: string;
  professions: string[];
  dashboardType: 'patient' | 'resource';
  groupByField: string;
  viewStyle: 'card' | 'table' | 'list' | 'stack';
  retention: 'forever' | '24h' | '12h' | '8h';
  cardFields: {
    primary: string;
    secondary: string;
    status: string;
    identifier: string;
    nurse?: string;
    extraFields?: string[];
  };
}

interface FormTemplate {
  id: string;
  name: string;
  department: string;
  fields: any[];
  sections: any[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

const prettifyLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

export const CustomTabManager: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editingTab, setEditingTab] = useState<CustomTab | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<'basic' | 'fields'>('basic');

  const [formData, setFormData] = useState<Partial<CustomTab>>({});

  const sanitizeTabs = (tabs: any[]): CustomTab[] =>
    (Array.isArray(tabs) ? tabs : []).map((t: any) => ({
      ...t,
      id: String(t.id),
      templateId: t.templateId != null ? String(t.templateId) : '',
      viewStyle: ['card', 'table', 'list', 'stack'].includes(t.viewStyle) ? t.viewStyle : 'card',
    }));

  // Load tabs from the backend (shared across all browsers/accounts).
  // One-time migration: if the server has no tabs but localStorage does, push them up.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/custom-tabs');
        if (!res.ok) return;
        let tabs = sanitizeTabs(await res.json());
        let localTabs: any[] = [];
        try {
          localTabs = JSON.parse(localStorage.getItem('isbar_custom_tabs') || '[]');
        } catch { localTabs = []; }
        if (tabs.length === 0 && localTabs.length > 0) {
          for (const t of localTabs) {
            try {
              const created = await fetch('/api/custom-tabs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(t),
              });
              if (created.ok) tabs = [...tabs, sanitizeTabs([await created.json()])[0]];
            } catch { /* keep going */ }
          }
          try { localStorage.removeItem('isbar_custom_tabs'); } catch { /* silent */ }
        }
        setCustomTabs(tabs);
      } catch { /* silent */ }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/form-templates');
        if (res.ok) {
          const data = await res.json();
          setAvailableTemplates((data || []).map((t: any) => ({
            id: String(t.id),
            name: t.name || t.title || `Template ${t.id}`,
            department: t.department || '',
            fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
            sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
          })));
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const getAllDepartments = () => {
    const set = new Set<string>();
    availableTemplates.forEach(t => t.department && set.add(t.department));
    return Array.from(set).sort();
  };

  const getFieldOptions = (templateId: string) => {
    const tpl = availableTemplates.find(t => t.id === templateId);
    if (!tpl) return [];
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    (tpl.fields || []).forEach((field: any) => {
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

  const openCreateForm = () => {
    setEditingTab(null);
    setFormData({
      name: '',
      displayName: '',
      templateId: '',
      templateName: '',
      department: '',
      departments: [],
      profession: '',
      professions: [],
      dashboardType: 'patient',
      groupByField: '',
      viewStyle: 'card',
      retention: 'forever',
      cardFields: { primary: '', secondary: '', status: '', identifier: '', nurse: '', extraFields: [] },
    });
    setStep('basic');
    setShowForm(true);
  };

  const openEditForm = (tab: CustomTab) => {
    setEditingTab(tab);
    setFormData({ ...tab });
    setStep('basic');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.templateId) return;
    const tpl = availableTemplates.find(t => t.id === formData.templateId);
    const payload = {
      name: formData.name!.trim(),
      displayName: formData.displayName?.trim() || formData.name!.trim(),
      templateId: formData.templateId!,
      templateName: tpl?.name || '',
      department: formData.department || tpl?.department || '',
      departments: formData.departments || [],
      profession: formData.profession || '',
      professions: formData.professions || (formData.profession ? [formData.profession] : []),
      dashboardType: formData.dashboardType || 'patient',
      groupByField: formData.groupByField || '',
      viewStyle: formData.viewStyle || 'card',
      retention: formData.retention || 'forever',
      cardFields: formData.cardFields || { primary: '', secondary: '', status: '', identifier: '', nurse: '', extraFields: [] },
    };

    try {
      if (editingTab) {
        const res = await fetch(`/api/custom-tabs/${editingTab.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update tab');
        const updated = sanitizeTabs([await res.json()])[0];
        setCustomTabs(prev => prev.map(t => t.id === editingTab.id ? updated : t));
        addToast('Tab updated successfully');
      } else {
        const res = await fetch('/api/custom-tabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create tab');
        const created = sanitizeTabs([await res.json()])[0];
        setCustomTabs(prev => [...prev, created]);
        addToast('Tab created successfully');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Something went wrong', 'error');
      return;
    }
    setShowForm(false);
    setEditingTab(null);
  };

  const handleDelete = async (tabId: string) => {
    try {
      const res = await fetch(`/api/custom-tabs/${tabId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tab');
      setCustomTabs(prev => prev.filter(t => t.id !== tabId));
      addToast('Tab deleted');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Something went wrong', 'error');
    }
  };

  const viewStyleIcons = { card: LayoutGrid, table: TableProperties, list: List, stack: SquareStack };
  const viewStyleLabels = { card: 'Card', table: 'Table', list: 'List', stack: 'Stack' };
  const retentionLabels = { forever: 'Forever', '24h': '24 Hours', '12h': '12 Hours', '8h': '8 Hours' };

  return (
    <div className="bg-gray-50 p-6">
      {/* Toast */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white ${t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {onNavigate && (
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[#003366]">Custom Tabs</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage custom dashboard tabs for form submissions</p>
          </div>
        </div>
      </div>

      <div>
        {showForm ? (
          /* ===== CREATE / EDIT FORM ===== */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Form Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingTab ? 'Edit Tab' : 'Create New Tab'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Step {step === 'basic' ? '1' : '2'} of 2 — {step === 'basic' ? 'Basic Settings' : 'Field Mapping'}
                </p>
              </div>
              <button onClick={() => { setShowForm(false); setEditingTab(null); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-100">
              <div className={`h-full bg-[#003153] transition-all duration-300 ${step === 'basic' ? 'w-1/2' : 'w-full'}`} />
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
              {step === 'basic' ? (
                <>
                  {/* Tab Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Tab Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={e => {
                        const name = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          name,
                          displayName: prev.displayName === prev.name || !prev.displayName ? name : prev.displayName,
                        }));
                      }}
                      placeholder="e.g. Daily Nursing Audit, Maternity, Lab Results..."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent bg-gray-50 text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">This becomes the identifier tag in dashboard mapping.</p>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Shown as section title (defaults to tab name)"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent bg-gray-50 text-sm"
                    />
                  </div>

                  {/* Form Template */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Form Template *</label>
                    <select
                      value={formData.templateId || ''}
                      onChange={e => {
                        const tplId = e.target.value;
                        const tpl = availableTemplates.find(t => t.id === tplId);
                        setFormData(prev => ({
                          ...prev,
                          templateId: tplId,
                          templateName: tpl?.name || '',
                          department: tpl?.department || prev.department || '',
                          departments: tpl?.department ? [tpl.department] : prev.departments || [],
                        }));
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                    >
                      <option value="">Select a template...</option>
                      {availableTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                      ))}
                    </select>
                    {availableTemplates.length === 0 && !loading && (
                      <p className="text-xs text-gray-400 mt-1">No templates available. Create one in Form Builder first.</p>
                    )}
                  </div>

                  {/* Dashboard Type */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Dashboard Type</label>
                    <div className="flex gap-3">
                      {(['patient', 'resource'] as const).map(dt => (
                        <button
                          key={dt}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dashboardType: dt }))}
                          className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                            formData.dashboardType === dt
                              ? 'bg-[#003153] border-[#003153] text-white shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {dt === 'patient' ? 'Patient Handover' : 'Resource Handover'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Department</label>
                    <select
                      value={formData.department || ''}
                      onChange={e => {
                        const dep = e.target.value;
                        const current = formData.departments || [];
                        const next = dep ? (current.includes(dep) ? current : [dep, ...current.filter(d => d !== dep)]) : current.filter(d => d !== formData.department);
                        setFormData(prev => ({ ...prev, department: dep, departments: next }));
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                    >
                      <option value="">All Departments</option>
                      {getAllDepartments().map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {getAllDepartments().length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {getAllDepartments().map(d => {
                          const checked = (formData.departments || []).includes(d);
                          return (
                            <label key={d} className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${checked ? 'bg-[#003153] border-[#003153] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="checkbox" className="sr-only" checked={checked}
                                onChange={() => {
                                  const current = formData.departments || [];
                                  const next = checked ? current.filter(x => x !== d) : [...current, d];
                                  setFormData(prev => ({ ...prev, departments: next }));
                                }}
                              />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Profession */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Profession</label>
                    {PROFESSIONS.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {PROFESSIONS.map(p => {
                          const checked = (formData.professions || []).includes(p);
                          return (
                            <label key={p} className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${checked ? 'bg-[#003153] border-[#003153] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="checkbox" className="sr-only" checked={checked}
                                onChange={() => {
                                  const current = formData.professions || [];
                                  const next = checked ? current.filter(x => x !== p) : [...current, p];
                                  setFormData(prev => ({ ...prev, professions: next }));
                                }}
                              />
                              {p}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">Leave empty for all professions. Tab will only appear for users in the selected departments and professions.</p>
                  </div>

                  {/* View Style */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Record View Style</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {([
                        { value: 'card' as const, icon: LayoutGrid, desc: 'Grid of cards' },
                        { value: 'table' as const, icon: TableProperties, desc: 'Rows & columns' },
                        { value: 'list' as const, icon: List, desc: 'Horizontal rows' },
                        { value: 'stack' as const, icon: SquareStack, desc: 'Full-width stacked' },
                      ]).map(vs => {
                        const Icon = vs.icon;
                        return (
                          <button
                            key={vs.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, viewStyle: vs.value }))}
                            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-center transition-colors ${
                              formData.viewStyle === vs.value
                                ? 'bg-[#003153] border-[#003153] text-white shadow-sm'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium capitalize">{vs.value}</span>
                            <span className={`text-[10px] ${formData.viewStyle === vs.value ? 'text-white/70' : 'text-gray-400'}`}>{vs.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submission Retention */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Submission Retention</label>
                    <div className="flex gap-3">
                      {([
                        { value: 'forever' as const, label: 'Forever', desc: 'Until deleted' },
                        { value: '24h' as const, label: '24 Hours', desc: 'Auto-clear' },
                        { value: '12h' as const, label: '12 Hours', desc: 'Auto-clear' },
                        { value: '8h' as const, label: '8 Hours', desc: 'Auto-clear' },
                      ]).map(ret => (
                        <button
                          key={ret.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, retention: ret.value }))}
                          className={`flex-1 px-3 py-3 rounded-lg border text-center transition-colors ${
                            formData.retention === ret.value
                              ? 'bg-[#003153] border-[#003153] text-white shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-xs font-medium">{ret.label}</div>
                          <div className={`text-[10px] ${formData.retention === ret.value ? 'text-white/70' : 'text-gray-400'}`}>{ret.desc}</div>
                        </button>
                      ))}
                    </div>
                    {formData.retention !== 'forever' && (
                      <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Submissions older than {formData.retention} will be hidden from this tab.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Field Mapping */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Group Records By</label>
                    <select
                      value={formData.groupByField || ''}
                      onChange={e => setFormData(prev => ({ ...prev, groupByField: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                    >
                      <option value="">No grouping (flat list)</option>
                      {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Records will be grouped by this field (e.g. patient MRN, department).</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Primary Field (Title) *</label>
                      <select
                        value={formData.cardFields?.primary || ''}
                        onChange={e => setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, primary: e.target.value } }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                      >
                        <option value="">Select field...</option>
                        {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Secondary Field (Subtitle)</label>
                      <select
                        value={formData.cardFields?.secondary || ''}
                        onChange={e => setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, secondary: e.target.value } }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                      >
                        <option value="">Select field...</option>
                        {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Status Field (Badge)</label>
                      <select
                        value={formData.cardFields?.status || ''}
                        onChange={e => setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, status: e.target.value } }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                      >
                        <option value="">Select field...</option>
                        {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Identifier Field (Bed/ID)</label>
                      <select
                        value={formData.cardFields?.identifier || ''}
                        onChange={e => setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, identifier: e.target.value } }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                      >
                        <option value="">Select field...</option>
                        {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Nurse Name Field</label>
                    <select
                      value={formData.cardFields?.nurse || ''}
                      onChange={e => setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, nurse: e.target.value } }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm bg-gray-50"
                    >
                      <option value="">Select field...</option>
                      {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Extra Fields (expanded card details)</label>
                    <select multiple
                      value={formData.cardFields?.extraFields || []}
                      onChange={e => {
                        const values = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
                        setFormData(prev => ({ ...prev, cardFields: { ...prev.cardFields!, extraFields: values } }));
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent text-sm h-32 bg-gray-50"
                    >
                      {getFieldOptions(formData.templateId || '').map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple fields to display on each card.</p>
                  </div>
                </>
              )}
            </div>

            {/* Form Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
              {step === 'fields' ? (
                <button onClick={() => setStep('basic')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium">
                  Back
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setEditingTab(null); }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium">
                  Cancel
                </button>
                {step === 'basic' ? (
                  <button
                    onClick={() => setStep('fields')}
                    disabled={!formData.name?.trim() || !formData.templateId}
                    className="px-4 py-2 rounded-lg bg-[#003153] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#002240] text-sm font-medium"
                  >
                    Next: Field Mapping
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={!formData.cardFields?.primary}
                    className="px-5 py-2 rounded-lg bg-[#003153] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#002240] text-sm font-medium flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingTab ? 'Update Tab' : 'Create Tab'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ===== TAB LIST ===== */
          <>
            {/* Action Bar */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">{customTabs.length} Custom Tab{customTabs.length !== 1 ? 's' : ''}</h2>
              </div>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#003153] text-white hover:bg-[#002240] text-sm font-medium shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Tab
              </button>
            </div>

            {customTabs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Tag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No Custom Tabs</h3>
                <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
                  Create custom tabs to display form submissions on your dashboard with tailored views and field mappings.
                </p>
                <button
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#003153] text-white hover:bg-[#002240] text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Tab
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTabs.map(tab => {
                  const ViewIcon = viewStyleIcons[tab.viewStyle || 'card'] || LayoutGrid;
                  return (
                    <div key={tab.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Tag className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{tab.displayName || tab.name}</h3>
                            <p className="text-[11px] text-gray-400">{tab.templateName}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <ViewIcon className="w-3.5 h-3.5 text-gray-400" />
                          <span>{viewStyleLabels[tab.viewStyle || 'card']} view</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Retains: {retentionLabels[tab.retention || 'forever']}</span>
                        </div>
                        {tab.department && (
                          <div className="text-xs text-gray-500">Dept: {tab.department}</div>
                        )}
                        {(tab.professions?.length > 0 || tab.profession) && (
                          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                            <span>Role:</span>
                            {(tab.professions?.length ? tab.professions : [tab.profession]).map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-semibold">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => openEditForm(tab)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(tab.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomTabManager;
