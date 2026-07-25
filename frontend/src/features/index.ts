// Features barrel export - re-exports all feature modules
export * from './auth/LoginForm';
export { default as Dashboard } from './dashboard/HealthcareDashboard';
export * from './staff/DepartmentStaffManagement';
export * from './staff/CheckInLogs';
export * from './staff/AttendanceReports';
export { default as ResourceManagement } from './resources/ResourceManagement';
export * from './patients/DatabaseRecords';
export * from './analysis/TrendsAnalytics';
export * from './form-builder/FormBuilder';
export * from './user-management/UserManagement';
export * from './forms/DynamicISBARForm';
export * from './admin/DashboardFormMapping';
export * from './admin/CustomTabManager';
export * from './admin/AdminSettings';
export * from './shifts/ShiftManager';
export * from './integrations/IntegrationPage';
export * from './scheduling/StaffScheduling';
