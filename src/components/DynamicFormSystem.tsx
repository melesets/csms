import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FormTemplate } from '../types/formBuilder';
import { DynamicFormRenderer } from './FormBuilder/DynamicFormRenderer';
import { FileText, Clock, User } from 'lucide-react';
import IsbarLoader from './IsbarLoader';

interface DynamicFormSystemProps {
  onFormSubmit?: (data: any) => void;
}

export const DynamicFormSystem: React.FC<DynamicFormSystemProps> = ({ onFormSubmit }) => {
  const { user, getUserDepartmentFilter } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const departmentFilter = getUserDepartmentFilter();

      // Fetch active templates for department (+ profession when available)
      let url = '/api/form-templates';
      if (departmentFilter) {
        url += `?department=${encodeURIComponent(departmentFilter)}`;
        if (user?.profession) {
          url += `&profession=${encodeURIComponent(user.profession)}`;
        }
      }
      const templatesRes = await fetch(url);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        const parsedTemplates = data.map((template: any) => ({
          ...template,
          fields: typeof template.fields === 'string' ? JSON.parse(template.fields) : (template.fields || []),
          sections: template.sections === null ? [] : (typeof template.sections === 'string' ? JSON.parse(template.sections) : (template.sections || []))
        }));

        // Show all active templates for the user's department; backend already filters by profession when provided
        const filteredTemplates = parsedTemplates.filter((template: any) => {
          const isActive = template.isActive || template.is_active;
          const departmentMatch = !departmentFilter || template.department === departmentFilter;
          return isActive && departmentMatch;
        });

        setTemplates(filteredTemplates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!selectedTemplate || !user) return;

    try {
      setSubmitting(true);

      const submissionData = {
        template_id: selectedTemplate.id,
        template_name: selectedTemplate.name,
        template_department: selectedTemplate.department,
        form_data: formData,
        submitted_by: user.username,
        submitted_by_name: user.name,
        submitted_by_department: user.department,
        submitted_at: new Date().toISOString()
      };

      const response = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          setSelectedTemplate(null);
        }, 2000);

        if (onFormSubmit) {
          onFormSubmit(submissionData);
        }
      } else {
        throw new Error('Failed to submit form');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 flex items-center justify-center"><IsbarLoader message="Loading forms..." size={72} /></div>;
  }

  if (submitSuccess) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Form Submitted Successfully!</h3>
        <p className="text-gray-600">Your form has been saved to the database.</p>
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedTemplate.name}</h2>
            <p className="text-gray-600 mt-1">{selectedTemplate.department}</p>
          </div>
          <button
            onClick={() => setSelectedTemplate(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back to Form List
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <DynamicFormRenderer
            template={selectedTemplate}
            onSubmit={handleFormSubmit}
            onSuccess={() => {}}
          />
        </div>

        {submitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <IsbarLoader message="Submitting form..." size={64} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Available Forms</h2>
        <p className="text-gray-600 mt-1">
          Select a form to fill out for {user?.department}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Forms Available</h3>
          <p className="text-gray-600">
            No forms are available for your department yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    v{template.version || 1}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {template.name}
                </h3>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {template.description || 'No description available'}
                </p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {template.department}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {template.fields?.length || 0} fields
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Fill Out Form →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};