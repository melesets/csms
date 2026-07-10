// Department activity timeline - chronological view of department submissions
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { FileText, Package, ClipboardCheck, Clock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { EthiopianDateDisplay } from '../../components/shared';

interface ActivityItem {
  id: number | string;
  type: 'submission' | 'resource' | 'report';
  title: string;
  subtitle: string;
  timestamp: string;
  user: string;
  shift: string;
  details?: any;
}

export const DepartmentActivityTimeline: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchActivity = async () => {
    if (!user?.department) return;
    try {
      const data = await apiGet(`/activity/department/${encodeURIComponent(user.department)}`);
      
      const flat: ActivityItem[] = [
        ...(data.submissions || []).map((s: any) => ({
          id: `sub-${s.id}`,
          type: 'submission',
          title: s.template_name,
          subtitle: `Patient: ${s.patient_name || 'N/A'} (MRN: ${s.mrn || 'N/A'})`,
          timestamp: s.submitted_at,
          user: s.submitted_by_name || s.submitted_by,
          shift: s.shift_name,
          details: s.form_data
        })),
        ...(data.resourceUpdates || []).map((r: any) => ({
          id: `res-${r.id}-${r.date}`,
          type: 'resource',
          title: `${r.name} Updated`,
          subtitle: `New Quantity: ${r.quantity} ${r.unit}`,
          timestamp: r.date,
          user: r.submitted_by,
          shift: r.shift_name
        })),
        ...(data.inventoryReports || []).map((ir: any) => ({
          id: `rep-${ir.id}`,
          type: 'report',
          title: 'Shift Inventory Report',
          subtitle: `Complete check for ${ir.department}`,
          timestamp: ir.date,
          user: ir.submitted_by,
          shift: ir.shift_name
        }))
      ];

      // Sort by timestamp descending
      flat.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(flat.slice(0, 50));
    } catch (err) {
      console.error('Failed to fetch activity timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'submission': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: <FileText className="w-4 h-4" /> };
      case 'resource': return { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: <Package className="w-4 h-4" /> };
      case 'report': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: <ClipboardCheck className="w-4 h-4" /> };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600', icon: <Clock className="w-4 h-4" /> };
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded w-3/4 mb-1.5" />
              <div className="h-2 bg-gray-50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#003153]" />
            Activity Monitoring
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{user?.department} department</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {activities.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No recent activities found.</p>
              <p className="text-xs text-gray-400 mt-1">Activities will appear here as staff perform actions.</p>
            </div>
          ) : (
            <div className="space-y-5 relative">
              {activities.map((activity) => {
                const styles = getTypeStyles(activity.type);
                return (
                  <div key={activity.id} className="flex gap-4 group">
                    <div className={`relative z-10 w-10 h-10 rounded-lg ${styles.bg} ${styles.text} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                      {styles.icon}
                    </div>

                    <div className="flex-1 pt-0.5 pb-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-[#003153] transition-colors text-sm">
                            {activity.title}
                          </h3>
                          <p className="text-gray-500 text-xs mt-0.5">{activity.subtitle}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                           <span className="text-[10px] font-bold text-gray-400">
                              <EthiopianDateDisplay date={activity.timestamp} format="short" />
                           </span>
                           <div className="flex items-center gap-1 mt-0.5 justify-end">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                 {activity.shift}
                              </span>
                           </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-50 border border-gray-100">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-[11px] font-medium text-gray-600">{activity.user}</span>
                        </div>
                        {activity.type === 'submission' && (
                           <div className="flex items-center gap-1 text-emerald-600">
                             <CheckCircle2 className="w-3 h-3" />
                             <span className="text-[10px] font-bold">Saved</span>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 font-medium">{activities.length} recent activities</span>
        <button 
          onClick={fetchActivity}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};
