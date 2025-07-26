import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, AuthContextType } from '../types/auth';
import { defaultUsers } from '../data/defaultUsers';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    const stored = localStorage.getItem('isbar_users');
    return stored ? JSON.parse(stored) : defaultUsers;
  });

  useEffect(() => {
    localStorage.setItem('isbar_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    const storedUser = localStorage.getItem('isbar_current_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const foundUser = users.find(u => u.username === username && u.password === password && u.isActive);
    
    if (foundUser) {
      const updatedUser = { ...foundUser, lastLogin: new Date().toISOString() };
      setUser(updatedUser);
      localStorage.setItem('isbar_current_user', JSON.stringify(updatedUser));
      
      // Update last login in users array
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('isbar_current_user');
  };

  const hasPermission = (module: string, action?: string): boolean => {
    if (!user) return false;
    
    const permission = user.permissions.find(p => p.module === module);
    if (!permission) return false;
    
    if (!action) return true;
    return permission.actions.includes(action);
  };

  return {
    user,
    login,
    logout,
    hasPermission
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};