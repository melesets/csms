import React, { useState } from 'react';
import { Save, Eye, Settings, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { FormTemplate } from '../../types/formBuilder';
import { mockFormTemplates } from '../../data/mockData';
import { TemplateManager } from './TemplateManager';
import { FormDesigner } from './FormDesigner';
import { FormPreview } from './FormPreview';

type ViewMode = 'list' | 'designer' | 'preview';

export const FormBuilder = () => {
  const { user, hasPermission } = useAuth();
  const [templates, setTemplates] = useLocalStorage<FormTemplate[]>('form_templates', mockFormTemplates);
  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate | null>(null);

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
      id: Date.now().toString(),
      name: 'New Form Template',
      department: user?.department === 'All' ? 'NICU' : user?.department || 'NICU',
      description: 'A new ISBAR form template',
      version: 1,
      isActive: false,
      fields: [],
      sections: [
        {
          id: 'patient-info',
          name: 'Patient Information',
          description: 'Basic patient details',
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

  const handleSaveTemplate = (template: FormTemplate) => {
    // Remove id so backend uses SERIAL id
    const { id, ...templateWithoutId } = template;
    fetch('/api/form-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateWithoutId)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save template');
        return res.json();
      })
      .then(savedTemplate => {
        // Set the saved template as active
        fetch(`/api/form-templates/${savedTemplate.id}/set-active`, {
          method: 'PATCH',
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to activate template');
            return res.json();
          })
          .then(activeTemplate => {
            const existingIndex = templates.findIndex(t => t.id === activeTemplate.id);
            if (existingIndex !== -1) {
              setTemplates(prev => prev.map((t, index) => 
                index === existingIndex ? { ...activeTemplate, updatedAt: new Date().toISOString() } : t
              ));
            } else {
              setTemplates(prev => [activeTemplate, ...prev]);
            }
            setCurrentView('list');
            setCurrentTemplate(null);
            alert('Template saved and set as active!');
          })
          .catch(err => {
            alert('Error activating template: ' + err.message);
          });
      })
      .catch(err => {
        alert('Error saving template: ' + err.message);
      });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      // Delete from backend
      fetch(`/api/form-templates/${templateId}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Failed to delete template');
          setTemplates(prev => prev.filter(t => t.id !== templateId));
        })
        .catch(err => {
          alert('Error deleting template: ' + err.message);
        });
    }
  };

  const handleToggleActive = (templateId: string) => {
    setTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, isActive: !t.isActive } : t
    ));
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
          <TemplateManager
            templates={templates}
            onEdit={handleEditTemplate}
            onPreview={handlePreviewTemplate}
            onDelete={handleDeleteTemplate}
            onToggleActive={handleToggleActive}
            userRole={user?.role || 'user'}
            userDepartment={user?.department || ''}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {currentView === 'list' && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Form Builder</h2>
            <p className="text-gray-600 mt-1">
              Create and manage custom ISBAR form templates for {user?.role === 'admin' ? 'all departments' : user?.department}
            </p>
          </div>
          {hasPermission('form-builder', 'create') && (
            <button
              onClick={handleCreateTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Template
            </button>
          )}
        </div>
      )}

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