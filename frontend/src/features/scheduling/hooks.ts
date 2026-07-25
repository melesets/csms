import { useState, useEffect, useCallback } from 'react';
import type { ShiftType, Schedule, ScheduleConflict, StaffUnavailability, MinimumStaffingRule, EthiopianHoliday, StaffMember } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api';

export function useShiftTypes(department?: string) {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = department ? `?department=${encodeURIComponent(department)}` : '';
      const data = await apiGet(`/scheduling/shift-types${params}`);
      setShiftTypes(data);
    } catch { setShiftTypes([]); }
    finally { setLoading(false); }
  }, [department]);

  useEffect(() => { fetch(); }, [fetch]);
  return { shiftTypes, loading, refresh: fetch };
}

export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    apiGet('/scheduling/departments').then(data => {
      setDepartments(Array.isArray(data) ? data : []);
    }).catch(() => setDepartments([]));
  }, []);

  return departments;
}

export function useSchedules(department: string, startDate: string, endDate: string, staffUserId?: number, shiftTypeId?: number) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useState(true);

  const fetchSchedules = useCallback(async (showLoading = false) => {
    if (!department || !startDate || !endDate) { setLoading(false); return; }
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ department, startDate, endDate });
      if (staffUserId) params.set('staffUserId', String(staffUserId));
      if (shiftTypeId) params.set('shiftTypeId', String(shiftTypeId));
      const data = await apiGet(`/scheduling/schedules?${params}`);
      setSchedules(data);
    } catch { setSchedules([]); }
    finally { setLoading(false); }
  }, [department, startDate, endDate, staffUserId, shiftTypeId]);

  useEffect(() => { fetchSchedules(true); }, [fetchSchedules]);
  return { schedules, setSchedules, loading, refresh: fetchSchedules };
}

export function useHolidays(startDate: string, endDate: string) {
  const [holidays, setHolidays] = useState<EthiopianHoliday[]>([]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const fetchHolidays = async () => {
      try {
        const data = await apiGet(`/scheduling/holidays?startDate=${startDate}&endDate=${endDate}`);
        setHolidays(data);
      } catch { setHolidays([]); }
    };
    fetchHolidays();
  }, [startDate, endDate]);

  return holidays;
}

export function useStaff(department: string) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = department ? `?department=${encodeURIComponent(department)}` : '';
      const data = await apiGet(`/scheduling/staff${params}`);
      setStaff(Array.isArray(data) ? data : []);
    } catch { setStaff([]); }
    finally { setLoading(false); }
  }, [department]);

  useEffect(() => { refreshStaff(); }, [refreshStaff]);
  return { staff, loading, refresh: refreshStaff };
}

export function useUnavailability(department: string, startDate: string, endDate: string) {
  const [items, setItems] = useState<StaffUnavailability[]>([]);

  const fetchItems = useCallback(async () => {
    if (!startDate || !endDate) return;
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (department) params.set('department', department);
      const data = await apiGet(`/scheduling/unavailability?${params}`);
      setItems(data);
    } catch { setItems([]); }
  }, [department, startDate, endDate]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  return { items, refresh: fetchItems };
}

export function useMinimumStaffing(department: string) {
  const [rules, setRules] = useState<MinimumStaffingRule[]>([]);

  const fetchRules = useCallback(async () => {
    if (!department) return;
    try {
      const data = await apiGet(`/scheduling/minimum-staffing?department=${encodeURIComponent(department)}`);
      setRules(data);
    } catch { setRules([]); }
  }, [department]);

  useEffect(() => { fetchRules(); }, [fetchRules]);
  return { rules, refresh: fetchRules };
}

export async function createScheduleApi(data: { staffUserId: number; shiftTypeId: number; scheduleDate: string; department: string; notes?: string }) {
  return apiPost('/scheduling/schedules', data);
}

export async function bulkCreateScheduleApi(assignments: { staffUserId: number; shiftTypeId: number; scheduleDate: string; department: string }[]) {
  return apiPost('/scheduling/schedules/bulk', { assignments });
}

export async function updateScheduleApi(id: number, data: { shiftTypeId?: number; notes?: string }) {
  return apiPut(`/scheduling/schedules/${id}`, data);
}

export async function deleteScheduleApi(id: number) {
  return apiDelete(`/scheduling/schedules/${id}`);
}

export async function checkConflictsApi(staffUserId: number, shiftTypeId: number, scheduleDate: string, department: string) {
  const params = new URLSearchParams({ staffUserId: String(staffUserId), shiftTypeId: String(shiftTypeId), scheduleDate, department });
  return apiGet(`/scheduling/conflicts?${params}`);
}

export async function getChangeLogApi(department: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ department, startDate, endDate });
  return apiGet(`/scheduling/change-log?${params}`);
}
