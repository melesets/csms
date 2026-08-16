// Central page registry — single source of truth for all pages
// Add new pages here and they automatically appear in:
//   1. Sidebar navigation (Layout.tsx)
//   2. Permission checkboxes (UserForm.tsx)
//   3. Access control (useAuth.tsx canAccessPage/hasPermission)

import {
  Home,
  ClipboardList,
  ClipboardCheck,
  Users,
  Package,
  Database,
  TrendingUp,
  Settings,
  UserPlus,
  FileText,
  LayoutDashboard,
  Plug,
  Clock,
  BarChart3,
  CalendarDays,
  Tag,
  Shield,
  Activity,
  ScrollText,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface PageDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  module: string;
  group: 'clinical' | 'admin';
  adminOnly?: boolean;
  /** If true, this page is hidden from sidebar but still enforceable via permissions */
  hidden?: boolean;
}

export const ALL_PAGES: PageDefinition[] = [
  // ── Clinical Pages ──────────────────────────────────────
  { id: 'dashboard',          label: 'Dashboard',          icon: Home,            module: 'dashboard',          group: 'clinical' },
  // Report page is hidden from the sidebar — only reachable via an active staff card
  { id: 'isbar',              label: 'Report',             icon: ClipboardList,   module: 'isbar',              group: 'clinical', hidden: true },
  { id: 'survey',             label: 'Documentation',      icon: ClipboardCheck,  module: 'survey',             group: 'clinical' },
  { id: 'staff',              label: 'Department Activity', icon: Users,          module: 'staff',              group: 'clinical' },
  // Resource page: visible in the sidebar as a read-only viewer; editing happens via the active staff card flow
  { id: 'resources',          label: 'Resources',          icon: Package,         module: 'resources',          group: 'clinical' },
  { id: 'database',           label: 'All Records',        icon: Database,        module: 'database',           group: 'clinical' },
  { id: 'trends',             label: 'Analytics',          icon: TrendingUp,      module: 'trends',             group: 'clinical' },
  { id: 'scheduling',         label: 'Staff Schedule',     icon: CalendarDays,    module: 'scheduling',         group: 'clinical' },
  { id: 'feedback',           label: 'Feedback',            icon: MessageSquare,   module: 'feedback',           group: 'clinical' },

  // ── Admin Pages ─────────────────────────────────────────
  { id: 'form-builder',       label: 'Form Builder',       icon: FileText,         module: 'form-builder',       group: 'admin', adminOnly: true },
  { id: 'custom-tabs',        label: 'Custom Tabs',        icon: Tag,              module: 'custom-tabs',        group: 'admin', adminOnly: true },
  { id: 'dashboard-mapping',  label: 'Dashboard Mapping',  icon: LayoutDashboard,  module: 'dashboard-mapping',  group: 'admin', adminOnly: true },
  { id: 'integrations',       label: 'Integrations',       icon: Plug,             module: 'integrations',       group: 'admin', adminOnly: true },
  { id: 'check-in-logs',      label: 'Check-In Logs',      icon: Clock,            module: 'check-in-logs',      group: 'admin', adminOnly: true },
  { id: 'attendance-reports', label: 'Attendance Reports',  icon: BarChart3,       module: 'attendance-reports', group: 'admin', adminOnly: true },
  { id: 'activity-log',       label: 'Activity Log',        icon: ScrollText,      module: 'activity-log',       group: 'admin', adminOnly: true },
  { id: 'user-management',    label: 'User Management',    icon: UserPlus,         module: 'user-management',    group: 'admin', adminOnly: true },
  { id: 'admin-settings',     label: 'Settings',           icon: Settings,         module: 'admin-settings',     group: 'admin', adminOnly: true },
];

/** Get unique modules for permission checkboxes (deduped by module id) */
export function getUniqueModules() {
  const seen = new Set<string>();
  return ALL_PAGES.filter(p => {
    if (seen.has(p.module)) return false;
    seen.add(p.module);
    return true;
  }).map(p => ({ id: p.module, label: p.label }));
}

/** Check if a page is accessible given user permissions and role */
export function isPageAccessible(
  pageId: string,
  userPermissions: Array<{ module: string; actions: string[] }> | null | undefined,
  userRole: string
): boolean {
  if (userRole === 'superadmin' || userRole === 'admin') return true;

  const page = ALL_PAGES.find(p => p.id === pageId);
  if (!page) return false;

  // Admin-only pages require admin/superadmin role
  if (page.adminOnly) return false;

  // Clinical pages are always accessible to all users
  if (page.group === 'clinical') return true;

  // For non-clinical pages, check explicit permissions
  if (userPermissions && userPermissions.length > 0) {
    const mod = userPermissions.find(p => p.module === page.module);
    return mod ? mod.actions.length > 0 : false;
  }

  return false;
}
