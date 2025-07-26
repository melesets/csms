import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ClipboardList, 
  Package, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Clock,
  Activity
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../api';
import { ISBARRecord, Staff, Resource } from '../types';
import { mockISBARRecords, mockStaff, mockResources } from '../data/mockData';

const Dashboard = () => {
  const { user } = useAuth();
  const [records] = React.useState<ISBARRecord[]>(mockISBARRecords);
  const [staff] = React.useState<Staff[]>(mockStaff);
  const [resources] = React.useState<Resource[]>(mockResources);

  // Filter data by department for non-admin users
  const filteredRecords = user?.role === 'admin' 
    ? records 
    : records.filter((record: ISBARRecord) => record.department === user?.department);
  
  const filteredStaff = user?.role === 'admin'
    ? staff
    : staff.filter((s: Staff) => s.department === user?.department);

  const filteredResources = user?.role === 'admin'
    ? resources
    : resources.filter((r: Resource) => r.department === user?.department);

  // Get today's records
  const today = new Date().toDateString();
  const todaysRecords = filteredRecords.filter((record: ISBARRecord) => 
    new Date(record.timestamp).toDateString() === today
  );

  // Inventory Reports Tabs Logic
  type Shift = 'Morning' | 'Evening' | 'Night';
  interface InventoryReport {
    shift: Shift;
    staffName: string;
    date: string;
    resources: any[];
  }
  const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([]);
  const [selectedReportTab, setSelectedReportTab] = useState<Shift | "Current" | null>(null);
  const [overwriteShift, setOverwriteShift] = useState<Shift | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        let url = '/inventory-reports';
        if (user?.role !== 'admin' && user?.department) {
          url += `?department=${encodeURIComponent(user.department)}`;
        }
        const data = await apiGet(url);
        setInventoryReports(data);
      } catch (err) {
        setInventoryReports([]);
      }
    }
    fetchReports();
    // Listen for report save event to refresh
    const handler = () => fetchReports();
    window.addEventListener('inventory_report_saved', handler);
    return () => window.removeEventListener('inventory_report_saved', handler);
  }, [user]);

  // Get latest report for each shift for today
  const todayReports: { [key in Shift]?: InventoryReport } = {};
  inventoryReports.forEach(r => {
    const reportDate = new Date(r.date).toDateString();
    if (reportDate === today) {
      todayReports[r.shift] = r;
    }
  });

  // Get critical resources (low stock)
  const criticalResources = filteredResources.filter((resource: Resource) => resource.quantity < 10);

  const stats = [
    {
      title: "Today's Handovers",
      value: todaysRecords.length,
      icon: ClipboardList,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Active Staff',
      value: filteredStaff.length,
      icon: Users,
      color: 'bg-green-500',
      change: '+5%'
    },
    {
      title: 'Resources',
      value: filteredResources.length,
      icon: Package,
      color: 'bg-purple-500',
      change: '+8%'
    },
    {
      title: 'Critical Alerts',
      value: criticalResources.length,
      icon: AlertCircle,
      color: 'bg-red-500',
      change: '-2%'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {user?.role === 'admin' ? 'System Overview' : `${user?.department} Department Dashboard`}
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{new Date().toLocaleDateString()}</span>
            <Clock className="w-4 h-4 ml-4" />
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-lg flex flex-col justify-between p-6 h-full min-h-[170px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">{stat.title}</p>
                  <p className="text-3xl font-extrabold text-blue-900 mb-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="flex items-center mt-auto pt-2 border-t border-gray-100">
                <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm font-bold text-green-700">{stat.change}</span>
                <span className="text-xs text-gray-500 ml-2">from last week</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent Handovers */}
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-full min-h-[170px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900">Recent Handovers</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {todaysRecords.slice(0, 5).map((record: ISBARRecord) => (
              <div key={record.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  record.stability === 'Stable' ? 'bg-green-500' :
                  record.stability === 'Unstable' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{record.patientName}</p>
                  <p className="text-xs text-gray-500">{record.bedNumber} • {record.nurseName}</p>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(record.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {todaysRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <ClipboardList className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-base font-semibold">No handovers recorded today</p>
              </div>
            )}
          </div>
        </div>

        {/* Resource Inventory with Tabs for Reports */}
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-full min-h-[170px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-700">Resources</h3>
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          {/* Tabs */}
          {/* Tabs with recent indicator */}
          <div className="mb-4 flex gap-2">
            {(() => {
              // Find the most recent report among the three shifts
              let mostRecentShift: Shift | null = null;
              let mostRecentDate = 0;
              (['Morning', 'Evening', 'Night'] as Shift[]).forEach(shift => {
                const report = todayReports[shift];
                if (report) {
                  const reportTime = new Date(report.date).getTime();
                  if (reportTime > mostRecentDate) {
                    mostRecentDate = reportTime;
                    mostRecentShift = shift;
                  }
                }
              });
              return (['Morning', 'Evening', 'Night'] as Shift[]).map(tab => (
                <button
                  key={tab}
                  className={`relative px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${selectedReportTab === tab ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}
                  onClick={() => setSelectedReportTab(tab)}
                >
                  {tab}
                  {/* Tiny indicator for most recent */}
                  {mostRecentShift === tab && todayReports[tab] && (
                    <span
                      title="Most Recent"
                      className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white shadow"
                      style={{ display: 'inline-block' }}
                    />
                  )}
                </button>
              ));
            })()}
          </div>

          {/* Low Stock & Near Expiry Status */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Low Stock (<2) */}
            <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="font-semibold text-red-700 mb-2 text-xs uppercase tracking-wider">Low Stock (&lt;2)</div>
              {filteredResources.filter((r: Resource) => r.type === 'Drug' && r.quantity < 2).length === 0 ? (
                <div className="text-xs text-gray-400">No low stock drugs</div>
              ) : (
                <ul className="text-xs text-red-800 space-y-1">
                  {filteredResources.filter((r: Resource) => r.type === 'Drug' && r.quantity < 2).map((drug: Resource) => (
                    <li key={drug.id} className="flex justify-between">
                      <span>{drug.name}</span>
                      <span className="font-mono">{drug.quantity} {drug.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Near Expired (within 7 days) */}
            <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="font-semibold text-yellow-700 mb-2 text-xs uppercase tracking-wider">Near Expiry (&lt;7 days)</div>
              {filteredResources.filter((r: Resource) => r.type === 'Drug' && r.expiry_date && (new Date(r.expiry_date).getTime() - Date.now())/(1000*60*60*24) < 7 && (new Date(r.expiry_date).getTime() - Date.now())/(1000*60*60*24) >= 0).length === 0 ? (
                <div className="text-xs text-gray-400">No near expiry drugs</div>
              ) : (
                <ul className="text-xs text-yellow-800 space-y-1">
                  {filteredResources.filter((r: Resource) => r.type === 'Drug' && r.expiry_date && (new Date(r.expiry_date).getTime() - Date.now())/(1000*60*60*24) < 7 && (new Date(r.expiry_date).getTime() - Date.now())/(1000*60*60*24) >= 0).map((drug: Resource) => (
                    <li key={drug.id} className="flex justify-between">
                      <span>{drug.name}</span>
                      <span className="font-mono">{drug.expiry_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Tab Content */}
          {(['Morning', 'Evening', 'Night'] as Shift[]).map(shift => (
            selectedReportTab === shift && todayReports[shift] ? (
              <div key={shift} className="overflow-x-auto">
                <div className="mb-2 text-sm text-gray-700"><b>Staff:</b> {todayReports[shift]!.staffName} &nbsp; <b>Date:</b> {new Date(todayReports[shift]!.date).toLocaleString()}</div>
                <table className="min-w-full border text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-1 border">Resource</th>
                      <th className="px-2 py-1 border">Type</th>
                      <th className="px-2 py-1 border">Quantity</th>
                      <th className="px-2 py-1 border">Standard Qty</th>
                      <th className="px-2 py-1 border">Unit</th>
                      <th className="px-2 py-1 border">Expired Date</th>
                      <th className="px-2 py-1 border">Batch Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayReports[shift]!.resources?.map((r: any, idx: number) => (
                      <tr key={r.id || idx} className="hover:bg-gray-50">
                        <td className="px-2 py-1 border">{r.name}</td>
                        <td className="px-2 py-1 border">{r.type}</td>
                        <td className="px-2 py-1 border">{r.quantity}</td>
                        <td className="px-2 py-1 border">{r.standard_quantity}</td>
                        <td className="px-2 py-1 border">{r.unit}</td>
                        <td className="px-2 py-1 border">{r.type === 'Drug' && r.expiry_date ? r.expiry_date : '-'}</td>
                        <td className="px-2 py-1 border">{r.type === 'Drug' && r.batch_number ? r.batch_number : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null
          ))}
        </div>
      </div>

      {/* Quick Actions & Inventory Report Modals removed as requested */}
      {(['Morning', 'Evening', 'Night'] as Shift[]).includes(selectedReportTab as Shift) && selectedReportTab && todayReports[selectedReportTab as Shift] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative border border-gray-200 animate-fade-in text-black">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              onClick={() => setSelectedReportTab(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <h5 className="font-bold mb-2 text-lg">{selectedReportTab} Report</h5>
            <div className="mb-1 text-left"><b>Staff Name:</b> {todayReports[selectedReportTab as Shift]!.staffName}</div>
            <div className="mb-1 text-left"><b>Date/Time:</b> {new Date(todayReports[selectedReportTab as Shift]!.date).toLocaleString()}</div>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 border">Resource</th>
                    <th className="px-2 py-1 border">Type</th>
                    <th className="px-2 py-1 border">Quantity</th>
                    <th className="px-2 py-1 border">Standard Qty</th>
                    <th className="px-2 py-1 border">Unit</th>
                    <th className="px-2 py-1 border">Expired Date</th>
                    <th className="px-2 py-1 border">Batch Number</th>
                  </tr>
                </thead>
                <tbody>
                  {todayReports[selectedReportTab as Shift]!.resources?.map((r: any, idx: number) => (
                    <tr key={r.id || idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1 border">{r.name}</td>
                      <td className="px-2 py-1 border">{r.type}</td>
                      <td className="px-2 py-1 border">{r.quantity}</td>
                      <td className="px-2 py-1 border">{r.standard_quantity}</td>
                      <td className="px-2 py-1 border">{r.unit}</td>
                      <td className="px-2 py-1 border">{r.type === 'Drug' && r.expiry_date ? r.expiry_date : '-'}</td>
                      <td className="px-2 py-1 border">{r.type === 'Drug' && r.batch_number ? r.batch_number : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Dashboard;