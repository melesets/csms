import React, { useState } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { Layout } from './components/Layout';
import Dashboard from './components/Dashboard';
import { ISBARForm } from './components/ISBARForm';
import { DepartmentStaffManagement } from './components/DepartmentStaff/DepartmentStaffManagement';
import ResourceManagement from './components/ResourceManagement';
import { DatabaseRecords } from './components/DatabaseRecords';

import { TrendsAnalytics } from './components/TrendsAnalytics';
import { FormBuilder } from './components/FormBuilder/FormBuilder';
import { UserManagement } from './components/UserManagement/UserManagement';
import { DynamicISBARForm } from './components/DynamicISBARForm';
import { useAuth } from './hooks/useAuth';

const AppContent = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!user) {
    return <LoginForm />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'isbar':
        return <DynamicISBARForm />;
      case 'staff':
        return <DepartmentStaffManagement />;
      case 'resources':
        return <ResourceManagement />;
      case 'database':
        return <DatabaseRecords />;
      case 'trends':
        return <TrendsAnalytics />;
      case 'form-builder':
        return <FormBuilder />;
      case 'user-management':
        return <UserManagement />;
      default:
        return <Dashboard />;
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
      <AppContent />
    </AuthProvider>
  );
}

export default App;