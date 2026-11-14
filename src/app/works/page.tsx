import type { Metadata } from 'next';
import { WorksAtlas } from '@/components/works/WorksAtlas';
import styles from '@/components/works/works.module.css';

export const metadata: Metadata = {
  title: 'Works | LibreCosta',
  description: '探索 LibreCosta 的作品海图。浏览软件、视觉作品与团队技术出版。',
};

export default function WorksPage() {
  return <main className={styles.page}><WorksAtlas /></main>;
}
