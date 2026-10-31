'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail } from 'lucide-react';
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
        <div className="row" style={{ gap: 12 }}>
          <span className="login-mark">JMS</span>
          <span style={{ fontWeight: 700, fontSize: 19, fontStretch: '90%' }}>Catchu ERP</span>
        </div>
        <div>
          <div className="login-org">{tenantSlug}</div>
          <h2 className="login-head">Every job, from raw material to the customer&rsquo;s door.</h2>
          <p className="login-sub">Make it here, buy parts in, send work out for welding or grinding, or take a machine back for repair. Each job carries its own route card, so everyone sees where it is and what comes next.</p>
          <ol className="login-route" aria-label="An example route card">
            {['Release', 'Parts & outside work', 'Production', 'Assembly', 'Final QC', 'Close'].map((step, i) => (
              <li key={step} className={i < 2 ? 'done' : i === 2 ? 'now' : ''}><i aria-hidden /><span>{step}</span>{i === 2 ? <b>Now</b> : null}</li>
            ))}
          </ol>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} Catchu ERP</div>
      </div>
      <div className="form-side">
        <form className="box stack" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: 30, lineHeight: '36px', fontWeight: 700, fontStretch: '86%' }}>Sign in</h1>
            <div className="secondary" style={{ marginTop: 4 }}>Use the email and password your manager gave you</div>
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
