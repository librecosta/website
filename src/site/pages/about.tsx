import { AboutExperience } from '@/components/about/AboutExperience';
import { sitePage } from '../site-page';

export const about = sitePage('/about', 'ABOUT', {
  zh: {
    metadata: {
      title: 'About | LibreCosta',
      description: '认识 LibreCosta 远岸开物，了解我们的独立软件、开源项目、交互作品与技术写作。',
    },
    render: () => <AboutExperience />,
  },
});
