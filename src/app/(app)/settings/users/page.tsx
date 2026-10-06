'use client';
// Settings · Users & Roles: who can sign in and with which role, and the menu-access matrix for each of the six
// roles. Menus, screens and buttons follow the role of whoever signs in.
import { useEffect, useState } from 'react';
import { Eye, Factory, Landmark, Plus, Truck, UserCog, Warehouse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { patch, post, put } from '@/lib/api';
import { useAuth, type Action } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { OVERVIEW, SECTIONS } from '@/lib/nav';
import type { Tone } from '@/lib/status';
import { Alert, Avatar, Badge, Button, Card, DataTable, ErrorBox, IconTile, Loading, Modal, PageHeader, SelectField, Tabs, TextField, Toggle, Two, useToast } from '@/components/ui';
import { SettingsTabs } from '../_components/SettingsTabs';

type Perms = Record<string, Record<Action, boolean>>;
interface Role { id: number; key: string; name: string; description: string | null; tier: string; users: number; permissions: Perms }
interface RolesData { modules: string[]; actions: Action[]; roles: Role[] }
interface User { id: number; name: string; email: string; title: string | null; initials: string | null; isActive: boolean; lastLoginAt: string | null; roleId: number; roleKey: string; roleName: string }

// Menu names, the same as the sidebar
const MODULE_LABEL: Record<string, string> = Object.fromEntries([OVERVIEW, ...SECTIONS].flatMap((s) => s.items.map((i) => [i.module, i.label])));
const ACTION_LABEL: Record<Action, string> = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve' };
const ROLE_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  manager: { icon: UserCog, tone: 'success' }, ops: { icon: Factory, tone: 'info' }, store: { icon: Warehouse, tone: 'warning' },
  purchase: { icon: Truck, tone: 'purple' }, accounts: { icon: Landmark, tone: 'teal' }, auditor: { icon: Eye, tone: 'neutral' },
};

// Where each module sits in the menu, e.g. "Sales · CRM"
function groupOf(module: string) {
  for (const s of [OVERVIEW, ...SECTIONS]) if (s.items.some((i) => i.module === module)) return s.label + (s.sub ? ' · ' + s.sub : '');
  return '';
}
const EMPTY = { name: '', email: '', title: '', roleId: '', password: '' };

