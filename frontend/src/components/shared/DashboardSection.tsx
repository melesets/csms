// Collapsible dashboard section wrapper with optional animation
// Provides consistent section layout with title, icon, and action slots
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  subtitle,
  actions,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    if (collapsible) setIsCollapsed(prev => !prev);
  };

  return (
    <section className={`bg-white rounded-xl shadow-sm overflow-hidden ${className || ''}`}>
      <div
        className={`flex items-start justify-between px-6 pt-6 pb-${isCollapsed ? '6' : '4'} ${collapsible ? 'cursor-pointer select-none hover:bg-gray-50 transition-colors rounded-t-xl' : ''}`}
        onClick={handleToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className="inline-flex items-center">{icon}</span>}
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            {collapsible && (
              <span className={`ml-1 inline-flex items-center text-gray-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                <ChevronDown className="w-4 h-4" />
              </span>
            )}
          </div>
          {subtitle && !isCollapsed && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
          {subtitle && isCollapsed && (
            <p className="text-xs text-gray-400 mt-0.5 italic">Click to expand</p>
          )}
        </div>
        {actions && !isCollapsed && (
          <div className="flex-shrink-0 ml-4" onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden`}
        style={{ maxHeight: isCollapsed ? 0 : '9999px', opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>
    </section>
  );
};

export default DashboardSection;

