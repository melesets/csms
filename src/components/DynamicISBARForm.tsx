import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, AlertTriangle, AlertCircle, CheckCircle, User, Clock, Bed } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FormTemplate } from '../types/formBuilder';
import { ISBARRecord, Staff } from '../types';
import { mockStaff } from '../data/mockData';
import { DynamicFormRenderer } from './FormBuilder/DynamicFormRenderer';
import { ISBARForm } from './ISBARForm';

export const DynamicISBARForm = () => {
  const { user } = useAuth();
  const [departmentTemplate, setDepartmentTemplate] = useState<FormTemplate | null>(null);
  const [records, setRecords] = useState<ISBARRecord[]>([]);
  // Fetch ISBAR records from backend on mount or when user/department changes
  useEffect(() => {
    if (user?.department) {
      // Admins get all records, others get only their department
      const url = user.role === 'admin'
        ? '/api/isbar-records'
        : `/api/isbar-records?department=${encodeURIComponent(user.department)}`;
      fetch(url)
        .then(res => res.ok ? res.json() : [])
        .then(data => setRecords(data || []));
    }
  }, [user?.department, user?.role]);
  const [staff] = useState<Staff[]>(mockStaff); // TODO: Replace with backend fetch
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<ISBARRecord | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'form'>('list');

  // Fetch active template for user's department from backend
  useEffect(() => {
    if (user?.department) {
      fetch(`/api/form-templates/department/${user.department}/active-template`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setDepartmentTemplate(data || null);
        });
    }
  }, [user?.department]);

  // Filter records by department for non-admin users
  const filteredRecords = user?.role === 'admin'
    ? records
    : records.filter(record => record.department === user?.department);

  // Group patients by stability
  const patientsByStability = {
    Critical: filteredRecords.filter(record => record.stability === 'Critical'),
    Unstable: filteredRecords.filter(record => record.stability === 'Unstable'),
    Stable: filteredRecords.filter(record => record.stability === 'Stable')
  };

  // Combine all patients into a single array
  const allPatients: ISBARRecord[] = [
    ...patientsByStability.Critical,
    ...patientsByStability.Unstable,
    ...patientsByStability.Stable
  ];

  const handleCreateHandover = (template?: FormTemplate, patient?: ISBARRecord) => {
    setSelectedTemplate(template || null);
    setSelectedPatient(patient || null);
    setCurrentView('form');
  };

  const handleFormSubmit = (formData: Record<string, any>) => {
    // Convert dynamic form data to ISBARRecord format
    const newRecord: ISBARRecord = {
      id: Date.now().toString(),
      patientName: formData.patientName || formData.patient_name || selectedPatient?.patientName || '',
      age: parseInt(formData.age) || selectedPatient?.age || 0,
      mrn: formData.mrn || formData.medical_record_number || selectedPatient?.mrn || '',
      bedNumber: formData.bedNumber || formData.bed_number || selectedPatient?.bedNumber || '',
      department: user?.department || selectedTemplate?.department || 'General',
      nurseName: formData.nurseName || formData.nurse_name || user?.name || '',
      shift: formData.shift || 'Day',
      timestamp: new Date().toISOString(),
      situation: formData.situation || '',
      background: formData.background || '',
      assessment: formData.assessment || '',
      recommendation: formData.recommendation || '',
      vitalSigns: {
        temperature: parseFloat(formData.temperature) || 0,
        heartRate: parseInt(formData.heartRate || formData.heart_rate) || 0,
        bloodPressure: formData.bloodPressure || formData.blood_pressure || '',
        respiratoryRate: parseInt(formData.respiratoryRate || formData.respiratory_rate) || 0,
        oxygenSaturation: parseInt(formData.oxygenSaturation || formData.o2_saturation) || 0
      },
      stability: formData.stability || selectedPatient?.stability || 'Stable'
    };

    setRecords(prev => [newRecord, ...prev]);
    setSelectedTemplate(null);
    setSelectedPatient(null);
    setCurrentView('list');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getStabilityIcon = (stability: string) => {
    switch (stability) {
      case 'Critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'Unstable':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'Stable':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'Critical':
        return 'border-red-200 bg-red-50';
      case 'Unstable':
        return 'border-yellow-200 bg-yellow-50';
      case 'Stable':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  // If form is being shown
  if (currentView === 'form') {
    if (selectedTemplate) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedTemplate.name}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {selectedTemplate.description}
                    {selectedPatient && (
                      <span className="ml-2 text-blue-600">
                        • Patient: {selectedPatient.patientName}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {selectedTemplate.department}
                  </div>
                  <button
                    onClick={() => setCurrentView('list')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Patient List
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {showSuccess && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                  <ClipboardList className="w-5 h-5 text-green-600 mr-3" />
                  <p className="text-green-800">ISBAR handover record saved successfully!</p>
                </div>
              )}
              
              <DynamicFormRenderer
                template={selectedTemplate}
                onSubmit={handleFormSubmit}
                initialData={selectedPatient ? {
                  patientName: selectedPatient.patientName,
                  age: selectedPatient.age,
                  mrn: selectedPatient.mrn,
                  bedNumber: selectedPatient.bedNumber,
                  stability: selectedPatient.stability
                } : undefined}
              />
            </div>
          </div>
        </div>
      );
    } else {
      return <ISBARForm onBack={() => setCurrentView('list')} />;
    }
  }

  // Main patient list view
  // Instead of showing patient cards, show the department's standard ISBAR form
  if (currentView === 'list') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              {departmentTemplate ? departmentTemplate.name : 'ISBAR Handover'}
            </h2>
            <p className="text-gray-600 mt-1">
              {departmentTemplate ? departmentTemplate.description : `Standard ISBAR form for ${user?.department} patients`}
            </p>
          </div>
          <div className="p-6">
            {departmentTemplate ? (
              <DynamicFormRenderer
                template={departmentTemplate}
                onSubmit={handleFormSubmit}
              />
            ) : (
              <div className="text-red-500">No ISBAR form template found for your department.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default to showing the list view with available patients
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ISBAR Handover</h2>
          <p className="text-gray-600 mt-1">
            Manage patient handovers for {user?.role === 'admin' ? 'all departments' : user?.department}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleCreateHandover()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Handover
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <p className="text-green-800">ISBAR handover record saved successfully!</p>
        </div>
      )}

      {/* Individual Patient Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-500 col-span-3">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No patients available</p>
          </div>
        ) : (
          allPatients.map((patient) => (
            <div key={patient.id} className={`p-4 rounded-lg border-2 ${getStabilityColor(patient.stability)}`}> 
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{patient.patientName}</h4>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <Bed className="w-4 h-4 mr-1" />
                    <span>{patient.bedNumber}</span>
                    <User className="w-4 h-4 ml-3 mr-1" />
                    <span>{patient.nurseName}</span>
                  </div>
                </div>
                {getStabilityIcon(patient.stability)}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>Age: {patient.age}</span>
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(patient.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex space-x-2">
                {departmentTemplate ? (
                  <button
                    onClick={() => handleCreateHandover(departmentTemplate, patient)}
                    className={`flex-1 text-white text-xs font-medium py-2 px-3 rounded transition-colors ${patient.stability === 'Critical' ? 'bg-red-600 hover:bg-red-700' : patient.stability === 'Unstable' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {departmentTemplate.name}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCreateHandover(undefined, patient)}
                    className={`flex-1 text-white text-xs font-medium py-2 px-3 rounded transition-colors ${patient.stability === 'Critical' ? 'bg-red-600 hover:bg-red-700' : patient.stability === 'Unstable' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    Standard Form
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};