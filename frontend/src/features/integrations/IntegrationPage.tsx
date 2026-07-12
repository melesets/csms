// Integration page - manage external system connections (EMR, lab systems, etc.)
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plug, Plus, Trash2, Power, PowerOff, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Settings, Database, ArrowRightLeft, Search, X, Save,
  TestTube, Wifi, WifiOff, Server, Clock, ChevronDown, ChevronRight, Copy
} from 'lucide-react';

interface IntegrationConfig {
  id?: number;
  name: string;
  type: string;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, string>;
  field_mappings: Array<{ source: string; target: string }>;
  sync_settings: Record<string, any>;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  created_at?: string;
}

interface SyncResult {
  success: boolean;
  count?: number;
  patients?: any[];
  duration?: number;
  message?: string;
}

interface ConnectionTest {
  success: boolean;
  status?: number;
  message: string;
}

const INTEGRATION_PRESETS: Record<string, Partial<IntegrationConfig>> = {
  bahmni: {
    name: 'Bahmni EMR',
    type: 'rest',
    auth_type: 'basic',
    auth_config: { username: '', password: '' },
    base_url: '',
    field_mappings: [
      { source: 'uuid', target: 'external_id' },
      { source: 'name', target: 'patient_name' },
      { source: 'gender', target: 'gender' },
      { source: 'age', target: 'age' },
      { source: 'patientIdentifier', target: 'mrn' },
    ],
    sync_settings: { fetch_patient: true, auto_sync: false, sync_interval: 30 },
  },
  openmrs: {
    name: 'OpenMRS',
    type: 'rest',
    auth_type: 'basic',
    auth_config: { username: '', password: '' },
    base_url: '',
    field_mappings: [
      { source: 'uuid', target: 'external_id' },
      { source: 'display', target: 'patient_name' },
      { source: 'gender', target: 'gender' },
      { source: 'age', target: 'age' },
    ],
    sync_settings: { fetch_patient: true, auto_sync: false, sync_interval: 30 },
  },
  hl7: {
    name: 'HL7 FHIR Server',
    type: 'fhir',
    auth_type: 'bearer',
    auth_config: { token: '' },
    base_url: '',
    field_mappings: [
      { source: 'id', target: 'external_id' },
      { source: 'name[0].text', target: 'patient_name' },
      { source: 'gender', target: 'gender' },
      { source: 'birthDate', target: 'dob' },
    ],
    sync_settings: { fetch_patient: true, auto_sync: false, sync_interval: 60 },
  },
  custom: {
    name: 'Custom REST API',
    type: 'rest',
    auth_type: 'none',
    auth_config: {},
    base_url: '',
    field_mappings: [],
    sync_settings: { fetch_patient: true, auto_sync: false, sync_interval: 30 },
  },
};

const AVAILABLE_SOURCE_FIELDS = [
  'uuid', 'id', 'name', 'display', 'patientIdentifier', 'gender', 'age',
  'birthDate', 'dateOfBirth', 'address', 'phone', 'email', 'nationalId',
  'emergencyContact', 'allergies', 'diagnosis', 'ward', 'bed',
];

const AVAILABLE_TARGET_FIELDS = [
  'external_id', 'patient_name', 'mrn', 'gender', 'age', 'dob',
  'phone', 'address', 'email', 'national_id', 'emergency_contact',
  'allergies', 'diagnosis', 'ward', 'bed',
];

