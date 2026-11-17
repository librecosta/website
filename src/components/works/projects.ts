import { siteCopy } from '@/site/content';
import type { Locale } from '@/site/locale-contract';
import type { ProjectAction, ProjectStatus } from '@/site/copy/types';
import { projectPreviews, type ProjectId } from '../project-previews';

type Island = { width: number; bearing: number; model: ProjectId | 'gopher-atlas' };

type ProjectSource = {
  id: ProjectId;
  slug: string;
  name: string;
  island: Island;
  status: ProjectStatus;
  links: readonly { action: ProjectAction; href: string }[];
};

export type Project = Omit<ProjectSource, 'island' | 'status' | 'links'> & {
  type: string;
  island: Island & { name: string };
  status: string;
  description: string;
  links: readonly { label: string; href: string }[];
  media: { src: string; alt: string; background?: string };
};

export function islandPreview(project: Project) { return `/works/previews/${project.slug}.webp`; }

export const projects = [
  {
    id: 'gofurry', slug: 'gofurry', name: 'GoFurry', status: 'development',
    island: { width: 39, bearing: 21, model: 'gofurry' },
    links: [{ action: 'source', href: 'https://github.com/librecosta/gofurry' }],
  },
  {
    id: 'tool4furry', slug: 'tool4furry', name: 'Tool4Furry', status: 'development',
    island: { width: 35, bearing: 71, model: 'tool4furry' },
    links: [{ action: 'source', href: 'https://github.com/librecosta/tool4furry' }],
  },
  {
    id: 'uptime', slug: 'librecosta-uptime', name: 'LibreCosta Uptime', status: 'released',
    island: { width: 28, bearing: 19, model: 'uptime' },
    links: [{ action: 'releases', href: 'https://github.com/librecosta/uptime/releases' }],
  },
  {
    id: 'harvest', slug: 'harvest', name: 'Harvest', status: 'openSource',
    island: { width: 37, bearing: 0, model: 'harvest' },
    links: [{ action: 'docs', href: 'https://github.com/librecosta/harvest#readme' }],
  },
  {
    id: 'liquid-glass', slug: 'liquid-glass', name: 'Liquid Glass', status: 'released',
    island: { width: 34, bearing: 0, model: 'liquid-glass' },
    links: [
      { action: 'usage', href: 'https://github.com/librecosta/liquid-glass#readme' },
      { action: 'releases', href: 'https://github.com/librecosta/liquid-glass/releases' },
    ],
  },
  {
    id: 'wavefield', slug: 'wavefield', name: 'Wavefield', status: 'openSource',
    island: { width: 45, bearing: 22, model: 'wavefield' },
    links: [
      { action: 'project', href: 'https://github.com/librecosta/wavefield#readme' },
      { action: 'article', href: 'https://gopheratlas.com/notes/graphics-interaction/webgpu-wavefield-reconstruction/' },
    ],
  },
  {
    id: 'sofaraway', slug: 'sofaraway', name: 'SoFarAway', status: 'development',
    island: { width: 44, bearing: 0, model: 'sofaraway' },
    links: [{ action: 'project', href: 'https://github.com/librecosta/sofaraway#readme' }],
  },
  {
    id: 'gopheratlas', slug: 'gopheratlas', name: 'GopherAtlas', status: 'ongoing',
    island: { width: 36, bearing: 15, model: 'gopher-atlas' },
    links: [
      { action: 'articles', href: 'https://gopheratlas.com/articles/' },
      { action: 'blog', href: 'https://gopheratlas.com/' },
    ],
  },
] as const satisfies readonly ProjectSource[];

export function projectsForLocale(locale: Locale): readonly Project[] {
  const copy = siteCopy[locale].works;
  return projects.map(project => {
    const { category, island, description, alt } = copy.projects[project.id];
    return { ...project, type: category, description, island: { ...project.island, name: island },
      status: copy.statuses[project.status], media: { ...projectPreviews[project.id], alt },
      links: project.links.map(({ action, href }) => ({ href, label: copy.actions[action] })) };
  });
}
