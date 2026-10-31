'use client';
// "Part of job …" strip for records that belong to a work order — a purchase order, a job work order, a goods
// receipt, an inspection. It shows that job's route in miniature and what the job needs next, so you can follow a
// job from any of its papers back to its route card.
import { ChevronRight } from 'lucide-react';
import { TenantLink as Link } from './ui/TenantLink';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { num } from '@/lib/format';
import { routeOf } from '@/lib/route';
import { flowsOf } from '@/lib/workorder';

export function JobLink({ woId, role = 'Part of job' }: { woId?: number | null; role?: string }) {
  const { can } = useAuth();
  const { data: wo } = useApi<any>(woId && can('wo') ? `/work-orders/${woId}` : null);
  if (!woId || !wo) return null;
  const { steps, next } = routeOf(wo);
  const now = steps.find((s) => s.state === 'now') || steps.find((s) => s.state === 'blocked');
  return (
    <Link href={`/production/work-orders/${wo.id}`} className="job-link" aria-label={`${role} ${wo.number}: open its route card`}>
      <div style={{ minWidth: 0 }}>
        <div className="text-xs muted">{role}</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="code" style={{ fontSize: 17 }}>{wo.number}</span>
          {flowsOf(wo).map((f) => <span key={f.key} className={`chip t-${f.tone}`}>{f.n} · {f.short}</span>)}
        </div>
        <div className="text-sm secondary truncate">{wo.itemName} · {num(wo.qtyCompleted)} of {num(wo.qtyPlanned)} {wo.uom} made</div>
      </div>
      <div className="job-link-route">
        <div className="mini-route" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.key} style={{ display: 'contents' }}>
              {i ? <b className={steps[i - 1].state === 'done' ? 'done' : ''} /> : null}
              <i className={s.state} title={s.label} />
            </span>
          ))}
        </div>
        <div className="text-xs secondary" style={{ marginTop: 6 }}>
          {now ? <><span className="strong">{now.label}</span> · </> : null}{next.key === 'none' ? next.title : `next: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}`}
        </div>
      </div>
      <ChevronRight size={18} className="muted" style={{ flex: 'none' }} />
    </Link>
  );
}
