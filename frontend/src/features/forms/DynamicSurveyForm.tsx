// Dynamic survey form - general forms without staff attribution
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { FormTemplate } from '../../types/formBuilder';
import { DynamicFormRenderer } from '../form-builder';
import { FileText, Clock, User, ChevronRight, CheckCircle, ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useShift } from '../../hooks/useShift';

interface DynamicSurveyFormProps {
  onFormSubmit?: (data: any) => void;
}

export const DynamicSurveyForm: React.FC<DynamicSurveyFormProps> = ({ onFormSubmit }) => {
  const { user, getUserDepartmentFilter } = useAuth();
  const { shift: currentShiftName } = useShift();
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
      const normalizeProfession = (p: any) => {
        const s = String(p ?? '').toLowerCase().trim();
        if (!s) return '';
        if (['gp', 'g.p', 'general practitioner', 'general-practitioner', 'generalpractitioner'].includes(s)) return 'general practitioner';
        if (['sp', 'senior', 'senior physician', 'senior-physician', 'seniorphysician', 'physician'].includes(s)) return 'senior physician';
        if (['nurse', 'nursing'].includes(s)) return 'nurse';
        if (['midwife', 'midwifery'].includes(s)) return 'midwifery';
        return s;
      };

      let url = '/api/form-templates';
      const qs: string[] = [];
      if (departmentFilter) qs.push(`department=${encodeURIComponent(departmentFilter)}`);
      if (user?.profession) qs.push(`profession=${encodeURIComponent(user.profession)}`);
      qs.push('requiresReporter=false');
      if (qs.length) url += `?${qs.join('&')}`;

      const res = await fetch(url);
      const data = res.ok ? await res.json() : [];

      const parsedTemplates = (Array.isArray(data) ? data : []).map((template: any) => ({
        ...template,
        fields: typeof template.fields === 'string' ? JSON.parse(template.fields) : (template.fields || []),
        sections: template.sections === null ? [] : (typeof template.sections === 'string' ? JSON.parse(template.sections) : (template.sections || []))
      }));

      const filteredTemplates = parsedTemplates.filter((template: any) => {
        const isActive = template.isActive || template.is_active;
        if (!departmentFilter) return false;
        const norm = (s: any) => String(s ?? '').toLowerCase().trim();
        const deptFilterNorm = norm(departmentFilter);
        const legacyMatch = norm(template.department) === deptFilterNorm;
        const arrayMatch = Array.isArray(template.departments) && template.departments.some((d: any) => norm(d) === deptFilterNorm);
        const departmentMatch = legacyMatch || arrayMatch;
        const professionMatch = user?.profession
          ? normalizeProfession(template.profession) === normalizeProfession(user.profession)
          : true;
        return isActive && departmentMatch && professionMatch;
      });

      setTemplates(filteredTemplates);
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
        submitted_by_profession: user.profession,
        submitted_at: new Date().toISOString()
      };

      const response = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gray-100 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 bg-gray-100 rounded w-48 animate-pulse" />
              <div className="h-3 bg-gray-50 rounded w-64 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="h-5 bg-gray-100 rounded-full w-14" />
              </div>
              <div className="h-5 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-full mb-4" />
              <div className="h-8 bg-gray-50 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Submitted Successfully</h3>
          <p className="text-sm text-gray-500">Your documentation has been saved to the database.</p>
        </div>
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedTemplate(null)}
                className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h1>
                <p className="text-sm text-gray-500">{selectedTemplate.department}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#003153]/5 border border-[#003153]/10 px-4 py-2 rounded-xl">
              <span className="text-[10px] font-bold text-[#003153]/70 uppercase tracking-wider">Documentation</span>
              <span className="text-sm font-semibold text-[#003153]">{user?.name}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <DynamicFormRenderer
            template={selectedTemplate}
            onSubmit={handleFormSubmit}
            onSuccess={() => { }}
          />
        </div>

        {submitting && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-xl">
              <span className="w-8 h-8 border-3 border-[#003153]/20 border-t-[#003153] rounded-full animate-spin" />
              <span className="text-sm font-medium text-gray-600">Submitting...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#003153] rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documentation</h1>
            <p className="text-sm text-gray-500">
              {user?.department} — {currentShiftName} Shift
            </p>
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Documentation Available</h3>
          <p className="text-sm text-gray-500">No documentation forms are available for your department yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="bg-white rounded-2xl border border-gray-100 p-5 text-left transition-all hover:shadow-lg hover:shadow-gray-100/80 hover:border-gray-200 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-[#003153]/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#003153]" />
                </div>
                <div className="flex items-center gap-2">
                  {(template.isActive || (template as any).is_active) && (
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 uppercase tracking-wider">
                      Active
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">
                    v{template.version || 1}
                  </span>
                </div>
              </div>

              <h3 className="text-base font-semibold text-gray-900 mb-1">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {template.description || 'No description available'}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{template.department}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{template.fields?.length || 0} fields</span>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-medium text-[#003153]">Fill Out Documentation</span>
                <ChevronRight className="w-4 h-4 text-[#003153]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
