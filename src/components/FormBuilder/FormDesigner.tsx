import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, ArrowLeft, Eye, Plus, Settings } from 'lucide-react';
import { FormTemplate, FormField, FormSection } from '../../types/formBuilder';
import { FieldLibrary } from './FieldLibrary';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';

interface FormDesignerProps {
  template: FormTemplate | null;
  onSave: (template: FormTemplate) => void;
  onCancel: () => void;
}

export const FormDesigner: React.FC<FormDesignerProps> = ({ template, onSave, onCancel }) => {
  const [currentTemplate, setCurrentTemplate] = useState<FormTemplate>(
    template || {
      id: '',
      name: 'New Form Template',
      department: 'NICU',
      description: '',
      version: 1,
      isActive: false,
      fields: [],
      sections: [],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
  
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'settings'>('design');

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
      name: `${fieldType.type}_${Date.now()}`
    };

    setCurrentTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
  }, []);

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

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setCurrentTemplate(prev => {
        const oldIndex = prev.fields.findIndex(field => field.id === active.id);
        const newIndex = prev.fields.findIndex(field => field.id === over.id);

        return {
          ...prev,
          fields: arrayMove(prev.fields, oldIndex, newIndex)
        };
      });
    }
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

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Field Library */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
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
            <FieldLibrary onAddField={handleAddField} />
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
                  <option value="NICU">NICU</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="ICU">ICU</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Oncology">Oncology</option>
                </select>
              </div>

              <div className="flex items-center">
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentTemplate.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentTemplate.fields.length} field{currentTemplate.fields.length !== 1 ? 's' : ''} • {currentTemplate.department}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
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
              {currentTemplate.fields.length === 0 ? (
                <div className="text-center py-12">
                  <Plus className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Start Building Your Form
                  </h3>
                  <p className="text-gray-500">
                    Drag fields from the left panel to build your ISBAR form template.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={currentTemplate.fields.map(field => field.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {currentTemplate.fields.map((field) => (
                        <div
                          key={field.id}
                          onClick={() => setSelectedField(field)}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                            selectedField?.id === field.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              {field.label}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {field.type}
                              </span>
                              {field.required && (
                                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                  Required
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Field Preview */}
                          <div className="text-sm text-gray-600">
                            {field.placeholder || 'No placeholder'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Field Editor */}
        {selectedField && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <FieldEditor
              field={selectedField}
              onUpdate={handleUpdateField}
              onDelete={handleDeleteField}
            />
          </div>
        )}
      </div>
    </div>
  );
};