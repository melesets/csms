// Authentication types - User, Permission, AuthContext interfaces
export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'user' | 'staff' | 'viewer';
  department: string;
  profession?: 'Nurse' | 'Midwifery' | 'General Practitioner' | 'Senior Physician' | 'Admin' | 'Laboratory' | 'Pharmacy' | 'Radiology' | 'Other Coordinators';
  isActive: boolean;
  permissions: Permission[];
  shiftType?: 'TID' | 'BID' | '24H' | '36H' | '48H';
  createdBy?: string;
  createdAt?: string;
  lastLogin?: string;
  parentUserId?: string | null;
}

export interface Permission {
  module: string;
  actions: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, profession?: string) => Promise<boolean>;
  logout: () => void;
  impersonate?: (params: { userId?: string; username?: string }) => Promise<boolean>;
  revertImpersonation?: () => void;
  activeOperator?: Partial<User> | null;
  setActiveOperator?: (user: Partial<User> | null) => void;
  hasPermission: (module: string, action?: string) => boolean;
  canAccessPage: (page: string) => boolean;
  getUserDepartmentFilter: () => string | null;
  loading: boolean;
}



// Central list of professions used across the app (login, form builder, mappings)
export const PROFESSIONS = [
  'General Practitioner',
  'Senior Physician',
  'Midwifery',
  'Nurse',
  'Laboratory',
  'Pharmacy',
  'Radiology',
  'Other Coordinators'
] as const;

// Role hierarchy: staff(1) < user(2) < admin(3) < superadmin(4)
export const ROLE_HIERARCHY: Record<string, number> = {
  staff: 1,
  user: 2,
  admin: 3,
  superadmin: 4,
};

export const USER_ROLES = [
  { value: 'superadmin', label: 'Super Administrator', description: 'Full system access, can grant admin role' },
  { value: 'admin', label: 'Administrator', description: 'Manages users and staff' },
  { value: 'user', label: 'User', description: 'Service unit account, manages own staff' },
  { value: 'staff', label: 'Staff', description: 'PIN-based access, nested under a user' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
];