import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reforge — Story Forge',
  description: 'A cinematic writing workspace with Myria, your persistent project assistant.',
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH||''}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: 'Reforge' },
};

export const viewport: Viewport = { themeColor: '#0b090d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