export const IntegrationPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IntegrationConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [testResult, setTestResult] = useState<ConnectionTest | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => { fetchIntegrations(); }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.map((c: any) => ({
          ...c,
          auth_config: typeof c.auth_config === 'string' ? JSON.parse(c.auth_config) : (c.auth_config || {}),
          field_mappings: typeof c.field_mappings === 'string' ? JSON.parse(c.field_mappings) : (c.field_mappings || []),
          sync_settings: typeof c.sync_settings === 'string' ? JSON.parse(c.sync_settings) : (c.sync_settings || {}),
        })));
      }
    } catch (err) { console.error('Failed to load integrations'); }
    finally { setLoading(false); }
  };

  const filteredIntegrations = integrations.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (preset?: string) => {
    const p = preset ? INTEGRATION_PRESETS[preset] : INTEGRATION_PRESETS.custom;
    setEditing({ ...p, is_active: false } as IntegrationConfig);
    setShowForm(true);
    setTestResult(null);
  };

  const handleEdit = (config: IntegrationConfig) => {
    setEditing({ ...config });
    setShowForm(true);
    setTestResult(null);
  };

  const handleClone = (config: IntegrationConfig) => {
    setEditing({
      ...config,
      id: undefined,
      name: `${config.name} (Copy)`,
      is_active: false,
      last_sync_at: null,
      last_sync_status: null,
      last_sync_message: null,
    });
    setShowForm(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const method = editing.id ? 'PUT' : 'POST';
      const url = editing.id ? `/api/integrations/${editing.id}` : '/api/integrations';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing)
      });
      if (res.ok) {
        await fetchIntegrations();
        setShowForm(false);
        setEditing(null);
      }
    } catch (err) { alert('Failed to save integration'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this integration?')) return;
    try {
      await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
      await fetchIntegrations();
    } catch (err) { alert('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      await fetch(`/api/integrations/${id}/toggle`, { method: 'PATCH' });
      await fetchIntegrations();
    } catch (err) { alert('Failed to toggle'); }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, message: 'Network error' });
    } finally { setTesting(null); }
  };

  const handleSync = async (id: number) => {
    setSyncing(id);
    try {
      const res = await fetch(`/api/integrations/${id}/sync`, { method: 'POST' });
      const data: SyncResult = await res.json();
      await fetchIntegrations();
      if (data.success) {
        alert(`Synced ${data.count} patients in ${data.duration}ms`);
      } else {
        alert(`Sync failed: ${data.message}`);
      }
    } catch (err) { alert('Sync failed'); }
    finally { setSyncing(null); }
  };

  const getStatusIcon = (config: IntegrationConfig) => {
    if (!config.is_active) return <WifiOff className="w-5 h-5 text-gray-400" />;
    if (config.last_sync_status === 'success') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    if (config.last_sync_status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Wifi className="w-5 h-5 text-blue-500" />;
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      rest: 'bg-blue-50 text-blue-700 border border-blue-200',
      fhir: 'bg-purple-50 text-purple-700 border border-purple-200',
      hl7: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
    return styles[type] || 'bg-gray-100 text-gray-600 border border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#003153] rounded-xl flex items-center justify-center flex-shrink-0">
            <Plug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Integrations</h2>
            <p className="text-sm text-gray-400">Connect external systems — <span className="text-emerald-600 font-medium">Read-only</span>, never modifies external data</p>
          </div>
        </div>
        <button onClick={() => handleCreate()}
          className="bg-[#003153] hover:bg-[#002640] text-white font-semibold text-xs py-2 px-4 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Integration
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search integrations..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      {/* Integration Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-50 rounded-xl border border-gray-200 animate-pulse" />)}
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Plug className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-sm font-medium text-gray-900 mb-1">No integrations configured</p>
          <p className="text-xs text-gray-400 mb-4">Connect to Bahmni EMR, OpenMRS, HL7 FHIR, or any REST API. All connections are read-only.</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {Object.entries(INTEGRATION_PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => handleCreate(key)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-50 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIntegrations.map(config => (
            <div key={config.id} className={`bg-white rounded-xl shadow-sm border transition-all ${config.is_active ? 'border-emerald-200' : 'border-gray-200'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(config)}
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{config.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${getTypeBadge(config.type)}`}>
                          {config.type}
                        </span>
                        {config.auth_type !== 'none' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            {config.auth_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => config.id && handleTest(config.id)} disabled={testing === config.id}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Test Connection">
                      {testing === config.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                    </button>
                    <button onClick={() => config.id && handleSync(config.id)} disabled={syncing === config.id || !config.is_active}
                      className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Read-only: Fetch patients from external system">
                      {syncing === config.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => config.id && handleToggle(config.id)}
                      className={`p-1.5 rounded-lg transition-colors ${config.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={config.is_active ? 'Deactivate' : 'Activate'}>
                      {config.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* URL */}
                <div className="text-xs text-gray-400 mb-3 truncate">
                  <Server className="w-3 h-3 inline mr-1" />
                  {config.base_url || 'No URL configured'}
                </div>

                {/* Sync Status */}
                {config.last_sync_at && (
                  <div className={`text-xs p-2 rounded-lg mb-3 ${config.last_sync_status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    Last sync: {new Date(new Date(config.last_sync_at).getTime() + 3 * 3600 * 1000).toLocaleString()}
                    {config.last_sync_message && ` — ${config.last_sync_message}`}
                  </div>
                )}

                {/* Field Mappings Preview */}
                <button onClick={() => setExpandedCard(expandedCard === config.id ? null : (config.id || 0))}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  {expandedCard === config.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {config.field_mappings.length} field mapping{config.field_mappings.length !== 1 ? 's' : ''}
                </button>

                {expandedCard === config.id && (
                  <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                    {config.field_mappings.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 font-mono">{m.source}</span>
                        <ArrowRightLeft className="w-3 h-3 text-gray-300" />
                        <span className="text-gray-700 font-mono font-medium">{m.target}</span>
                      </div>
                    ))}
                    {config.field_mappings.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No field mappings configured</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => config.id && handleEdit(config)}
                    className="p-1.5 text-gray-400 hover:text-[#003153] hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleClone(config)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Clone">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => config.id && handleDelete(config.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Config Form Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">
                {editing.id ? 'Edit Integration' : 'New Integration'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditing(null); setTestResult(null); }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Preset Selection (only for new) */}
              {!editing.id && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Setup</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(INTEGRATION_PRESETS).map(([key, preset]) => (
                      <button key={key} onClick={() => setEditing(prev => prev ? { ...prev, ...preset, name: preset.name || prev.name } : null)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${editing.name === preset.name ? 'bg-[#003153] text-white border-[#003153]' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Name *</label>
                  <input type="text" value={editing.name}
                    onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Type</label>
                  <select value={editing.type}
                    onChange={e => setEditing(prev => prev ? { ...prev, type: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="rest">REST API</option>
                    <option value="fhir">HL7 FHIR</option>
                    <option value="hl7">HL7 v2</option>
                  </select>
                </div>
              </div>

              {/* Connection */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base URL *</label>
                <input type="text" value={editing.base_url} placeholder="https://bahmni.example.com/openmrs/ws/rest/v1"
                  onChange={e => setEditing(prev => prev ? { ...prev, base_url: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              {/* Auth */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Auth Type</label>
                  <select value={editing.auth_type}
                    onChange={e => setEditing(prev => prev ? { ...prev, auth_type: e.target.value, auth_config: {} } : null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="none">None</option>
                    <option value="basic">Basic Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="custom">Custom Header</option>
                  </select>
                </div>
                {editing.auth_type === 'basic' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                      <input type="text" value={editing.auth_config.username || ''}
                        onChange={e => setEditing(prev => prev ? { ...prev, auth_config: { ...prev.auth_config, username: e.target.value } } : null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                      <input type="password" value={editing.auth_config.password || ''}
                        onChange={e => setEditing(prev => prev ? { ...prev, auth_config: { ...prev.auth_config, password: e.target.value } } : null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </>
                )}
                {editing.auth_type === 'bearer' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Token</label>
                    <input type="password" value={editing.auth_config.token || ''}
                      onChange={e => setEditing(prev => prev ? { ...prev, auth_config: { ...prev.auth_config, token: e.target.value } } : null)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                )}
                {editing.auth_type === 'custom' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Header Name</label>
                      <input type="text" value={editing.auth_config.header_name || ''}
                        onChange={e => setEditing(prev => prev ? { ...prev, auth_config: { ...prev.auth_config, header_name: e.target.value } } : null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Header Value</label>
                      <input type="password" value={editing.auth_config.header_value || ''}
                        onChange={e => setEditing(prev => prev ? { ...prev, auth_config: { ...prev.auth_config, header_value: e.target.value } } : null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </>
                )}
              </div>

              {/* Field Mappings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Field Mappings</label>
                  <button type="button" onClick={() => setEditing(prev => prev ? {
                    ...prev, field_mappings: [...prev.field_mappings, { source: '', target: '' }]
                  } : null)}
                    className="text-xs font-medium text-[#003153] hover:underline">+ Add Mapping</button>
                </div>
                <div className="space-y-2">
                  {editing.field_mappings.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={m.source}
                        onChange={e => {
                          const updated = [...editing.field_mappings];
                          updated[i] = { ...updated[i], source: e.target.value };
                          setEditing(prev => prev ? { ...prev, field_mappings: updated } : null);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">Source field...</option>
                        {AVAILABLE_SOURCE_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <ArrowRightLeft className="w-3 h-3 text-gray-300 flex-shrink-0" />
                      <select value={m.target}
                        onChange={e => {
                          const updated = [...editing.field_mappings];
                          updated[i] = { ...updated[i], target: e.target.value };
                          setEditing(prev => prev ? { ...prev, field_mappings: updated } : null);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">Target field...</option>
                        {AVAILABLE_TARGET_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <button type="button" onClick={() => {
                        const updated = editing.field_mappings.filter((_, idx) => idx !== i);
                        setEditing(prev => prev ? { ...prev, field_mappings: updated } : null);
                      }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => { setShowForm(false); setEditing(null); setTestResult(null); }}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              {editing.id && (
                <button onClick={() => editing.id && handleTest(editing.id)}
                  className="px-4 py-2 text-xs font-medium bg-gray-50 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5">
                  <TestTube className="w-3.5 h-3.5" /> Test
                </button>
              )}
              <button onClick={handleSave}
                className="px-4 py-2 bg-[#003153] text-white rounded-lg text-xs font-semibold hover:bg-[#002640] transition-colors inline-flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
