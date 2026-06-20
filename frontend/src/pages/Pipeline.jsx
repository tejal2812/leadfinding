import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leadsAPI } from '../services/api';

const COLUMNS = [
  { key: 'saved', label: 'New', headerBg: '#eff6ff', headerColor: '#1d4ed8' },
  { key: 'contacted', label: 'Contacted', headerBg: '#fef9c3', headerColor: '#854d0e' },
  { key: 'replied', label: 'Replied', headerBg: '#f0fdf4', headerColor: '#166534' },
  { key: 'proposal', label: 'Proposal Sent', headerBg: '#fdf4ff', headerColor: '#6b21a8' },
  { key: 'won', label: 'Won 🎉', headerBg: '#f0fdfa', headerColor: '#0f766e' },
];

export default function Pipeline() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['leads', 'pipeline'], queryFn: () => leadsAPI.list({ limit: 200 }).then(r => r.data) });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => leadsAPI.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['leads']); toast.success('Lead moved'); },
  });

  const leads = data?.leads || [];
  const byColumn = COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: leads.filter(l => l.status === c.key) }), {});

  const handleDrop = (e, status) => {
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) updateStatus.mutate({ id: leadId, status });
  };

  if (isLoading) return <div className="py-12 text-center text-slate-400"><i className="ti ti-loader-2 animate-spin text-2xl"></i></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] text-slate-500">Drag cards between columns to update status</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(col => (
          <div key={col.key} className="min-w-[220px] flex-1" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.key)}>
            <div className="text-xs font-bold uppercase tracking-wide px-2.5 py-2 rounded-t-md flex items-center justify-between"
              style={{ background: col.headerBg, color: col.headerColor }}>
              {col.label}
              <span className="text-[11px] opacity-70">{byColumn[col.key].length}</span>
            </div>
            <div className="bg-slate-50 rounded-b-md p-2 min-h-[120px]">
              {byColumn[col.key].map(l => (
                <div key={l.id} draggable onDragStart={e => e.dataTransfer.setData('leadId', l.id)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 mb-2 cursor-grab hover:shadow-md transition-shadow">
                  <div className="font-semibold text-[13px]">{l.business_name}</div>
                  <div className="flex gap-2 text-[11px] text-slate-400 mt-1">
                    <span><i className="ti ti-map-pin text-[11px]"></i> {l.city || '—'}</span>
                    <span><i className="ti ti-star text-[11px]"></i> {l.lead_score}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {l.gaps?.slice(0,2).map(g => <span key={g} className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{g}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
