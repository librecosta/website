import type { ProjectId } from '@/components/project-previews';
import type { ObservationId, WitnessId } from '@/components/expanse/narrative';

export type ArchiveId = 'gofurry' | 'tool4furry' | 'gopheratlas' | 'uptime' | 'sofaraway';
export type PrincipleId = 'useful-first' | 'experience-first' | 'built-to-last';
export type AboutChapter = 'opening' | 'studio' | 'collections' | 'practice' | 'closing';
export type ProjectStatus = 'development' | 'released' | 'openSource' | 'ongoing';
export type ProjectAction = 'source' | 'releases' | 'docs' | 'usage' | 'project' | 'article' | 'articles' | 'blog';
export type ErrorScreenKind = 'notFound' | 'request' | 'server';

export type SiteCopy = {
  shared: {
    language: string; pending: string; navigation: string; home: string; social: string; newTab: string; blogNewTab: string;
    siteSwitch: { label: string; cn: string; intl: string; fallback: `${string}{language}${string}` };
    nav: Record<'world' | 'works' | 'about' | 'blog' | 'contact', string>;
    dossier: { name: string; field: string; software: string; practice: string; design: string; channels: string; email: string };
    errors: Record<ErrorScreenKind, { title: string; detail: string }> & {
      home: string; works: string; retry: string; routing: string; service: string;
    };
  };
  world: {
    title: string; landscape: string; sceneLabel: string; noScript: string; instructions: string;
    webgl: string; canvasFallback: string; reload: string; scroll: string; progress: string;
    loading: { starting: string; assets: string; presenting: string; ready: string };
    audio: { on: string; off: string; labelOn: string; labelOff: string; indicatorOn: string; indicatorOff: string;
      prompt: readonly [string, string]; failure: string; windMissing: string };
    readout: { site: string; basin: string; sector: string; time: string; position: string; chapter: string };
    transcript: string; witnessLabel: string; observationsLabel: string; read: string; readAct: string; staticView: string;
    witness: { [Id in WitnessId]: Id extends '03' ? readonly [string] : readonly [string, string] };
    observations: Record<ObservationId, { name: string; lines: readonly [string, ...string[]] }>;
    brand: { title: string; description: readonly [string, string]; signature: string };
  };
  about: {
    opening: { brand: string; description: string; explore: string };
    studio: { label: string; first: string; second: string };
    profile: { title: string; brand: string; operator: string; company: string; first: string; second: string };
    collections: { label: string; source: string; site: string; releases: string; descriptions: Record<ArchiveId, string> };
    practice: { intro: string; titles: Record<PrincipleId, string>; carousel: string; pagination: string;
      previous: string; next: string; pause: string; resume: string };
    closing: { intro: string; contact: string; links: string; works: string };
    sections: Record<AboutChapter, string>;
    chapters: string; scrollPosition: string;
  };
  works: {
    heading: string; archive: string; expand: string; overview: string; reel: string; cards: string;
    previousCard: string; nextCard: string; browse: string; previousProject: string; nextProject: string;
    pause: string; resume: string; reserved: string; island: string; zoomIn: string; zoomOut: string; reset: string;
    loadingIsland: string; staticPreview: string; previewLabel: `${string}{name}${string}`; canvasLabel: `${string}{name}${string}`; links: string;
    statuses: Record<ProjectStatus, string>;
    actions: Record<ProjectAction, string>;
    projects: Record<ProjectId, { category: string; island: string; description: string; alt: string }>;
  };
  contact: { title: string; intro: string; emailLabel: string };
  metadata: { world: string; about: string; works: string; contactTitle: string; aboutTitle: string; worksTitle: string };
};
