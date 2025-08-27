import { useState } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { ShiftProvider } from './hooks/useShift';
import { SearchProvider } from './hooks/useSearch';
import { LoginForm } from './components/Auth/LoginForm';
import { Layout } from './components/Layout';
import Dashboard from './components/Dashboard';
import { DepartmentStaffManagement } from './components/DepartmentStaff/DepartmentStaffManagement';
import ResourceManagement from './components/ResourceManagement';
import { DatabaseRecords } from './components/DatabaseRecords';

import { TrendsAnalytics } from './components/TrendsAnalytics';
import { FormBuilder } from './components/FormBuilder/FormBuilder';
import { UserManagement } from './components/UserManagement/UserManagement';
import { DynamicISBARForm } from './components/DynamicISBARForm';
import { DashboardFormMapping } from './components/Admin/DashboardFormMapping';
import { useAuth } from './hooks/useAuth';
import IsbarLoader from './components/IsbarLoader';

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
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <SearchProvider>
          <AppContent />
        </SearchProvider>
      </ShiftProvider>
    </AuthProvider>
  );
}

export default App;