import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { discoverAPI } from '../services/api';

const INDUSTRIES = [
  'Accountant',
  'Automotive',
  'Cafe',
  'Cleaning',
  'Construction',
  'Dentist',
  'Education',
  'Electrician',
  'Gym',
  'Healthcare',
  'Hospitality',
  'Hotel',
  'HVAC',
  'IT Services',
  'Lawyer',
  'Legal',
  'Photographer',
  'Plumber',
  'Real Estate',
  'Restaurant',
  'Retail',
  'Roofer',
  'Salon',
  'Spa',
  'Veterinary',
  'Wellness'
];
const CITIES = ['Ahmedabad', 'Mumbai', 'Bengaluru', 'Delhi', 'Pune', 'Hyderabad', 'Chennai'];

export default function Discover() {
  const [filters, setFilters] = useState({ industry: '', city: '', min_rating: '' });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const search = async () => {
    setLoading(true);
    try {
      const { data } = await discoverAPI.search({ industry: filters.industry, city: filters.city, min_rating: filters.min_rating || undefined, limit: 50 });
      setResults(data.results);
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const saveSelected = async () => {
    const businesses = results.filter((_, i) => selected.has(i));
    if (!businesses.length) return toast.error('Select at least one business');
    try {
      const { data } = await discoverAPI.save(businesses);
      toast.success(`Saved ${data.saved} leads!`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to save leads');
    }
  };

  const saveAll = async () => {
    try {
      const { data } = await discoverAPI.save(results.filter(r => !r.already_saved));
      toast.success(`Saved ${data.saved} leads!`);
    } catch {
      toast.error('Failed to save leads');
    }
  };

  return (
    <div>
      <div className="card mb-5 flex gap-3 items-end flex-wrap">
        <div>
          <label className="label">Industry</label>
          <select className="input bg-slate-50" value={filters.industry} onChange={e => setFilters({ ...filters, industry: e.target.value })}>
            <option value="">All Industries</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input
            type="text"
            className="input bg-slate-50 min-w-[180px]"
            placeholder="e.g. New York, London, Delhi"
            value={filters.city}
            onChange={e => setFilters({ ...filters, city: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Min Rating</label>
          <select className="input bg-slate-50" value={filters.min_rating} onChange={e => setFilters({ ...filters, min_rating: e.target.value })}>
            <option value="">Any Rating</option>
            <option value="3">3.0+</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-outline" onClick={() => { setFilters({ industry: '', city: '', min_rating: '' }); setResults([]); }}>
            <i className="ti ti-refresh"></i> Reset
          </button>
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-search"></i>}
            {loading ? 'Searching...' : 'Discover Leads'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-bold">{results.length ? `Showing ${results.length} businesses` : 'No search yet'}</span>
          {results.length > 0 && (
            <div className="flex gap-2">
              {selected.size > 0 && <button className="btn btn-primary btn-sm" onClick={saveSelected}><i className="ti ti-bookmark"></i> Save Selected ({selected.size})</button>}
              <button className="btn btn-outline btn-sm" onClick={saveAll}><i className="ti ti-bookmarks"></i> Save All New</button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2.5 text-slate-500 py-6">
            <Dots /> AI is scanning businesses...
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <i className="ti ti-search text-4xl block mb-3"></i>
            <p>Choose filters and click "Discover Leads" to find businesses to pitch.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-2 px-3 w-8"></th>
                <th className="py-2 px-3">Business</th>
                <th className="py-2 px-3">Score</th>
                <th className="py-2 px-3">Gaps Detected</th>
                <th className="py-2 px-3">City</th>
                <th className="py-2 px-3">Rating</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 text-[13px]">
                  <td className="py-3 px-3">
                    <input type="checkbox" checked={selected.has(i)} disabled={r.already_saved} onChange={() => toggleSelect(i)} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-light text-teal-dark flex items-center justify-center font-bold text-[13px] flex-shrink-0">
                        {r.business_name[0]}
                      </div>
                      <div>
                        <div className="font-semibold">{r.business_name}</div>
                        <div className="text-[11px] text-slate-400">{r.website_url || 'No website'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3"><ScoreBadge score={r.lead_score} /></td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {r.gaps?.map(g => <span key={g} className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{g}</span>)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{r.city}</td>
                  <td className="py-3 px-3 text-slate-500">{r.google_rating ? `⭐ ${r.google_rating}` : '—'}</td>
                  <td className="py-3 px-3">
                    {r.already_saved
                      ? <span className="text-[11px] text-slate-400 font-medium">Already saved</span>
                      : <button className="btn btn-primary btn-sm" onClick={() => { setSelected(new Set([i])); saveSelected(); }}><i className="ti ti-bookmark"></i> Save</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const cls = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{score}</span>;
}

function Dots() {
  return (
    <div className="flex gap-1">
      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );
}
