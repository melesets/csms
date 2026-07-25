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
  CustomTabManager,
  CheckInLogs,
  AttendanceReports,
  UserManagement, 
  ShiftManager,
  IntegrationPage,
  AdminSettings,
  LoginForm
} from './features';
import StaffScheduling from './features/scheduling/StaffScheduling';
import { Layout, IsbarLoader, ErrorBoundary } from './components/shared';

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
    const page = (() => {
      switch (currentPage) {
        case 'dashboard':
          return canView('dashboard') ? <Dashboard onNavigate={setCurrentPage} /> : deny;
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
          return canView('dashboard-mappings') ? <DashboardFormMapping /> : deny;
        case 'custom-tabs':
          return canView('dashboard') ? <CustomTabManager onNavigate={setCurrentPage} /> : deny;
        case 'check-in-logs':
          return canView('staff') ? <CheckInLogs /> : deny;
        case 'attendance-reports':
          return canView('staff') ? <AttendanceReports /> : deny;
        case 'integrations':
          return canView('form-builder') ? <IntegrationPage /> : deny;
        case 'user-management':
          return canView('user-management') ? <UserManagement /> : deny;
        case 'admin-settings':
          return canView('user-management') ? <AdminSettings /> : deny;
        case 'scheduling':
          return canView('scheduling') ? <StaffScheduling /> : deny;
        default:
          return canView('dashboard') ? <Dashboard /> : deny;
      }
    })();
    return <ErrorBoundary key={currentPage}>{page}</ErrorBoundary>;
  };

  return (
    <ShiftManager>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderCurrentPage()}
      </Layout>
    </ShiftManager>
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