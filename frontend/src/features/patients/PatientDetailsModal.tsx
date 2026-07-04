// Patient details modal - quick view of patient information
import React from 'react';
import { X, Bed, User, Stethoscope, FileText, Clock } from 'lucide-react';

interface PatientDetailsModalProps {
  patient: {
    id: string;
    patientName: string;
    mrn: string;
    bedNumber: string;
    department: string;
    stability: string;
    lastHandover: string;
    assignedNurse: string;
    diagnosis: string;
    age: number;
    gender: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onNewHandover: () => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  patient,
  isOpen,
  onClose,
  onNewHandover
}) => {
  if (!isOpen || !patient) return null;

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'unstable': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'subcritical': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'stable': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Derive Patient Condition label
  const getPatientCondition = (): 'critical' | 'subcritical' | 'stable' => {
    // Fallback to existing stability mapping because modal props don't include formData
    const s = String(patient.stability || '').toLowerCase();
    if (s.includes('critical')) return 'critical';
    if (s.includes('unstable') || s.includes('subcritical')) return 'subcritical';
    return 'stable';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <Bed className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{patient.patientName}</h2>
              <p className="text-gray-600">MRN: {patient.mrn} • Bed {patient.bedNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Patient Information */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Patient Condition</label>
                {(() => { const cond = getPatientCondition(); return (
                <div className={`mt-1 px-3 py-2 rounded-lg border ${getStabilityColor(cond)}`}>
                  <span className="font-medium">{cond === 'critical' ? 'Critical' : cond === 'subcritical' ? 'Subcritical' : 'Stable'}</span>
                </div>
                ); })()}
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Age & Gender</label>
                <div className="mt-1 flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{patient.age} years old, {patient.gender === 'M' ? 'Male' : 'Female'}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Department</label>
                <div className="mt-1 text-gray-900">{patient.department}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Assigned Nurse</label>
                <div className="mt-1 flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{patient.assignedNurse}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Last Handover</label>
                <div className="mt-1 flex items-center">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">
                    {new Date(patient.lastHandover).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnosis/Background */}
          <div>
            <label className="text-sm font-medium text-gray-600">Diagnosis/Background</label>
            <div className="mt-1 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start">
                <Stethoscope className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                <span className="text-gray-900">{patient.diagnosis}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Patient ID: {patient.id}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // Navigate to patient history
                  window.location.href = `#/all-records?patient=${patient.mrn}`;
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                View History
              </button>
              <button
                onClick={() => {
                  onNewHandover();
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                New Handover
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
