// Activity feed - chronological list of staff actions and submissions
import React, { useState, useEffect } from 'react';
import { FileText, Package, UserPlus, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { EthiopianDateTimeDisplay, EthiopianDateDisplay } from '../../components/shared';
import { getEthiopianRelativeTime } from '../../utils/timeUtils';

interface ActivityFeedProps {
    username?: string;
    department?: string;
}

interface ActivityData {
    submissions: any[];
    resourceUpdates: any[];
    staffCreated: any[];
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

interface ActivityGroup {
    title: string;
    events: ActivityEvent[];
    icon: any;
    color: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ username, department }) => {
    const [activities, setActivities] = useState<ActivityData>({
        submissions: [],
        resourceUpdates: [],
        staffCreated: []
    });
    const [loading, setLoading] = useState(true);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

    useEffect(() => {
        const fetchActivity = async () => {
            setLoading(true);
            try {
                let url = '';
                if (username) url = `/api/activity/user/${username}`;
                else if (department) url = `/api/activity/department/${department === 'All' ? 'All' : department}`;

                if (!url) return;

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data);
                }
            } catch (err) {
                console.error('Error loading activity:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActivity();
    }, [username, department]);

    if (loading) {
        return (
            <div className="p-8 bg-white/50 rounded-xl border border-gray-100">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-50 rounded w-full mb-2" />
                <div className="h-3 bg-gray-50 rounded w-2/3" />
            </div>
        );
    }

    const allEvents: ActivityEvent[] = [
        ...(activities.submissions || []).map(s => ({
            id: `sub-${s.id}`,
            type: 'submission',
            title: s.template_name || 'Report Submitted',
            description: `Patient: ${s.patient_name || 'N/A'} (MRN: ${s.mrn || 'N/A'})`,
            date: s.submitted_at,
            submittedBy: s.submitted_by || 'Unknown',
            icon: FileText,
            color: 'blue',
            details: s.form_data,
            shiftName: s.shift_name
        })),
        ...(activities.resourceUpdates || []).map(r => ({
            id: `res-${r.id}`,
            type: 'resource',
            title: `Inventory Update: ${r.name}`,
            description: `Updated quantity to ${r.quantity} ${r.unit}`,
            date: r.updated_at,
            submittedBy: r.submitted_by || 'Unknown',
            icon: Package,
            color: 'emerald',
            details: r,
            shiftName: r.shift_name
        })),
        ...(activities.staffCreated || []).map(st => ({
            id: `staff-${st.id}`,
            type: 'staff',
            title: 'Added Staff Member',
            description: `${st.name} as ${st.role} in ${st.department}`,
            date: st.created_at,
            submittedBy: st.submitted_by || 'Unknown',
            icon: UserPlus,
            color: 'purple',
            details: st,
            shiftName: st.shift_name
        })),
        ...((activities as any).inventoryReports || []).map((ir: any) => ({
            id: `inv-${ir.id}`,
            type: 'inventory',
            title: 'Inventory Report Saved',
            description: `Shift end inventory reconciliation`,
            date: ir.date,
            submittedBy: ir.submitted_by || 'Unknown',
            icon: Package,
            color: 'amber',
            details: ir,
            shiftName: ir.shift_name
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    if (allEvents.length === 0) {
        return (
            <div className="p-10 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium tracking-tight">No activity found for this {username ? 'user' : 'department'}.</p>
                <p className="text-xs text-gray-400 mt-1">Once actions are performed, they will appear here in detail.</p>
            </div>
        );
    }

    // Group events by title
    const groupedActivities: ActivityGroup[] = [];
    const groupMap = new Map<string, ActivityEvent[]>();

    allEvents.forEach(event => {
        if (!groupMap.has(event.title)) {
            groupMap.set(event.title, []);
        }
        groupMap.get(event.title)!.push(event);
    });

    groupMap.forEach((events, title) => {
        groupedActivities.push({
            title,
            events,
            icon: events[0].icon,
            color: events[0].color
        });
    });

    // Sort groups by most recent activity
    groupedActivities.sort((a, b) =>
        new Date(b.events[0].date).getTime() - new Date(a.events[0].date).getTime()
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-2 mb-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                    Detailed Activity Log
                </h4>
                <div className="text-[10px] text-gray-400 font-medium">
                    {allEvents.length} Recent Action{allEvents.length !== 1 ? 's' : ''} • {groupedActivities.length} Group{groupedActivities.length !== 1 ? 's' : ''}
                </div>
            </div>

            <div className="space-y-3">
                {groupedActivities.map((group, groupIndex) => {
                    const groupId = `group-${groupIndex}`;
                    const isGroupExpanded = expandedGroupId === groupId;
                    const Icon = group.icon;
                    const colorClasses =
                        group.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            group.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                'bg-purple-50 text-purple-600 border-purple-100';

                    return (
                        <div
                            key={groupId}
                            className={`border rounded-xl transition-all duration-300 ${isGroupExpanded ? 'bg-white shadow-lg border-indigo-200' : 'bg-white/60 hover:bg-white hover:shadow-sm border-gray-200'}`}
                        >
                            {/* Group Header */}
                            <div
                                onClick={() => setExpandedGroupId(isGroupExpanded ? null : groupId)}
                                className="p-4 cursor-pointer flex gap-4 items-center hover:bg-gray-50/50 rounded-t-xl transition-colors"
                            >
                                <div className={`p-2.5 rounded-lg border shadow-sm ${colorClasses}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <h5 className="text-base font-bold text-gray-900 leading-tight truncate">
                                                {group.title}
                                            </h5>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-xs text-gray-500">
                                                    {getEthiopianRelativeTime(group.events[0].date)}
                                                </span>
                                                <span className="text-[10px] text-gray-400">•</span>
                                                <span className="text-[10px] text-gray-400">
                                                    <EthiopianDateDisplay date={group.events[0].date} format="long" />
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                {group.events.length} {group.events.length === 1 ? 'entry' : 'entries'}
                                            </span>
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${isGroupExpanded ? 'bg-indigo-100 text-indigo-600 rotate-90' : 'bg-gray-100 text-gray-500'}`}>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Group Content - Expandable */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isGroupExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
                                <div className="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100">
                                    {group.events.map((event) => {
                                        const isEventExpanded = expandedEventId === event.id;

                                        return (
                                            <div
                                                key={event.id}
                                                className={`border rounded-lg transition-all duration-200 ${isEventExpanded ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-gray-50/50 hover:bg-white border-gray-200'}`}
                                            >
                                                <div
                                                    onClick={() => setExpandedEventId(isEventExpanded ? null : event.id)}
                                                    className="p-3 cursor-pointer flex gap-3 items-start"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded uppercase">
                                                                        By: {event.submittedBy}
                                                                    </span>
                                                                    {event.shiftName && (
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${event.shiftName === 'Morning' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                                                event.shiftName === 'Afternoon' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                                                                    event.shiftName === 'Night' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                                                                                        'text-gray-600 bg-gray-50 border-gray-200'
                                                                            }`}>
                                                                            {event.shiftName} Shift
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] text-gray-500">
                                                                        {getEthiopianRelativeTime(event.date)}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400">•</span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        <EthiopianDateDisplay date={event.date} format="long" />
                                                                    </span>
                                                                </div>
                                                                {!isEventExpanded && (
                                                                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-1 italic">
                                                                        {event.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all ${isEventExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-gray-200 text-gray-500'}`}>
                                                                <ChevronDown className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Event Details - Animated */}
                                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isEventExpanded ? 'max-h-[500px] border-t border-gray-200' : 'max-h-0'}`}>
                                                    <div className="p-3 bg-white/80">
                                                        <div className="mb-3 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Record Details</span>
                                                            <span className="text-[10px] text-gray-400 italic">#{event.id.split('-')[1]}</span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {event.description && (
                                                                <div className="col-span-full bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                                                                    <div className="text-[10px] text-gray-400 mb-1 uppercase font-semibold">Summary</div>
                                                                    <div className="text-xs text-gray-700">{event.description}</div>
                                                                </div>
                                                            )}

                                                            {event.details && Object.entries(event.details).map(([key, value]) => {
                                                                // Skip some technical fields
                                                                if (['form_data', 'id', 'submitted_by', 'submitted_by_name', 'template_department', 'updated_at', 'created_at', 'submitted_at', 'last_updated_by', 'created_by'].includes(key)) return null;
                                                                if (value === null || value === undefined || value === '') return null;

                                                                // Handle complex values
                                                                let displayValue = String(value);
                                                                if (typeof value === 'object') displayValue = JSON.stringify(value);

                                                                return (
                                                                    <div key={key} className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-200 transition-colors">
                                                                        <div className="text-[10px] text-gray-400 mb-0.5 uppercase font-medium truncate" title={key}>
                                                                            {key.replace(/[_-]+/g, ' ')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-800 font-semibold break-words">
                                                                            {displayValue}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
