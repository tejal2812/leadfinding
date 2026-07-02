import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('hello.opirawebs@outlook.com');
  const [password, setPassword] = useState('Opira##2005');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-teal rounded-lg flex items-center justify-center">
            <i className="ti ti-target-arrow text-white text-lg"></i>
          </div>
          <span className="text-xl font-bold">Lead<span className="text-teal">Sutra</span></span>
        </div>

        <div className="card">
          <h1 className="text-lg font-bold mb-1">Welcome back</h1>
          <p className="text-slate-500 text-[13px] mb-5">Log in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@agency.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? <i className="ti ti-loader-2 animate-spin"></i> : <i className="ti ti-login"></i>}
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className="text-center text-[12px] text-slate-400 mt-4">
            Demo credentials prefilled — just hit Log In
          </p>
        </div>

        <p className="text-center text-[12px] text-slate-400 mt-5">
          Registration is disabled. Contact your administrator to request an account.
        </p>
      </div>
    </div>
  );
}
