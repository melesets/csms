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
  Shield
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout, hasPermission } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, module: 'dashboard' },
    { id: 'isbar', label: 'Report', icon: ClipboardList, module: 'isbar' },
    { id: 'staff', label: 'Department Staff', icon: Users, module: 'staff' },
    { id: 'resources', label: 'Resources', icon: Package, module: 'resources' },
    { id: 'database', label: 'All Records', icon: Database, module: 'database' },
    { id: 'trends', label: 'Analytics', icon: TrendingUp, module: 'trends' },
    { id: 'form-builder', label: 'Form Builder', icon: Settings, module: 'form-builder', adminOnly: true },
    { id: 'user-management', label: 'User Management', icon: UserPlus, module: 'user-management', adminOnly: true },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return hasPermission(item.module);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 bg-blue-600 text-white">
          <div className="flex items-center">
            <Shield className="w-8 h-8 mr-3" />
            <h1 className="text-lg font-semibold">ISBAR Clinical</h1>
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
                className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                  currentPage === item.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.department}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
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
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
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
                    case 'user-management':
                      return 'User Management';
                    default:
                      return currentPage.replace('-', ' ');
                  }
                })()}
              </h2>
            </div>

            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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