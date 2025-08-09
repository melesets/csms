import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
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
    setLoading(false);
  }, []);

  const login = async (username: string, password: string, profession?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, profession }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('isbar_user', JSON.stringify(userData));
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        console.error('Login failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('isbar_user');
  };

  const hasPermission = (module: string, action?: string): boolean => {
    if (!user || !user.permissions) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // Profession-based restriction: only Nurses/Midwives can access resources
    if (module === 'resources') {
      const allowed = user.profession === 'Nurse' || user.profession === 'Midwifery';
      if (!allowed) return false;
    }

    const modulePermission = user.permissions.find(p => p.module === module);
    if (!modulePermission) return false;

    if (!action) return modulePermission.actions.length > 0;
    return modulePermission.actions.includes(action);
  };

  const canAccessPage = (page: string): boolean => {
    if (!user) return false;

    // Define page access rules based on roles
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