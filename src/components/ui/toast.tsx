'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { CircleCheck, CircleAlert } from 'lucide-react';

type T = { id: number; text: string; kind: 'ok' | 'err' };
const Ctx = createContext<{ ok: (t: string) => void; err: (t: unknown) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, kind: T['kind']) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 6000 : 3500);
  }, []);
  const ok = useCallback((t: string) => push(t, 'ok'), [push]);
  const err = useCallback((e: unknown) => push(e instanceof Error ? e.message : String(e), 'err'), [push]);
  return (
    <Ctx.Provider value={{ ok, err }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast' + (t.kind === 'err' ? ' err' : '')}>
            {t.kind === 'err' ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}
