import React from 'react';
import { fieldTemplates } from '../../data/fieldTemplates';
import * as LucideIcons from 'lucide-react';

interface FieldLibraryProps {
  onAddField: (fieldType: any) => void;
}

export const FieldLibrary: React.FC<FieldLibraryProps> = ({ onAddField }) => {
  const categories = [
    { id: 'basic', name: 'Basic Fields', color: 'text-blue-600' },
    { id: 'medical', name: 'Medical Fields', color: 'text-red-600' },
    { id: 'isbar', name: 'ISBAR Fields', color: 'text-green-600' },
    { id: 'advanced', name: 'Advanced Fields', color: 'text-purple-600' }
  ];

  const groupedFields = fieldTemplates.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof fieldTemplates>);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Field Library</h3>
        <p className="text-sm text-gray-600">
          Drag and drop fields to build your form
        </p>
      </div>

      {categories.map((category) => {
        const fields = groupedFields[category.id] || [];
        
        return (
          <div key={category.id}>
            <h4 className={`text-sm font-medium mb-3 ${category.color}`}>
              {category.name}
            </h4>
            
            <div className="space-y-2">
              {fields.map((field) => {
                const IconComponent = (LucideIcons as any)[field.icon];
                
                return (
                  <button
                    key={field.type}
                    onClick={() => onAddField(field)}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      {IconComponent && (
                        <IconComponent className="w-4 h-4 mr-3 text-gray-500" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {field.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {field.type}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};