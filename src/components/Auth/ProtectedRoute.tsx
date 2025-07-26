import React, { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  module?: string;
  action?: string;
  fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  module, 
  action,
  fallback = <div className="p-4 text-center text-gray-500">Access denied</div>
}) => {
  const { hasPermission } = useAuth();

  if (module && !hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};