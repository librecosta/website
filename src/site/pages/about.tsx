import { AboutExperience } from '@/components/about/AboutExperience';
import { sitePage } from '../site-page';

export const about = sitePage('/about', 'ABOUT', () => <AboutExperience />);
