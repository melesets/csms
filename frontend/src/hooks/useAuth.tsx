// Authentication context - login, logout, permissions, and user session management
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types/auth';
import { apiPost } from '../api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeOperator, setActiveOperatorState] = useState<Partial<User> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session on app load
    const savedUser = localStorage.getItem('isbar_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('isbar_user');
      }
    }
    const savedOperator = localStorage.getItem('isbar_active_operator');
    if (savedOperator) {
      try {
        setActiveOperatorState(JSON.parse(savedOperator));
      } catch (error) {
        localStorage.removeItem('isbar_active_operator');
      }
    }
    setLoading(false);
  }, []);

  const setActiveOperator = (operator: Partial<User> | null) => {
    setActiveOperatorState(operator);
    if (operator) {
      localStorage.setItem('isbar_active_operator', JSON.stringify(operator));
    } else {
      localStorage.removeItem('isbar_active_operator');
    }
  };

  const login = async (username: string, password: string, profession?: string): Promise<boolean> => {
    try {
      const userData = await apiPost('/login', { username, password, profession });
      setUser(userData);
      localStorage.setItem('isbar_user', JSON.stringify(userData));
      return true;
    } catch (e: any) {
      try {
        const parsed = typeof e?.message === 'string' ? JSON.parse(e.message) : e;
        console.error('Login failed:', parsed);
      } catch {
        console.error('Login failed:', e);
      }
      return false;
    }
  };

  const logout = () => {
    // Log audit trail entry before clearing session
    fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    setUser(null);
    setActiveOperator(null);
    localStorage.removeItem('isbar_user');
    localStorage.removeItem('isbar_admin_impersonator');
  };

  // Frontend-only FULL impersonation for Admin Testing
  const impersonate = async (params: { userId?: string; username?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      const users = await res.json();
      const target = users.find((u: any) =>
        (params.userId && String(u.id) === String(params.userId)) ||
        (params.username && String(u.username) === String(params.username))
      );
      if (!target) throw new Error('User not found');
      const role = String(target.role || '').toLowerCase();
      let permissions: any[] = [];
      switch (role) {
        case 'admin':
          permissions = [
            { module: 'dashboard', actions: ['view'] },
            { module: 'isbar', actions: ['view', 'create', 'edit', 'delete'] },
            { module: 'staff', actions: ['view', 'create', 'edit', 'delete'] },
            { module: 'resources', actions: ['view', 'create', 'edit', 'delete'] },
            { module: 'database', actions: ['view', 'export'] },
            { module: 'trends', actions: ['view'] },
            { module: 'form-builder', actions: ['view', 'create', 'edit', 'delete'] },
            { module: 'user-management', actions: ['view', 'create', 'edit', 'delete'] }
          ];
          break;
        case 'staff':
          permissions = [
            { module: 'dashboard', actions: ['view'] },
            { module: 'forms', actions: ['edit'] }
          ];
          break;
        case 'viewer':
          permissions = [
            { module: 'dashboard', actions: ['view'] }
          ];
          break;
        case 'user':
          permissions = [
            { module: 'dashboard', actions: ['view'] },
            { module: 'isbar', actions: ['view'] },
            { module: 'staff', actions: ['view'] },
            { module: 'resources', actions: ['view'] },
            { module: 'database', actions: ['view'] },
            { module: 'trends', actions: ['view'] },
            { module: 'form-builder', actions: ['view'] },
            { module: 'user-management', actions: [] }
          ];
          break;
        default:
          permissions = [];
      }
      const userData = {
        id: target.id,
        username: target.username,
        name: target.name,
        email: target.email,
        role,
        department: target.department,
        profession: target.profession,
        isActive: target.isActive ?? true,
        permissions,
        createdAt: target.createdAt,
        token: user?.token
      } as any;
      
      // Save root admin user before replacing
      if (!localStorage.getItem('isbar_admin_impersonator') && user) {
        localStorage.setItem('isbar_admin_impersonator', JSON.stringify(user));
      }

      setUser(userData);
      localStorage.setItem('isbar_user', JSON.stringify(userData));
      return true;
    } catch (e) {
      console.error('Impersonation failed:', e);
      return false;
    }
  };

  const revertImpersonation = () => {
    const adminUserStr = localStorage.getItem('isbar_admin_impersonator');
    if (adminUserStr) {
      try {
        const originalUser = JSON.parse(adminUserStr);
        setUser(originalUser);
        localStorage.setItem('isbar_user', JSON.stringify(originalUser));
        localStorage.removeItem('isbar_admin_impersonator');
      } catch (e) {
        console.error('Failed to revert impersonation', e);
      }
    }
  };



  const hasPermission = (module: string, action?: string): boolean => {
    if (!user) return false;

    // 1. If explicit permissions exist, they are the source of truth
    const modulePermission = (user.permissions || []).find(p => p.module === module);
    if (modulePermission) {
      if (!action) return modulePermission.actions.length > 0;
      return modulePermission.actions.includes(action);
    }

    // 2. Fallback: Role-based defaults if no explicit permissions defined for this module
    if (user.role === 'admin') return true;

    // Special profession-based rule for resources (existing logic)
    if (module === 'resources') {
      return user.profession === 'Nurse' || user.profession === 'Midwifery';
    }

    // Default: basic modules for everyone
    const defaultModules = ['dashboard', 'isbar'];
    if (defaultModules.includes(module)) return true;

    return false;
  };

  const canAccessPage = (page: string): boolean => {
    if (!user) return false;

    const pageAccess: Record<string, string[]> = {
      'dashboard': ['admin', 'user', 'staff', 'viewer'],
      'reports': ['admin', 'user', 'staff'],
      'department-staff': ['admin', 'staff'],
      'resources': ['admin', 'staff'],
      'all-records': ['admin', 'user', 'staff'],
      'analytics': ['admin', 'user', 'staff'],
      'form-builder': ['admin'],
      'user-management': ['admin']
    };

    const allowedRoles = pageAccess[page] || [];
    return allowedRoles.includes(user.role);
  };

  const getUserDepartmentFilter = (): string | null => {
    if (!user) return null;
    if (user.role === 'admin') return null; // Admin sees all departments
    return user.department;
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    impersonate,
    revertImpersonation,
    activeOperator,
    setActiveOperator,
    hasPermission,
    canAccessPage,
    getUserDepartmentFilter,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};