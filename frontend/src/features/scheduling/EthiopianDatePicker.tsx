import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { gregorianToEthiopian, ethiopianToGregorian, formatEthiopianDate } from '../../utils/ethiopianCalendar';

const toLocal = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

function daysInEthMonth(year: number, month: number) {
  return month === 13 ? (year % 4 === 3 ? 6 : 5) : 30;
}

function ethFirstDayDow(year: number, month: number) {
  return ethiopianToGregorian({ year, month, day: 1 }).getDay();
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function EthiopianDatePicker({ value, onChange }: Props) {
  const eth = useMemo(() => gregorianToEthiopian(toLocal(value)), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(eth.month);
  const [viewYear, setViewYear] = useState(eth.year);
  const [selectedDay, setSelectedDay] = useState(eth.day);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const e = gregorianToEthiopian(toLocal(value));
    setViewMonth(e.month);
    setViewYear(e.year);
    setSelectedDay(e.day);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const curYear = gregorianToEthiopian(new Date()).year;
  const years = useMemo(() => Array.from({ length: 21 }, (_, i) => curYear - 10 + i), [curYear]);

  const dim = daysInEthMonth(viewYear, viewMonth);
  const dow = ethFirstDayDow(viewYear, viewMonth);
  const prevM = viewMonth === 1 ? 13 : viewMonth - 1;
  const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
  const dimPrev = daysInEthMonth(prevY, prevM);

  const cells = useMemo(() => {
    const r: { day: number; current: boolean }[] = [];
    for (let i = dow - 1; i >= 0; i--) r.push({ day: dimPrev - i, current: false });
    for (let d = 1; d <= dim; d++) r.push({ day: d, current: true });
    const rem = 42 - r.length;
    for (let d = 1; d <= rem; d++) r.push({ day: d, current: false });
    return r;
  }, [dow, dim, dimPrev]);

  const handleConfirm = () => {
    const greg = ethiopianToGregorian({ year: viewYear, month: viewMonth, day: selectedDay });
    onChange(toStr(greg));
    setOpen(false);
  };

  const selectDay = (day: number, current: boolean) => {
    if (!current) return;
    setSelectedDay(day);
  };

  const todayEth = useMemo(() => gregorianToEthiopian(new Date()), []);
  const isToday = viewYear === todayEth.year && viewMonth === todayEth.month;

  const handleToday = () => {
    const now = new Date();
    const today = gregorianToEthiopian(now);
    setViewYear(today.year);
    setViewMonth(today.month);
    setSelectedDay(today.day);
  };

  const displayLabel = formatEthiopianDate(eth, 'long');
  const headerLabel = formatEthiopianDate({ year: viewYear, month: viewMonth, day: selectedDay }, 'long');

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-gray-300 transition-colors select-none"
        title={`Gregorian: ${value}`}
      >
        <CalendarDays className="w-3 h-3 text-gray-400" />
        <span className="text-[11px] text-gray-700 whitespace-nowrap">{displayLabel}</span>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 w-[300px] overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[11px] text-gray-400 font-medium mb-0.5">Selected Date</div>
            <div className="text-sm font-bold text-gray-800">{headerLabel}</div>
          </div>

          <div className="px-4 pb-3 flex gap-2">
            <select
              value={viewMonth}
              onChange={e => setViewMonth(+e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:border-blue-400"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={e => setViewYear(+e.target.value)}
              className="w-[80px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:border-blue-400"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="px-4 pb-1">
            <div className="grid grid-cols-7">
              {WEEKDAYS.map(w => (
                <div key={w} className="text-center text-[9px] font-semibold text-gray-400 py-1">{w}</div>
              ))}
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="grid grid-cols-7">
              {cells.map((c, i) => {
                const sel = c.current && c.day === selectedDay;
                const todayMark = c.current && isToday && c.day === todayEth.day;
                return (
                  <button
                    key={i}
                    onClick={() => selectDay(c.day, c.current)}
                    disabled={!c.current}
                    className={`h-9 w-full flex items-center justify-center rounded-full text-xs transition-all ${
                      !c.current ? 'text-gray-200 cursor-default' :
                      sel ? 'bg-[#00b8d4] text-white font-bold shadow-sm' :
                      todayMark ? 'ring-2 ring-[#00b8d4] text-[#00b8d4] font-bold' :
                      'text-gray-700 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    {String(c.day).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToday}
                className="text-xs font-semibold text-[#00b8d4] hover:text-[#009db4] px-3 py-1.5"
              >
                Today
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleConfirm}
              className="text-xs font-bold text-[#00b8d4] hover:text-[#009db4] px-4 py-1.5"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
