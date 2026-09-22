import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Redbound — Write · Train · Evolve',
  description: 'An RPG writing studio and workout journal with shared character progression.',
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH||''}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: 'Redbound' },
};

export const viewport: Viewport = { themeColor: '#0b090d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