export default function UsersRolesPage() {
  const { user, can, refresh } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const allowed = can('settings');
  const { data: users, error: usersError, mutate: mutateUsers } = useApi<User[]>(allowed ? '/settings/users' : null);
  const { data: roles, error: rolesError, mutate: mutateRoles } = useApi<RolesData>(allowed ? '/settings/roles' : null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const canEdit = can('settings', 'edit');
  const set = (k: keyof typeof EMPTY) => (v: string) => setF({ ...f, [k]: v });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'roles') setTab('roles');
  }, []);
  useEffect(() => {
    if (roles && roleId === null) setRoleId((roles.roles.find((r) => r.key !== 'manager') || roles.roles[0])?.id ?? null);
  }, [roles, roleId]);

  async function updateUser(u: User, body: { roleId?: number; isActive?: boolean }, msg: string) {
    mutateUsers(users?.map((x) => (x.id === u.id ? { ...x, ...body } : x)), { revalidate: false });
    try {
      await patch(`/settings/users/${u.id}`, body);
      toast.ok(msg);
      if (body.roleId) mutateRoles();
    } catch (e) { toast.err(e); } finally { mutateUsers(); }
  }

  async function addUser() {
    setBusy(true);
    try {
      const r = await post('/settings/users', { name: f.name.trim(), email: f.email.trim(), title: f.title.trim() || undefined, roleId: Number(f.roleId), password: f.password });
      toast.ok(`${r.name} added · they can sign in now`);
      setAdding(false);
      mutateUsers();
      mutateRoles();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  async function setPerm(role: Role, module: string, action: Action, value: boolean) {
    if (!roles) return;
    const row = { ...role.permissions[module], [action]: value };
    const next: RolesData = { ...roles, roles: roles.roles.map((r) => (r.id === role.id ? { ...r, permissions: { ...r.permissions, [module]: row } } : r)) };
    mutateRoles(next, { revalidate: false });
    setSaving((n) => n + 1);
    try {
      await put(`/settings/roles/${role.id}/permissions`, { permissions: { [module]: row } });
      setSavedAt(Date.now());
      await refresh();
    } catch (e) {
      toast.err(e);
      mutateRoles();
    } finally { setSaving((n) => n - 1); }
  }

  const role = roles?.roles.find((r) => r.id === roleId) || null;
  const roleOptions = (roles?.roles || []).map((r) => ({ value: r.id, label: r.name }));
  const validNew = f.name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(f.email.trim()) && f.password.length >= 8 && !!f.roleId;

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Settings' }, { label: 'Users & Roles' }]} title="Users & Roles" />
        <Alert tone="warning" title="Your role cannot open Users & Roles">Ask a manager to change who can sign in or what a role can see.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Settings' }, { label: 'Users & Roles' }]}
        title="Users & Roles"
        sub="Pick a role or a user · menus, screens and buttons follow the role of whoever signs in"
        actions={tab === 'users' && can('settings', 'create') ? <Button variant="primary" icon={Plus} onClick={() => { setF(EMPTY); setAdding(true); }}>Add user</Button> : null}
      />
      <SettingsTabs active="users" />
      <Tabs active={tab} items={[
        { key: 'users', label: 'Users', count: users?.length, onClick: () => setTab('users') },
        { key: 'roles', label: 'Roles & access', count: roles?.roles.length, onClick: () => setTab('roles') },
      ]} />
      <ErrorBox error={usersError || rolesError} />

      {tab === 'users' ? (
        <DataTable
          loading={!users && !usersError}
          rows={users}
          columns={[
            {
              key: 'name', header: 'User', render: (u) => (
                <div className="row" style={{ gap: 10 }}>
                  <Avatar initials={u.initials} size="sm" />
                  <Two a={<>{u.name}{u.id === user?.id ? <span className="text-xs muted" style={{ fontWeight: 400 }}> · you</span> : null}</>} b={u.email} />
                </div>
              ),
            },
            { key: 'title', header: 'Title', render: (u) => <span className="secondary">{u.title || '—'}</span> },
            {
              key: 'role', header: 'Role', width: 230, render: (u) => (
                <select className="select" style={{ height: 34, width: 210 }} value={u.roleId} aria-label={`Role for ${u.name}`}
                  disabled={!canEdit || u.id === user?.id} title={u.id === user?.id ? 'You cannot change your own role' : undefined}
                  onChange={(e) => { const r = roles?.roles.find((x) => x.id === Number(e.target.value)); updateUser(u, { roleId: Number(e.target.value) }, `${u.name} is now ${r?.name || 'updated'}`); }}>
                  {roleOptions.length ? roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : <option value={u.roleId}>{u.roleName}</option>}
                </select>
              ),
            },
            {
              key: 'active', header: 'Active', width: 110, render: (u) => (
                <div className="row" style={{ gap: 8 }}>
                  <Toggle on={u.isActive} label={`${u.name} active`} disabled={!canEdit || u.id === user?.id} onChange={(v) => updateUser(u, { isActive: v }, v ? `${u.name} can sign in again` : `${u.name} switched off`)} />
                  {!u.isActive ? <Badge tone="neutral" dot={false}>Off</Badge> : null}
                </div>
              ),
            },
            { key: 'login', header: 'Last sign-in', render: (u) => <span className="secondary nowrap">{u.lastLoginAt ? ago(u.lastLoginAt) : 'Never'}</span> },
          ]}
        />
      ) : !roles ? <Card><Loading rows={6} /></Card> : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)', alignItems: 'start' }}>
          <Card title="Roles" sub="Pick a role to see and change its menus">
            <div className="stack tight" style={{ gap: 8 }}>
              {roles.roles.map((r) => {
                const on = r.id === roleId;
                const ic = ROLE_ICON[r.key] || { icon: UserCog, tone: 'neutral' as Tone };
                const menus = Object.values(r.permissions).filter((p) => p.view).length;
                return (
                  <button key={r.id} type="button" onClick={() => setRoleId(r.id)} aria-pressed={on}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', background: on ? 'var(--bg-sidebar-active)' : 'var(--bg-surface)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, boxShadow: on ? '0 0 0 3px var(--brand-subtle)' : undefined }}>
                    <IconTile icon={ic.icon} tone={ic.tone} size={34} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="strong" style={{ display: 'block' }}>{r.name}</span>
                      <span className="text-xs muted truncate" style={{ display: 'block' }}>{r.description || '—'}</span>
                    </span>
                    <span className="text-xs" style={{ textAlign: 'right', flex: 'none' }}>
                      <span className="strong" style={{ display: 'block' }}>{r.users} user{r.users === 1 ? '' : 's'}</span>
                      <span className="muted">{menus} menus</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="stack">
            <Alert tone="info" title="Menus follow the role">
              Switch a menu off and it disappears from the sidebar of every user with this role. Create, Edit, Delete and Approve show or hide the matching buttons. Managers always keep Settings.
            </Alert>
            {role ? (
              <DataTable
                toolbar={
                  <div className="toolbar">
                    <div>
                      <div className="tt">Menus for {role.name}</div>
                      <div className="ts">View · Create · Edit · Delete · Approve for the selected role (Managers always keep Settings)</div>
                    </div>
                    <div className="spacer" />
                    <span className="text-xs muted nowrap">{!canEdit ? 'View only · your role cannot change access' : saving ? 'Saving…' : savedAt ? 'All changes saved' : 'Changes save as you switch'}</span>
                  </div>
                }
                rows={roles.modules.map((m) => ({ id: m, module: m }))}
                columns={[
                  { key: 'menu', header: 'Menu', render: (r) => <Two a={MODULE_LABEL[r.module] || r.module} b={groupOf(r.module)} /> },
                  ...roles.actions.map((a) => ({
                    key: a, header: ACTION_LABEL[a], align: 'center' as const, width: 84,
                    render: (r: { module: string }) => {
                      const locked = role.key === 'manager' && r.module === 'settings';
                      return (
                        <div style={{ display: 'flex', justifyContent: 'center' }} title={locked ? 'Managers always keep Settings' : undefined}>
                          <Toggle on={!!role.permissions[r.module]?.[a]} label={`${ACTION_LABEL[a]} ${MODULE_LABEL[r.module] || r.module} for ${role.name}`} disabled={!canEdit || locked} onChange={(v) => setPerm(role, r.module, a, v)} />
                        </div>
                      );
                    },
                  })),
                ]}
              />
            ) : null}
          </div>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add user" sub="They sign in with this email and password · the role decides their menus"
        footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!validNew} onClick={addUser}>Add user</Button></>}>
        <div className="form c2">
          <TextField label="Full name" value={f.name} onChange={set('name')} placeholder="e.g. Priya Raman" required />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} placeholder="name@company.in" required />
          <TextField label="Job title" value={f.title} onChange={set('title')} placeholder="Defaults to the role name" />
          <SelectField label="Role" value={f.roleId} onChange={set('roleId')} placeholder="Choose a role…" options={roleOptions} required />
          <TextField className="full" label="Password" type="password" value={f.password} onChange={set('password')} hint={f.password && f.password.length < 8 ? `${8 - f.password.length} more characters needed` : 'At least 8 characters'} required />
        </div>
      </Modal>
    </>
  );
}
