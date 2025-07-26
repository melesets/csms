export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  department: string;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
}

export interface Permission {
  module: string;
  actions: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (module: string, action?: string) => boolean;
}


export const DEPARTMENTS = [
  'NICU',
  'PEOPD',
  'TFU',
  'Pediatrics Ward',
  'Medical Ward',
  'Gynecology Ward',
  'Obstetrics Unit',
  'Surgical Ward',
  'AEOPD',
  'ICU'
] as const;

export type Department = typeof DEPARTMENTS[number];