'use client';
// New Work Order — JMS Industries product card picker + simple form
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Factory, ShoppingCart, Square, SquareCheck, Truck, Wrench } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { duration, addDaysIso, num, todayIso } from '@/lib/format';
import { Alert, Button, PageHeader, TextField, TextAreaField, Toggle, useToast } from '@/components/ui';
import { FLOWS, IN_HOUSE, flowsLabel, isPicked, kindHelp, pickFlow, type FlowKey, type WoKind } from '@/lib/workorder';

const PAGE_SIZE = 24;
const FLOW_ICON: Record<FlowKey, LucideIcon> = { make: Factory, buy: ShoppingCart, out: Truck, service: Wrench };

// ── Product categories — JMS Industries food processing machinery ─────────────
const CATEGORIES = [
  { key: 'cook',  label: 'Cooking & Heating',    codes: ['BK015','EK028','MK131','GK117','GK087','K088','ISK074','ASK092','SKK153','BMC009','CW161','CWM078','MCM033','CMM103','GMM050','MM051','FWBM106','GR118','DPG039','CBR097','SSGR082','HMM043','HM056','AKM005','TFK011'] },
  { key: 'fry',   label: 'Frying & Roasting',    codes: ['BTF008','BTF014','GOF162','AF136','CP098','DR026','DR062','SSDR032','URM010','AR091','PCPL066','NM133','NK124','SR168'] },
  { key: 'proc',  label: 'Cutting & Peeling',    codes: ['AGPM002','GPM166','GGPM113','GPM116','HDGB023','GBM063','SSGB080','GPM038','SOPM167','OPM137','OCM138','GCCM041','LVC053','VCM155','BC003','JCM150','JFP020','LCM121','MKCC122','MCC127','MCM128','MDS129','PCM140','PPM141','PCM142','PCM143','MCM075','PPM061','ICM085','CM100','TG089','HDTM046','M058','DP059','MMM021'] },
  { key: 'juice', label: 'Juice & Pulp',         codes: ['FP035','TSP040','TSP060','FM057','FP031','PST071','PK076','PCF072','PFT065'] },
  { key: 'mix',   label: 'Mixing & Blending',    codes: ['UTB037','RB94','PB068','PB1T170','DCB107','HDMM045','FPMM034','PB007','BM079','BB095','SMV086'] },
  { key: 'bake',  label: 'Bakery & Sweets',      codes: ['ADM001','ACM004','RCM158','CPM022','CCM101','SPMM159','LMM125','LMRT099','KKM052','CMM130','SPM114','PDM064','SCM156','BM016','BMM013','NMM049','SVM024','AVM093','IM047','IB048','IARS0019','SSGIB081','DK025','DBC108','MM123'] },
  { key: 'tank',  label: 'Tanks & Vessels',      codes: ['SSMT145','SSP146','PMT139','PT111','CC147','GMT119','GBT112','CS104','FT030','SSST042','SSST105','SBB164','SM165','TSKWS120','VS055','PFM144'] },
  { key: 'boil',  label: 'Boilers & Steam',      codes: ['EB027','SB152','NIB134','TTB115','SSB077','BTS006','SU154','EB029','SSES084'] },
  { key: 'wash',  label: 'Washing & Cleaning',   codes: ['FW036','VW126','BTWM157','CWM160','FVW109','HWS044'] },
  { key: 'conv',  label: 'Conveyors & SS Furniture', codes: ['SSCB054','BC017','CB102','BC096','SST069','ST163','SSFST149','FVR110','SSPR135','SSWT151','SSCT132','SSHC083','BCT018','SS_FW073','DRY','TDM012','FAVD148'] },
];

const CAT_TONE: Record<string, string> = {
  cook: '#e53e3e', fry: '#dd6b20', proc: '#d69e2e', juice: '#38a169',
  mix: '#3182ce', bake: '#805ad5', tank: '#319795', boil: '#e53e3e',
  wash: '#0987a0', conv: '#718096',
};

