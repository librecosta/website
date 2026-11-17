import { publication } from '@/site/publication';
import { robotsText } from '@/site/seo';

export const dynamic = 'force-static';

export function GET() {
  return new Response(robotsText(publication), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
