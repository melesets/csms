// Admin Settings - system configuration, data migration, backup, theme, maintenance
import React, { useState, useEffect } from 'react';
import {
  Settings, Database, Download, Upload, Trash2, RefreshCw, Shield, Palette,
  Server, HardDrive, Activity, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff,
  Copy, Clock, FileText, Layers, Zap, Bell, Lock, Key, Save, ChevronDown,
  ChevronRight, Search, Cpu, MemoryStick, Wifi, WifiOff, Users, Package, UserPlus, LogOut
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { apiGet, apiPost } from '../../api';
import { CustomSelect } from '../../components/shared/CustomSelect';

type SettingsTab = 'overview' | 'migration' | 'backup' | 'theme' | 'data' | 'security' | 'notifications' | 'audit-trail' | 'maintenance';

interface SystemInfo {
  nodeVersion: string;
  uptime: string;
  database: string;
  totalUsers: number;
  totalPatients: number;
  totalReports: number;
  diskUsage: string;
}

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Theme state
  const [brandColor, setBrandColor] = useState('#003153');
  const [darkMode, setDarkMode] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Backup state
  const [backups, setBackups] = useState<any[]>([]);
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupRetention, setBackupRetention] = useState('30');

  // Security state
  const [passwordPolicy, setPasswordPolicy] = useState('medium');
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Notification state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [lowStockAlert, setLowStockAlert] = useState(true);
  const [expiryAlert, setExpiryAlert] = useState(true);
  const [shiftAlert, setShiftAlert] = useState(true);

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  // Real-time audit log polling
  useEffect(() => {
    if (activeTab !== 'audit-trail') return;
    let interval: ReturnType<typeof setInterval>;
    const fetchLogs = async () => {
      try {
        const logs = await apiGet('/admin/audit-logs');
        setAuditLogs(logs);
      } catch { /* silent */ }
    };
    fetchLogs();
    interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchSystemInfo = async () => {
    try {
      const [info, backupList, logs, themeData, notifData] = await Promise.all([
        apiGet('/admin/system-info').catch(() => null),
        apiGet('/admin/backups').catch(() => []),
        apiGet('/admin/audit-logs').catch(() => []),
        apiGet('/admin/theme').catch(() => null),
        apiGet('/admin/notifications').catch(() => null),
      ]);
      if (info) setSystemInfo(info);
      if (backupList) setBackups(backupList);
      if (logs) setAuditLogs(logs);
      if (themeData) {
        setBrandColor(themeData.brandColor || '#003153');
        setDarkMode(themeData.darkMode || false);
        setCompactMode(themeData.compactMode || false);
      }
      if (notifData) {
        setEmailEnabled(notifData.emailEnabled || false);
        setLowStockAlert(notifData.lowStockAlert !== false);
        setExpiryAlert(notifData.expiryAlert !== false);
        setShiftAlert(notifData.shiftAlert !== false);
      }
    } catch {
      // Use fallback data
      setSystemInfo({
        nodeVersion: 'v18.x',
        uptime: '0d 0h',
        database: 'PostgreSQL',
        totalUsers: 0,
        totalPatients: 0,
        totalReports: 0,
        diskUsage: '0 MB',
      });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    try {
      await fn();
      showMessage('success', `${action} completed successfully`);
    } catch (err: any) {
      showMessage('error', err?.message || `${action} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Tabs ──────────────────────────────────────────────
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Server className="w-4 h-4" /> },
    { id: 'migration', label: 'Data Migration', icon: <Layers className="w-4 h-4" /> },
    { id: 'backup', label: 'Backup & Restore', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'theme', label: 'Theme & Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'data', label: 'Data Management', icon: <Database className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'audit-trail', label: 'Audit Trail', icon: <FileText className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Zap className="w-4 h-4" /> },
  ];

  if (user?.role !== 'admin') {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-1">Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#003153] rounded-xl">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">System Settings</h2>
            <p className="text-sm text-gray-400 mt-0.5">Manage system configuration and maintenance</p>
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="flex gap-5">
        {/* Sidebar Tabs */}
        <div className="w-56 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 sticky top-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* ── Overview ──────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Users', value: systemInfo?.totalUsers ?? '—', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Patients', value: systemInfo?.totalPatients ?? '—', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Reports', value: systemInfo?.totalReports ?? '—', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Uptime', value: systemInfo?.uptime ?? '—', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                      <div className={`p-1.5 rounded-lg ${stat.bg}`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">System Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Database', value: systemInfo?.database ?? 'PostgreSQL' },
                    { label: 'Node.js', value: systemInfo?.nodeVersion ?? 'v18.x' },
                    { label: 'Disk Usage', value: systemInfo?.diskUsage ?? '—' },
                    { label: 'Server', value: 'localhost:4000' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-400">{item.label}</span>
                      <span className="text-sm font-medium text-gray-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Data Migration ────────────────────────── */}
          {activeTab === 'migration' && (
            <div className="space-y-5">
              {/* Export */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Download className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Export Data</h3>
                    <p className="text-[11px] text-gray-400">Download system data for migration or backup</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'All Data', desc: 'Complete database export', format: 'json', color: 'bg-[#003153]' },
                    { label: 'Users Only', desc: 'User accounts and roles', format: 'users', color: 'bg-blue-600' },
                    { label: 'Templates', desc: 'Form templates and fields', format: 'templates', color: 'bg-emerald-600' },
                  ].map(exp => (
                    <button
                      key={exp.format}
                      onClick={() => handleAction(`Export ${exp.label}`, async () => {
                        const data = await apiGet(`/admin/export/${exp.format}`);
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `isbar-${exp.format}-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })}
                      disabled={actionLoading === `Export ${exp.label}`}
                      className="p-4 rounded-xl border border-gray-200 text-left hover:border-gray-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${exp.color}`} />
                        <span className="text-sm font-semibold text-gray-900">{exp.label}</span>
                      </div>
                      <p className="text-xs text-gray-400">{exp.desc}</p>
                      {actionLoading === `Export ${exp.label}` && (
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mt-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Import */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Upload className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Import Data</h3>
                    <p className="text-[11px] text-gray-400">Restore data from exported files</p>
                  </div>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#003153]/30 transition-colors">
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-2">Drag & drop a JSON file or click to browse</p>
                  <p className="text-xs text-gray-400 mb-4">Supports .json files exported from this system</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#003153] text-white rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#002640] transition-colors">
                    <Upload className="w-4 h-4" />
                    Choose File
                    <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        await handleAction('Import Data', async () => {
                          await apiPost('/admin/import', { data });
                        });
                      } catch { showMessage('error', 'Invalid JSON file'); }
                    }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Backup & Restore ──────────────────────── */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Actions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                      <HardDrive className="w-4.5 h-4.5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Backup & Restore</h3>
                      <p className="text-[11px] text-gray-400">Create and manage database backups</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAction('Create Backup', async () => {
                      const result = await apiPost('/admin/backup', {});
                      setBackups(prev => [result, ...prev]);
                    })}
                    disabled={!!actionLoading}
                    className="px-4 py-2 bg-[#003153] text-white rounded-xl text-sm font-semibold hover:bg-[#002640] inline-flex items-center gap-2 transition-all"
                  >
                    {actionLoading === 'Create Backup' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Create Backup
                  </button>
                </div>

                {/* Backup List */}
                <div className="space-y-2">
                  {backups.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <HardDrive className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No backups yet</p>
                      <p className="text-xs text-gray-400 mt-1">Create your first backup to get started</p>
                    </div>
                  ) : (
                    backups.map((backup, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Database className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{backup.name || `Backup ${i + 1}`}</p>
                            <p className="text-xs text-gray-400">{backup.date || 'Unknown date'} · {backup.size || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction('Restore Backup', async () => {
                              await apiPost('/admin/restore', { backupId: backup.id });
                            })}
                            className="px-3 py-1.5 text-xs font-medium text-[#003153] bg-[#003153]/5 rounded-lg hover:bg-[#003153]/10 transition-colors"
                          >
                            Restore
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Auto Backup Settings */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Automatic Backup</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enable Auto Backup</p>
                      <p className="text-xs text-gray-400">Automatically backup database daily</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${autoBackup ? 'bg-[#003153]' : 'bg-gray-200'}`}
                      onClick={() => setAutoBackup(!autoBackup)}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${autoBackup ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Retention (days)</label>
                    <CustomSelect
                      value={backupRetention}
                      onChange={setBackupRetention}
                      options={[
                        { value: '7', label: '7 days' },
                        { value: '14', label: '14 days' },
                        { value: '30', label: '30 days' },
                        { value: '90', label: '90 days' },
                        { value: '365', label: '1 year' },
                      ]}
                      className="max-w-[200px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Theme & Appearance ────────────────────── */}
          {activeTab === 'theme' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
                    <Palette className="w-4.5 h-4.5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Theme & Appearance</h3>
                    <p className="text-[11px] text-gray-400">Customize the look and feel of the application</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Brand Color */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Brand Color</label>
                    <div className="flex items-center gap-3">
                      {['#003153', '#1a5276', '#2c3e50', '#7d3c98', '#117a65', '#b71c1c'].map(color => (
                        <button
                          key={color}
                          onClick={() => setBrandColor(color)}
                          className={`w-10 h-10 rounded-xl transition-all ${brandColor === color ? 'ring-2 ring-offset-2 ring-[#003153] scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer border-0"
                        />
                      </div>
                      <span className="text-sm font-mono text-gray-500">{brandColor}</span>
                    </div>
                  </div>

                  {/* Dark Mode */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Dark Mode</p>
                      <p className="text-xs text-gray-400">Switch to dark color scheme</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-[#003153]' : 'bg-gray-200'}`}
                      onClick={() => setDarkMode(!darkMode)}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${darkMode ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>

                  {/* Compact Mode */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Compact Mode</p>
                      <p className="text-xs text-gray-400">Reduce spacing for denser layout</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${compactMode ? 'bg-[#003153]' : 'bg-gray-200'}`}
                      onClick={() => setCompactMode(!compactMode)}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${compactMode ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Preview</label>
                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">ISBAR</h4>
                          <p className="text-xs text-gray-400">Healthcare Dashboard</p>
                        </div>
                      </div>
                      <button className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
                        Primary Button
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAction('Save Theme', async () => {
                      const theme = { brandColor, darkMode, compactMode };
                      await apiPost('/admin/theme', theme);
                      localStorage.setItem('isbar_theme', JSON.stringify(theme));
                      document.documentElement.style.setProperty('--brand-color', brandColor);
                    })}
                    className="px-5 py-2.5 bg-[#003153] text-white rounded-xl text-sm font-semibold hover:bg-[#002640] inline-flex items-center gap-2 transition-all"
                  >
                    <Save className="w-4 h-4" />Save Theme
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Data Management ───────────────────────── */}
          {activeTab === 'data' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <Database className="w-4.5 h-4.5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Data Management</h3>
                    <p className="text-[11px] text-gray-400">Manage and clean system data</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Clear Audit Logs', desc: 'Remove all audit log entries', action: 'clear-logs', icon: FileText, danger: false },
                    { label: 'Purge Old Reports', desc: 'Remove reports older than 90 days', action: 'purge-reports', icon: Clock, danger: false },
                    { label: 'Clear Expired Resources', desc: 'Remove expired inventory items', action: 'clear-expired', icon: Package, danger: false },
                    { label: 'Reset All Data', desc: 'Factory reset — removes ALL data except users', action: 'reset-all', icon: Trash2, danger: true },
                    { label: 'Nuclear Reset', desc: 'Completely wipe the database', action: 'nuclear-reset', icon: AlertTriangle, danger: true },
                  ].map(item => (
                    <div key={item.action} className={`flex items-center justify-between p-4 rounded-xl border ${item.danger ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.danger ? 'bg-red-100' : 'bg-white'}`}>
                          <item.icon className={`w-4 h-4 ${item.danger ? 'text-red-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${item.danger ? 'text-red-700' : 'text-gray-900'}`}>{item.label}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (item.danger && !confirm(`Are you sure you want to ${item.label.toLowerCase()}? This cannot be undone.`)) return;
                          handleAction(item.label, async () => {
                            await apiPost(`/admin/${item.action}`, {});
                          });
                        }}
                        disabled={!!actionLoading}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          item.danger
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {actionLoading === item.label ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Execute'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Security ──────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Shield className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Security Settings</h3>
                    <p className="text-[11px] text-gray-400">Manage security policies and access control</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Password Policy */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 block">Password Policy</label>
                    <CustomSelect
                      value={passwordPolicy}
                      onChange={setPasswordPolicy}
                      options={[
                        { value: 'low', label: 'Low — Minimum 4 characters' },
                        { value: 'medium', label: 'Medium — 6+ chars, mixed case' },
                        { value: 'high', label: 'High — 8+ chars, symbols, numbers' },
                      ]}
                    />
                  </div>

                  {/* Session Timeout */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5 block">Session Timeout (minutes)</label>
                    <CustomSelect
                      value={sessionTimeout}
                      onChange={setSessionTimeout}
                      options={[
                        { value: '15', label: '15 minutes' },
                        { value: '30', label: '30 minutes' },
                        { value: '60', label: '1 hour' },
                        { value: '120', label: '2 hours' },
                        { value: '480', label: '8 hours' },
                      ]}
                      className="max-w-[200px]"
                    />
                  </div>

                  {/* Two-Factor */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Two-Factor Authentication</p>
                      <p className="text-xs text-gray-400">Require 2FA for all admin accounts</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${twoFactorEnabled ? 'bg-[#003153]' : 'bg-gray-200'}`}
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${twoFactorEnabled ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Logs */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Audit Logs</h3>
                <div className="space-y-2">
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No audit logs available</p>
                  ) : (
                    auditLogs.slice(0, 10).map((log, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-gray-500 text-xs">{log.time || '—'}</span>
                        <span className="text-gray-700">{log.action || '—'}</span>
                        <span className="text-gray-400 text-xs ml-auto">{log.user || '—'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ─────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Notification Settings</h3>
                  <p className="text-[11px] text-gray-400">Configure alerts and notifications</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Email Notifications', desc: 'Send alerts via email', state: emailEnabled, setState: setEmailEnabled },
                  { label: 'Low Stock Alerts', desc: 'Notify when inventory is low', state: lowStockAlert, setState: setLowStockAlert },
                  { label: 'Expiry Alerts', desc: 'Notify when items are near expiry', state: expiryAlert, setState: setExpiryAlert },
                  { label: 'Shift Alerts', desc: 'Notify on shift changes', state: shiftAlert, setState: setShiftAlert },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${item.state ? 'bg-[#003153]' : 'bg-gray-200'}`}
                      onClick={() => item.setState(!item.state)}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${item.state ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleAction('Save Notifications', async () => {
                  await apiPost('/admin/notifications', { emailEnabled, lowStockAlert, expiryAlert, shiftAlert });
                })}
                className="mt-5 px-5 py-2.5 bg-[#003153] text-white rounded-xl text-sm font-semibold hover:bg-[#002640] inline-flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />Save Settings
              </button>
            </div>
          )}

          {/* ── Audit Trail ──────────────────────────── */}
          {activeTab === 'audit-trail' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                      <FileText className="w-4.5 h-4.5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Real-Time Audit Trail</h3>
                      <p className="text-[11px] text-gray-400">Auto-refreshes every 5 seconds · {auditLogs.length} entries</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                    <button
                      onClick={async () => {
                        const logs = await apiGet('/admin/audit-logs');
                        setAuditLogs(logs);
                      }}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Log entries */}
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No audit logs yet</p>
                      <p className="text-xs text-gray-400 mt-1">Actions will appear here in real-time</p>
                    </div>
                  ) : (
                    auditLogs.map((log: any, i: number) => {
                      const actionColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
                        login: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: <UserPlus className="w-3 h-3" /> },
                        logout: { bg: 'bg-gray-100', text: 'text-gray-600', icon: <LogOut className="w-3 h-3" /> },
                        login_failed: { bg: 'bg-red-50', text: 'text-red-600', icon: <XCircle className="w-3 h-3" /> },
                        login_blocked: { bg: 'bg-red-50', text: 'text-red-700', icon: <Lock className="w-3 h-3" /> },
                        export: { bg: 'bg-blue-50', text: 'text-blue-600', icon: <Download className="w-3 h-3" /> },
                        import: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: <Upload className="w-3 h-3" /> },
                        backup: { bg: 'bg-purple-50', text: 'text-purple-600', icon: <HardDrive className="w-3 h-3" /> },
                        purge: { bg: 'bg-amber-50', text: 'text-amber-600', icon: <Trash2 className="w-3 h-3" /> },
                        clear: { bg: 'bg-red-50', text: 'text-red-600', icon: <Trash2 className="w-3 h-3" /> },
                        reset: { bg: 'bg-red-50', text: 'text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
                        update: { bg: 'bg-[#003153]/5', text: 'text-[#003153]', icon: <Save className="w-3 h-3" /> },
                        check: { bg: 'bg-teal-50', text: 'text-teal-600', icon: <Activity className="w-3 h-3" /> },
                        sync: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: <Database className="w-3 h-3" /> },
                        reindex: { bg: 'bg-orange-50', text: 'text-orange-600', icon: <Search className="w-3 h-3" /> },
                      };
                      const style = actionColors[log.action] || { bg: 'bg-gray-50', text: 'text-gray-600', icon: <FileText className="w-3 h-3" /> };
                      const time = log.created_at ? new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                      const date = log.created_at ? new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

                      return (
                        <div key={log.id || i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50/80 transition-colors group">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                            {style.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                                {log.action}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-400 uppercase">{log.module}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 truncate">{log.detail || '—'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-gray-400">{date} {time}</p>
                            <p className="text-[10px] text-gray-300">{log.performed_by || 'system'}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Maintenance ───────────────────────────── */}
          {activeTab === 'maintenance' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Zap className="w-4.5 h-4.5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">System Maintenance</h3>
                    <p className="text-[11px] text-gray-400">Health checks and maintenance tools</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Clear Application Cache', desc: 'Reset in-memory cache', action: 'clear-cache', icon: RefreshCw },
                    { label: 'Restart Backend Server', desc: 'Restart the Node.js server', action: 'restart-server', icon: Server },
                    { label: 'Run Health Check', desc: 'Verify all systems are operational', action: 'health-check', icon: Activity },
                    { label: 'Sync Database Schema', desc: 'Run pending migrations', action: 'sync-schema', icon: Database },
                    { label: 'Rebuild Search Index', desc: 'Reindex all searchable data', action: 'reindex', icon: Search },
                  ].map(item => (
                    <div key={item.action} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                          <item.icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAction(item.label, async () => {
                          await apiPost(`/admin/${item.action}`, {});
                        })}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-all"
                      >
                        {actionLoading === item.label ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Run'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
