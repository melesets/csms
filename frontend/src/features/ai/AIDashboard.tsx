// AI Dashboard - Detailed patient analysis
import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  Clock,
  Heart,
  RefreshCw,
  Shield,
  Zap,
  Loader2,
  Info,
  Stethoscope,
  TrendingUp,
  Activity,
  Thermometer,
  Wind,
  Droplets,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { IsbarLoader } from '../../components/shared';

interface PatientData {
  id: string;
  patientName: string;
  mrn: string;
  bedNumber: string;
  department: string;
  stability: 'stable' | 'unstable' | 'critical';
  lastHandover: string;
  diagnosis: string;
  age: number;
  gender: 'M' | 'F';
  shift: string | null;
  assignedNurse: string;
  heartRate: string | null;
  bloodPressure: string | null;
  temperature: string | null;
  respiratoryRate: string | null;
  oxygenSaturation: string | null;
  bloodGlucose: string | null;
  painLevel: string | null;
  weight: string | null;
  height: string | null;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  patient?: string;
  mrn?: string;
}

interface Recommendation {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

interface PatientAnalysis {
  mrn: string;
  name: string;
  status: string;
  riskLevel: string;
  age?: number;
  gender?: string;
  bed?: string;
  diagnosis?: string;
  analysis: string;
  monitoring: string;
  concerns: string[];
  lastUpdate?: string;
  assignedNurse?: string;
}

interface AIInsights {
  summary: string;
  alerts: Alert[];
  recommendations: Recommendation[];
  patientAnalysis: PatientAnalysis[];
  trendInsight: string;
  riskFactors: string[];
  positiveIndicators: string[];
  generatedAt: string;
  isAI: boolean;
}

interface Metrics {
  total: number;
  critical: number;
  unstable: number;
  stable: number;
  criticalRate: string;
}

const AIDashboard: React.FC = () => {
  const { getUserDepartmentFilter } = useAuth();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const dept = getUserDepartmentFilter();
      const params = new URLSearchParams({ timeRange: selectedTimeRange });
      if (dept) params.append('department', dept);
      const res = await fetch(`/api/ai/patient-data?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
        setMetrics(data.metrics || null);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [getUserDepartmentFilter, selectedTimeRange]);

  const generateInsights = useCallback(async () => {
    if (!metrics) return;
    try {
      setInsightsLoading(true);
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients, metrics, timeRange: selectedTimeRange, department: getUserDepartmentFilter() || '' })
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, [patients, metrics, selectedTimeRange, getUserDepartmentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (metrics && !loading) generateInsights(); }, [metrics, loading, generateInsights]);

  const getVitalStatus = (type: string, value: string | null): 'normal' | 'warning' | 'critical' | 'none' => {
    if (!value) return 'none';
    const num = parseFloat(value);
    if (isNaN(num)) return 'none';
    switch (type) {
      case 'hr': return num < 60 || num > 100 ? (num < 40 || num > 120 ? 'critical' : 'warning') : 'normal';
      case 'bp': return 'normal';
      case 'temp': return num < 36.1 || num > 37.8 ? (num < 35 || num > 39 ? 'critical' : 'warning') : 'normal';
      case 'rr': return num < 12 || num > 20 ? (num < 8 || num > 28 ? 'critical' : 'warning') : 'normal';
      case 'spo2': return num < 94 ? (num < 90 ? 'critical' : 'warning') : 'normal';
      case 'glucose': return num < 70 || num > 140 ? (num < 54 || num > 200 ? 'critical' : 'warning') : 'normal';
      case 'pain': return num >= 7 ? 'critical' : num >= 4 ? 'warning' : 'normal';
      default: return 'normal';
    }
  };

  const getVitalColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      case 'normal': return 'text-green-600 bg-green-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  if (loading && !metrics) {
    return <div className="flex items-center justify-center py-20"><IsbarLoader size={48} /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#003153] rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Patient Analysis</h1>
              <p className="text-sm text-gray-500">Detailed clinical insights for each patient</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />{lastRefresh.toLocaleTimeString()}
            </span>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#003153] text-white text-sm font-medium rounded-xl hover:bg-[#002640] transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 bg-gray-50 p-1 rounded-xl w-fit border border-gray-100">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button key={range} onClick={() => setSelectedTimeRange(range)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                selectedTimeRange === range ? 'bg-[#003153] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}>
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', value: metrics?.total || 0, icon: <User className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Critical', value: metrics?.critical || 0, icon: <Heart className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Stability Score', value: `${metrics && metrics.total > 0 ? Math.round((metrics.stable / metrics.total) * 100) : 100}%`, icon: <Shield className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Unstable', value: metrics?.unstable || 0, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center ${stat.color} mb-3`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {insights && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[#003153] rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Clinical Summary</h2>
            {insights.isAI && <span className="px-2 py-0.5 bg-[#003153]/10 text-[#003153] text-xs font-semibold rounded-lg">AI</span>}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{insights.summary}</p>
          {insights.trendInsight && (
            <p className="text-sm text-gray-500 mt-3 flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />{insights.trendInsight}
            </p>
          )}
        </div>
      )}

      {/* Alerts */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Zap className="w-4 h-4 text-amber-500" />Patient Alerts
          </h2>
          {insights && insights.alerts.length > 0 && (
            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100">{insights.alerts.length}</span>
          )}
        </div>
        {insightsLoading ? (
          <div className="text-center py-6"><Loader2 className="w-6 h-6 text-[#003153] animate-spin mx-auto mb-2" /><p className="text-sm text-gray-500">Analyzing...</p></div>
        ) : insights && insights.alerts.length > 0 ? (
          <div className="space-y-2">
            {insights.alerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                alert.type === 'critical' ? 'bg-red-50 border-red-100' : alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  alert.type === 'critical' ? 'bg-red-100 text-red-600' : alert.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {alert.type === 'critical' ? <Heart className="w-4 h-4" /> : alert.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{alert.title}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      alert.priority === 'high' ? 'bg-red-100 text-red-700' : alert.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>{alert.priority.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6"><CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" /><p className="text-sm text-gray-500">No alerts</p></div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
          <Stethoscope className="w-4 h-4 text-[#003153]" />Care Recommendations
        </h2>
        {insightsLoading ? (
          <div className="text-center py-6"><Loader2 className="w-6 h-6 text-[#003153] animate-spin mx-auto mb-2" /></div>
        ) : insights && insights.recommendations.length > 0 ? (
          <div className="space-y-2">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  rec.impact === 'high' ? 'bg-red-50 text-red-600' : rec.impact === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                }`}><Stethoscope className="w-4 h-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{rec.title}</h3>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      rec.impact === 'high' ? 'bg-red-100 text-red-700' : rec.impact === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>{rec.impact.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500 text-center py-4">No recommendations</p>}
      </div>

      {/* Detailed Patient Analysis */}
      {insights && insights.patientAnalysis && insights.patientAnalysis.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
            <Activity className="w-4 h-4 text-[#003153]" />Detailed Patient Analysis
          </h2>
          <div className="space-y-3">
            {insights.patientAnalysis.map((pa, i) => {
              const patient = patients.find(p => p.mrn === pa.mrn);
              const isExpanded = expandedPatient === pa.mrn;
              return (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedPatient(isExpanded ? null : pa.mrn)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      pa.status === 'critical' ? 'bg-red-100 text-red-700' : pa.status === 'unstable' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>{pa.name?.charAt(0) || '?'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{pa.name}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          pa.riskLevel === 'high' ? 'bg-red-100 text-red-700' : pa.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}>{pa.riskLevel.toUpperCase()} RISK</span>
                      </div>
                      <p className="text-xs text-gray-500">MRN: {pa.mrn} | Bed: {pa.bed || 'N/A'} | {pa.age}y, {pa.gender} | {pa.diagnosis}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </button>

                  {isExpanded && patient && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                      {/* Vitals Grid */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vital Signs</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { label: 'Heart Rate', value: patient.heartRate, unit: 'bpm', type: 'hr', icon: <Heart className="w-3.5 h-3.5" /> },
                            { label: 'Blood Pressure', value: patient.bloodPressure, unit: '', type: 'bp', icon: <Droplets className="w-3.5 h-3.5" /> },
                            { label: 'Temperature', value: patient.temperature, unit: '°C', type: 'temp', icon: <Thermometer className="w-3.5 h-3.5" /> },
                            { label: 'Resp. Rate', value: patient.respiratoryRate, unit: '/min', type: 'rr', icon: <Wind className="w-3.5 h-3.5" /> },
                            { label: 'SpO2', value: patient.oxygenSaturation, unit: '%', type: 'spo2', icon: <Activity className="w-3.5 h-3.5" /> },
                            { label: 'Glucose', value: patient.bloodGlucose, unit: 'mg/dL', type: 'glucose', icon: <Droplets className="w-3.5 h-3.5" /> },
                            { label: 'Pain Level', value: patient.painLevel, unit: '/10', type: 'pain', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                          ].map((vital) => {
                            const status = getVitalStatus(vital.type, vital.value);
                            return (
                              <div key={vital.label} className={`p-2.5 rounded-lg ${getVitalColor(status)}`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  {vital.icon}
                                  <span className="text-[10px] font-medium opacity-75">{vital.label}</span>
                                </div>
                                <p className="text-lg font-bold">{vital.value || '—'}<span className="text-xs font-normal ml-0.5">{vital.value ? vital.unit : ''}</span></p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* AI Analysis */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" />AI Analysis
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{pa.analysis}</p>
                      </div>

                      {/* Monitoring */}
                      <div className="bg-blue-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Monitoring Plan</h4>
                        <p className="text-sm text-gray-700">{pa.monitoring}</p>
                      </div>

                      {/* Concerns */}
                      {pa.concerns.length > 0 && (
                        <div className="bg-amber-50 rounded-xl p-4">
                          <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Concerns</h4>
                          <ul className="space-y-1">
                            {pa.concerns.map((c, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Last update: {pa.lastUpdate ? new Date(new Date(pa.lastUpdate).getTime() + 3 * 3600 * 1000).toLocaleString() : 'N/A'}</span>
                        <span>Nurse: {pa.assignedNurse || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk & Positive */}
      {((insights?.riskFactors.length || 0) > 0 || (insights?.positiveIndicators.length || 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights && insights.riskFactors.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />Patient Risk Factors
              </h3>
              <ul className="space-y-2">
                {insights.riskFactors.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 shrink-0" />{risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights && insights.positiveIndicators.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <CheckCircle className="w-4 h-4 text-green-500" />Positive Indicators
              </h3>
              <ul className="space-y-2">
                {insights.positiveIndicators.map((positive, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 shrink-0" />{positive}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDashboard;
