import ExpanseExperience from '@/components/expanse/ExpanseExperience';
import { sitePage } from '../site-page';

export const home = sitePage('/', 'LibreCosta', {
  zh: {
    metadata: { description: 'LibreCosta 远岸开物官方网站。探索第一幕 The Expanse，沿苍白浅谷走向远方的城市与巨环。' },
    render: () => <ExpanseExperience />,
  },
});
