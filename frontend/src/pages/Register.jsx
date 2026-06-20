import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', agency_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created! Welcome to LeadSutra 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-teal rounded-lg flex items-center justify-center">
            <i className="ti ti-target-arrow text-white text-lg"></i>
          </div>
          <span className="text-xl font-bold">Lead<span className="text-teal">Sutra</span></span>
        </div>

        <div className="card">
          <h1 className="text-lg font-bold mb-1">Create your account</h1>
          <p className="text-slate-500 text-[13px] mb-5">Start finding clients with AI — free 50 credits</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" required value={form.full_name} onChange={set('full_name')} placeholder="Arjun Kumar" />
            </div>
            <div>
              <label className="label">Agency / Business Name</label>
              <input className="input" value={form.agency_name} onChange={set('agency_name')} placeholder="DigiGrow Agency" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email} onChange={set('email')} placeholder="you@agency.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
            </div>
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-rocket"></i>}
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-slate-500 mt-5">
          Already have an account? <Link to="/login" className="text-teal font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
}
