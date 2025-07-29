import React, { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../api';
import { Package, Pen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Resource } from '../types';
// import { Layout } from './Layout';
function ResourceManagement() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  // (removed duplicate filteredResources, see below for correct version)
  const [staff, setStaff] = useState<{ id: string; name: string; department?: string; role?: string }[]>([]);
  const [selectedShift, setSelectedShift] = useState('Morning');
  const [selectedStaff, setSelectedStaff] = useState('');
  // Fetch staff for reporting dropdown (from department staff register)
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/department-staff');
        if (!res.ok) throw new Error('Failed to fetch staff');
        const data = await res.json();
        setStaff(data);
      } catch (err) {
        setStaff([]);
      }
    };
    fetchStaff();
  }, []);
  const [editingQuantityId, setEditingQuantityId] = useState<string | number | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  // const [currentPage, setCurrentPage] = useState('resources');
  const [newResource, setNewResource] = useState({
    name: '',
    type: 'Drug',
    quantity: '',
    standardQuantity: '',
    unit: '',
    expiredDate: '',
    batchNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editResourceId, setEditResourceId] = useState<string | number | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/resources');
        if (!res.ok) throw new Error('Failed to fetch resources');
        const data = await res.json();
        setResources(data);
      } catch (err) {
        setResources([]);
      }
    };
    fetchResources();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewResource((prev) => ({ ...prev, [name]: value }));
  };

  const openEditModal = (resource: any) => {
    setEditMode(true);
    setEditResourceId(resource.id);
    setNewResource({
      name: resource.name || '',
      type: resource.type || 'Drug',
      quantity: resource.quantity?.toString() || '',
      standardQuantity: resource.standard_quantity?.toString() || '',
      unit: resource.unit || '',
      expiredDate: resource.expiry_date || '',
      batchNumber: resource.batch_number || ''
    });
    setShowModal(true);
  };

  const handleAddOrEditResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Validation: all fields required for both Drug and Equipment
      if (!newResource.name.trim() ||
          !newResource.type.trim() ||
          !newResource.quantity.toString().trim() ||
          !newResource.standardQuantity.toString().trim() ||
          !newResource.unit.trim() ||
          (newResource.type === 'Drug' && (!newResource.expiredDate.trim() || !newResource.batchNumber.trim()))
      ) {
        setError('All fields are required.');
        setLoading(false);
        return;
      }
      // Build body object, only including Drug fields if type is Drug
      const body: any = {
        name: newResource.name,
        type: newResource.type,
        quantity: Number(newResource.quantity),
        standard_quantity: Number(newResource.standardQuantity),
        unit: newResource.unit,
        department: user?.department // Add department from logged-in user
      };
      if (newResource.type === 'Drug') {
        body.expiry_date = newResource.expiredDate;
        body.batch_number = newResource.batchNumber;
      }
      let res: Response;
      let updated: Resource;
      if (editMode && editResourceId) {
        res = await fetch(`/api/resources/${editResourceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error('Failed to update resource: ' + errText);
        }
        updated = await res.json();
        setResources((prev) => prev.map(r => r.id === editResourceId ? updated : r));
      } else {
        res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error('Failed to add resource: ' + errText);
        }
        updated = await res.json();
        setResources((prev) => [...prev, updated]);
      }
      setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' });
      setShowModal(false);
      setEditMode(false);
      setEditResourceId(null);
    } catch (err: any) {
      setError(err.message || 'Error saving resource');
    } finally {
      setLoading(false);
    }
  };

  // Filtered and searched resources, and by department for non-admin users
  const filteredResources = resources
    .filter(resource => user?.role === 'admin' || resource.department === user?.department)
    .filter(resource => {
      const matchesType = filterType === 'All' || resource.type === filterType;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        resource.name?.toLowerCase().includes(searchLower) ||
        resource.unit?.toLowerCase().includes(searchLower) ||
        (resource.batch_number ? resource.batch_number.toLowerCase().includes(searchLower) : false);
      return matchesType && matchesSearch;
    });

  // Inline quantity save handler
  const handleQuantityEdit = (resource: Resource) => {
    setEditingQuantityId(resource.id);
    setEditingQuantityValue(resource.quantity.toString());
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingQuantityValue(e.target.value);
  };

  const handleQuantitySave = async (resource: Resource) => {
    const newQuantity = Number(editingQuantityValue);
    if (isNaN(newQuantity) || newQuantity < 0) return;
    try {
      const body = { ...resource, quantity: newQuantity };
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update quantity');
      const updated = await res.json();
      setResources((prev) => prev.map(r => r.id === resource.id ? updated : r));
      setEditingQuantityId(null);
    } catch (err: any) {
      setError(err.message || 'Error updating quantity');
    }
  };

  return (
    <div>
      <div className="p-6">
        {/* Reporting Mechanism UI */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Shift</label>
              <select
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Name of Nurse/Midwife</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedStaff}
                  onChange={e => setSelectedStaff(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 min-w-[180px]"
                >
                  <option value="">Select Staff</option>
                  {staff
                    .filter(s => !user?.department || s.department === user.department)
                    .map(s => (
                      <option key={s.id} value={s.name}>{s.name} {s.department ? `(${s.department})` : ''}</option>
                    ))}
                </select>
                <button
                  className="ml-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow"
                  onClick={async () => {
                    if (!selectedStaff) return;
                    if (!resources || resources.length === 0) {
                      alert('No resources to save in the report.');
                      return;
                    }
                    const now = new Date();
                    // Save report to backend
                    const report = {
                      shift: selectedShift,
                      staffName: selectedStaff,
                      staffId: staff.find(s => s.name === selectedStaff)?.id || null,
                      department: user?.department || '',
                      date: now.toISOString(),
                      resources: resources.map(r => ({ ...r }))
                    };
                    try {
                      await apiPost('/inventory-reports', report);
                      window.dispatchEvent(new Event('inventory_report_saved'));
                      alert('Report saved successfully!');
                    } catch (err: any) {
                      alert('Failed to save report: ' + (err?.message || err));
                    }
                  }}
                  disabled={!selectedStaff}
                  type="button"
                >
                  Save Report
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 w-full">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by name, unit, or batch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 w-full sm:w-56"
            />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 w-full sm:w-auto"
            >
              <option value="All">All Types</option>
              <option value="Drug">Drug</option>
              <option value="Equipment">Equipment</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow w-full sm:w-auto"
              onClick={() => {
                setShowModal(true);
                setEditMode(false);
                setEditResourceId(null);
                setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' });
              }}
            >
              Register New Resource
            </button>
          </div>
        </div>
        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xl relative border border-gray-200">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                onClick={() => {
                  setShowModal(false);
                  setEditMode(false);
                  setEditResourceId(null);
                }}
                aria-label="Close"
              >
                &times;
              </button>
              <h3 className="text-2xl font-bold mb-6 text-gray-900">{editMode ? 'Edit Resource' : 'Register New Resource'}</h3>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleAddOrEditResource}>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={newResource.name}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    name="type"
                    value={newResource.type}
                    onChange={handleInputChange}
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  >
                    <option value="Drug">Drug</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={newResource.quantity}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Standard Quantity</label>
                  <input
                    type="number"
                    name="standardQuantity"
                    value={newResource.standardQuantity}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={newResource.unit}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  >
                    <option value="">Select Unit</option>
                    <option value="Vial">Vial</option>
                    <option value="Ampule">Ampule</option>
                    <option value="Number">Number</option>
                    <option value="Box">Box</option>
                    <option value="Strip">Strip</option>
                  </select>
                </div>
                {/* Only show for Drug */}
                {newResource.type === 'Drug' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Expired Date</label>
                      <input
                        type="date"
                        name="expiredDate"
                        value={newResource.expiredDate}
                        onChange={handleInputChange}
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                      <input
                        type="text"
                        name="batchNumber"
                        value={newResource.batchNumber}
                        onChange={handleInputChange}
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                      />
                    </div>
                  </>
                )}
                <div className="md:col-span-2 flex justify-end items-center gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditMode(false);
                      setEditResourceId(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !newResource.name.trim() ||
                      !newResource.type.trim() ||
                      !newResource.quantity.toString().trim() ||
                      !newResource.standardQuantity.toString().trim() ||
                      !newResource.unit.trim() ||
                      (newResource.type === 'Drug' && (!newResource.expiredDate.trim() || !newResource.batchNumber.trim()))
                    }
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {loading ? (editMode ? 'Saving...' : 'Registering...') : (editMode ? 'Save' : 'Register')}
                  </button>
                  {error && <span className="text-red-500 text-sm ml-4">{error}</span>}
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Resource Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Current Inventory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Standard Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expired Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resource.type === 'Drug' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{resource.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingQuantityId === resource.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingQuantityValue}
                            min="0"
                            onChange={handleQuantityChange}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button
                            className="text-green-600 hover:text-green-800"
                            title="Save"
                            onClick={() => handleQuantitySave(resource)}
                          >
                            Save
                          </button>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            title="Cancel"
                            onClick={() => setEditingQuantityId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{resource.quantity}</span>
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Quantity"
                            onClick={() => handleQuantityEdit(resource)}
                          >
                            <Pen className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.standard_quantity !== undefined ? resource.standard_quantity : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.type === 'Drug' && resource.expiry_date ? resource.expiry_date : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.type === 'Drug' && resource.batch_number ? resource.batch_number : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex gap-2">
                        <button
                          className="p-2 rounded hover:bg-blue-100 text-blue-600"
                          title="Edit"
                          onClick={() => openEditModal(resource)}
                        >
                          <Pen className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-red-100 text-red-600"
                          title="Delete"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this resource?')) {
                              try {
                                const res = await fetch(`/api/resources/${resource.id}`, { method: 'DELETE' });
                                if (!res.ok) throw new Error('Failed to delete resource');
                                setResources((prev) => prev.filter(r => r.id !== resource.id));
                              } catch (err: any) {
                                setError(err.message || 'Error deleting resource');
                              }
                            }
                          }}
                        >
                          <span className="sr-only">Delete</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredResources.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No resources found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new resource.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResourceManagement;

