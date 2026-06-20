import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { settingsAPI, billingAPI } from '../services/api';

export default function Settings() {
  const { user, refreshUser } = useAuthStore();
  const [profile, setProfile] = useState({ full_name: '', agency_name: '', phone: '' });
  const [prefs, setPrefs] = useState({ default_from_name: '', default_reply_to: '', signature: '', services_offered: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', agency_name: user.agency_name || '', phone: user.phone || '' });
      setPrefs({
        default_from_name: user.default_from_name || '',
        default_reply_to: user.default_reply_to || '',
        signature: user.signature || '',
        services_offered: (user.services_offered || []).join(', '),
      });
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateProfile(profile);
      await refreshUser();
      toast.success('Profile saved!');
    } catch { toast.error('Failed to save profile'); }
    finally { setSaving(false); }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePreferences({ ...prefs, services_offered: prefs.services_offered.split(',').map(s => s.trim()).filter(Boolean) });
      await refreshUser();
      toast.success('Outreach settings saved!');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const upgradeToPro = async () => {
    try {
      const { data } = await billingAPI.checkout('pro');
      window.location.href = data.url;
    } catch {
      toast.error('Billing not configured — add Stripe keys to enable checkout');
    }
  };

  const creditsUsed = user?.credits_used || 0;
  const creditsTotal = user?.credits_total || 1;
  const pct = Math.round((creditsUsed / creditsTotal) * 100);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="card mb-4">
          <div className="text-[15px] font-bold mb-3">Profile</div>
          <Field label="Full Name"><input className="input" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></Field>
          <Field label="Agency / Business"><input className="input" value={profile.agency_name} onChange={e => setProfile({ ...profile, agency_name: e.target.value })} /></Field>
          <Field label="Email"><input className="input bg-slate-50" value={user?.email || ''} disabled /></Field>
          <Field label="Phone"><input className="input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>Save Changes</button>
        </div>

        <div className="card">
          <div className="text-[15px] font-bold mb-3">Outreach Defaults</div>
          <Field label="Default From Name"><input className="input" value={prefs.default_from_name} onChange={e => setPrefs({ ...prefs, default_from_name: e.target.value })} /></Field>
          <Field label="Default Reply-To Email"><input className="input" value={prefs.default_reply_to} onChange={e => setPrefs({ ...prefs, default_reply_to: e.target.value })} /></Field>
          <Field label="Services Offered (comma separated)"><input className="input" value={prefs.services_offered} onChange={e => setPrefs({ ...prefs, services_offered: e.target.value })} /></Field>
          <Field label="Signature"><textarea className="input" rows={3} value={prefs.signature} onChange={e => setPrefs({ ...prefs, signature: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={savePrefs} disabled={saving}>Save</button>
        </div>
      </div>

      <div>
        <div className="card mb-4">
          <div className="text-[15px] font-bold mb-3">Plan & Credits</div>
          <div className="p-3.5 bg-teal-light rounded-lg mb-3.5">
            <div className="font-bold text-teal-dark text-[15px] capitalize">{user?.plan} Plan</div>
            <div className="text-xs text-teal-dark mt-0.5">{creditsTotal} credits / month</div>
          </div>
          <div className="flex justify-between text-[13px] mb-2">
            <span className="text-slate-500">Credits Used</span>
            <strong>{creditsUsed} / {creditsTotal}</strong>
          </div>
          <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden mb-3.5">
            <div className="h-full bg-teal rounded-full" style={{ width: `${pct}%` }}></div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={upgradeToPro}>Upgrade to Pro</button>
          </div>
        </div>

        <div className="card">
          <div className="text-[15px] font-bold mb-3">Account</div>
          <p className="text-xs text-slate-500 mb-3">Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
          <p className="text-xs text-slate-500">Email verified: {user?.email_verified ? '✅ Yes' : '⚠️ Pending'}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="mb-4"><label className="label">{label}</label>{children}</div>;
}
