import cn from '../../config/publications/cn.json' with { type: 'json' };
import intl from '../../config/publications/intl.json' with { type: 'json' };
import { parsePublication } from './publication-config.ts';

export const publications = { cn: parsePublication(cn), intl: parsePublication(intl) };
