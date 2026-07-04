// Dynamic handover form - patient handover with template-driven fields
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { FormTemplate } from '../../types/formBuilder';
import { DynamicFormRenderer } from '../form-builder/DynamicFormRenderer';
import { Shield, Loader2, FileText, AlertCircle } from 'lucide-react';
import { useShift } from '../../hooks/useShift';

interface DynamicHandoverFormProps {
    ward: string;
    profession: string;
    mrn?: string; // Optional for patient-specific handover
    patientName?: string;
    onSuccess: (data: any, template: FormTemplate, reporterInfo?: any) => void;
    onCancel: () => void;
    title?: string;
}

export const DynamicHandoverForm: React.FC<DynamicHandoverFormProps> = ({
    ward,
    profession,
    mrn,
    patientName,
    onSuccess,
    onCancel,
    title = "Clinical Handover"
}) => {
    const { shift: currentShiftName } = useShift();
    const [template, setTemplate] = useState<FormTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();
    const { activeSession } = useShift();
    const [activeStaffList, setActiveStaffList] = useState<any[]>([]);
    const [selectedReporterId, setSelectedReporterId] = useState<string>('');

    useEffect(() => {
        const fetchHandoverTemplate = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch templates for this ward and profession that are "Handover" types
                // We look for name containing "Handover"
                const response = await fetch(`/api/form-templates?department=${encodeURIComponent(ward)}&profession=${encodeURIComponent(profession)}`);

                if (response.ok) {
                    const templates = await response.json();
                    // Find the one that is most likely a handover form
                    const handoverTemplate = templates.find((t: any) =>
                        t.name.toLowerCase().includes('handover') && (t.isActive || t.is_active)
                    );

                    if (handoverTemplate) {
                        // Parse JSON fields/sections if they are strings
                        const parsed = {
                            ...handoverTemplate,
                            fields: typeof handoverTemplate.fields === 'string' ? JSON.parse(handoverTemplate.fields) : handoverTemplate.fields,
                            sections: typeof handoverTemplate.sections === 'string' ? JSON.parse(handoverTemplate.sections) : (handoverTemplate.sections || [])
                        };
                        setTemplate(parsed);
                    } else {
                        setError(`No "Handover" template found for ${ward} (${profession}). Please create one in Form Builder.`);
                    }
                } else {
                    setError('Failed to fetch form templates.');
                }
            } catch (err) {
                console.error('Handover template fetch error:', err);
                setError('Connection error while fetching templates.');
            } finally {
                setLoading(false);
            }
        };

        fetchHandoverTemplate();
    }, [ward, profession]);

    // Fetch active staff for this department
    useEffect(() => {
        if (user?.department && user.role !== 'admin') {
            import('../api').then(({ apiGet }) => {
                apiGet(`/shifts/active-staff/${encodeURIComponent(user.department)}`)
                    .then(data => {
                        const onlineStaff = data.filter((s: any) => s.session_id);
                        setActiveStaffList(onlineStaff);
                        if (onlineStaff.length > 0 && !selectedReporterId) {
                            setSelectedReporterId(onlineStaff[0].id.toString());
                        }
                    })
                    .catch(err => console.error("Failed to fetch active staff", err));
            });
        }
    }, [user, activeSession]);

    const handleFormSubmit = async (formData: Record<string, any>) => {
        if (!template) return;
        const selectedStaff = activeStaffList.find(s => s.id.toString() === selectedReporterId);
        const reporterInfo = selectedStaff ? {
            username: selectedStaff.username,
            name: selectedStaff.name,
            department: selectedStaff.department,
            profession: selectedStaff.profession,
            id: selectedStaff.id
        } : null;
        
        onSuccess(formData, template, reporterInfo);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center shadow-xl border border-gray-100 max-w-md w-full">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Loading handover format...</p>
            </div>
        );
    }

    if (error || !template) {
        return (
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-red-100 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Template Missing</h3>
                <p className="text-gray-600 mb-6">{error}</p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => window.location.href = '/form-builder'}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg"
                    >
                        Go to Builder
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 max-w-3xl w-full mx-auto max-h-[90vh] flex flex-col relative">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3 text-white">
                    <Shield className="w-6 h-6" />
                    <div>
                        <h2 className="text-xl font-bold">{title}</h2>
                        <p className="text-blue-100 text-[10px] uppercase tracking-wider font-bold">
                            {ward} • {profession} • {currentShiftName} Shift
                        </p>
                    </div>
                </div>
                {patientName && (
                    <div className="bg-white/20 px-3 py-1 rounded-full text-white text-xs font-bold backdrop-blur-sm border border-white/20">
                        Patient: {patientName} ({mrn})
                    </div>
                )}
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-900">Customized Handover Format</h4>
                        <p className="text-xs text-blue-700 mt-0.5">
                            This form uses the "{template.name}" template created for your department.
                        </p>
                    </div>
                    {activeStaffList.length > 0 && (
                        <div className="ml-auto flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                            <span className="text-[10px] uppercase font-bold text-blue-600">Reporting As</span>
                            <select 
                                className="text-sm font-bold text-gray-900 outline-none max-w-[120px] truncate"
                                value={selectedReporterId}
                                onChange={e => setSelectedReporterId(e.target.value)}
                            >
                                {activeStaffList.map(staff => (
                                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {activeStaffList.length === 0 && user?.role !== 'admin' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-center">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-amber-900">Handover Locked</h3>
                        <p className="text-amber-800 font-medium">You cannot submit a handover because no shift staff are checked in.</p>
                    </div>
                )}

                <div className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative ${activeStaffList.length === 0 && user?.role !== 'admin' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                    {activeStaffList.length === 0 && user?.role !== 'admin' && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px] bg-white/20"></div>
                    )}
                    <DynamicFormRenderer
                        template={template}
                        onSubmit={handleFormSubmit}
                        initialData={mrn ? { mrn, patientName, patient_name: patientName, MRN: mrn } : {}}
                        onSuccess={() => { }}
                    />
                </div>

                <div className="mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
                    >
                        Cancel and Return
                    </button>
                </div>
            </div>
        </div>
    );
};
