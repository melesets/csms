import React, { useState } from 'react';
import { 
  Home, 
  ClipboardList, 
  Users, 
  Package, 
  Database, 
  TrendingUp, 
  Settings, 
  UserPlus,
  Menu,
  X,
  LogOut,
  User,
  Stethoscope
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useShift } from '../hooks/useShift';
import { Search } from 'lucide-react';
import { useSearch } from '../hooks/useSearch';
import { EthiopianDateDisplay } from './EthiopianDateDisplay';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const { shift, setShift } = useShift();
  const { query, setQuery } = useSearch();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, module: 'dashboard' },
    { id: 'isbar', label: 'Report', icon: ClipboardList, module: 'isbar' },
    { id: 'staff', label: 'Department Staff', icon: Users, module: 'staff' },
    { id: 'resources', label: 'Resources', icon: Package, module: 'resources' },
    { id: 'database', label: 'All Records', icon: Database, module: 'database' },
    { id: 'trends', label: 'Analytics', icon: TrendingUp, module: 'trends' },
    { id: 'form-builder', label: 'Form Builder', icon: Settings, module: 'form-builder', adminOnly: true },
    { id: 'dashboard-mapping', label: 'Dashboard Mapping', icon: Settings, module: 'form-builder', adminOnly: true },
    { id: 'user-management', label: 'User Management', icon: UserPlus, module: 'user-management', adminOnly: true },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return hasPermission(item.module);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'} bg-[#003153] text-white shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 bg-[#003153] text-white border-b border-white/10">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-white flex items-center justify-center mr-3">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <h1 className={`text-lg font-semibold ${isCollapsed ? 'hidden' : ''}`}>AGH-CSMS</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="mt-6">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-6'} py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  currentPage === item.id ? 'bg-white/20 text-white border-l-4 border-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} ${currentPage === item.id ? 'text-white' : 'text-white/80 group-hover:text-white'}`} />
                <span className={`${isCollapsed ? 'hidden' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center mr-3">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className={`flex-1 min-w-0 ${isCollapsed ? 'hidden' : ''}`}>
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/70">{user?.department}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className={`w-4 h-4 ${isCollapsed ? '' : 'mr-2'}`} />
            <span className={`${isCollapsed ? 'hidden' : ''}`}>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#eaf3f7] shadow-sm border-b border-[rgba(0,51,102,0.15)]">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-6 h-6" />
              </button>
              <button
                onClick={() => setIsCollapsed(prev => !prev)}
                className="hidden lg:inline-flex text-gray-500 hover:text-gray-700"
                aria-label="Toggle sidebar"
                aria-expanded={!isCollapsed}
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-semibold text-[#003366] capitalize ml-2">
                {(() => {
                  switch (currentPage) {
                    case 'isbar':
                      return 'Report';
                    case 'dashboard':
                      return 'Dashboard';
                    case 'staff':
                      return 'Department Staff';
                    case 'resources':
                      return 'Resources';
                    case 'database':
                      return 'All Records';
                    case 'trends':
                      return 'Analytics';
                    case 'form-builder':
                      return 'Form Builder';
                    case 'dashboard-mapping':
                      return 'Dashboard Mapping';
                    case 'user-management':
                      return 'User Management';
                    default:
                      return currentPage.replace('-', ' ');
                  }
                })()}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              {currentPage === 'dashboard' && (
                <div className="hidden md:flex items-center relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 pr-3 py-2 w-56 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="hidden md:flex items-center text-sm text-gray-600">
                <EthiopianDateDisplay date={new Date()} format="long" />
              </div>
              {currentPage === 'dashboard' && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Shift:</label>
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value as any)}
                    className="text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All</option>
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              )}
              <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user?.role === 'admin' ? 'Administrator' : user?.department}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};