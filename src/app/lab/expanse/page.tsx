import type { Metadata } from 'next';
import ExpanseLab from '@/components/expanse/ExpanseLab';

export const metadata: Metadata = {
  title: 'The Expanse · 空间灰模 | LibreCosta',
  description: '苍白荒原、几何巨构与三个固定观察点。LibreCosta 本地空间研究。',
  robots: { index: false, follow: false },
};

export default function ExpansePage() {
  return <ExpanseLab />;
}
