import React, { useState, useCallback } from 'react';
import { DEPARTMENTS, PROFESSIONS } from '../../types/auth';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, ArrowLeft, Eye, Plus, Layers } from 'lucide-react';
import { FormTemplate, FormField, FormSection } from '../../types/formBuilder';
import { FieldLibrary } from './FieldLibrary';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';
import { SectionManager } from './SectionManager';
import { SectionedFormCanvas } from './SectionedFormCanvas';
import { FormBuilderGuide } from './FormBuilderGuide';

interface FormDesignerProps {
  template: FormTemplate | null;
  onSave: (template: FormTemplate) => void;
  onCancel: () => void;
}

export const FormDesigner: React.FC<FormDesignerProps> = ({ template, onSave, onCancel }) => {
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate>(() => {
    if (template) {
      return {
        ...template,
        fields: template.fields || [],
        sections: template.sections || []
      };
    }
    return {
      id: '',
      name: 'New Form Template',
      department: 'Medical Ward',
      profession: undefined as any,
      description: '',
      version: 1,
      isActive: false,
      fields: [],
      sections: [],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
  
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'sections' | 'settings'>('design');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddField = useCallback((fieldType: any) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      ...fieldType.defaultProps,
      type: fieldType.type,
      name: `${fieldType.type}_${Date.now()}`,
      section: selectedSectionId || undefined
    };

    setCurrentTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setSelectedField(newField);
  }, [selectedSectionId]);

  const handleUpdateField = useCallback((updatedField: FormField) => {
    setCurrentTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === updatedField.id ? updatedField : field
      )
    }));
    setSelectedField(updatedField);
  }, []);

  const handleDeleteField = useCallback((fieldId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId)
    }));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [selectedField]);

  const handleMoveField = useCallback((fieldId: string, newSectionId: string, newIndex: number) => {
    setCurrentTemplate(prev => {
      const field = prev.fields.find(f => f.id === fieldId);
      if (!field) return prev;

      const updatedField = { ...field, section: newSectionId || undefined };
      const otherFields = prev.fields.filter(f => f.id !== fieldId);
      const sectionFields = otherFields.filter(f => f.section === newSectionId);
      
      // Insert at the specified index within the section
      sectionFields.splice(newIndex, 0, updatedField);
      
      // Combine with fields from other sections
      const fieldsFromOtherSections = otherFields.filter(f => f.section !== newSectionId);
      
      return {
        ...prev,
        fields: [...fieldsFromOtherSections, ...sectionFields]
      };
    });
  }, []);

  const handleAddSection = useCallback(() => {
    const newSection: FormSection = {
      id: `section-${Date.now()}`,
      name: `Section ${currentTemplate.sections.length + 1}`,
      description: '',
      order: currentTemplate.sections.length,
      isCollapsible: true,
      isCollapsed: false
    };

    setCurrentTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setSelectedSectionId(newSection.id);
    
    // Switch to sections tab after creating first section
    if (currentTemplate.sections.length === 0) {
      setActiveTab('sections');
    }
  }, [currentTemplate.sections]);

  const handleUpdateSection = useCallback((updatedSection: FormSection) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.id === updatedSection.id ? updatedSection : section
      )
    }));
  }, []);

  const handleDeleteSection = useCallback((sectionId: string) => {
    if (window.confirm('Are you sure you want to delete this section? Fields in this section will become unassigned.')) {
      setCurrentTemplate(prev => ({
        ...prev,
        sections: prev.sections.filter(section => section.id !== sectionId),
        fields: prev.fields.map(field => 
          field.section === sectionId ? { ...field, section: undefined } : field
        )
      }));
      if (selectedSectionId === sectionId) {
        setSelectedSectionId('');
      }
    }
  }, [selectedSectionId]);

  const handleToggleSection = useCallback((sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.id === sectionId 
          ? { ...section, isCollapsed: !section.isCollapsed }
          : section
      )
    }));
  }, []);

  const handleReorderSections = useCallback((oldIndex: number, newIndex: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: arrayMove(prev.sections, oldIndex, newIndex).map((section, index) => ({
        ...section,
        order: index
      }))
    }));
  }, []);

  const handleSave = () => {
    onSave(currentTemplate);
  };

  const handleTemplateChange = (updates: Partial<FormTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  if (showPreview) {
    return (
      <FormPreview
        template={currentTemplate}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  const hasFields = currentTemplate.fields.length > 0;
  const hasSections = currentTemplate.sections.length > 0;

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('design')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                activeTab === 'design' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Design
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                activeTab === 'sections' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Sections
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                activeTab === 'settings' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'design' ? (
            <div>
              {/* Section Selection for New Fields */}
              {currentTemplate.sections.length > 0 && (
                <div className="p-4 border-b border-gray-200 bg-blue-50">
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Add fields to section:
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {currentTemplate.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-blue-700 mt-1">
                    Fields will be added to the selected section
                  </p>
                </div>
              )}
              
              {/* Show message if no sections */}
              {currentTemplate.sections.length === 0 && (
                <div className="p-4 border-b border-gray-200 bg-amber-50">
                  <p className="text-sm text-amber-800 mb-2">
                    📋 Create sections first to organize your fields
                  </p>
                  <button
                    onClick={() => setActiveTab('sections')}
                    className="text-xs text-amber-700 underline hover:text-amber-900"
                  >
                    Go to Sections tab →
                  </button>
                </div>
              )}
              
              <FieldLibrary onAddField={handleAddField} />
            </div>
          ) : activeTab === 'sections' ? (
            <div className="p-4">
              <SectionManager
                sections={currentTemplate.sections}
                onAddSection={handleAddSection}
                onUpdateSection={handleUpdateSection}
                onDeleteSection={handleDeleteSection}
                onToggleSection={handleToggleSection}
                onReorderSections={handleReorderSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
              />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={currentTemplate.name}
                  onChange={(e) => handleTemplateChange({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={currentTemplate.description}
                  onChange={(e) => handleTemplateChange({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={currentTemplate.department}
                  onChange={(e) => handleTemplateChange({ department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profession (optional)
                </label>
                <select
                  value={currentTemplate.profession || ''}
                  onChange={(e) => handleTemplateChange({ profession: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  {PROFESSIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">If set, this template will be shown only to that profession within the department.</p>
              </div>

              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  checked={currentTemplate.isActive}
                  onChange={(e) => handleTemplateChange({ isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Active Template
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Form Designer */}
      <div className="flex-1 flex">
        <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentTemplate.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentTemplate.fields.length} field{currentTemplate.fields.length !== 1 ? 's' : ''} • 
                  {currentTemplate.sections.length} section{currentTemplate.sections.length !== 1 ? 's' : ''} • 
                  {currentTemplate.department}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={currentTemplate.fields.length === 0}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </button>
                <button
                  onClick={onCancel}
                  className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
              </div>
            </div>

            {/* Form Canvas */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              {!hasFields && !hasSections ? (
                <FormBuilderGuide 
                  onAddSection={handleAddSection}
                  hasFields={hasFields}
                  hasSections={hasSections}
                />
              ) : (
                <>
                  <FormBuilderGuide 
                    onAddSection={handleAddSection}
                    hasFields={hasFields}
                    hasSections={hasSections}
                  />
                  <SectionedFormCanvas
                    fields={currentTemplate.fields}
                    sections={currentTemplate.sections}
                    selectedField={selectedField}
                    onSelectField={setSelectedField}
                    onMoveField={handleMoveField}
                    onReorderSections={handleReorderSections}
                    onToggleSection={handleToggleSection}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Field Editor */}
        {selectedField && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <FieldEditor
              field={selectedField}
              sections={currentTemplate.sections}
              onUpdate={handleUpdateField}
              onDelete={handleDeleteField}
            />
          </div>
        )}
      </div>
    </div>
  );
};