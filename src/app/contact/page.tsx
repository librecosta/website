import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../info.module.css';

export const metadata: Metadata = { title: 'Contact | LibreCosta' };

export default function ContactPage() {
  return <main className={styles.page}>
    <p className={styles.brand}><span lang="en">LibreCosta</span><span>远岸开物</span></p>
    <h1 lang="en">Contact</h1>
    <dl className={styles.channels}>
      <div><dt>邮箱</dt><dd><a href="mailto:contact@librecosta.com">contact@librecosta.com</a></dd></div>
      <div><dt>X</dt><dd><a href="https://x.com/LibreCostaHQ" target="_blank" rel="noopener noreferrer"
        aria-label="@LibreCostaHQ（在新标签页打开）">@LibreCostaHQ</a></dd></div>
    </dl>
    <nav className={styles.nav} aria-label="返回导航">
      <Link href="/">首页</Link>
      <Link href="/works" prefetch={false} lang="en">WORKS</Link>
    </nav>
  </main>;
}
