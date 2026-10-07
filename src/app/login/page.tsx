'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { tenantStore } from '@/lib/api';
import { Alert, Button } from '@/components/ui';

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || '';

function OrgSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  // Redirect to stored slug, or the env default if set — skip the selector entirely
  useEffect(() => {
    const stored = tenantStore.get() || DEFAULT_TENANT;
    if (stored) router.replace(`/${stored}/login?next=${encodeURIComponent(next)}`);
  }, [next, router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = slug.trim().toLowerCase();
    if (!val) { setError('Enter your organisation URL'); return; }
    tenantStore.set(val);
    router.push(`/${val}/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="login">
      <div className="panel">
        <div className="row"><span className="logo" style={{ width: 36, height: 36, borderRadius: 9, background: '#155eef', display: 'grid', placeItems: 'center', fontWeight: 700 }}>KC</span><span style={{ fontWeight: 700, fontSize: 18 }}>KCERP</span></div>
        <div>
          <div style={{ fontSize: 34, lineHeight: '42px', fontWeight: 700, letterSpacing: -0.6, maxWidth: 460 }}>Manufacturing ERP for industrial companies.</div>
          <div style={{ marginTop: 14, opacity: 0.75, maxWidth: 440 }}>Enter your organisation name to continue.</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} KCERP</div>
      </div>
      <div className="form-side">
        <form className="box stack" onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: 26, lineHeight: '34px', fontWeight: 600 }}>Find your organisation</h1>
            <div className="secondary" style={{ marginTop: 4 }}>Enter the URL name your admin gave you</div>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="field"><label htmlFor="org">Organisation URL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Building2 size={16} className="muted" style={{ position: 'absolute', left: 12 }} />
              <input
                id="org" className="input" style={{ paddingLeft: 36 }}
                placeholder="forgetech-engineering"
                value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoComplete="off" autoFocus
              />
            </div>
            <div className="text-xs muted" style={{ marginTop: 4 }}>e.g. your URL will be: /{slug || 'your-org'}/login</div>
          </div>
          <Button variant="primary" type="submit" style={{ width: '100%' }}>Continue</Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><OrgSelector /></Suspense>;
}
