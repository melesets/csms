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
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Form Preview</h2>
            <p className="text-xs text-gray-400">{template.name} · {template.department}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={isInteractive} onChange={(e) => setIsInteractive(e.target.checked)}
              className="w-3.5 h-3.5 text-[#003153] rounded border-gray-300 focus:ring-[#003153]" />
            Interactive Mode
          </label>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
            <Play className="w-3 h-3" />Preview Mode
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
          <p className="text-xs text-gray-400 mt-1">{template.description}</p>
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
