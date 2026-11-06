import type { Metadata } from 'next';
import ExpanseLab from '@/components/expanse/ExpanseLab';

export const metadata: Metadata = {
  title: 'The Expanse | LibreCosta',
  description: '苍白荒原，半埋巨构。以滚动走向远方。',
  robots: { index: false, follow: false },
};

export default function ExpansePage() {
  return <ExpanseLab />;
}
