// Root application component - manages routing, auth, and global providers
import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ShiftProvider } from './hooks/useShift';
import { SearchProvider } from './hooks/useSearch';
import { 
  Dashboard, 
  DynamicISBARForm, 
  DepartmentStaffManagement, 
  ResourceManagement, 
  DatabaseRecords, 
  TrendsAnalytics, 
  FormBuilder, 
  DashboardFormMapping, 
  UserManagement, 
  ShiftManager,
  LoginForm 
} from './features';
import { Layout, IsbarLoader, AIAssistantPanel } from './components/shared';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  const { hasPermission } = useAuth();

  const deny = (
    <div className="p-6 text-center text-red-600">Access denied</div>
  );

  const canView = (module: string) => hasPermission(module, 'view');

  if (loading) {
    return <IsbarLoader overlay message="Loading application..." size={96} />;
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return canView('dashboard') ? <Dashboard /> : deny;
      case 'isbar':
        return canView('isbar') ? <DynamicISBARForm /> : deny;
      case 'staff':
        return canView('staff') ? <DepartmentStaffManagement /> : deny;
      case 'resources':
        return canView('resources') ? <ResourceManagement /> : deny;
      case 'database':
        return canView('database') ? <DatabaseRecords /> : deny;
      case 'trends':
        return canView('trends') ? <TrendsAnalytics /> : deny;
      case 'form-builder':
        return canView('form-builder') ? <FormBuilder /> : deny;
      case 'dashboard-mapping':
        // Permission module name uses plural in limited-admin block: 'dashboard-mappings'
        return canView('dashboard-mappings') ? <DashboardFormMapping /> : deny;
      case 'user-management':
        return canView('user-management') ? <UserManagement /> : deny;
      default:
        return canView('dashboard') ? <Dashboard /> : deny;
    }
  };

  return (
    <ShiftManager>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderCurrentPage()}
      </Layout>
      <AIAssistantPanel />
    </ShiftManager>
  );
};

import { ScreenProvider } from './contexts/ScreenContext';

function App() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <SearchProvider>
          <ScreenProvider>
            <AppContent />
          </ScreenProvider>
        </SearchProvider>
      </ShiftProvider>
    </AuthProvider>
  );
}

export default App;