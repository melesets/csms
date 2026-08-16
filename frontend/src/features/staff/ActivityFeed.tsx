// Activity feed - session-based timeline of staff actions within check-in sessions
import React, { useState, useEffect } from 'react';
import { FileText, Package, Clock, ChevronDown, ChevronRight, Calendar, Users, Activity, ArrowRight, UserCheck } from 'lucide-react';
import { EthiopianDateTimeDisplay } from '../../components/shared';

interface ActivityFeedProps {
    username?: string;
    department?: string;
}

interface ActivityData {
    submissions: any[];
    resourceUpdates: any[];
    inventoryReports: any[];
}

interface ActivityEvent {
    id: string;
    type: string;
    title: string;
    description: string;
    date: string;
    submittedBy: string;
    icon: any;
    color: string;
    details?: Record<string, any>;
    shiftName?: string;
}

interface SessionRecord {
    id: string;
    person: string;
    shiftName: string;
    lastDate: string;
    reports: ActivityEvent[];
    edits: ActivityEvent[];
    submissions: ActivityEvent[];
}

interface ActivityGroup {
    id: string;
    label: string;
    icon: any;
    color: string;
    sessions: SessionRecord[];
}

type ViewMode = 'daily' | 'individual' | 'activity';

// API timestamps are stored as UTC; the app header displays Ethiopian time
// from the browser's local clock (EAT). Shift UTC values to EAT wall time so
// the feed matches the header logic.
const toEAT = (value: string): string => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Date(d.getTime() + 3 * 3600 * 1000).toISOString();
};

const getDayKey = (date: string): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'unknown';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;

