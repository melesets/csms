import React, { useState, useEffect } from 'react';
import { Settings, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { FormTemplate } from '../../types/formBuilder';
import { FormDesigner } from './FormDesigner';
import { FormPreview } from './FormPreview';
import { TemplateManager } from './TemplateManager';

export const FormBuilder = () => {
  const { user, hasPermission } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'designer' | 'preview'>('list');
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate | null>(null);
  // Ref to trigger report page template refresh
  const reportRefetchTemplates = (window as any).reportRefetchTemplates;

  useEffect(() => {
    // Fetch templates from backend on mount
    fetch('/api/form-templates')
      .then(res => res.json())
      .then(data => {
        // Ensure all IDs are strings for frontend compatibility and parse JSON fields
        setTemplates(Array.isArray(data) ? data.map(t => ({
          ...t,
          id: t.id?.toString?.() ?? '',
          fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
          sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
          departments: Array.isArray((t as any).departments)
            ? (t as any).departments
            : (t.department ? [t.department] : [])
        })) : []);
      })
      .catch(() => setTemplates([]));
  }, []);

  if (!hasPermission('form-builder', 'view')) {
    return (
      <div className="text-center py-12">
        <Settings className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          You don't have permission to access the form builder.
        </p>
      </div>
    );
  }

  const handleCreateTemplate = () => {
    const newTemplate: FormTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Form Template',
      department: user?.department === 'All' ? 'Medical Ward' : user?.department || 'Medical Ward',
      departments: [user?.department === 'All' ? 'Medical Ward' : user?.department || 'Medical Ward'],
      description: 'A new dynamic form template',
      version: 1,
      isActive: false,
      fields: [
        // Start with basic patient identification fields
        {
          id: 'patient-name',
          type: 'text',
          label: 'Patient Name',
          name: 'patientName',
          required: true,
          placeholder: 'Enter patient full name',
          width: 'half'
        },
        {
          id: 'mrn',
          type: 'text',
          label: 'MRN',
          name: 'mrn',
          required: true,
          placeholder: 'Medical Record Number',
          width: 'half'
        },
        {
          id: 'bed-number',
          type: 'text',
          label: 'Bed Number',
          name: 'bedNumber',
          required: true,
          placeholder: 'e.g., MW-12',
          width: 'half'
        }
      ],
      sections: [
        {
          id: 'main-section',
          name: 'Form Content',
          description: 'Main form fields - customize as needed',
          order: 1,
          isCollapsible: false,
          isCollapsed: false
        }
      ],
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
      // Ensure departments array and sync legacy department to first
      const depts = Array.isArray((template as any).departments)
        ? (template as any).departments
        : (template.department ? [template.department] : []);
      let body: any = { ...template, departments: depts, department: depts[0] || template.department };

      // Decide update vs create strictly by id existence in backend
      // Fetch minimal list to check if this id exists server-side
      let latest: any[] = await fetch('/api/form-templates').then(r => r.ok ? r.json() : []);
      latest = Array.isArray(latest) ? latest : [];
      const idExists = template.id && latest.some((t: any) => String(t.id) === String(template.id));
      if (idExists) {
        url = `/api/form-templates/${template.id}`;
        method = 'PUT';
      } else {
        // Create new; server will assign id. Do not send client-generated id to avoid accidental overwrite.
        const { id, ...rest } = template as any;
        body = { ...rest, departments: depts, department: depts[0] || rest.department };
      }

      const saveRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!saveRes.ok) {
        let detail = '';
        try {
          const errBody = await saveRes.json();
          detail = errBody?.error || JSON.stringify(errBody);
        } catch {
          try { detail = await saveRes.text(); } catch {}
        }
        throw new Error(`Failed to save template (status ${saveRes.status}): ${detail}`);
      }
      const savedTemplate = await saveRes.json();

      // Activate saved/updated template
      const actRes = await fetch(`/api/form-templates/${savedTemplate.id}/set-active`, { method: 'PATCH' });
      if (!actRes.ok) {
        let detail = '';
        try {
          const errBody = await actRes.json();
          detail = errBody?.error || JSON.stringify(errBody);
        } catch {
          try { detail = await actRes.text(); } catch {}
        }
        throw new Error(`Failed to activate template (status ${actRes.status}): ${detail}`);
      }
      const activeTemplate = await actRes.json();

      const parsedTemplate = {
        ...activeTemplate,
        id: activeTemplate.id?.toString?.() ?? '',
        fields: typeof activeTemplate.fields === 'string' ? JSON.parse(activeTemplate.fields) : (activeTemplate.fields || []),
        sections: typeof activeTemplate.sections === 'string' ? JSON.parse(activeTemplate.sections) : (activeTemplate.sections || []),
        departments: Array.isArray((activeTemplate as any).departments)
          ? (activeTemplate as any).departments
          : (activeTemplate.department ? [activeTemplate.department] : [])
      };

      // Update local list: add or replace by id only (do not collapse by name/department)
      setTemplates(prev => {
        const exists = prev.some(t => t.id === parsedTemplate.id);
        return exists
          ? prev.map(t => (t.id === parsedTemplate.id ? parsedTemplate : t))
          : [parsedTemplate, ...prev];
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
    if (window.confirm('Are you sure you want to delete this template?')) {
      fetch(`/api/form-templates/${templateId}`, { method: 'DELETE' })
        .then(async res => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete template');
          }
          setTemplates(prev => prev.filter(t => t.id !== templateId));
          alert('Template deleted successfully.');
        })
        .catch(err => {
          alert('Error deleting template: ' + err.message);
        });
    }
  };

  const handleToggleActive = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newActiveStatus = !Boolean(template.isActive);
    
    fetch(`/api/form-templates/${templateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...template,
        isActive: newActiveStatus
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update template status');
        return res.json();
      })
      .then(() => {
        setTemplates(prev => prev.map(t =>
          t.id === templateId ? { ...t, isActive: newActiveStatus } : t
        ));
        if (typeof reportRefetchTemplates === 'function') reportRefetchTemplates();
      })
      .catch(err => {
        alert('Error updating template status: ' + err.message);
      });
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'designer':
        return (
          <FormDesigner
            template={currentTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setCurrentView('list');
              setCurrentTemplate(null);
            }}
          />
        );
      case 'preview':
        return (
          <FormPreview
            template={currentTemplate}
            onBack={() => setCurrentView('list')}
          />
        );
      default:
        return (
          <>
            {/* Form Creation Instructions */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Create Dynamic Forms</h3>
              <div className="text-blue-800 space-y-2">
                <p>• <strong>Any Form Type:</strong> Create ISBAR, clinical assessments, audit forms, or any custom form</p>
                <p>• <strong>Department Assignment:</strong> Choose which department can access the form</p>
                <p>• <strong>Dynamic Fields:</strong> Add, remove, or modify fields as needed</p>
                <p>• <strong>Easy Updates:</strong> Edit existing forms anytime to add new fields or change requirements</p>
              </div>
            </div>

            {/* Current Templates Table */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Templates</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fields</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {templates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                          No forms found. Click "Create New Form" to get started.
                        </td>
                      </tr>
                    ) : (
                      // Only show unique (name, department) pairs, most recent first
                      Array.from(
                        new Map(templates.map(t => [`${t.name}__${t.department}`, t])).values()
                      ).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">{t.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{t.department}</td>
                          <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                t.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {t.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{t.fields?.length || 0} fields</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Unknown'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Template Manager */}
            <TemplateManager
              templates={templates}
              onEdit={handleEditTemplate}
              onPreview={handlePreviewTemplate}
              onDelete={handleDeleteTemplate}
              onToggleActive={handleToggleActive}
              onImport={async (importedTemplates) => {
                // Fetch latest templates once
                let current = await fetch('/api/form-templates').then(r => r.ok ? r.json() : []);
                if (!Array.isArray(current)) current = [];
                // Normalize
                current = current.map((t: any) => ({
                  ...t,
                  id: t.id?.toString?.() ?? '',
                  departments: Array.isArray(t.departments) ? t.departments : (t.department ? [t.department] : [])
                }));

                for (const t of importedTemplates) {
                  const tDepts = Array.isArray((t as any).departments) ? (t as any).departments : (t.department ? [t.department] : []);
                  const match = current.find((x: any) => x.name === t.name && x.department === (tDepts[0] || t.department));
                  if (match) {
                    // Update existing when name+department unchanged
                    await fetch(`/api/form-templates/${match.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...match,
                        name: t.name,
                        department: tDepts[0] || t.department,
                        departments: tDepts,
                        description: t.description,
                        version: t.version ?? match.version ?? 1,
                        isActive: t.isActive ?? match.isActive ?? false,
                        fields: t.fields || [],
                        sections: t.sections || []
                      })
                    });
                  } else {
                    // Create new only if name or department changed (no match)
                    await fetch('/api/form-templates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...t, id: undefined, departments: tDepts, department: tDepts[0] || t.department })
                    });
                  }
                }

                // Refetch templates from backend and normalize
                fetch('/api/form-templates')
                  .then(res => res.json())
                  .then(data => setTemplates(Array.isArray(data) ? data.map(t => ({
                    ...t,
                    id: t.id?.toString?.() ?? '',
                    fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
                    sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
                    departments: Array.isArray((t as any).departments) ? (t as any).departments : (t.department ? [t.department] : [])
                  })) : []));
              }}
              userRole={user?.role || 'user'}
              userDepartment={user?.department || ''}
            />
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dynamic Form Builder</h2>
          <p className="text-gray-600 mt-1">
            Create any type of form for {user?.role === 'admin' ? 'any department' : user?.department}
          </p>
        </div>
        {hasPermission('form-builder', 'create') && (
          <button
            onClick={handleCreateTemplate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Form
          </button>
        )}
      </div>

      {/* Navigation breadcrumbs */}
      {currentView !== 'list' && (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <button
            onClick={() => setCurrentView('list')}
            className="hover:text-gray-700"
          >
            Form Builder
          </button>
          <span>/</span>
          <span className="text-gray-900">
            {currentView === 'designer' ? 'Form Designer' : 'Preview'}
          </span>
        </div>
      )}

      {renderCurrentView()}
    </div>
  );
};