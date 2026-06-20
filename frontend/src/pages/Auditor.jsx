import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { auditAPI, leadsAPI } from '../services/api';

export default function Auditor() {
  const [url, setUrl] = useState('');
  const [auditId, setAuditId] = useState(null);
  const [result, setResult] = useState(null);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();

  const runAudit = async () => {
    if (!url) return toast.error('Enter a website URL');
    setResult(null);
    setPolling(true);
    try {
      const { data } = await auditAPI.run({ url });
      setAuditId(data.audit_id);
      pollForResult(data.audit_id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Audit failed to start');
      setPolling(false);
    }
  };

  const pollForResult = (id) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await auditAPI.get(id);
        if (data.status === 'completed') {
          clearInterval(interval);
          setResult(data);
          setPolling(false);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          toast.error('Audit failed: ' + (data.error_message || 'Unknown error'));
          setPolling(false);
        }
      } catch {
        clearInterval(interval);
        setPolling(false);
      }
    }, 2000);
    setTimeout(() => clearInterval(interval), 60000); // safety timeout
  };

  const saveAsLead = async () => {
    try {
      await leadsAPI.create({
        business_name: new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.',''),
        website_url: url,
        lead_score: result.overall_score,
        gaps: result.gaps,
        source: 'manual',
      });
      toast.success('Saved as lead!');
    } catch {
      toast.error('Failed to save lead');
    }
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="text-[15px] font-bold mb-3">Website Auditor</div>
        <div className="flex gap-2.5 mb-2">
          <input className="input flex-1" placeholder="Enter website URL e.g. https://example.com"
            value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAudit()} />
          <button className="btn btn-primary" onClick={runAudit} disabled={polling}>
            {polling ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-wand"></i>}
            {polling ? 'Auditing...' : 'Audit with AI'}
          </button>
        </div>
        <p className="text-xs text-slate-500">AI analyzes the website for SEO issues, speed problems, social presence, and more.</p>
      </div>

      {polling && (
        <div className="card flex items-center gap-2.5 text-slate-500 py-6">
          <Dots /> AI is auditing {url}...
        </div>
      )}

      {result && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[17px] font-bold">{result.url}</div>
              <div className="text-[13px] text-slate-500">Full AI Audit Report</div>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-extrabold text-teal">{result.overall_score}<span className="text-sm text-slate-400 font-normal">/100</span></div>
              <div className="text-xs text-amber-500 font-semibold">
                {result.overall_score >= 75 ? 'Low Opportunity' : result.overall_score >= 50 ? 'Medium Opportunity' : 'High Opportunity'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5 mb-5">
            <AuditMetric label="SEO Score" value={`${result.seo_score}/100`} bad={result.seo_score < 50} />
            <AuditMetric label="Page Speed (Mobile)" value={`${result.speed_score}/100`} bad={result.speed_score < 50} />
            <AuditMetric label="Social Presence" value={result.has_facebook || result.has_instagram ? 'Found' : 'Not Found'} bad={!result.has_facebook && !result.has_instagram} />
            <AuditMetric label="Meta Description" value={result.meta_description ? 'Present' : 'Missing'} bad={!result.meta_description} />
            <AuditMetric label="H1 Tags" value={result.h1_count ?? '—'} good />
            <AuditMetric label="Images w/o Alt" value={result.image_alt_missing ?? '—'} bad={result.image_alt_missing > 3} />
          </div>

          {result.gaps?.length > 0 && (
            <div className="mb-5">
              <div className="text-[15px] font-bold mb-2.5">Detected Gaps & Opportunities</div>
              {(result.recommendations || []).map((rec, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-alert-triangle text-red-500"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-[13px]">{rec.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{rec.description}</div>
                  </div>
                </div>
              ))}
              {result.gaps.map(g => (
                <span key={g} className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full mr-1.5 mt-2">{g}</span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => navigate('/pitches')}><i className="ti ti-sparkles"></i> Generate Pitch</button>
            <button className="btn btn-outline" onClick={saveAsLead}><i className="ti ti-bookmark"></i> Save as Lead</button>
          </div>
        </div>
      )}

      {!polling && !result && (
        <div className="card text-center py-16 text-slate-400">
          <i className="ti ti-wand text-4xl block mb-3"></i>
          <p>Enter a website URL above to run a full AI audit.</p>
        </div>
      )}
    </div>
  );
}

function AuditMetric({ label, value, bad, good }) {
  return (
    <div className="border border-slate-200 rounded-lg px-4 py-3.5">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${bad ? 'text-red-500' : good ? 'text-emerald-500' : 'text-amber-500'}`}>{value}</div>
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
