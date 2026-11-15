import type { Metadata } from 'next';
import ExpanseExperience from '@/components/expanse/ExpanseExperience';

export const metadata: Metadata = {
  description: 'LibreCosta 远岸开物官方网站。探索第一幕 The Expanse，沿苍白浅谷走向远方的城市与巨环。',
};

export default function Home() {
  return <ExpanseExperience />;
}
