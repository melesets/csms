// Shift activity panel - shows current shift activities and handover status
import React, { useState } from 'react';
import {
  Package,
  Clock,
  ChevronDown,
  ChevronRight,
  Flag,
  AlertTriangle,
  MinusCircle,
  Stethoscope,
  User,
} from 'lucide-react';
import { DashboardSection, EthiopianDateDisplay, EthiopianDateTimeDisplay } from '../../components/shared';
import { ShiftContextData } from '../../hooks/useShift';
import { getRelativeTime } from '../../utils/timeUtils';

/* ─────────────────────── types ─────────────────────── */
interface Report {
  id: string | number;
  staffName: string;
  date: string;
  resources: ResourceItem[];
}

interface ResourceItem {
  name?: string;
  type?: string;
  quantity?: number | string;
  standard_quantity?: number | string;
  standard?: number | string;
  unit?: string;
  expiry_date?: string;
  expiry?: string;
  batch_number?: string;
  batch?: string;
  [key: string]: unknown;
}

interface Round {
  id: string | number;
  staffName: string;
  date: string;
  title: string;
  agenda: { label: string; value: string }[];
}

type ShiftName = 'Morning' | 'Evening' | 'Night';

interface Props {
  shiftContext: ShiftContextData;
  reportsByShift: Record<ShiftName, Report[]>;
  roundsByShift: Record<ShiftName, Round[]>;
  roundMappedTemplates: string[];
  mostRecentShift: ShiftName | null;
  mostRecentRoundShift: ShiftName | null;
}

/* ─── timezone fix helper ─────────────────────────────────── */
function fixTimezoneOffset(dateStr: string | Date): Date {
  const d = new Date(dateStr);
  // Backend DB timezone drop bug pushes EAT dates back by 3 hours when parsed correctly as UTC string.
  // We manually add 3 hours to correct the display to the true EAT original time.
  return new Date(d.getTime() + 3 * 3600 * 1000);
}

/* ─── helpers ─────────────────────────────────────────── */
function resourceBadges(item: ResourceItem) {
  const qty = Number(item.quantity ?? 0);
  const std = Number(item.standard_quantity ?? item.standard ?? NaN);
  const expiry = item.expiry_date || item.expiry;
  const badges: { label: string; cls: string; icon: React.ReactNode }[] = [];
  if (expiry) {
    const d = new Date(expiry);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      if (d < now) badges.push({ label: 'Expired', cls: 'bg-red-100 text-red-700', icon: <Flag className="w-3 h-3" /> });
      else if (diffDays <= 7) badges.push({ label: 'Near Expiry', cls: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> });
    }
  }
  const isLow = !isNaN(qty) && (qty <= 0 || (!isNaN(std) && std >= 2 && qty < 2));
  if (isLow) badges.push({ label: 'Low Stock', cls: 'bg-orange-100 text-orange-700', icon: <MinusCircle className="w-3 h-3" /> });
  return badges;
}