const TYPE_BADGES: Record<string, string> = {
    submission: 'bg-blue-50 text-blue-600',
    resource: 'bg-indigo-50 text-indigo-600',
    inventory: 'bg-emerald-50 text-emerald-600',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ username, department }) => {
    const [activities, setActivities] = useState<ActivityData>({
        submissions: [], resourceUpdates: [], inventoryReports: [],
    });
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [paginationPage, setPaginationPage] = useState(1);

    const fetchData = async () => {
        if (!username && !department) return;
        setLoading(true);
        try {
            const url = username
                ? `/api/activity/user/${encodeURIComponent(username)}`
                : `/api/activity/department/${encodeURIComponent(department as string)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Activity fetch failed');
            const data = await res.json();
            setActivities(data);
        } catch (err) {
            console.error('Failed to load activity:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, department]);

    // ── Build events from all data sources ─────────────────────────────
    const events: ActivityEvent[] = [
        ...(activities.submissions || []).map((s: any) => ({
            id: `sub-${s.id}`,
            type: 'submission',
            title: s.template_name || 'Report Submitted',
            description: `Submitted report${s.patient_name && s.patient_name !== 'N/A' ? ` for ${s.patient_name}` : ''}${s.mrn && s.mrn !== 'N/A' ? ` (MRN ${s.mrn})` : ''}`,
            date: toEAT(s.submitted_at),
            submittedBy: s.submitted_by_name || s.submitted_by || 'Unknown',
            icon: FileText,
            color: 'blue',
            details: s,
            shiftName: s.shift_name,
        })),
        ...(activities.resourceUpdates || []).map((r: any) => ({
            id: `res-${r.id}-${r.updated_at}`,
            type: 'resource',
            title: `Inventory: ${r.name}`,
            description: `Stock updated to ${r.quantity} ${r.unit}${r.expiry_date ? ` · Expiry ${String(r.expiry_date).slice(0, 10)}` : ''}`,
            date: r.updated_at || r.date,
            submittedBy: r.last_updated_by_name || r.last_updated_by || 'Unknown',
            icon: Package,
            color: 'indigo',
            details: r,
            shiftName: r.shift_name,
        })),
        ...((activities as any).inventoryReports || []).map((ir: any) => ({
            id: `ir-${ir.id}`,
            type: 'inventory',
            title: 'Inventory Report',
            description: `${Array.isArray(ir.changes) ? ir.changes.length : 0} item(s) updated`,
            date: toEAT(ir.date),
            submittedBy: ir.submitted_by || ir.staffName || ir.staffname || 'Unknown',
            icon: Package,
            color: 'emerald',
            details: ir,
            shiftName: ir.shift_name || ir.shift,
        })),
    ];

    // Last 14 days only, newest first
    const filteredEvents = events
        .filter(e => {
            const t = new Date(e.date).getTime();
            return !isNaN(t) && t >= Date.now() - TWO_WEEKS_MS;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── Group events into check-in sessions ────────────────────────────
    const getSessionKey = (e: ActivityEvent): string | null => {
        const sid = e.details?.shift_session_id;
        if (sid) return `sess-${sid}`;
        // No session link: only track records by real staff members
        if (!e.details?.staff_username) return null;
        return `flat-${e.details.staff_username}|${e.shiftName || ''}|${getDayKey(e.date)}`;
    };

    // Resource edits already reflected in a saved report's changes should not
    // appear as separate standalone entries (no fragmentation under a report).
    // `r.updated_at` is stored as EAT wall time (DB `now()`), while report
    // dates are UTC wall, so `toEAT` has already normalized them to the same
    // instant space before this comparison.
    const isCapturedInReport = (e: ActivityEvent): boolean => {
        if (e.type !== 'resource' || !e.details) return false;
        const resTime = new Date(e.date).getTime();
        return filteredEvents.some(rep => {
            if (rep.type !== 'inventory') return false;
            const changes = rep.details?.changes || [];
            if (!changes.some((c: any) => String(c.id) === String(e.details.id))) return false;
            return new Date(rep.date).getTime() >= resTime;
        });
    };

    const sessions: SessionRecord[] = (() => {
        const map = new Map<string, SessionRecord>();
        filteredEvents.forEach(e => {
            if (isCapturedInReport(e)) return;
            const key = getSessionKey(e);
            // Only records tied to an actual check-in session are tracked
            if (!key) return;
            let rec = map.get(key);
            if (!rec) {
                rec = { id: key, person: e.submittedBy || 'Unknown', shiftName: e.shiftName || '', lastDate: e.date, reports: [], edits: [], submissions: [] };
                map.set(key, rec);
            }
            if (new Date(e.date).getTime() > new Date(rec.lastDate).getTime()) rec.lastDate = e.date;
            if (e.type === 'inventory') rec.reports.push(e);
            else if (e.type === 'resource') rec.edits.push(e);
            else if (e.type === 'submission') rec.submissions.push(e);
        });
        return [...map.values()].sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
    })();

    // ── Grouping by view mode ──────────────────────────────────────────
    const groups: ActivityGroup[] = (() => {
        if (viewMode === 'daily') {
            const byDay = new Map<string, SessionRecord[]>();
            sessions.forEach(s => {
                const key = getDayKey(s.lastDate);
                if (!byDay.has(key)) byDay.set(key, []);
                byDay.get(key)!.push(s);
            });
            return [...byDay.entries()].map(([key, sess]) => ({
                id: `day-${key}`,
                label: key,
                icon: Calendar,
                color: 'blue',
                sessions: sess,
            }));
        }
        if (viewMode === 'individual') {
            const byPerson = new Map<string, SessionRecord[]>();
            sessions.forEach(s => {
                const person = s.person || 'Unknown';
                if (!byPerson.has(person)) byPerson.set(person, []);
                byPerson.get(person)!.push(s);
            });
            return [...byPerson.entries()].map(([key, sess]) => ({
                id: `person-${key}`,
                label: key,
                icon: Users,
                color: 'teal',
                sessions: sess,
            }));
        }
        const byShift = new Map<string, SessionRecord[]>();
        sessions.forEach(s => {
            const shift = s.shiftName || 'General';
            if (!byShift.has(shift)) byShift.set(shift, []);
            byShift.get(shift)!.push(s);
        });
        return [...byShift.entries()].map(([key, sess]) => ({
            id: `shift-${key}`,
            label: key,
            icon: Activity,
            color: 'purple',
            sessions: sess,
        }));
    })();

    const displayedGroups = groups.slice(0, paginationPage * PAGE_SIZE);
    const hasMore = displayedGroups.length < groups.length;

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isGroupExpanded = (id: string) => expandedGroups.has(id);

    const scopeLabel = username ? username : department === 'All' ? 'All departments' : department || 'This department';

    const renderInventoryChanges = (e: ActivityEvent) => {
        const d = e.details;
        if (!d) return null;
        const changes = Array.isArray(d.changes) ? d.changes : [];
        if (changes.length === 0) return null;
        return (
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {changes.map((r: any, i: number) => {
                        const name = r.name || 'Item';
                        const unit = r.unit || '';
                        const type = r.type || '';
                        const qtyBefore = r.qtyBefore;
                        const qtyAfter = r.qtyAfter;
                        const expBefore = r.expBefore ? String(r.expBefore).slice(0, 10) : null;
                        const expAfter = r.expAfter ? String(r.expAfter).slice(0, 10) : null;
                        const qtyDiff = (Number(qtyBefore) || 0) - (Number(qtyAfter) || 0);
                        return (
                            <div key={i} className="px-3 py-1.5 text-xs">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-gray-700 capitalize truncate">{name}</span>
                                        {type && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${type.toLowerCase() === 'drug' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {type.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    {qtyBefore !== undefined && qtyBefore !== null && (
                                        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                                            <span className="text-gray-400">{qtyBefore} {unit}</span>
                                            <ArrowRight className="w-3 h-3 text-gray-300" />
                                            <span className={`font-bold ${qtyDiff < 0 ? 'text-emerald-600' : qtyDiff > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                {qtyAfter} {unit}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {expBefore && expAfter && (
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                                        <span className="text-gray-400">Expiry {expBefore}</span>
                                        <ArrowRight className="w-3 h-3 text-gray-300" />
                                        <span className="font-semibold text-amber-600">{expAfter}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderCoSigners = (e: ActivityEvent) => {
        const co = e.details?.co_signers;
        if (!Array.isArray(co) || co.length === 0) return null;
        return (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                    <UserCheck className="w-3 h-3" />Co-signer(s): {co.join(', ')}
                </span>
            </div>
        );
    };

    const renderEvent = (e: ActivityEvent, showPerson: boolean) => {
        const EventIcon = e.icon;
        const badge = TYPE_BADGES[e.type] || 'bg-gray-50 text-gray-500';
        return (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className={`p-2 rounded-lg shrink-0 ${badge}`}>
                    <EventIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">{e.title}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">
                            <EthiopianDateTimeDisplay date={e.date} showTime format="long" size="xs" />
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        {showPerson && (
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                                {e.submittedBy}
                            </span>
                        )}
                        {e.shiftName && e.shiftName !== 'Unknown' && (
                            <span className="text-[10px] font-semibold text-[#003153] bg-[#003153]/5 border border-[#003153]/10 px-1.5 py-0.5 rounded">
                                {e.shiftName}
                            </span>
                        )}
                    </div>
                    {e.type === 'inventory' && renderCoSigners(e)}
                    {e.type === 'inventory' && renderInventoryChanges(e)}
                </div>
            </div>
        );
    };

    const renderSession = (s: SessionRecord) => {
        const recordCount = s.reports.length + s.submissions.length + (s.reports.length === 0 ? s.edits.length : 0);
        return (
            <div key={s.id} className="border-t border-gray-100 first:border-t-0">
                <div className="px-5 py-2.5 bg-gray-50/70 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-600 bg-white border border-gray-100 px-1.5 py-0.5 rounded">
                        {s.person}
                    </span>
                    {s.shiftName && s.shiftName !== 'Unknown' && (
                        <span className="text-[10px] font-semibold text-[#003153] bg-[#003153]/5 border border-[#003153]/10 px-1.5 py-0.5 rounded">
                            {s.shiftName}
                        </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                        <EthiopianDateTimeDisplay date={s.lastDate} showTime format="long" size="xs" />
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-gray-400">{recordCount} record(s)</span>
                </div>
                <div className="divide-y divide-gray-50">
                    {s.reports.map(rep => renderEvent(rep, false))}
                    {s.submissions.map(sub => renderEvent(sub, true))}
                    {s.reports.length === 0 && s.edits.map(edit => renderEvent(edit, true))}
                </div>
            </div>
        );
    };

    const renderGroup = (g: ActivityGroup) => {
        const expanded = isGroupExpanded(g.id);
        const Icon = g.icon;
        return (
            <div key={g.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-gray-100/60 transition-shadow duration-300">
                <button onClick={() => toggleGroup(g.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-1 h-3 bg-[#003153] rounded-full" />
                        <div className={`p-2 rounded-lg bg-gray-50 shrink-0`}>
                            <Icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                            {viewMode === 'daily' ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <EthiopianDateTimeDisplay date={g.sessions[0].lastDate} showTime format="long" size="sm" />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{g.sessions.length} session{g.sessions.length === 1 ? '' : 's'}</p>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm font-bold text-gray-900">{g.label}</span>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{g.sessions.length} session{g.sessions.length === 1 ? '' : 's'}</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{g.sessions.length}</span>
                        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                </button>
                {expanded && (
                    <div>
                        {g.sessions.map(renderSession)}
                    </div>
                )}
            </div>
        );
    };

    const modes: { id: ViewMode; label: string; icon: any }[] = [
        { id: 'daily', label: 'Day', icon: Calendar },
        { id: 'individual', label: 'Individual', icon: Users },
        { id: 'activity', label: 'Activity', icon: Activity },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#003153] rounded-xl">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                        <p className="text-sm text-gray-400 mt-0.5">
                            {scopeLabel} · last 14 days
                            {sessions.length > 0 && (
                                <span className="ml-2 text-xs font-semibold text-[#003153]">{sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {modes.map(m => (
                        <button key={m.id} onClick={() => { setViewMode(m.id); setPaginationPage(1); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${viewMode === m.id ? 'bg-[#003153] text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                            <m.icon className="w-3.5 h-3.5" />{m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse" />)}
                </div>
            ) : displayedGroups.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <div className="mx-auto w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500">No activity recorded in the last 14 days</p>
                    <p className="text-xs text-gray-400 mt-1">Check-in sessions with reports, handovers and inventory updates will appear here.</p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {displayedGroups.map(renderGroup)}
                    </div>
                    {hasMore && (
                        <button onClick={() => setPaginationPage(p => p + 1)}
                            className="w-full mt-4 py-3 rounded-xl bg-[#003153] text-white font-bold hover:bg-[#002640] transition-all shadow-md shadow-[#003153]/20">
                            Load More Activities
                        </button>
                    )}
                </>
            )}
        </div>
    );
};