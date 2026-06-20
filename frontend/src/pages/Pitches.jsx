import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { pitchesAPI, leadsAPI } from '../services/api';

const PITCH_TYPES = ['Cold Email', 'WhatsApp Message', 'LinkedIn DM', 'Follow-up Email', 'Phone Script'];
const SERVICES = ['Social Media Management', 'SEO & Content Marketing', 'Google Ads / PPC', 'Website Redesign', 'WhatsApp Marketing', 'Video Production'];
const TONES = ['Professional', 'Friendly & Casual', 'Consultative', 'Urgent / Problem-Focused'];

export default function Pitches() {
  const location = useLocation();
  const qc = useQueryClient();
  const [leadId, setLeadId] = useState(location.state?.leadId || '');
  const [pitchType, setPitchType] = useState('Cold Email');
  const [service, setService] = useState(SERVICES[0]);
  const [tone, setTone] = useState('Professional');
  const [generating, setGenerating] = useState(false);
  const [pitch, setPitch] = useState(null);

  const { data: leads } = useQuery({ queryKey: ['leads', 'for-pitch'], queryFn: () => leadsAPI.list({ limit: 100 }).then(r => r.data.leads) });
  const { data: savedPitches } = useQuery({ queryKey: ['pitches'], queryFn: () => pitchesAPI.list().then(r => r.data) });

  const { data: leadDetails } = useQuery({
    queryKey: ['lead-details', leadId],
    queryFn: () => leadsAPI.get(leadId).then(r => r.data),
    enabled: !!leadId,
  });

  useEffect(() => {
    if (!leadId && leads?.length) setLeadId(leads[0].id);
  }, [leads]);

  const sendWhatsApp = () => {
    const currentLead = leads?.find(l => l.id === leadId);
    if (!currentLead?.phone) {
      return toast.error('This lead does not have a phone number listed.');
    }
    const cleanPhone = currentLead.phone.replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(pitch.body);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  const openLinkedIn = () => {
    const currentLead = leads?.find(l => l.id === leadId);
    if (!currentLead) return;

    // Check if we have a scraped LinkedIn URL from audits
    const latestAudit = leadDetails?.audits?.[0];
    const scrapedLinkedIn = latestAudit?.raw_data?.seo?.linkedin_link;

    if (scrapedLinkedIn) {
      window.open(scrapedLinkedIn, '_blank');
      toast.success("Opening lead's LinkedIn page...");
    } else {
      const searchQuery = encodeURIComponent(currentLead.business_name);
      window.open(`https://www.linkedin.com/search/results/all/?keywords=${searchQuery}`, '_blank');
      toast.success('Searching LinkedIn for business...');
    }
  };

  const openInstagram = () => {
    const currentLead = leads?.find(l => l.id === leadId);
    if (!currentLead) return;

    // Check if we have a scraped Instagram URL from audits
    const latestAudit = leadDetails?.audits?.[0];
    const scrapedInstagram = latestAudit?.raw_data?.seo?.instagram_link;

    if (scrapedInstagram) {
      window.open(scrapedInstagram, '_blank');
      toast.success("Opening lead's Instagram page...");
    } else {
      const searchQuery = encodeURIComponent(`${currentLead.business_name} instagram`);
      window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
      toast.success('Searching Google for Instagram profile...');
    }
  };

  const generate = async () => {
    if (!leadId) return toast.error('Select a lead first');
    setGenerating(true);
    setPitch(null);
    try {
      const { data } = await pitchesAPI.generate({ lead_id: leadId, pitch_type: pitchType, service, tone });
      setPitch(data);
      qc.invalidateQueries(['pitches']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate pitch');
    } finally {
      setGenerating(false);
    }
  };

  const copyPitch = () => {
    navigator.clipboard.writeText(pitch.body);
    toast.success('Pitch copied to clipboard!');
  };

  const sendPitch = async () => {
    try {
      await pitchesAPI.send(pitch.id);
      toast.success('Email sent!');
      qc.invalidateQueries(['pitches']);
      qc.invalidateQueries(['leads']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card">
          <div className="text-[15px] font-bold mb-3">Generate AI Pitch</div>
          <Field label="Business">
            <select className="input" value={leadId} onChange={e => setLeadId(e.target.value)}>
              {leads?.map(l => <option key={l.id} value={l.id}>{l.business_name}{l.city ? `, ${l.city}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Pitch Type">
            <select className="input" value={pitchType} onChange={e => setPitchType(e.target.value)}>
              {PITCH_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Service You Offer">
            <select className="input" value={service} onChange={e => setService(e.target.value)}>
              {SERVICES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Tone">
            <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
              {TONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <button className="btn btn-primary w-full justify-center mt-1" onClick={generate} disabled={generating}>
            {generating ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-sparkles"></i>}
            {generating ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[15px] font-bold">Generated Pitch</span>
            {pitch && <button className="btn btn-outline btn-sm" onClick={generate} title="Regenerate"><i className="ti ti-refresh"></i></button>}
          </div>

          {generating && (
            <div className="flex items-center gap-2.5 text-slate-500 py-6">
              <Dots /> AI is crafting your personalized pitch...
            </div>
          )}

          {!generating && !pitch && (
            <div className="text-center py-12 text-slate-400">
              <i className="ti ti-mail-code text-3xl block mb-2"></i>
              <p className="text-sm">Configure options and click Generate to create your personalized pitch.</p>
            </div>
          )}

          {!generating && pitch && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-[13px] leading-relaxed whitespace-pre-wrap min-h-[120px]">
                {pitch.subject_line && <div className="font-semibold mb-2">Subject: {pitch.subject_line}</div>}
                {pitch.body}
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button className="btn btn-primary btn-sm" onClick={copyPitch}><i className="ti ti-copy"></i> Copy</button>
                <button className="btn btn-outline btn-sm" onClick={sendPitch}><i className="ti ti-send"></i> Send Email</button>
                <button className="btn btn-outline btn-sm" onClick={sendWhatsApp}><i className="ti ti-brand-whatsapp"></i> WhatsApp</button>
                <button className="btn btn-outline btn-sm" onClick={openLinkedIn}><i className="ti ti-brand-linkedin"></i> LinkedIn</button>
                <button className="btn btn-outline btn-sm" onClick={openInstagram}><i className="ti ti-brand-instagram"></i> Instagram</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="text-[15px] font-bold mb-3">Saved Pitches</div>
        {savedPitches?.length ? savedPitches.map(p => (
          <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <div>
              <div className="font-semibold text-[13px]">{p.business_name} — {p.pitch_type}</div>
              <div className="text-[11px] text-slate-400">{p.sent_at ? `Sent ${new Date(p.sent_at).toLocaleDateString()}` : `Created ${new Date(p.created_at).toLocaleDateString()}`}</div>
            </div>
            <div className="flex gap-1.5">
              <button className="btn btn-outline btn-sm" onClick={() => setPitch(p)}><i className="ti ti-eye"></i></button>
            </div>
          </div>
        )) : <div className="text-center py-8 text-slate-400 text-sm">No pitches generated yet.</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Dots() {
  return (
    <div className="flex gap-1">
      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );
}
