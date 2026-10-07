'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Factory, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Alert, Button } from '@/components/ui';

const DEMO = [
  ['Nivetha', 'Plant Manager', 'nivetha@forgetech.in'],
  ['Gowtham R', 'Production Supervisor', 'gowtham@forgetech.in'],
  ['Sathish V', 'Store Keeper', 'sathish@forgetech.in'],
  ['Prakash M', 'Purchase Officer', 'prakash@forgetech.in'],
  ['Hema L', 'Accountant', 'hema@forgetech.in'],
];

function TenantLoginForm({ tenantSlug }: { tenantSlug: string }) {
  const { login, status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || `/${tenantSlug}`;
  const [email, setEmail] = useState('nivetha@forgetech.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (status === 'signed-in') router.replace(next); }, [status, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password, tenantSlug);
      router.replace(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="panel">
        <div className="row"><span className="logo" style={{ width: 36, height: 36, borderRadius: 9, background: '#155eef', display: 'grid', placeItems: 'center', fontWeight: 700 }}>KC</span><span style={{ fontWeight: 700, fontSize: 18 }}>KCERP</span></div>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 16 }}><span className="icon-tile" style={{ background: '#f79009', color: '#fff', width: 40, height: 40 }}><Factory size={20} /></span><span style={{ fontSize: 13, opacity: 0.8 }}>Organisation: {tenantSlug}</span></div>
          <div style={{ fontSize: 34, lineHeight: '42px', fontWeight: 700, letterSpacing: -0.6, maxWidth: 460 }}>Every order, from customer PO to payment, in seven stages.</div>
          <div style={{ marginTop: 14, opacity: 0.75, maxWidth: 440 }}>One system for sales, purchasing, warehouse, production, quality, dispatch and finance — with live order tracking across all seven stages.</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} KCERP</div>
      </div>
      <div className="form-side">
        <form className="box stack" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: 26, lineHeight: '34px', fontWeight: 600 }}>Sign in</h1>
            <div className="secondary" style={{ marginTop: 4 }}>Use your KCERP account</div>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="field"><label htmlFor="email">Email</label>
            <div style={{ position: 'relative' }}><Mail size={16} className="muted" style={{ position: 'absolute', left: 12, top: 12 }} /><input id="email" className="input" style={{ paddingLeft: 36 }} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </div>
          <div className="field"><label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}><Lock size={16} className="muted" style={{ position: 'absolute', left: 12, top: 12 }} /><input id="password" className="input" style={{ paddingLeft: 36 }} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          </div>
          <Button variant="primary" type="submit" loading={busy} style={{ width: '100%' }}>Sign in</Button>
          <div className="card" style={{ padding: 12 }}>
            <div className="text-xs muted" style={{ marginBottom: 6 }}>Demo accounts (password Kcerp@2026)</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {DEMO.map(([n, t, e]) => <button key={e} type="button" className={'btn xs' + (email === e ? ' primary' : '')} title={t} onClick={() => { setEmail(e); setPassword('Kcerp@2026'); }}>{n}</button>)}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function TenantLoginPage() {
  const { tenant } = useParams<{ tenant: string }>();
  return (
    <Suspense>
      <TenantLoginForm tenantSlug={tenant} />
    </Suspense>
  );
}

export default TenantLoginPage;
