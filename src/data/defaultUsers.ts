import { User, DEPARTMENTS } from '../types/auth';

export const defaultUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    role: 'admin',
    department: 'All',
    isActive: true,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'staff', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'resources', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'database', actions: ['view', 'export'] },
      { module: 'trends', actions: ['view'] },
      { module: 'form-builder', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'user-management', actions: ['view', 'create', 'edit', 'delete'] }
    ]
  },
  {
    id: '2',
    username: 'nicu_nurse',
    password: 'nicu123',
    name: 'NICU Nurse Manager',
    role: 'user',
    department: 'NICU',
    isActive: true,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create'] },
      { module: 'staff', actions: ['view', 'create'] },
      { module: 'resources', actions: ['view', 'create', 'edit'] },
      { module: 'database', actions: ['view'] },
      { module: 'trends', actions: ['view'] }
    ]
  },
  {
    id: '3',
    username: 'surgery_nurse',
    password: 'surgery123',
    name: 'Surgery Unit Coordinator',
    role: 'user',
    department: 'Surgery',
    isActive: true,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create'] },
      { module: 'staff', actions: ['view', 'create'] },
      { module: 'resources', actions: ['view', 'create', 'edit'] },
      { module: 'database', actions: ['view'] },
      { module: 'trends', actions: ['view'] }
    ]
  },
  {
    id: '4',
    username: 'icu_nurse',
    password: 'icu123',
    name: 'ICU Charge Nurse',
    role: 'user',
    department: 'ICU',
    isActive: true,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create'] },
      { module: 'staff', actions: ['view', 'create'] },
      { module: 'resources', actions: ['view', 'create', 'edit'] },
      { module: 'database', actions: ['view'] },
      { module: 'trends', actions: ['view'] }
    ]
  }
];