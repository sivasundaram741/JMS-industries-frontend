'use client';
import { useEffect, useState } from 'react';
import { Building2, Eye, EyeOff, ExternalLink, Key, LogOut, Palette, Users, X } from 'lucide-react';
import { patch, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { Alert, Button, ErrorBox, Loading, Toggle, useToast } from '@/components/ui';

type DrawerTab = 'account' | 'company' | 'users';

interface Company {
  name: string; shortName: string; gstin: string | null; pan: string | null;
  city: string | null; address: string | null; phone: string | null; email: string | null;
  website: string | null; fyStart: string; timezone: string;
}
interface User {
  id: number; name: string; email: string; title: string | null;
  initials: string | null; isActive: boolean; lastLoginAt: string | null;
  roleId: number; roleKey: string; roleName: string;
}

export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, can } = useAuth();
  const [tab, setTab] = useState<DrawerTab>('account');

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Profile & settings">
        <div className="drawer-head">
          <div className="avatar">{user?.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="strong truncate">{user?.name}</div>
            <div className="text-xs muted truncate">{user?.email} · {user?.role.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="tabs" style={{ padding: '0 24px', flexShrink: 0, background: 'var(--bg-subtle)' }}>
          <button className={tab === 'account' ? 'on' : ''} onClick={() => setTab('account')}>
            <Key size={14} /> Account
          </button>
          {can('settings') && (
            <button className={tab === 'company' ? 'on' : ''} onClick={() => setTab('company')}>
              <Building2 size={14} /> Company
            </button>
          )}
          {can('settings') && (
            <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
              <Users size={14} /> Users
            </button>
          )}
        </div>
        <div className="drawer-body">
          {tab === 'account' && <AccountTab onClose={onClose} />}
          {tab === 'company' && <CompanyTab />}
          {tab === 'users' && <UsersTab />}
        </div>
      </div>
    </>
  );
}

function AccountTab({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    setBusy(true);
    try {
      await patch('/auth/me/password', { password: newPwd });
      toast.ok('Password updated · use it next time you sign in');
      setNewPwd(''); setConfirmPwd('');
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="row" style={{ gap: 12, marginBottom: 14 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>{user?.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="strong">{user?.name}</div>
            <div className="text-sm muted">{user?.email}</div>
            <div className="text-xs muted">{user?.role.name} · {user?.company.name}</div>
          </div>
        </div>
        <div className="divider" style={{ margin: '0 0 12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/settings/appearance" onClick={onClose} className="btn sm ghost" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <Palette size={15} /> Appearance
          </Link>
          <button className="btn sm ghost" style={{ justifyContent: 'flex-start', gap: 8, color: 'var(--danger-fg)' }} onClick={() => { logout(); onClose(); }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="h4" style={{ marginBottom: 14 }}>Change password</div>
        <div className="stack tight">
          <div className="field">
            <label>New password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showNew ? 'text' : 'password'} value={newPwd}
                onChange={e => setNewPwd(e.target.value)} placeholder="At least 8 characters" style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 0, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'grid', padding: 0 }}>
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPwd.length > 0 && newPwd.length < 8
              ? <div className="hint">{8 - newPwd.length} more character{8 - newPwd.length !== 1 ? 's' : ''} needed</div>
              : null}
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showConfirm ? 'text' : 'password'} value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)} placeholder="Type it again" style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 0, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'grid', padding: 0 }}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPwd.length > 0 && newPwd !== confirmPwd
              ? <div className="hint" style={{ color: 'var(--danger-fg)' }}>Passwords do not match</div>
              : null}
          </div>
          <Button variant="primary" loading={busy} disabled={newPwd.length < 8 || newPwd !== confirmPwd} onClick={changePassword}>
            Update password
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompanyTab() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('settings', 'edit');
  const { data, error, mutate } = useApi<Company>('/settings/company');
  const [f, setF] = useState<Partial<Company>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setF(data); }, [data]);

  const set = (k: keyof Company) => (v: string) => setF(prev => ({ ...prev, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      await put('/settings/company', f);
      toast.ok('Company details saved');
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!data) return <div className="card card-pad"><Loading rows={6} /></div>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Link href="/settings/company" className="text-xs" style={{ color: 'var(--text-link)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Full settings <ExternalLink size={12} />
        </Link>
      </div>
      <div className="card card-pad">
        <div className="h4" style={{ marginBottom: 14 }}>Company details</div>
        <div className="form c2">
          <div className="field">
            <label>Legal name</label>
            <input className="input" value={f.name || ''} onChange={e => set('name')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Short name</label>
            <input className="input" value={f.shortName || ''} onChange={e => set('shortName')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>GSTIN</label>
            <input className="input" value={f.gstin || ''} onChange={e => set('gstin')(e.target.value)} disabled={!canEdit} placeholder="22AAAAA0000A1Z5" />
          </div>
          <div className="field">
            <label>PAN</label>
            <input className="input" value={f.pan || ''} onChange={e => set('pan')(e.target.value)} disabled={!canEdit} placeholder="AAAAA0000A" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={f.phone || ''} onChange={e => set('phone')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" value={f.email || ''} onChange={e => set('email')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>City</label>
            <input className="input" value={f.city || ''} onChange={e => set('city')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Website</label>
            <input className="input" value={f.website || ''} onChange={e => set('website')(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field full">
            <label>Address</label>
            <textarea className="textarea" value={f.address || ''} onChange={e => set('address')(e.target.value)} disabled={!canEdit} rows={2} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          {canEdit
            ? <Button variant="primary" loading={busy} onClick={save}>Save changes</Button>
            : <Alert tone="info" title="View only">Your role cannot edit company details.</Alert>}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: users, error, mutate } = useApi<User[]>(can('settings') ? '/settings/users' : null);
  const canEdit = can('settings', 'edit');

  async function toggleActive(u: User) {
    const next = !u.isActive;
    mutate(users?.map(x => x.id === u.id ? { ...x, isActive: next } : x), { revalidate: false });
    try {
      await patch(`/settings/users/${u.id}`, { isActive: next });
      toast.ok(next ? `${u.name} can sign in again` : `${u.name} switched off`);
    } catch (e) { toast.err(e); } finally { mutate(); }
  }

  if (!can('settings')) return (
    <Alert tone="warning" title="No access">You need the Settings permission to view users.</Alert>
  );
  if (error) return <ErrorBox error={error} />;
  if (!users) return <div className="card card-pad"><Loading rows={4} /></div>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="text-sm muted">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        <Link href="/settings/users" className="text-xs" style={{ color: 'var(--text-link)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Manage in Settings <ExternalLink size={12} />
        </Link>
      </div>
      <div className="card">
        <div style={{ padding: '0 16px' }}>
          {users.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div className="avatar sm">{u.initials || u.name[0]?.toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong text-sm truncate">
                  {u.name}
                  {u.id === user?.id ? <span className="text-xs muted" style={{ fontWeight: 400 }}> · you</span> : null}
                </div>
                <div className="text-xs muted truncate">{u.roleName} · {u.lastLoginAt ? ago(u.lastLoginAt) : 'Never signed in'}</div>
              </div>
              <Toggle on={u.isActive} label={`${u.name} active`} disabled={!canEdit || u.id === user?.id} onChange={() => toggleActive(u)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
