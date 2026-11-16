import type { Metadata } from 'next';
import { WorksReel } from '@/components/works/WorksReel';

export const metadata: Metadata = {
  title: 'Works | LibreCosta',
  description: 'LibreCosta · 远岸开物的作品档案。',
};

export default function WorksPage() {
  return <WorksReel />;
}
