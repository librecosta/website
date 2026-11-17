import type { Metadata } from 'next';
import { publication } from '@/site/publication';
import './globals.css';

const chinese = publication.defaultLocale === 'zh';
export const metadata: Metadata = { title: chinese ? '页面未找到 | LibreCosta' : 'Page not found | LibreCosta' };

export default function GlobalNotFound() {
  return <html lang={publication.defaultLocale}><body><main>
    <h1>{chinese ? '404 · 页面未找到' : '404 · Page not found'}</h1>
    <a href="/">{chinese ? '返回首页' : 'Back to home'}</a>
  </main></body></html>;
}
