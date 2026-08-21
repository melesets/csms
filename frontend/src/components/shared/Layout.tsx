// Main application layout - sidebar navigation, header, and content area
// Provides responsive sidebar with role-based menu items and global search
import React, { useState, useRef, useCallback } from 'react';
import {
  Menu,
  LogOut,
  User,
  UserCircle,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { Search } from 'lucide-react';
import { useSearch } from '../../hooks/useSearch';
import { EthiopianDateTimeDisplay } from './date/EthiopianDateTimeDisplay';
import { NotificationBell } from './NotificationBell';
import { ALL_PAGES } from '../../config/pages';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([]));
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout, hasPermission, canAccessPage, revertImpersonation } = useAuth();
  const { shift, setShift, activeSession } = useShift();
  const isAdminImpersonating = !!localStorage.getItem('isbar_admin_impersonator');
  const { query, setQuery } = useSearch();

  const handleSidebarEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(true);
  }, []);

  const handleSidebarLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 300);
  }, []);

  const sidebarExpanded = isCollapsed ? isHovering : true;

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const menuItems = ALL_PAGES;

  const filteredMenuItems = menuItems.filter(item => {
    // Hide pages marked as hidden
    if (item.hidden) return false;
    // Use canAccessPage which checks the specific page ID against permissions
    return canAccessPage(item.id);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        className={`fixed inset-y-0 left-0 z-50 ${sidebarExpanded ? 'w-64' : 'w-20'} bg-[#003153] text-white shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center h-16 px-6 border-b border-white/10">
              <img src={`${import.meta.env.BASE_URL}applogo.png`} alt="CSMS" className="h-12 w-auto max-w-full object-contain" />
        </div>

        <nav className="mt-6 space-y-1">
          {/* Clinical Section - collapsible */}
          {filteredMenuItems.some(item => item.group === 'clinical') && (
            <div>
              <div>
                {sidebarExpanded && (
                  <button
                    onClick={() => toggleSection('clinical')}
                    className="w-full flex items-center justify-between px-6 py-1.5 group"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Clinical</span>
                    <ChevronDown className={`w-3 h-3 text-white/30 transition-transform duration-300 ${collapsedSections.has('clinical') ? '-rotate-90' : ''}`} />
                  </button>
                )}
                {!sidebarExpanded && <div className="border-t border-white/10 mx-4 my-2" />}
              </div>
              {filteredMenuItems.filter(item => item.group === 'clinical' && !collapsedSections.has('clinical')).map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`group w-full flex items-center ${sidebarExpanded ? 'px-6' : 'justify-center px-0'} py-3 text-left transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg mx-2 ${sidebarExpanded ? '' : 'w-[calc(100%-1rem)]'} ${
                      isActive
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                  >
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ease-in-out ${isActive ? 'bg-white/20' : 'group-hover:bg-white/10'}`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                      {isActive && (
                        <span className="absolute -left-5 w-1 h-5 bg-white rounded-r-full transition-all duration-300" />
                      )}
                    </div>
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${sidebarExpanded ? 'opacity-100 w-auto ml-3' : 'opacity-0 w-0'}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Admin Section - collapsible */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && filteredMenuItems.some(item => item.group === 'admin') && (
            <div>
              <div>
                {sidebarExpanded && (
                  <button
                    onClick={() => toggleSection('admin')}
                    className="w-full flex items-center justify-between px-6 py-1.5 group"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Admin</span>
                    <ChevronDown className={`w-3 h-3 text-white/30 transition-transform duration-300 ${collapsedSections.has('admin') ? '-rotate-90' : ''}`} />
                  </button>
                )}
                {!sidebarExpanded && <div className="border-t border-white/10 mx-4 my-2" />}
              </div>
              {filteredMenuItems.filter(item => item.group === 'admin' && !collapsedSections.has('admin')).map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`group w-full flex items-center ${sidebarExpanded ? 'px-6' : 'justify-center px-0'} py-3 text-left transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg mx-2 ${sidebarExpanded ? '' : 'w-[calc(100%-1rem)]'} ${
                      isActive
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                  >
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ease-in-out ${isActive ? 'bg-white/20' : 'group-hover:bg-white/10'}`}>
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                      {isActive && (
                        <span className="absolute -left-5 w-1 h-5 bg-white rounded-r-full transition-all duration-300" />
                      )}
                    </div>
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${sidebarExpanded ? 'opacity-100 w-auto ml-3' : 'opacity-0 w-0'}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 transition-all duration-300">
              <User className="w-4 h-4 text-white/70" />
            </div>
            <div className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50">{user?.department}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
            }}
            className="w-full flex items-center justify-center px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-all duration-300 ease-in-out"
            title={!sidebarExpanded ? 'Sign Out' : undefined}
          >
            <LogOut className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${sidebarExpanded ? 'mr-2' : ''}`} />
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Sign Out</span>
          </button>
          <p className={`text-center text-[10px] text-white/30 mt-3 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>v2.0.0</p>
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
        {/* Admin Impersonation Banner */}
        {isAdminImpersonating && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-sm z-50">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="font-medium text-sm">
                ADMIN MODE: You are currently fully logged in as <strong>{user?.name} ({user?.role})</strong>.
              </span>
            </div>
            <button 
              onClick={() => {
                if (revertImpersonation) revertImpersonation();
                onNavigate?.('dashboard');
              }}
              className="px-3 py-1 bg-white text-red-700 text-xs font-bold rounded shadow hover:bg-gray-100 transition-colors"
            >
              Return to Admin
            </button>
          </div>
        )}
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
                className="hidden lg:inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
              </button>
              <h2 className="text-xl font-semibold text-[#003366] capitalize ml-2">
                {(() => {
                  switch (currentPage) {
                    case 'isbar':
                      return 'Report';
                    case 'dashboard':
                      return 'Dashboard';
                    case 'staff':
                      return 'Department Activity';
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
                    case 'custom-tabs':
                      return 'Custom Tabs';
                    case 'check-in-logs':
                      return 'Check-In Logs';
                    case 'attendance-reports':
                      return 'Attendance Reports';
                    case 'activity-log':
                      return 'Activity Log';
                    case 'integrations':
                      return 'Integrations';
                    case 'user-management':
                      return 'User Management';
                    case 'units':
                      return 'Unit Management';
                    case 'feedback':
                      return 'Feedback';
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
              <div className="hidden md:flex items-center text-xs font-semibold text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                <EthiopianDateTimeDisplay date={new Date()} showTime format="long" />
              </div>
              <NotificationBell onNavigate={onNavigate} />

              {activeSession && (
                <div className="hidden lg:flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-bold text-gray-400">Ward / Station</span>
                    <span className="text-xs font-bold text-[#003153]">{activeSession.ward}</span>
                  </div>
                  <div className="h-6 w-[1px] bg-gray-300" />
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-bold text-gray-400">Shift</span>
                    <span className="text-xs font-bold text-[#002640]">{activeSession.shiftName}</span>
                  </div>
                </div>
              )}

              {user?.role === 'admin' && (
                <div className="flex items-center space-x-2 bg-[#003153]/5 px-3 py-1.5 rounded-lg border border-[#003153]/10">
                  <label className="text-[10px] font-bold text-[#003153] uppercase">View Shift:</label>
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value as any)}
                    className="text-xs font-bold bg-transparent text-[#002640] outline-none cursor-pointer"
                  >
                    <option value="All">All Shifts</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              )}
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