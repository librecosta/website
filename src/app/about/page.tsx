import type { Metadata } from 'next';
import { AboutExperience } from '@/components/about/AboutExperience';
import { projects, type Category } from '@/components/works/projects';

export const metadata: Metadata = {
  title: 'About | LibreCosta',
  description: '认识 LibreCosta 远岸开物，了解我们的独立软件、开源项目、交互作品与技术写作。',
};

const groups: readonly { label: string; categories: readonly Category[] }[] = [
  { label: '软件与服务', categories: ['platforms', 'systems'] },
  { label: '交互作品', categories: ['interaction'] },
  { label: '技术出版', categories: ['publishing'] },
];

const collections = groups.map(({ label, categories }) => ({
  label,
  items: projects.filter(project => categories.includes(project.category)).map(project => project.name),
}));

export default function AboutPage() {
  return <AboutExperience collections={collections} />;
}
