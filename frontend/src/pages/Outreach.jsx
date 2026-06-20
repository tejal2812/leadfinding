import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { outreachAPI } from '../services/api';

export default function Outreach() {
  const qc = useQueryClient();
  const [activeSeq, setActiveSeq] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: sequences } = useQuery({ queryKey: ['sequences'], queryFn: () => outreachAPI.sequences().then(r => r.data) });
  const { data: stats } = useQuery({ queryKey: ['outreach-stats'], queryFn: () => outreachAPI.stats().then(r => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['sequence', activeSeq],
    queryFn: () => outreachAPI.sequence(activeSeq).then(r => r.data),
    enabled: !!activeSeq,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => outreachAPI.updateSequence(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['sequences']); toast.success('Sequence updated'); },
  });

  const replyRate = stats?.emails_sent > 0 ? ((stats.emails_replied / stats.emails_sent) * 100).toFixed(1) : '0.0';
  const openRate = stats?.emails_sent > 0 ? ((stats.emails_opened / stats.emails_sent) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="card mb-4">
          <div className="text-[15px] font-bold mb-3">Email Sequences</div>
          {sequences?.length ? sequences.map(s => (
            <div key={s.id} onClick={() => setActiveSeq(s.id)}
              className={`flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 cursor-pointer ${activeSeq === s.id ? 'bg-teal-50/50 -mx-2 px-2 rounded' : ''}`}>
              <div>
                <div className="font-semibold text-[13px]">{s.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{s.enrolled_count} leads · {s.step_count} steps</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                  {s.status}
                </span>
                <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); toggleStatus.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' }); }}>
                  <i className={`ti ${s.status === 'active' ? 'ti-player-pause' : 'ti-player-play'}`}></i>
                </button>
              </div>
            </div>
          )) : <div className="text-center py-8 text-slate-400 text-sm">No sequences yet.</div>}
          <button className="btn btn-outline w-full mt-3 justify-center" onClick={() => setShowCreate(true)}><i className="ti ti-plus"></i> New Sequence</button>
        </div>

        <div className="card">
          <div className="text-[15px] font-bold mb-3">Outreach Stats</div>
          <Row label="Emails Sent" value={stats?.emails_sent || 0} />
          <Row label="Opened" value={`${stats?.emails_opened || 0} (${openRate}%)`} />
          <Row label="Replied" value={`${stats?.emails_replied || 0} (${replyRate}%)`} />
          <Row label="Unsubscribed" value={stats?.unsubscribed || 0} danger />
        </div>
      </div>

      <div className="card">
        <div className="text-[15px] font-bold mb-3">{detail ? detail.name : 'Select a Sequence'}</div>
        {!detail && <div className="text-center py-16 text-slate-400 text-sm">Click a sequence on the left to view its steps.</div>}
        {detail?.steps?.map((s, i) => (
          <div key={s.id} className="flex gap-3.5 mb-3.5">
            <div className="w-6.5 h-6.5 w-[26px] h-[26px] rounded-full bg-teal text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500">{s.step_type}</span>
                <span className="text-xs text-slate-400">· Day {s.delay_days}</span>
              </div>
              <div className="text-[13px] font-semibold mb-1">{s.subject}</div>
              <div className="text-xs text-slate-500 leading-relaxed line-clamp-2">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateSequenceModal onClose={() => setShowCreate(false)} onCreated={() => qc.invalidateQueries(['sequences'])} />}
    </div>
  );
}

function CreateSequenceModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([{ subject: '', body: '', delay_days: 0 }]);
  const [saving, setSaving] = useState(false);

  const addStep = () => setSteps([...steps, { subject: '', body: '', delay_days: steps.length * 3 }]);
  const updateStep = (i, field, val) => {
    const next = [...steps];
    next[i] = { ...next[i], [field]: val };
    setSteps(next);
  };

  const save = async () => {
    if (!name || !steps[0].subject) return toast.error('Name and at least one step subject required');
    setSaving(true);
    try {
      await outreachAPI.createSequence({ name, steps });
      toast.success('Sequence created!');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create sequence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <span className="text-[17px] font-bold">New Sequence</span>
          <button onClick={onClose} className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-400"><i className="ti ti-x"></i></button>
        </div>
        <div className="p-6">
          <label className="label">Sequence Name</label>
          <input className="input mb-4" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Restaurant Outreach" />

          {steps.map((s, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3.5 mb-3">
              <div className="text-xs font-bold text-slate-500 mb-2">Step {i + 1} · Day {s.delay_days}</div>
              <input className="input mb-2" placeholder="Subject line" value={s.subject} onChange={e => updateStep(i, 'subject', e.target.value)} />
              <textarea className="input" rows={3} placeholder="Email body... use {Business} and {Name} for personalization" value={s.body} onChange={e => updateStep(i, 'body', e.target.value)} />
            </div>
          ))}
          <button className="btn btn-outline w-full justify-center mb-4" onClick={addStep}><i className="ti ti-plus"></i> Add Step</button>
        </div>
        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2.5">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create Sequence'}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, danger }) {
  return (
    <div className="flex justify-between text-[13px] mb-2.5 last:mb-0">
      <span className="text-slate-500">{label}</span>
      <strong className={danger ? 'text-red-500' : ''}>{value}</strong>
    </div>
  );
}
