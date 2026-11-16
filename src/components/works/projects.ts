import { projectPreviews } from '../project-previews';

type Island = { name: string; width: number; bearing: number } & (
  { model: 'bay' | 'foundry' | 'signal' | 'prism' | 'wave' | 'harvest'; original?: never } |
  { original: 'gates' | 'archive'; model?: never }
);

export type Project = {
  slug: string;
  name: string;
  type: string;
  island: Island;
  status: string;
  description: string;
  links: readonly { label: string; href: string }[];
  media: { src: string; alt: string; background?: string };
};

export function islandPreview(project: Project) { return `/works/previews/${project.slug}.webp`; }

export const projects: readonly Project[] = [
  {
    slug: 'gofurry', name: 'GoFurry', type: '资源发现平台', status: '开发中',
    island: { name: '铆湾', width: 39, bearing: 85, model: 'bay' },
    description: '面向 Furry 社群的可定制浏览器起始页与资源发现入口。',
    links: [{ label: 'GitHub 源码', href: 'https://github.com/librecosta/gofurry' }],
    media: projectPreviews.gofurry,
  },
  {
    slug: 'tool4furry', name: 'Tool4Furry', type: '创作者工具', status: '开发中',
    island: { name: '砧石屿', width: 35, bearing: 24, model: 'foundry' },
    description: '面向 Furry 创作者的开源浏览器工具箱。',
    links: [{ label: 'GitHub 源码', href: 'https://github.com/librecosta/tool4furry' }],
    media: projectPreviews.tool4furry,
  },
  {
    slug: 'librecosta-uptime', name: 'LibreCosta Uptime', type: '可用性监测', status: '已发布',
    island: { name: '风标岭', width: 28, bearing: 45, model: 'signal' },
    description: '自托管 HTTP/HTTPS 可用性监测工具，附状态面板。',
    links: [{ label: '查看发布版', href: 'https://github.com/librecosta/uptime/releases' }],
    media: projectPreviews.uptime,
  },
  {
    slug: 'harvest', name: 'Harvest', type: '数据采集引擎', status: '开源项目',
    island: { name: '层畴屿', width: 37, bearing: 0, model: 'harvest' },
    description: '支持持久化调度和可扩展采集源的分布式数据采集引擎。',
    links: [{ label: '查看项目文档', href: 'https://github.com/librecosta/harvest#readme' }],
    media: { src: '/works/harvest.webp', alt: 'Harvest 命令行帮助，列出控制面、Worker 和健康检查命令' },
  },
  {
    slug: 'liquid-glass', name: 'Liquid Glass', type: 'SVG 折射库', status: '已发布',
    island: { name: '折光屿', width: 34, bearing: 30, model: 'prism' },
    description: '为原生 HTML 提供可定制 SVG 玻璃折射的开源库。',
    links: [
      { label: '查看库与用法', href: 'https://github.com/librecosta/liquid-glass#readme' },
      { label: '查看发布版', href: 'https://github.com/librecosta/liquid-glass/releases' },
    ],
    media: { src: '/works/liquid-glass.webp', alt: 'Liquid Glass Playground 中的折射演示与调节控件' },
  },
  {
    slug: 'wavefield', name: 'Wavefield', type: 'WebGPU 实验', status: '开源项目',
    island: { name: '回波岬', width: 45, bearing: 34, model: 'wave' },
    description: '以 WebGPU 绘制可交互的线框地形。',
    links: [
      { label: '查看项目', href: 'https://github.com/librecosta/wavefield#readme' },
      { label: '阅读技术文章', href: 'https://gopheratlas.com/notes/graphics-interaction/webgpu-wavefield-reconstruction/' },
    ],
    media: { src: '/works/wavefield.webp', alt: 'Wavefield 的线框地形演示，网格随柔和丘陵起伏' },
  },
  {
    slug: 'sofaraway', name: 'SoFarAway', type: '浏览器节奏游戏', status: '开发中',
    island: { name: '远拍岛', width: 44, bearing: 39, original: 'gates' },
    description: '在程序化音乐和场景中穿过节拍门的浏览器节奏跑酷游戏。',
    links: [{ label: '查看项目', href: 'https://github.com/librecosta/sofaraway#readme' }],
    media: projectPreviews.sofaraway,
  },
  {
    slug: 'gopheratlas', name: 'GopherAtlas', type: '技术出版', status: '持续更新',
    island: { name: '页港', width: 36, bearing: 8, original: 'archive' },
    description: 'LibreCosta 团队的 Go 技术文章与实验笔记。',
    links: [
      { label: '阅读文章', href: 'https://gopheratlas.com/articles/' },
      { label: '访问博客', href: 'https://gopheratlas.com/' },
    ],
    media: projectPreviews.gopheratlas,
  },
];
