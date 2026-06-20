import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { leadsAPI, auditAPI } from '../services/api';

const TABS = [
  { key: 'all', label: 'All Leads' },
  { key: 'hot', label: 'Hot Leads', status: 'hot' },
  { key: 'contacted', label: 'Contacted', status: 'contacted' },
  { key: 'saved', label: 'Saved', status: 'saved' },
];

export default function Leads() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const tabConfig = TABS.find(t => t.key === tab);
  const { data, isLoading } = useQuery({
    queryKey: ['leads', tab, search],
    queryFn: () => leadsAPI.list({
      ...(tabConfig.status ? { status: tabConfig.status } : {}),
      ...(search ? { search } : {})
    }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['leads']); toast.success('Lead removed'); },
  });

  const exportCSV = async () => {
    const res = await leadsAPI.exportCSV();
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url; a.download = 'leadsutra-leads.csv'; a.click();
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Importing leads from CSV...');
    try {
      const { data: result } = await leadsAPI.importCSV(file);
      qc.invalidateQueries(['leads']);
      toast.success(result.message || 'Leads imported successfully', { id: loadingToast });
      e.target.value = ''; // clear input
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import CSV', { id: loadingToast });
      e.target.value = ''; // clear input
    }
  };

  const leads = data?.leads || [];

  return (
    <div>
      <div className="card mb-4">
        <div className="flex border-b border-slate-200 mb-4 -mt-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'text-teal border-teal' : 'text-slate-500 border-transparent hover:text-navy'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2.5">
          <div className="flex items-center gap-3.5">
            <span className="text-[15px] font-bold">My Lead List ({leads.length})</span>
            <input
              type="text"
              placeholder="Search leads..."
              className="input input-sm max-w-[200px] bg-slate-50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              id="csv-import-input"
              className="hidden"
              onChange={handleImportCSV}
            />
            <label htmlFor="csv-import-input" className="btn btn-outline btn-sm cursor-pointer flex items-center gap-1.5 font-normal">
              <i className="ti ti-upload"></i> Import CSV
            </label>
            <button className="btn btn-outline btn-sm" onClick={exportCSV}><i className="ti ti-download"></i> Export CSV</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/discover')}><i className="ti ti-plus"></i> Add More</button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400"><i className="ti ti-loader-2 animate-spin text-2xl"></i></div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <i className="ti ti-users text-4xl block mb-3"></i>
            <p>No leads yet. <button className="text-teal font-semibold" onClick={() => navigate('/discover')}>Discover some →</button></p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-2 px-3">Business</th>
                <th className="py-2 px-3">Score</th>
                <th className="py-2 px-3">Gaps</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Updated</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50 text-[13px]">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-light text-teal-dark flex items-center justify-center font-bold text-[13px] flex-shrink-0">
                        {l.business_name[0]}
                      </div>
                      <div>
                        <div className="font-semibold">{l.business_name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{l.website_url || l.city}</span>
                          {l.phone && <span className="text-[10px]" title={`Phone: ${l.phone}`}>📞</span>}
                          {l.email && <span className="text-[10px]" title={`Email: ${l.email}`}>✉️</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3"><ScoreBadge score={l.lead_score} /></td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {l.gaps?.slice(0,2).map(g => <span key={g} className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{g}</span>)}
                    </div>
                  </td>
                  <td className="py-3 px-3"><StatusDot status={l.status} /></td>
                  <td className="py-3 px-3 text-slate-400 text-xs">{new Date(l.updated_at).toLocaleDateString()}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedLead(l)}><i className="ti ti-eye"></i></button>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate('/pitches', { state: { leadId: l.id } })}><i className="ti ti-sparkles"></i></button>
                      <button className="btn btn-outline btn-sm text-red-500" onClick={() => deleteMutation.mutate(l.id)}><i className="ti ti-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}

function LeadModal({ lead, onClose }) {
  const navigate = useNavigate();
  const { data: audits } = useQuery({ queryKey: ['audits', lead.id], queryFn: () => auditAPI.byLead(lead.id).then(r => r.data) });
  const latest = audits?.[0];

  return (
    <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <span className="text-[17px] font-bold">{lead.business_name}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-teal-light text-teal-dark flex items-center justify-center font-bold text-xl">{lead.business_name[0]}</div>
            <div>
              <div className="font-bold text-[17px]">{lead.business_name}</div>
              <div className="text-slate-500 text-[13px]">{lead.website_url} · {lead.city}</div>
            </div>
            <div className="ml-auto"><ScoreBadge score={lead.lead_score} big /></div>
          </div>

          {latest ? (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Metric label="SEO Score" value={`${latest.seo_score}/100`} bad={latest.seo_score < 50} />
              <Metric label="Page Speed" value={`${latest.speed_score}/100`} bad={latest.speed_score < 50} />
              <Metric label="Social Presence" value={latest.has_facebook || latest.has_instagram ? 'Found' : 'Not Found'} bad={!latest.has_facebook && !latest.has_instagram} />
              <Metric label="Overall Score" value={`${latest.overall_score}/100`} good={latest.overall_score >= 75} />
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400 text-sm mb-4">No audit run yet for this lead.</div>
          )}

          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detected Gaps</div>
            <div className="flex flex-wrap gap-1.5">
              {lead.gaps?.map(g => <span key={g} className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full"><i className="ti ti-alert-triangle text-[11px] mr-1"></i>{g}</span>)}
            </div>
          </div>

          <div className="flex gap-4 text-[13px] text-slate-500">
            {lead.email && <span>📧 {lead.email}</span>}
            {lead.phone && <span>📱 {lead.phone}</span>}
          </div>
        </div>
        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2.5">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); navigate('/pitches', { state: { leadId: lead.id } }); }}>
            <i className="ti ti-sparkles"></i> Generate Pitch
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, bad, good }) {
  return (
    <div className="border border-slate-200 rounded-lg px-4 py-3.5">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${bad ? 'text-red-500' : good ? 'text-emerald-500' : 'text-amber-500'}`}>{value}</div>
    </div>
  );
}

function ScoreBadge({ score, big }) {
  const cls = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${cls} ${big ? 'text-[15px] px-3 py-1' : 'text-xs'}`}>{score}{big ? '/100' : ''}</span>;
}

function StatusDot({ status }) {
  const colors = { hot: '#ef4444', contacted: '#f59e0b', replied: '#10b981', won: '#0d9488', saved: '#94a3b8', new: '#94a3b8' };
  return (
    <span className="text-xs flex items-center gap-1.5 capitalize">
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: colors[status] || '#94a3b8' }}></span>
      {status}
    </span>
  );
}
