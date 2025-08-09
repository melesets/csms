 import React from 'react';

interface DashboardSectionProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  subtitle,
  actions,
  children,
  className
}) => {
  return (
    <section className={`bg-white rounded-xl shadow-sm p-6 ${className || ''}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center">
            {icon && <span className="mr-2 inline-flex items-center">{icon}</span>}
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
          </div>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex-shrink-0 ml-4">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
};

export default DashboardSection;
