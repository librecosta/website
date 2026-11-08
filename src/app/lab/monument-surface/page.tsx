import type { Metadata } from 'next';
import MonumentStudy from '@/components/monument-surface/MonumentStudy';

export const metadata: Metadata = {
  title: 'Still Monolith Surface Study | LibreCosta',
  robots: { index: false, follow: false },
};

export default function MonumentSurfacePage() {
  return <MonumentStudy />;
}
