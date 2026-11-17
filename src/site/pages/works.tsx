import { WorksReel } from '@/components/works/WorksReel';
import { sitePage } from '../site-page';

export const works = sitePage('works', 'WORKS', () => <WorksReel />);
