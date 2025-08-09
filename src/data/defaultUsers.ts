import { User } from '../types/auth';

export const defaultUsers: User[] = [
  {
    id: '1',
    username: 'quality',
    name: 'Quality Admin',
    email: 'quality@hospital.com',
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
    ],
    createdAt: new Date().toISOString()
  }
];