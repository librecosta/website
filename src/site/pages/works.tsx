import { WorksReel } from '@/components/works/WorksReel';
import { sitePage } from '../site-page';

export const works = sitePage('/works', 'WORKS', {
  en: { metadata: { title: 'Works | LibreCosta', description: 'Explore the LibreCosta Project Archive.' }, render: () => <WorksReel /> },
  zh: {
    metadata: { title: 'Works | LibreCosta', description: 'LibreCosta · 远岸开物的作品档案。' },
    render: () => <WorksReel />,
  },
});
