
import React, { useState } from 'react';

type Shift = 'Morning' | 'Evening' | 'Night';

interface InventoryReport {
  shift: Shift;
  staffName: string;
  date: string; // ISO string
  resources: any[]; // You can type this better if needed
}

const Inventory: React.FC = () => {
  const [shift, setShift] = useState<Shift>('Morning');
  const [staffName, setStaffName] = useState('');
  const [resources] = useState<any[]>([]); // Placeholder for resource data
  const [lastReport, setLastReport] = useState<InventoryReport | null>(() => {
    const saved = localStorage.getItem('inventory_reports');
    if (!saved) return null;
    const reports: InventoryReport[] = JSON.parse(saved);
    return reports.length > 0 ? reports[reports.length - 1] : null;
  });

  const handleSaveReport = () => {
    const now = new Date();
    const report: InventoryReport = {
      shift,
      staffName,
      date: now.toISOString(),
      resources: resources // You can add actual resource data here
    };
    // POST the report to the backend
    fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save resource report');
        return res.json();
      })
      .then(data => {
        setLastReport(report);
        alert('Resource report saved to database!');
      })
      .catch(err => {
        alert('Error saving resource report: ' + err.message);
      });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Inventory Handover Report</h2>
      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Shift</label>
          <select value={shift} onChange={e => setShift(e.target.value as Shift)} className="border rounded px-2 py-1">
            <option value="Morning">Morning</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Staff Name</label>
          <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} className="border rounded px-2 py-1" />
        </div>
      </div>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        onClick={handleSaveReport}
        disabled={!staffName}
      >
        Save Report (Date/Time auto)
      </button>

      {lastReport && (
        <div className="mt-8 bg-gray-50 p-4 rounded border">
          <h3 className="font-semibold mb-2">Last Saved Report (Read Only)</h3>
          <div className="mb-1"><b>Shift:</b> {lastReport.shift}</div>
          <div className="mb-1"><b>Staff Name:</b> {lastReport.staffName}</div>
          <div className="mb-1"><b>Date/Time:</b> {new Date(lastReport.date).toLocaleString()}</div>
          {/* Add more fields as needed */}
        </div>
      )}
    </div>
  );
};

export default Inventory;
