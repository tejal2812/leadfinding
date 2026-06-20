import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NAV = [
  { section: 'Main', items: [
    { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
    { to: '/discover', icon: 'ti-search', label: 'Discover Leads', badge: 'New' },
    { to: '/leads', icon: 'ti-users', label: 'My Leads' },
    { to: '/pipeline', icon: 'ti-layout-kanban', label: 'Pipeline' },
  ]},
  { section: 'AI Tools', items: [
    { to: '/auditor', icon: 'ti-chart-dots', label: 'Website Auditor' },
    { to: '/pitches', icon: 'ti-mail-forward', label: 'AI Pitches' },
    { to: '/outreach', icon: 'ti-send', label: 'Outreach' },
  ]},
  { section: 'Account', items: [
    { to: '/settings', icon: 'ti-settings', label: 'Settings' },
  ]},
];

const TITLES = {
  '/dashboard': 'Dashboard', '/discover': 'Discover Leads', '/leads': 'My Leads',
  '/pipeline': 'Pipeline', '/auditor': 'Website Auditor', '/pitches': 'AI Pitches',
  '/outreach': 'Outreach', '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen text-sm">
      {/* Sidebar */}
      <aside className="w-[220px] bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 flex-shrink-0">
        <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2">
          <div className="w-7 h-7 bg-teal rounded-lg flex items-center justify-center">
            <i className="ti ti-target-arrow text-white text-base"></i>
          </div>
          <span className="text-base font-bold tracking-tight">Lead<span className="text-teal">Sutra</span></span>
        </div>

        <nav className="p-2 flex-1 overflow-y-auto">
          {NAV.map(group => (
            <div key={group.section}>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pt-3 pb-1">{group.section}</div>
              {group.items.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-2.5 py-2 rounded-md mb-0.5 font-medium text-[13.5px] transition-colors ${
                      isActive ? 'bg-teal-light text-teal-dark' : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
                    }`
                  }>
                  <i className={`ti ${item.icon} text-[17px]`}></i>
                  {item.label}
                  {item.badge && <span className="ml-auto bg-teal text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-200">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-50 cursor-pointer group relative">
            <div className="w-7.5 h-7.5 w-[30px] h-[30px] rounded-full bg-gradient-to-br from-teal to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">{user?.full_name}</div>
              <div className="text-[11px] text-teal font-medium capitalize">{user?.plan} Plan</div>
            </div>
            <button onClick={logout} title="Log out" className="text-slate-400 hover:text-red-500">
              <i className="ti ti-logout text-base"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3 sticky top-0 z-10">
          <span className="text-base font-bold flex-1">{TITLES[location.pathname] || ''}</span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 min-w-[220px]">
            <i className="ti ti-search text-slate-400 text-base"></i>
            <input placeholder="Search leads, businesses..." className="bg-transparent outline-none text-[13px] w-full" />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/discover')}>
            <i className="ti ti-plus"></i> Add Leads
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/auditor')}>
            <i className="ti ti-wand"></i> Audit Site
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
