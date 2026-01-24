export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'staff' | 'viewer';
  department: string;
  profession?: 'Nurse' | 'Midwifery' | 'General Practitioner' | 'Senior Physician' | 'Admin';
  isActive: boolean;
  permissions: Permission[];
  createdAt?: string;
  lastLogin?: string;
}

export interface Permission {
  module: string;
  actions: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, profession?: string) => Promise<boolean>;
  logout: () => void;
  impersonate: (params: { userId?: string; username?: string }) => Promise<boolean>;
  hasPermission: (module: string, action?: string) => boolean;
  canAccessPage: (page: string) => boolean;
  getUserDepartmentFilter: () => string | null;
  loading: boolean;
}

export const DEPARTMENTS = [
  'NICU',
  'ICU',
  'Medical Ward',
  'Pediatrics Ward',
  'Surgical Ward',
  'Gyni Ward',
  'OB',
  'AEOPD',
  'PEOPD',
  'TFU',
  'Recovery',
  'Liaison',
  'OBGYN Emergency',
  'Radiology'
];

// Central list of professions used across the app (login, form builder, mappings)
export const PROFESSIONS = [
  'General Practitioner',
  'Senior Physician',
  'Midwifery',
  'Nurse'
] as const;

export const USER_ROLES = [
  { value: 'admin', label: 'Administrator', description: 'Full system access' },
  { value: 'user', label: 'User', description: 'Can create and view own reports' },
  { value: 'staff', label: 'Staff', description: 'Department-level access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
];