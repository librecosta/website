import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../info.module.css';

export const metadata: Metadata = {
  title: 'About | LibreCosta',
  robots: { index: false },
};

export default function AboutPage() {
  return <main className={styles.page}>
    <p className={styles.brand}><span lang="en">LibreCosta</span><span>远岸开物</span></p>
    <h1 lang="en">About</h1>
    <p>远岸开物（LibreCosta）发布软件、交互作品与技术文章。</p>
    <p className={styles.notice}>这是临时入口，正式介绍将在之后发布。</p>
    <nav className={styles.nav} aria-label="返回导航">
      <Link href="/">首页</Link>
      <Link href="/works" prefetch={false} lang="en">WORKS</Link>
    </nav>
  </main>;
}
