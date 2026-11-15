import type { Metadata } from 'next';
import { AboutExperience } from '@/components/about/AboutExperience';

export const metadata: Metadata = {
  title: 'About | LibreCosta',
  description: '认识 LibreCosta 远岸开物，了解我们的独立软件、开源项目、交互作品与技术写作。',
};

export default function AboutPage() {
  return <AboutExperience />;
}
