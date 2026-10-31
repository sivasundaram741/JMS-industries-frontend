import type { Metadata } from 'next';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Catchu ERP', template: '%s · Catchu ERP' },
  description: 'Catchu ERP · JMS Industries manufacturing ERP',
};

// Applies the saved appearance (theme, sidebar, compact tables, motion, focus rings) before first paint
const themeScript = `(function(){try{var d=document.documentElement,a=JSON.parse(localStorage.getItem('kcerp-appearance')||'null')||{},t=a.theme||localStorage.getItem('kcerp-theme')||'system';if(t==='system')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.setAttribute('data-theme',t);d.setAttribute('data-sidebar',a.sidebar||'match');if(a.compact)d.setAttribute('data-compact','');if(a.reduceMotion)d.setAttribute('data-reduce-motion','');if(a.strongFocus)d.setAttribute('data-strong-focus','')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
