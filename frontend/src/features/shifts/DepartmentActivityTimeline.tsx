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
      case 'submission': return { bg: 'bg-blue-100', text: 'text-blue-600', icon: <FileText className="w-5 h-5" /> };
      case 'resource': return { bg: 'bg-indigo-100', text: 'text-indigo-600', icon: <Package className="w-5 h-5" /> };
      case 'report': return { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: <ClipboardCheck className="w-5 h-5" /> };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', icon: <Clock className="w-5 h-5" /> };
    }
  };

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="h-5 bg-gray-100 rounded w-40 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl" />
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded w-3/4 mb-1" />
              <div className="h-2 bg-gray-50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Activity Monitoring
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time clinical event log for {user?.department}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100"></div>

          {activities.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No recent activities found.</p>
            </div>
          ) : (
            <div className="space-y-8 relative">
              {activities.map((activity) => {
                const styles = getTypeStyles(activity.type);
                return (
                  <div key={activity.id} className="flex gap-6 group">
                    <div className={`relative z-10 w-12 h-12 rounded-xl ${styles.bg} ${styles.text} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                      {styles.icon}
                    </div>

                    <div className="flex-1 pt-1 pb-4 border-b border-gray-50 last:border-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-sm">
                            {activity.title}
                          </h3>
                          <p className="text-gray-600 text-sm mt-0.5">{activity.subtitle}</p>
                        </div>
                        <div className="text-right">
                           <span className="text-xs font-bold text-gray-400">
                              <EthiopianDateDisplay date={activity.timestamp} format="short" />
                           </span>
                           <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase">
                                {activity.shift}
                              </span>
                           </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-700">{activity.user}</span>
                        </div>
                        {activity.type === 'submission' && (
                           <div className="flex items-center gap-1 text-green-600">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase">Record Saved</span>
                           </div>
                        )}
                        <button className="ml-auto text-blue-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Showing {activities.length} most recent activities</span>
        <button 
          onClick={fetchActivity}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          REFRESH FEED
        </button>
      </div>
    </div>
  );
};
