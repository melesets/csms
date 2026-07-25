export interface ShiftType {
  id: number;
  name: string;
  abbreviation: string;
  color: string;
  default_hours: number;
  is_active: boolean;
  department: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  staff_user_id: number;
  shift_type_id: number;
  schedule_date: string;
  department: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  shift_name: string;
  shift_abbr: string;
  shift_color: string;
  staff_name: string;
  staff_role: string;
  profile_picture: string | null;
}

export interface ScheduleConflict {
  type: 'double_booking' | 'unavailable' | 'understaffed';
  message: string;
  existing?: Schedule;
  unavailability?: StaffUnavailability;
  currentCount?: number;
  minRequired?: number;
}

export interface ScheduleChangeLog {
  id: number;
  schedule_id: number | null;
  staff_user_id: number;
  shift_type_id: number | null;
  schedule_date: string;
  department: string;
  action: 'create' | 'update' | 'delete';
  old_shift_type_id: number | null;
  changed_by: number | null;
  changed_at: string;
  staff_name: string;
  changed_by_name: string;
  new_shift_name: string;
  new_shift_abbr: string;
  new_shift_color: string;
  old_shift_name: string | null;
  old_shift_abbr: string | null;
  old_shift_color: string | null;
}

export interface StaffUnavailability {
  id: number;
  user_id: number;
  date_from: string;
  date_to: string;
  reason: string | null;
  is_approved: boolean;
  approved_by: number | null;
  created_at: string;
  user_name: string;
  staff_role: string;
}

export interface MinimumStaffingRule {
  id: number;
  shift_type_id: number;
  department: string;
  min_staff_count: number;
  day_of_week: number | null;
  is_holiday: boolean;
  shift_name: string;
  shift_abbr: string;
  shift_color: string;
}

export interface EthiopianHoliday {
  date: string;
  name: string;
  nameAmharic: string;
  type: 'public' | 'religious' | 'cultural';
}

export interface StaffMember {
  id: number;
  name: string;
  username: string;
  profession: string;
  department: string;
  profile_picture: string | null;
}
