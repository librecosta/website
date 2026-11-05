import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LibreCosta — 远岸开物',
  description: 'LibreCosta 官方网站。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
