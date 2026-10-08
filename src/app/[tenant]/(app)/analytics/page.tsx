'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { num, dateShort, inrShort } from '@/lib/format';
import { Card, DataTable, ErrorBox, Loading, PageHeader, SelectField, StatStrip, StatusBadge, Two } from '@/components/ui';

const DAY_OPTS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

function BarChart({ data }: { data: Array<{ date: string; good: number; scrap: number }> }) {
  const max = Math.max(...data.map(d => d.good + d.scrap), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => {
        const goodPct = (d.good / max) * 100;
        const scrapPct = (d.scrap / max) * 100;
        const label = dateShort(d.date).split(' ').slice(0, 2).join(' ');
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div style={{ width: '100%', height: 96, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1 }} title={`${label}: ${num(d.good)} good, ${num(d.scrap)} scrap`}>
              {d.scrap > 0 && <div style={{ width: '100%', height: `${scrapPct}%`, background: 'var(--warning-solid)', borderRadius: '2px 2px 0 0', minHeight: 2 }} />}
              <div style={{ width: '100%', height: `${goodPct}%`, background: 'var(--brand)', borderRadius: d.scrap > 0 ? 0 : '2px 2px 0 0', minHeight: d.good > 0 ? 2 : 0 }} />
            </div>
            <span className="text-xs muted" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const WO_ORDER = ['Released', 'In Progress', 'On Hold', 'Planned', 'Completed', 'Closed'];

export default function AnalyticsPage() {
  const { user, can } = useAuth();
  const [days, setDays] = useState('7');
  const { data, isLoading, error } = useApi<any>(`/analytics/production?days=${days}`);

  const { data: openOrders } = useApi<any>(can('sales') ? '/sales-orders?open=1&pageSize=200' : null);
  const { data: openPos } = useApi<any>(can('purchase') ? '/purchase-orders?open=1&pageSize=200' : null);

  const woStatus: Record<string, number> = data?.woStatus || {};
  const activeWos = (woStatus['Released'] || 0) + (woStatus['In Progress'] || 0);
  const totalGood = (data?.daily || []).reduce((a: number, d: any) => a + d.good, 0);
  const totalScrap = (data?.daily || []).reduce((a: number, d: any) => a + d.scrap, 0);
  const scrapRate = totalGood + totalScrap > 0 ? (totalScrap / (totalGood + totalScrap)) * 100 : 0;

  const openOrderRows = openOrders?.rows || [];
  const openPosRows = openPos?.rows || [];
  const openOrderValue = openOrderRows.reduce((a: number, r: any) => a + (r.total || 0), 0);
  const openPoValue = openPosRows.reduce((a: number, r: any) => a + (r.total || 0), 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Analytics' }]}
        title="Analytics"
        sub="Production output, order pipeline and key metrics"
        actions={<SelectField label="" value={days} onChange={setDays} options={DAY_OPTS} />}
      />

      <StatStrip items={[
        { label: 'Active work orders', value: num(activeWos) },
        { label: `Good output (${days}d)`, value: num(totalGood) },
        { label: `Scrap rate (${days}d)`, value: `${scrapRate.toFixed(1)}%`, color: scrapRate > 5 ? 'danger' : undefined },
        { label: 'Open customer orders', value: num(openOrders?.total ?? 0) },
        { label: 'Open SO value', value: inrShort(openOrderValue) },
      ]} />

      <ErrorBox error={error} />

      <div className="grid cols-2">
        {/* Production output chart */}
        <Card title="Production output" sub={`Good pieces (blue) and scrap (orange) · last ${days} days`}>
          {isLoading ? <Loading rows={3} /> : data?.daily?.length
            ? <BarChart data={data.daily} />
            : <div className="text-sm muted" style={{ padding: '24px 0', textAlign: 'center' }}>No production entries in this period</div>
          }
          {data?.daily?.length ? (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand)', display: 'inline-block' }} /> Good: {num(totalGood)}</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--warning-solid)', display: 'inline-block' }} /> Scrap: {num(totalScrap)}</span>
            </div>
          ) : null}
        </Card>

        {/* Work order status */}
        <Card title="Work order status">
          {isLoading ? <Loading rows={4} /> : (
            <div className="list">
              {WO_ORDER.map(s => woStatus[s] != null && (
                <div key={s} className="li" style={{ padding: '10px 0' }}>
                  <StatusBadge kind="wo" status={s} />
                  <span style={{ flex: 1 }} />
                  <span className="strong num">{num(woStatus[s])}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top items */}
      <DataTable
        loading={isLoading}
        toolbar={<div className="toolbar"><div><div className="tt">Top items by output</div><div className="ts">Last {days} days · ranked by good pieces produced</div></div></div>}
        rows={data?.topItems}
        empty="No production recorded in this period"
        columns={[
          { key: 'item', header: 'Item', render: (r) => <Two a={r.name} b={r.code} /> },
          { key: 'good', header: 'Good', align: 'right', render: (r) => <span className="strong num">{num(r.good)} {r.uom}</span> },
          { key: 'scrap', header: 'Scrap', align: 'right', render: (r) => r.scrap > 0 ? <span className="num f-warning">{num(r.scrap)}</span> : <span className="muted">—</span> },
          { key: 'rate', header: 'Scrap %', align: 'right', render: (r) => {
            const rate = r.good + r.scrap > 0 ? (r.scrap / (r.good + r.scrap)) * 100 : 0;
            return <span className={rate > 5 ? 'f-danger num' : 'muted num'}>{rate.toFixed(1)}%</span>;
          }},
        ]}
      />

      {/* Open orders pipeline */}
      {can('sales') && (
        <div className="grid cols-2">
          <Card title="Open customer orders" sub="By order value">
            {!openOrders ? <Loading rows={3} /> : openOrderRows.length === 0
              ? <div className="text-sm muted" style={{ padding: '12px 0' }}>No open orders</div>
              : (
                <div className="list">
                  {openOrderRows.slice(0, 6).map((o: any) => (
                    <div key={o.id} className="li" style={{ padding: '8px 0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lt">{o.number} · {o.customerName}</div>
                        <div className="ls">{o.status} · {o.itemsText}</div>
                      </div>
                      <span className="num strong">{inrShort(o.total)}</span>
                    </div>
                  ))}
                  {openOrderRows.length > 6 && <div className="text-xs muted" style={{ paddingTop: 8 }}>+{openOrderRows.length - 6} more orders</div>}
                </div>
              )}
          </Card>

          {can('purchase') && (
            <Card title="Open purchase orders" sub="By order value">
              {!openPos ? <Loading rows={3} /> : openPosRows.length === 0
                ? <div className="text-sm muted" style={{ padding: '12px 0' }}>No open purchase orders</div>
                : (
                  <div className="list">
                    {openPosRows.slice(0, 6).map((o: any) => (
                      <div key={o.id} className="li" style={{ padding: '8px 0' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="lt">{o.number} · {o.vendorName}</div>
                          <div className="ls">{o.status} · {o.itemsText}</div>
                        </div>
                        <span className="num strong">{inrShort(o.total)}</span>
                      </div>
                    ))}
                    {openPosRows.length > 6 && <div className="text-xs muted" style={{ paddingTop: 8 }}>+{openPosRows.length - 6} more POs</div>}
                  </div>
                )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
