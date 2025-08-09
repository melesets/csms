import React from 'react';
import { Layers, Plus, Move, Settings, Eye } from 'lucide-react';

interface FormBuilderGuideProps {
  onAddSection: () => void;
  hasFields: boolean;
  hasSections: boolean;
}

export const FormBuilderGuide: React.FC<FormBuilderGuideProps> = ({
  onAddSection,
  hasFields,
  hasSections
}) => {
  if (!hasSections && !hasFields) {
    // Complete empty state
    return (
      <div className="text-center py-12">
        <Layers className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Start Building Your Form
        </h3>
        <p className="text-gray-500 mb-6">
          Follow these steps to create your ISBAR form:
        </p>
        
        <div className="max-w-md mx-auto space-y-4 text-left">
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900">Create Sections</h4>
              <p className="text-xs text-blue-700 mt-1">
                Add sections like "Patient Info", "Situation", "Background", etc.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700">Add Fields</h4>
              <p className="text-xs text-gray-600 mt-1">
                Drag fields from the library into your sections
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700">Customize</h4>
              <p className="text-xs text-gray-600 mt-1">
                Click fields to edit properties and requirements
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={onAddSection}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-6"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create First Section
        </button>
      </div>
    );
  }

  if (!hasSections && hasFields) {
    // Has fields but no sections
    return (
      <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
        <Layers className="mx-auto h-8 w-8 text-amber-600 mb-3" />
        <h3 className="text-md font-medium text-amber-800 mb-2">
          Organize Your Fields into Sections
        </h3>
        <p className="text-sm text-amber-700 mb-4">
          You have fields that need to be organized. Create sections to group related fields together.
        </p>
        <button
          onClick={onAddSection}
          className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </button>
      </div>
    );
  }

  // Has sections - show tips
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
        <Eye className="w-4 h-4 mr-2" />
        Form Builder Tips
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-700">
        <div className="flex items-start space-x-2">
          <Move className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Drag fields from the library to sections</span>
        </div>
        <div className="flex items-start space-x-2">
          <Settings className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Click fields to edit their properties</span>
        </div>
        <div className="flex items-start space-x-2">
          <Layers className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Use the "Sections" tab to manage sections</span>
        </div>
        <div className="flex items-start space-x-2">
          <Eye className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Click "Preview" to test your form</span>
        </div>
      </div>
    </div>
  );
};