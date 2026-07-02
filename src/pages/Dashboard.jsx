import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const STAT_ICONS = {
  total_leads: { icon: 'ti-users', bg: '#f0fdfa', color: '#0d9488' },
  emails_sent: { icon: 'ti-mail-forward', bg: '#eff6ff', color: '#3b82f6' },
  emails_replied: { icon: 'ti-message-reply', bg: '#fef9c3', color: '#f59e0b' },
  won_leads: { icon: 'ti-currency-rupee', bg: '#f0fdf4', color: '#10b981' },
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardAPI.overview().then(r => r.data) });

  const stats = data?.stats || {};
  const replyRate = stats.emails_sent ? ((stats.emails_replied / stats.emails_sent) * 100).toFixed(1) : '0.0';

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total Leads" value={stats.total_leads || 0} change="+12% this week" icon={STAT_ICONS.total_leads} />
        <StatCard label="Pitches Sent" value={stats.emails_sent || 0} change="Up to date" icon={STAT_ICONS.emails_sent} />
        <StatCard label="Reply Rate" value={`${replyRate}%`} change="vs last month" icon={STAT_ICONS.emails_replied} />
        <StatCard label="Won Deals" value={stats.won_leads || 0} change="Lifetime" icon={STAT_ICONS.won_leads} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div>
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px] font-bold">Recent Activity</span>
            </div>
            {data?.recent_activity?.length ? data.recent_activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                <div className="w-7 h-7 rounded-md bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-activity text-teal text-sm"></i>
                </div>
                <div className="flex-1">
                  <div className="text-[13px]">{a.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                </div>
              </div>
            )) : <Empty text="No activity yet — start by discovering leads!" />}
          </div>
        </div>

        <div>
          <div className="card mb-4">
            <div className="text-[15px] font-bold mb-3">Top Gap Opportunities</div>
            {data?.top_gaps?.length ? data.top_gaps.map(g => (
              <div key={g.gap} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{g.gap}</span>
                  <span className="text-slate-400">{g.count} leads</span>
                </div>
                <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal rounded-full" style={{ width: `${Math.min(100, g.count * 10)}%` }}></div>
                </div>
              </div>
            )) : <Empty text="No gaps detected yet" />}
          </div>

          <div className="card">
            <div className="text-[15px] font-bold mb-3">Quick Stats</div>
            <Row label="Avg Lead Score" value={`${stats.avg_lead_score || 0}/100`} />
            <Row label="Audits Run" value={stats.audits_run || 0} />
            <Row label="Credits Remaining" value={stats.credits_remaining ?? '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, icon }) {
  return (
    <div className="card-sm border border-slate-200 rounded-xl bg-white p-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: icon.bg }}>
        <i className={`ti ${icon.icon}`} style={{ color: icon.color, fontSize: 18 }}></i>
      </div>
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className="text-[26px] font-bold tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold text-emerald-500 mt-1">{change}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center text-[13px] mb-2.5 last:mb-0">
      <span className="text-slate-500">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-center py-8 text-slate-400">
      <i className="ti ti-inbox text-3xl block mb-2"></i>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-3.5">
      {[1,2,3,4].map(i => <div key={i} className="card-sm h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
    </div>
  );
}