/* ─── Round display ───────────────────────────────────── */
function RoundEntry({ round }: { round: Round }) {
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const findVal = (labels: string[]) => {
    const set = new Set(labels.map(norm));
    const found = round.agenda.find(x => set.has(norm(x.label)));
    return found ? String(found.value) : '';
  };
  const capWords = (s: string) => s.replace(/\b([a-z])(\w*)/gi, (_, a, b) => a.toUpperCase() + b.toLowerCase());

  const patientName = findVal(['Patient name', 'Patient Name', 'name', 'patient_name']);
  const age = findVal(['Age']);
  const bn = findVal(['BN', 'Bed Number', 'bed number', 'bed']);
  const gender = findVal(['Gender', 'Sex']);
  const pain = findVal(['Pain']);
  const orient = findVal(['Patient Orientation/Behavior', 'Orientation']);
  const tasks = findVal(['Performed Tasks']);
  const position = findVal(['Position']);
  const possessions = findVal(['Possessions']);
  const potty = findVal(['Potty']);
  const info = findVal(['Provision of Information']);
  const shiftVal = findVal(['Shift']);

  const items: { label: string; value: string; hi?: boolean }[] = [];
  if (patientName) items.push({ label: 'Patient', value: capWords(patientName), hi: true });
  if (age) items.push({ label: 'Age', value: age });
  if (bn) items.push({ label: 'BN', value: bn });
  if (gender) items.push({ label: 'Gender', value: gender });
  if (pain) items.push({ label: 'Pain', value: pain });
  if (orient) items.push({ label: 'Orientation', value: orient });
  if (tasks) items.push({ label: 'Tasks', value: tasks });
  if (position) items.push({ label: 'Position', value: position });
  if (possessions) items.push({ label: 'Possessions', value: possessions });
  if (potty) items.push({ label: 'Potty', value: potty });
  if (info) items.push({ label: 'Info', value: info });
  if (shiftVal) items.push({ label: 'Shift', value: shiftVal });

  const dateObj = fixTimezoneOffset(round.date || new Date().toISOString());

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
             <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{round.staffName || 'Unknown'}</div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">
              <EthiopianDateTimeDisplay date={dateObj} format="long" showTime={true} /> · <span className="text-indigo-600 font-medium">{getRelativeTime(dateObj)}</span>
            </div>
          </div>
        </div>
        <div className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
          {round.title || 'Nursing Round'}
        </div>
      </div>
      
      {items.length > 0 && (
        <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-2.5 gap-x-4">
            {items.map((it, idx) => (
              <div key={idx} className="text-sm flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{it.label}</span>
                <span className={`font-medium mt-0.5 ${it.hi ? 'text-indigo-600 font-semibold' : 'text-gray-800'}`}>
                    {it.value}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── Inventory report table ──────────────────────────── */
function InventoryReportDetail({ report }: { report: Report }) {
  const [open, setOpen] = useState(true);
  const dateObj = fixTimezoneOffset(report.date);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between border-b border-gray-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">
               {report.staffName}
            </div>
            <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
               <EthiopianDateTimeDisplay date={dateObj} format="long" showTime={true} showIcon={true} /> · <span className="text-emerald-600 font-medium">{getRelativeTime(dateObj)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">
             {Array.isArray(report.resources) ? report.resources.length : 0} items
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {open && (
         <div className="p-0">
          {Array.isArray(report.resources) && report.resources.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Name</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Type</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Qty</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Standard</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Unit</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Expiry</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Batch</th>
                    <th className="px-4 py-2.5 font-semibold border-b border-gray-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(report.resources as ResourceItem[]).map((item, idx) => {
                    const badges = resourceBadges(item);
                    const qtyNum = Number(item.quantity);
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{String(item.name || '-')}</td>
                        <td className="px-4 py-2.5 text-gray-500">{String(item.type || '-')}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{isNaN(qtyNum) ? '0' : (qtyNum >= 1 ? String(qtyNum) : '0')}</td>
                        <td className="px-4 py-2.5 text-gray-500">{String(item.standard_quantity ?? item.standard ?? '-')}</td>
                        <td className="px-4 py-2.5 text-gray-500">{String(item.unit || '-')}</td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {(item.expiry_date || item.expiry) ? <EthiopianDateDisplay date={(item.expiry_date || item.expiry) as string} format="short" /> : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{String(item.batch_number ?? item.batch ?? '-')}</td>
                        <td className="px-4 py-2.5">
                          {badges.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {badges.map((b, bi) => (
                                <span key={bi} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}`}>
                                  {b.icon && <span className="mr-0.5">{b.icon}</span>}
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">No inventory items in this report</div>
          )}
        </div>
      )}
    </div>
  );
}


/* ─── Main component ──────────────────────────────────── */
export function ShiftActivityPanel({
  reportsByShift,
  roundsByShift,
  roundMappedTemplates,
}: Props) {
  
  // Flatten all reports and rounds, ignoring the "Morning/Evening/Night" splits
  const allReports = Object.values(reportsByShift)
    .flat()
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allRounds = Object.values(roundsByShift)
    .flat()
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || Date.now()).getTime() - new Date(a.date || Date.now()).getTime());

  return (
    <>
      {/* Resource Inventory Section (Time-based Timeline) */}
      <DashboardSection
        title="Resource Inventory"
        icon={<Package className="w-5 h-5 text-green-600" />}
        collapsible
        defaultCollapsed={false}
      >
        <div className="space-y-3">
           {allReports.length > 0 ? (
             allReports.map((report, idx) => (
               <InventoryReportDetail key={report.id || idx} report={report} />
             ))
           ) : (
             <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-600">No Inventory Reports</h3>
                <p className="text-xs text-gray-400 mt-1">Reports will appear here as staff submit them.</p>
             </div>
           )}
        </div>
      </DashboardSection>

      {/* Nursing Rounds Section (Time-based Timeline) */}
      <DashboardSection
        title="Nursing Rounds"
        icon={<Stethoscope className="w-5 h-5 text-indigo-600" />}
        collapsible
        defaultCollapsed={false}
      >
        {roundMappedTemplates.length > 0 && allRounds.length === 0 && (
          <div className="mb-4 p-3.5 border border-amber-200 bg-amber-50 text-sm text-amber-800 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-semibold">Round mapping configured:</span> {roundMappedTemplates.join(', ')}. No rounds submitted yet.
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
              onClick={() => { window.location.href = '#/isbar'; }}
              type="button"
            >
              Start Round
            </button>
          </div>
        )}

        <div className="space-y-3">
           {allRounds.length > 0 ? (
             allRounds.map((round, idx) => (
               <RoundEntry key={round.id || idx} round={round} />
             ))
           ) : (
             <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Stethoscope className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-600">No Nursing Rounds</h3>
                <p className="text-xs text-gray-400 mt-1">Rounds will appear here as staff submit them.</p>
             </div>
           )}
        </div>
      </DashboardSection>
    </>
  );
}
