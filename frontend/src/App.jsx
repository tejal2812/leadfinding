import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Auditor from './pages/Auditor';
import Pitches from './pages/Pitches';
import Outreach from './pages/Outreach';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  if (loading) return <SplashScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function SplashScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-2 text-teal font-bold text-lg">
        <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center">
          <i className="ti ti-target-arrow text-white text-base"></i>
        </div>
        LeadSutra
      </div>
    </div>
  );
}

export default function App() {
  const { init, loading } = useAuthStore();

  useEffect(() => { init(); }, []);

  if (loading) return <SplashScreen />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="discover" element={<Discover />} />
        <Route path="leads" element={<Leads />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="auditor" element={<Auditor />} />
        <Route path="pitches" element={<Pitches />} />
        <Route path="outreach" element={<Outreach />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
