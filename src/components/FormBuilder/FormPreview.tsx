import React, { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { FormTemplate } from '../../types/formBuilder';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import { useAuth } from '../../hooks/useAuth';

interface FormPreviewProps {
  template: FormTemplate | null;
  onBack: () => void;
}

export const FormPreview: React.FC<FormPreviewProps> = ({ template, onBack }) => {
  const [isInteractive, setIsInteractive] = useState(false);
  const { user } = useAuth();

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No template selected for preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Form Preview</h2>
              <p className="text-gray-600">
                {template.name} • {template.department}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isInteractive}
              onChange={(e) => setIsInteractive(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm text-gray-700">Interactive Mode</label>
          </div>
          
          <div className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            <Play className="w-4 h-4 mr-1" />
            Preview Mode
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
        </div>
        <div className="p-6">
          <DynamicFormRenderer
            template={template}
            onSubmit={async (data) => {
              if (isInteractive) {
                try {
                  const res = await fetch('/api/form-submissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      template_id: template.id,
                      template_name: template.name,
                      template_department: template.department,
                      form_data: data,
                      submitted_by: user?.username || 'preview-user',
                      submitted_by_name: user?.name || 'Preview User',
                      submitted_by_department: user?.department || template.department,
                      submitted_by_profession: user?.profession || null,
                      submitted_at: new Date().toISOString(),
                    })
                  });
                  if (!res.ok) throw new Error('Failed to submit form');
                  alert('Form submitted and saved!');
                } catch (err) {
                  let msg = 'Unknown error';
                  if (err && typeof err === 'object' && 'message' in err) {
                    msg = (err as any).message;
                  } else if (typeof err === 'string') {
                    msg = err;
                  } else {
                    msg = JSON.stringify(err);
                  }
                  alert('Error submitting form: ' + msg);
                }
              }
            }}
            isPreview={!isInteractive}
          />
        </div>
      </div>
    </div>
  );
};