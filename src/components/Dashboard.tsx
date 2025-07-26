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
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ISBARRecord, Staff, Resource } from '../types';
import { mockISBARRecords, mockStaff, mockResources } from '../data/mockData';

const Dashboard = () => {
  const { user } = useAuth();
  const [records] = useLocalStorage<ISBARRecord[]>('isbar_records', mockISBARRecords);
  const [staff] = useLocalStorage<Staff[]>('department_staff', mockStaff);
  const [resources] = useLocalStorage<Resource[]>('resources', mockResources);

  // Filter data by department for non-admin users
  const filteredRecords = user?.role === 'admin' 
    ? records 
    : records.filter(record => record.department === user?.department);
  
  const filteredStaff = user?.role === 'admin'
    ? staff
    : staff.filter(s => s.department === user?.department);

  const filteredResources = user?.role === 'admin'
    ? resources
    : resources.filter(r => r.department === user?.department);

  // Get today's records
  const today = new Date().toDateString();
  const todaysRecords = filteredRecords.filter(record => 
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
  const [selectedReportTab, setSelectedReportTab] = useState<Shift | null>(null);
  const [overwriteShift, setOverwriteShift] = useState<Shift | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('inventory_reports');
    if (saved) {
      setInventoryReports(JSON.parse(saved));
    }
  }, []);

  // Get latest report for each shift for today
  const todayReports: { [key in Shift]?: InventoryReport } = {};
  inventoryReports.forEach(r => {
    const reportDate = new Date(r.date).toDateString();
    if (reportDate === today) {
      todayReports[r.shift] = r;
    }
  });

  // Get critical resources (low stock)
  const criticalResources = filteredResources.filter(resource => resource.quantity < 10);

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
            {todaysRecords.slice(0, 5).map((record) => (
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

        {/* Critical Resources */}
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-full min-h-[170px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-red-700">Low Stock Alerts</h3>
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {criticalResources.slice(0, 5).map((resource) => (
              <div key={resource.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{resource.name}</p>
                  <p className="text-xs text-gray-500">{resource.type} • {resource.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{resource.quantity}</p>
                  <p className="text-xs text-gray-500">{resource.unit}</p>
                </div>
              </div>
            ))}
            {criticalResources.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Package className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-base font-semibold">All resources are well stocked</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions & Inventory Report Modals removed as requested */}
      {selectedReportTab && todayReports[selectedReportTab] && (
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
              <div className="mb-1 text-left"><b>Staff Name:</b> {todayReports[selectedReportTab]?.staffName}</div>
              <div className="mb-1 text-left"><b>Date/Time:</b> {new Date(todayReports[selectedReportTab]!.date).toLocaleString()}</div>
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
                    {todayReports[selectedReportTab]?.resources?.map((r, idx) => (
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