export default function NewWorkOrderPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const toast = useToast();

  // Which of the four flows this job takes. 2 (parts from a supplier) and 3 (work sent outside) can both be ticked.
  const [kind, setKind] = useState<WoKind>(IN_HOUSE);
  const woType = kind.type;
  function choose(k: FlowKey) {
    const next = pickFlow(kind, k);
    // A service job picks from everything the customer owns, the others from finished goods — start the pick again.
    if ((next.type === 'Service') !== (kind.type === 'Service')) { setSelectedItem(null); setCatFilter('all'); setSearch(''); }
    setKind(next);
  }
  // A service job can be booked against anything the customer owns; the other two make a finished good.
  const { data: itemsData } = useApi<any>(woType === 'Service' ? '/items?pageSize=200' : '/items?type=FG&pageSize=200');
  const items: any[] = itemsData?.rows || [];

  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ qty: '', startDate: todayIso(), dueDate: addDaysIso(todayIso(), 7), notes: '' });
  const [needsAssembly, setNeedsAssembly] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  // Reset to page 1 whenever search or category changes
  useEffect(() => { setPage(1); }, [search, catFilter]);

  // Detail for selected item (operations + materials preview)
  const { data: itemDetail } = useApi<any>(selectedItem ? `/items/${selectedItem.id}` : null);
  // The product's supplier plan: bought-out components and operations sent outside, each with its supplier
  const planBuy: any[] = woType === 'Service' ? [] : (itemDetail?.materials || []).filter((m: any) => m.source === 'buy');
  const planOut: any[] = woType === 'Service' ? [] : (itemDetail?.operations || []).filter((o: any) => o.doneBy === 'outside');
  // …which ticks flows 2 and 3 for the job (the server does the same when it creates it)
  useEffect(() => {
    if (!itemDetail || woType === 'Service' || (!planBuy.length && !planOut.length)) return;
    setKind((k) => (k.type === 'Service' ? k : { type: 'Partial Outsourcing', buysParts: (k.type === 'Partial Outsourcing' && k.buysParts) || planBuy.length > 0, sendsOut: (k.type === 'Partial Outsourcing' && k.sendsOut) || planOut.length > 0 }));
  }, [itemDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine which category an item belongs to
  function itemCat(code: string) {
    return CATEGORIES.find((c) => c.codes.includes(code));
  }

  // Filter + paginate
  const filteredItems = items.filter((i) => {
    const matchCat = catFilter === 'all' || itemCat(i.code)?.key === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function selectProduct(item: any) {
    setSelectedItem(item);
    setStep('form');
  }

  async function createWO() {
    const qty = Number(f.qty);
    if (!qty || qty <= 0) { toast.err('Enter a quantity'); return; }
    setBusy(true);
    try {
      const wo = await post('/work-orders', {
        itemId: selectedItem.id,
        qtyPlanned: qty,
        type: woType,
        buysParts: kind.buysParts,
        sendsOut: kind.sendsOut,
        startDate: f.startDate || undefined,
        dueDate: f.dueDate || undefined,
        notes: f.notes || undefined,
        ...(woType === 'Service'
          ? { needsAssembly, checklist: checklist.length ? checklist : undefined }
          : {}),
      });
      toast.ok(`${wo.number} created`);
      router.push(tenantHref(`/production/work-orders/${wo.id}`));
    } catch (e) { toast.err(e); setBusy(false); }
  }

  // ── Step 1: Product picker ─────────────────────────────────────────────────
  if (step === 'pick') {
    const from = filteredItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const to   = Math.min(safePage * PAGE_SIZE, filteredItems.length);

    // Page number buttons (show up to 7 pages around current)
    const pageNums: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pageNums.push(i);
    } else {
      pageNums.push(1);
      if (safePage > 3) pageNums.push('…');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNums.push(i);
      if (safePage < totalPages - 2) pageNums.push('…');
      pageNums.push(totalPages);
    }

    return (
      <div className="picker-screen">

        {/* ── Header — does NOT scroll ── */}
        <PageHeader
          back="/production/work-orders"
          crumbs={[{ label: user?.company.shortName || 'JMS Industries' }, { label: 'Work Orders', href: '/production/work-orders' }, { label: 'New' }]}
          title="New Work Order"
          sub={woType === 'Service' ? 'Pick the machine being repaired' : 'Pick the product to make'}
        />

        {/* ── Which of the four flows does this job take? 2 and 3 can both be ticked. ── */}
        <div className="grid cols-4" role="group" aria-label="How this job is done" style={{ gap: 10, marginBottom: 8, flexShrink: 0 }}>
          {FLOWS.map((t) => {
            const on = isPicked(kind, t.key);
            const tick = t.key === 'buy' || t.key === 'out';
            const Icon = FLOW_ICON[t.key];
            return (
              <button key={t.key} type="button" onClick={() => choose(t.key)} aria-pressed={on}
                style={{
                  position: 'relative', textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'var(--brand-subtle)' : 'var(--bg-surface)',
                  border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`,
                  color: 'var(--text-primary)',
                }}>
                <div className="row" style={{ gap: 8, marginBottom: 4, paddingRight: tick ? 22 : 0 }}>
                  <span className={`stage-dot s-${t.tone}`}>{t.n}</span>
                  <Icon size={15} className="secondary" />
                  <span className="strong text-sm truncate">{t.label}</span>
                </div>
                <div className="text-xs secondary">{t.sub}</div>
                {tick ? (
                  <span style={{ position: 'absolute', top: 11, right: 11, color: on ? 'var(--brand)' : 'var(--text-tertiary)', display: 'grid' }} aria-hidden>
                    {on ? <SquareCheck size={16} /> : <Square size={16} />}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="text-xs muted" style={{ marginBottom: 10, flexShrink: 0 }}>
          <span className="strong secondary">{flowsLabel(kind)}.</span> {kindHelp(kind)}
          {kind.type !== 'Service' && !(kind.buysParts && kind.sendsOut) ? ' Parts from a supplier and work sent outside can both be ticked for one job.' : ''}
        </div>

        {/* ── Search + category filter ── */}
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-canvas)',
          paddingBottom: 10, marginBottom: 2,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="search"
              className="input"
              style={{ flex: '1 1 220px', minWidth: 180 }}
              placeholder="Search product name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              {filteredItems.length} product{filteredItems.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ key: 'all', label: 'All' }, ...CATEGORIES].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCatFilter(c.key)}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${catFilter === c.key ? (CAT_TONE[c.key] || 'var(--brand)') : 'var(--border-default)'}`,
                  background: catFilter === c.key ? (CAT_TONE[c.key] || 'var(--brand)') : 'var(--bg-surface)',
                  color: catFilter === c.key ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable grid — fills all remaining height inside .picker-screen ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 12 }}>

          {items.length === 0 && (
            <Alert tone="warning" title="No products found">
              Run <code>seed-jms-correct.sql</code> against the tenant database to load JMS Industries product list.
            </Alert>
          )}

          {/* Product cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {pageItems.map((item) => {
              const cat = itemCat(item.code);
              const color = CAT_TONE[cat?.key || ''] || 'var(--brand)';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectProduct(item)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: 8, padding: 0, overflow: 'hidden',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 3px ${color}22`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ height: 4, background: color }} />
                  <div style={{ padding: '11px 13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>{item.code}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: color + '22', color, padding: '2px 6px', borderRadius: 10, whiteSpace: 'nowrap', flex: 'none' }}>
                        {cat?.label || 'FG'}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{item.uom}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredItems.length === 0 && items.length > 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>No products match your filter.</div>
          )}

          {/* ── Pagination bar ── */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '14px 0 6px', marginTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}>
              {/* Info */}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                Showing {from}–{to} of {filteredItems.length}
              </span>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <PagBtn onClick={() => setPage(1)}         disabled={safePage === 1}><ChevronsLeft  size={14} /></PagBtn>
                <PagBtn onClick={() => setPage(p => p-1)} disabled={safePage === 1}><ChevronLeft   size={14} /></PagBtn>

                {pageNums.map((n, i) =>
                  n === '…'
                    ? <span key={`e${i}`} style={{ padding: '0 4px', fontSize: 13, color: 'var(--text-tertiary)' }}>…</span>
                    : <PagBtn key={n} active={n === safePage} onClick={() => setPage(n as number)}>{n}</PagBtn>
                )}

                <PagBtn onClick={() => setPage(p => p+1)} disabled={safePage === totalPages}><ChevronRight  size={14} /></PagBtn>
                <PagBtn onClick={() => setPage(totalPages)} disabled={safePage === totalPages}><ChevronsRight size={14} /></PagBtn>
              </div>
            </div>
          )}

        </div>{/* end scrollable */}
      </div>
    );
  }

  // ── Step 2: WO form ────────────────────────────────────────────────────────
  const cat = itemCat(selectedItem?.code || '');
  const color = CAT_TONE[cat?.key || ''] || 'var(--brand)';
  const ops: any[] = itemDetail?.operations || [];
  const mats: any[] = itemDetail?.materials || [];
  const qty = Number(f.qty) || 0;

  return (
    <>
      <PageHeader
        back={undefined}
        crumbs={[{ label: user?.company.shortName || 'JMS Industries' }, { label: 'Work Orders', href: '/production/work-orders' }, { label: 'New' }]}
        title="New Work Order"
        sub={selectedItem?.name}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={() => setStep('pick')} icon={ChevronLeft}>Change product</Button>
            <Button variant="primary" icon={Factory} loading={busy} onClick={createWO} disabled={!can('wo', 'create') || !f.qty}>
              Create Work Order
            </Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left — form */}
        <div>
          {/* Selected product card */}
          <div style={{ background: 'var(--bg-surface)', border: `2px solid ${color}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: 4, background: color }} />
            <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <CheckCircle2 size={20} style={{ color, flex: 'none' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedItem?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>{selectedItem?.code} · {selectedItem?.uom}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="form c2">
              <TextField
                className="full"
                label={`Quantity to make (${selectedItem?.uom || 'NOS'})`}
                type="number" min={1}
                value={f.qty}
                onChange={set('qty')}
                placeholder="e.g. 50"
                required

              />
              <TextField label="Start date" type="date" value={f.startDate} onChange={set('startDate')} />
              <TextField label="Due date"   type="date" value={f.dueDate}   onChange={set('dueDate')} />
              <TextAreaField className="full" label="Notes / instructions" value={f.notes} onChange={set('notes')} placeholder="Drawing revision, special batch instructions…" rows={2} />
              {kind.type === 'Partial Outsourcing' ? (
                <div className="full">
                  <Alert tone="info" title={flowsLabel(kind)}>
                    {planBuy.length || planOut.length ? (
                      <>
                        From this product&rsquo;s plan:{' '}
                        {[...planBuy.map((m) => `${m.itemName} bought from ${m.vendorName || 'a supplier'}`), ...planOut.map((o) => `${o.name} at ${o.vendorName || 'a supplier'}`)].join(' · ')}.
                        {' '}Once it is created, one button on the work order raises an order for each supplier.
                      </>
                    ) : (
                      <>
                        After you create it, raise {kind.buysParts && kind.sendsOut ? 'the purchase order for the bought-in parts and the job work order for the outside work'
                          : kind.buysParts ? 'the purchase order for the bought-in parts' : 'the job work order for the outside work'} from the work order. It cannot be completed until {kind.buysParts && kind.sendsOut ? 'both exist' : 'that order exists'}.
                      </>
                    )}
                  </Alert>
                </div>
              ) : null}
              {woType === 'Service' ? (
                <div className="full stack" style={{ gap: 10 }}>
                  <label className="row text-sm secondary" style={{ gap: 8, cursor: 'pointer' }}>
                    <Toggle on={needsAssembly} onChange={setNeedsAssembly} label="This repair also needs assembly" />
                    This repair also needs assembly before it goes back
                  </label>
                  <div>
                    <div className="text-sm strong" style={{ marginBottom: 6 }}>Checklist</div>
                    <div className="text-xs muted" style={{ marginBottom: 8 }}>
                      Every step has to be ticked before the job can be closed. Leave it empty and the six usual steps are added for you.
                    </div>
                    {checklist.length ? (
                      <div className="list" style={{ marginBottom: 8 }}>
                        {checklist.map((t, i) => (
                          <div key={i} className="li">
                            <span className="chip">{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }} className="truncate">{t}</div>
                            <button type="button" className="icon-btn" aria-label={`Remove ${t}`} onClick={() => setChecklist((x) => x.filter((_, j) => j !== i))}>&times;</button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="row" style={{ gap: 8 }}>
                      <input className="input" style={{ flex: 1 }} aria-label="New checklist step" value={newTask} placeholder="e.g. Replace the drive belt"
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTask.trim()) { e.preventDefault(); setChecklist((x) => [...x, newTask.trim()]); setNewTask(''); } }} />
                      <Button size="sm" disabled={!newTask.trim()} onClick={() => { setChecklist((x) => [...x, newTask.trim()]); setNewTask(''); }}>Add step</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right — routing + BOM preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Operations */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Operations ({ops.length})</div>
            {ops.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No routing defined — a single Production operation will be added.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ops.map((o) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, flex: 'none' }}>{o.seq / 10}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{o.name}</span>
                    {o.machineCode && <span style={{ fontSize: 10, background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: 4 }}>{o.machineCode}</span>}
                    <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {qty > 0 ? duration(o.runMin * qty) : `${duration(o.runMin)} / pc`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materials */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Materials / BOM ({mats.length})</div>
            {mats.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No BOM defined for this item.</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Material</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>Per pc</th>
                    {qty > 0 && <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {mats.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '5px 0' }}>
                        <div style={{ fontWeight: 600 }}>{m.itemName}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>{m.itemCode}</div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '5px 0', color: 'var(--text-secondary)' }}>{num(m.qtyPer, 3)} {m.uom}</td>
                      {qty > 0 && (
                        <td style={{ textAlign: 'right', padding: '5px 0', fontWeight: 700 }}>
                          {num(Math.round(m.qtyPer * qty * 1000) / 1000, 3)} {m.uom}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Pagination button ─────────────────────────────────────────────────────────
function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: '0 6px', borderRadius: 6,
        border: `1px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
        background: active ? 'var(--brand)' : 'var(--bg-surface)',
        color: active ? '#fff' : disabled ? 'var(--text-disabled, #aaa)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: active ? 700 : 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {children}
    </button>
  );
}
