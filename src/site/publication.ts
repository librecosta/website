import active from '../../config/publications/active';
import { parsePublication } from './publication-config';

export const publication = parsePublication(active);
