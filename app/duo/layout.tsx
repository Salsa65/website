import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Reforge Duo — AI Story Forge',
  description: 'A mobile-first brainstorming and writing forge powered by Vesper and Arden.',
  manifest: (process.env.NEXT_PUBLIC_BASE_PATH||'') + '/duo-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Reforge Duo', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function DuoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
