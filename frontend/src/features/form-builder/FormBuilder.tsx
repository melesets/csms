// Form builder - visual form designer with template management
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Plus, Eye, Edit2, Trash2, ToggleLeft, ToggleRight, Search, Download, Upload, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDepartments } from '../../hooks/useDepartments';
import { FormTemplate } from '../../types/formBuilder';
import { FormDesigner } from './FormDesigner';
import { FormPreview } from './FormPreview';
import { CustomSelect } from '../../components/shared/CustomSelect';

export const FormBuilder = () => {
  const { user, hasPermission } = useAuth();
  const { departments } = useDepartments();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'designer' | 'preview'>('list');
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRefetchTemplates = (window as any).reportRefetchTemplates;

  useEffect(() => {
    fetch('/api/form-templates')
      .then(res => res.json())
      .then(data => {
        setTemplates(Array.isArray(data) ? data.map(t => ({
          ...t,
          id: t.id?.toString?.() ?? '',
          isActive: (t as any).is_active ?? (t as any).isActive ?? false,
          requiresReporter: (t as any).requires_reporter === true || (t as any).requires_reporter === 'true' || Boolean((t as any).requiresReporter),
          createdAt: (t as any).created_at ?? (t as any).createdAt ?? null,
          updatedAt: (t as any).updated_at ?? (t as any).updatedAt ?? null,
          fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
          sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
          departments: Array.isArray((t as any).departments)
            ? (t as any).departments
            : (t.department ? [t.department] : [])
        })) : []);
      })
      .catch(() => setTemplates([]));
  }, []);

  /* ─── Filtered templates ──────────────────────────── */
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const hasDept = (dept: string) =>
        (Array.isArray((t as any).departments) && (t as any).departments.includes(dept)) ||
        t.department === dept;
      const matchesDept = user?.role === 'admin' || !user?.department || hasDept(user.department);
      const matchesSearch = !searchTerm || t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDeptFilter = filterDepartment === 'All' || hasDept(filterDepartment);
      const matchesStatus = filterStatus === 'All' ||
        (filterStatus === 'Active' && Boolean(t.isActive)) ||
        (filterStatus === 'Inactive' && !Boolean(t.isActive));
      return matchesDept && matchesSearch && matchesDeptFilter && matchesStatus;
    });
  }, [templates, searchTerm, filterDepartment, filterStatus, user]);

  if (!hasPermission('form-builder', 'view')) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">You don't have permission to access the form builder.</p>
      </div>
    );
  }

  /* ─── Template CRUD ───────────────────────────────── */
  const handleCreateTemplate = () => {
    const newTemplate: FormTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Form Template',
      department: user?.department === 'All' ? 'Medical Ward' : user?.department || 'Medical Ward',
      departments: [user?.department === 'All' ? 'Medical Ward' : user?.department || 'Medical Ward'],
      description: 'A new dynamic form template',
      version: 1,
      isActive: false,
      requiresReporter: true,
      fields: [
        { id: 'patient-name', type: 'text', label: 'Patient Name', name: 'patientName', required: true, placeholder: 'Enter patient full name', width: 'half' },
        { id: 'mrn', type: 'text', label: 'MRN', name: 'mrn', required: true, placeholder: 'Medical Record Number', width: 'half' },
        { id: 'bed-number', type: 'text', label: 'Bed Number', name: 'bedNumber', required: true, placeholder: 'e.g., MW-12', width: 'half' }
      ],
      sections: [{ id: 'main-section', name: 'Form Content', description: 'Main form fields', order: 1, isCollapsible: false, isCollapsed: false }],
      createdBy: user?.username || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCurrentTemplate(newTemplate);
    setCurrentView('designer');
  };

  const handleEditTemplate = (template: FormTemplate) => {
    setCurrentTemplate(template);
    setCurrentView('designer');
  };

  const handlePreviewTemplate = (template: FormTemplate) => {
    setCurrentTemplate(template);
    setCurrentView('preview');
  };

  const handleSaveTemplate = async (template: FormTemplate) => {
    try {
      let url = '/api/form-templates';
      let method: 'POST' | 'PUT' = 'POST';
      const depts = Array.isArray((template as any).departments)
        ? (template as any).departments
        : (template.department ? [template.department] : []);
      let body: any = { ...template, departments: depts, department: depts[0] || template.department };

      let latest: any[] = await fetch('/api/form-templates').then(r => r.ok ? r.json() : []);
      latest = Array.isArray(latest) ? latest : [];
      const idExists = template.id && latest.some((t: any) => String(t.id) === String(template.id));
      if (idExists) {
        url = `/api/form-templates/${template.id}`;
        method = 'PUT';
      } else {
        const { id, ...rest } = template as any;
        body = { ...rest, departments: depts, department: depts[0] || rest.department };
      }

      const saveRes = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!saveRes.ok) {
        let detail = '';
        try { const errBody = await saveRes.json(); detail = errBody?.error || JSON.stringify(errBody); } catch { try { detail = await saveRes.text(); } catch {} }
        throw new Error(`Failed to save template (status ${saveRes.status}): ${detail}`);
      }
      const savedTemplate = await saveRes.json();

      const actRes = await fetch(`/api/form-templates/${savedTemplate.id}/set-active`, { method: 'PATCH' });
      if (!actRes.ok) {
        let detail = '';
        try { const errBody = await actRes.json(); detail = errBody?.error || JSON.stringify(errBody); } catch { try { detail = await actRes.text(); } catch {} }
        throw new Error(`Failed to activate template (status ${actRes.status}): ${detail}`);
      }
      const activeTemplate = await actRes.json();
      const parsedTemplate = {
        ...activeTemplate,
        id: activeTemplate.id?.toString?.() ?? '',
        isActive: activeTemplate.is_active ?? activeTemplate.isActive ?? true,
        createdAt: activeTemplate.created_at ?? activeTemplate.createdAt ?? null,
        updatedAt: activeTemplate.updated_at ?? activeTemplate.updatedAt ?? null,
        fields: typeof activeTemplate.fields === 'string' ? JSON.parse(activeTemplate.fields) : (activeTemplate.fields || []),
        sections: typeof activeTemplate.sections === 'string' ? JSON.parse(activeTemplate.sections) : (activeTemplate.sections || []),
        departments: Array.isArray((activeTemplate as any).departments) ? (activeTemplate as any).departments : (activeTemplate.department ? [activeTemplate.department] : [])
      };

      setTemplates(prev => {
        const exists = prev.some(t => t.id === parsedTemplate.id);
        return exists ? prev.map(t => (t.id === parsedTemplate.id ? parsedTemplate : t)) : [parsedTemplate, ...prev];
      });
      setCurrentView('list');
      setCurrentTemplate(null);
      if (typeof reportRefetchTemplates === 'function') reportRefetchTemplates();
      alert('Template saved and set as active!');
    } catch (err: any) {
      alert('Error saving template: ' + (err?.message || err));
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    fetch(`/api/form-templates/${templateId}`, { method: 'DELETE' })
      .then(async res => {
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete'); }
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        alert('Template deleted successfully.');
      })
      .catch(err => alert('Error deleting template: ' + err.message));
  };

  const handleToggleActive = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const newActiveStatus = !Boolean(template.isActive);
    fetch(`/api/form-templates/${templateId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...template, isActive: newActiveStatus })
    })
      .then(res => { if (!res.ok) throw new Error('Failed to update'); return res.json(); })
      .then(() => {
        setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, isActive: newActiveStatus } : t));
        if (typeof reportRefetchTemplates === 'function') reportRefetchTemplates();
      })
      .catch(err => alert('Error: ' + err.message));
  };

  /* ─── CSV Export (templates) ─────────────────────── */
  const downloadCSV = () => {
    const headers = ['Template ID', 'Template Name', 'Department', 'Description', 'Version', 'Active Status', 'Created By', 'Created Date', 'Field Count', 'Fields JSON'];
    const rows = [headers, ...filteredTemplates.map(t => [
      t.id?.toString() || '', t.name || '', t.department || '', t.description || '',
      t.version?.toString() || '1', t.isActive ? 'Active' : 'Inactive',
      t.createdBy || '', t.createdAt ? new Date(new Date(t.createdAt).getTime() + 3 * 3600 * 1000).toLocaleDateString() : '',
      t.fields?.length?.toString() || '0', JSON.stringify(t.fields || [])
    ])];
    const csv = rows.map(r => r.map(c => { const s = String(c || ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `form_templates_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── CSV Export (fields) ────────────────────────── */
  const downloadFieldsCSV = () => {
    const headers = ['Template ID', 'Template Name', 'Department', 'Section ID', 'Section Name', 'Field ID', 'Field Label', 'Field Name', 'Field Type', 'Required', 'Width', 'Placeholder', 'Options', 'Validation JSON'];
    const rows: string[][] = [headers];
    filteredTemplates.forEach(t => {
      const secs: Record<string, any> = {}; (t.sections || []).forEach((s: any) => { secs[s.id] = s; });
      (t.fields || []).forEach((f: any) => {
        rows.push([t.id?.toString() || '', t.name || '', t.department || '', f.section || '', secs[f.section]?.name || '', f.id?.toString() || '', f.label || '', f.name || '', f.type || '', f.required ? 'true' : 'false', f.width || '', f.placeholder || '', f.options ? JSON.stringify(f.options) : '', f.validation ? JSON.stringify(f.validation) : '']);
      });
    });
    const csv = rows.map(r => r.map(c => { const s = String(c || ''); return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `form_fields_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── Kobo CSV Export (single template) ──────────── */
  const exportKoboCSV = (template: FormTemplate) => {
    const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    const lines: string[][] = [['type', 'name', 'label']];
    const sections = (template.sections || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const fieldsBySection: Record<string, any[]> = {};
    (template.fields || []).forEach((f: any) => { const k = f.section || 'main-section'; (fieldsBySection[k] = fieldsBySection[k] || []).push(f); });
    const mapType = (f: any): string => {
      const t = String(f.type || '').toLowerCase();
      if (t === 'number') return 'integer';
      if (t === 'textarea') return 'text';
      if (t === 'date') return 'date';
      if (t === 'time') return 'time';
      if (t === 'measurement') return f.mode === 'bp' ? 'text' : 'decimal';
      if (t === 'multiselect' || t === 'checkbox') return `${f.selectionMode === 'single' ? 'select_one' : 'select_multiple'} list_${slug(f.id || f.name || 'opt')}`;
      if (t === 'select' || t === 'dropdown' || t === 'radio' || t === 'stability') return `select_one list_${slug(f.id || f.name || 'opt')}`;
      return 'text';
    };
    const push = (a: string, b: string, c: string) => lines.push([a, b, c].map(x => x.includes(',') || x.includes('"') ? '"' + x.replace(/"/g, '""') + '"' : x));
    if (sections.length === 0) {
      push('begin_group', 'main', template.name || 'Form');
      (fieldsBySection['main-section'] || template.fields || []).forEach((f: any) => push(mapType(f), f.name || slug(f.label || ''), f.label || f.name || ''));
      push('end_group', '', '');
    } else {
      sections.forEach((sec: any) => {
        push('begin_group', sec.id || slug(sec.name || 'section'), sec.name || '');
        (fieldsBySection[sec.id] || []).forEach((f: any) => push(mapType(f), f.name || slug(f.label || ''), f.label || f.name || ''));
        push('end_group', '', '');
      });
    }
    const csv = lines.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${slug(template.name)}_kobo_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── CSV Import ─────────────────────────────────── */
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
      else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += line[i]; }
    }
    result.push(current);
    return result;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { alert('Please select a CSV file'); return; }
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('File is empty');
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV must have header + data rows');
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const hasKobo = ['type', 'name', 'label'].every(h => headers.includes(h));
        const hasField = headers.some(h => h.includes('field label')) || headers.some(h => h.includes('field type'));

        if (hasKobo || hasField) {
          alert('Detected field-level CSV. Use "Export Fields CSV" format for import. Direct Kobo import not yet supported.');
        } else {
          // Template-level CSV import
          const requiredHeaders = ['template name', 'department'];
          const missing = requiredHeaders.filter(h => !headers.some(x => x.includes(h)));
          if (missing.length > 0) throw new Error(`Missing required headers: ${missing.join(', ')}`);

          const colIdx = (name: string) => headers.findIndex(h => h.includes(name));
          const importedTemplates: FormTemplate[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const rowData: Record<string, string> = {};
            headers.forEach((h, idx) => { rowData[h] = values[idx] || ''; });
            const tName = rowData[headers[colIdx('template name')] || '']?.trim();
            const dept = rowData[headers[colIdx('department')] || '']?.trim();
            if (!tName || !dept) continue;
            let fields: any[] = [];
            const fieldsIdx = colIdx('fields json');
            if (fieldsIdx >= 0 && rowData[headers[fieldsIdx]]) {
              try { fields = JSON.parse(rowData[headers[fieldsIdx]]); } catch { fields = []; }
            }
            importedTemplates.push({
              id: Math.random().toString(36).substr(2, 9),
              name: tName, department: dept, departments: [dept],
              description: rowData[headers[colIdx('description')] || ''] || '',
              version: parseInt(rowData[headers[colIdx('version')] || '']) || 1,
              isActive: rowData[headers[colIdx('active')] || '']?.toLowerCase() === 'active',
              fields, sections: [],
              createdBy: user?.username || 'admin',
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
          }
          if (importedTemplates.length === 0) throw new Error('No valid templates found in CSV');
          await handleBulkImport(importedTemplates);
        }
      } catch (err: any) { alert('Import error: ' + (err?.message || err)); }
      finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async (importedTemplates: FormTemplate[]) => {
    let current = await fetch('/api/form-templates').then(r => r.ok ? r.json() : []);
    if (!Array.isArray(current)) current = [];
    current = current.map((t: any) => ({ ...t, id: t.id?.toString?.() ?? '', departments: Array.isArray(t.departments) ? t.departments : (t.department ? [t.department] : []) }));

    for (const t of importedTemplates) {
      const tDepts = Array.isArray((t as any).departments) ? (t as any).departments : [t.department];
      const match = current.find((x: any) => x.name === t.name && x.department === (tDepts[0] || t.department));
      if (match) {
        await fetch(`/api/form-templates/${match.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...match, name: t.name, department: tDepts[0], departments: tDepts, description: t.description, version: t.version ?? 1, isActive: t.isActive ?? false, fields: t.fields || [], sections: t.sections || [] }) });
      } else {
        await fetch('/api/form-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, id: undefined, departments: tDepts, department: tDepts[0] }) });
      }
    }

    fetch('/api/form-templates').then(res => res.json()).then(data => setTemplates(Array.isArray(data) ? data.map(t => ({
      ...t, id: t.id?.toString?.() ?? '',
      isActive: (t as any).is_active ?? (t as any).isActive ?? false,
      requiresReporter: (t as any).requires_reporter === true || (t as any).requires_reporter === 'true' || Boolean((t as any).requiresReporter),
      createdAt: (t as any).created_at ?? (t as any).createdAt ?? null,
      updatedAt: (t as any).updated_at ?? (t as any).updatedAt ?? null,
      fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
      sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
      departments: Array.isArray((t as any).departments) ? (t as any).departments : (t.department ? [t.department] : [])
    })) : []));
  };

  /* ─── View Router ─────────────────────────────────── */
  const renderCurrentView = () => {
    switch (currentView) {
      case 'designer':
        return <FormDesigner template={currentTemplate} onSave={handleSaveTemplate} onCancel={() => { setCurrentView('list'); setCurrentTemplate(null); }} />;
      case 'preview':
        return <FormPreview template={currentTemplate} onBack={() => setCurrentView('list')} />;
      default:
        return (
          <>
            {/* Filters + Import/Export bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search templates..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                {user?.role === 'admin' && (
                  <CustomSelect
                    value={filterDepartment}
                    onChange={setFilterDepartment}
                    options={[
                      { value: 'All', label: 'All Departments' },
                      ...departments.map(d => ({ value: d, label: d })),
                    ]}
                  />
                )}
                <CustomSelect
                  value={filterStatus}
                  onChange={(v) => setFilterStatus(v as 'All' | 'Active' | 'Inactive')}
                  options={[
                    { value: 'All', label: 'All Status' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                  ]}
                />
                <div className="flex items-center gap-2">
                  <button onClick={downloadCSV} disabled={!filteredTemplates.length}
                    className="px-3 py-2 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5" />Templates
                  </button>
                  <button onClick={downloadFieldsCSV} disabled={!filteredTemplates.length}
                    className="px-3 py-2 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5" />Fields
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isImporting}
                    className="px-3 py-2 bg-[#003153] text-white rounded-lg text-xs font-semibold hover:bg-[#002640] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />{isImporting ? 'Importing...' : 'Import CSV'}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-gray-400">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
                {(searchTerm || filterDepartment !== 'All' || filterStatus !== 'All') && ' (filtered)'}
              </div>
            </div>

            {/* Templates Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Form Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                            <FileText className="w-6 h-6 text-gray-300" />
                          </div>
                          <p className="text-sm text-gray-500">No templates found</p>
                          <p className="text-xs text-gray-400 mt-0.5">{searchTerm || filterDepartment !== 'All' || filterStatus !== 'All' ? 'Try adjusting filters' : 'Create your first form to get started'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTemplates.map((t) => {
                        const isActive = t.isActive;
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-gray-100 rounded-lg shrink-0">
                                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">{t.name}</span>
                                {(t as any).requiresReporter ? (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded border border-blue-100">Report</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-teal-50 text-teal-600 text-[9px] font-bold rounded border border-teal-100">Documentation</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-600">{t.department}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-600">{t.fields?.length || 0} fields</td>
                            <td className="px-4 py-2.5 text-sm text-gray-500">
                              {t.createdAt ? new Date(new Date(t.createdAt).getTime() + 3 * 3600 * 1000).toLocaleDateString() : 'Unknown'}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handlePreviewTemplate(t)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Preview">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditTemplate(t)} className="p-1.5 text-gray-400 hover:text-[#003153] hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => exportKoboCSV(t)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Export Kobo CSV">
                                  <Download className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleToggleActive(t.id)} className={`p-1.5 rounded-lg transition-colors ${isActive ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`} title={isActive ? 'Deactivate' : 'Activate'}>
                                  {isActive ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#003153] rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Dynamic Form Builder</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Create any type of form for {user?.role === 'admin' ? 'any department' : user?.department}
            </p>
          </div>
        </div>
        {hasPermission('form-builder', 'create') && (
          <button onClick={handleCreateTemplate}
            className="px-4 py-2 bg-[#003153] text-white rounded-lg text-sm font-semibold hover:bg-[#002640] inline-flex items-center gap-1.5 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />Create New Form
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      {currentView !== 'list' && (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <button onClick={() => setCurrentView('list')} className="hover:text-gray-700">Form Builder</button>
          <span>/</span>
          <span className="text-gray-900">{currentView === 'designer' ? 'Form Designer' : 'Preview'}</span>
        </div>
      )}

      {renderCurrentView()}
    </div>
  );
};
