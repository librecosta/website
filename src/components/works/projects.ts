export const categories = {
  platforms: { name: 'Platforms', label: '平台' },
  systems: { name: 'Systems', label: '系统' },
  interaction: { name: 'Interaction / Visual Computing', label: '交互与视觉计算' },
  publishing: { name: 'Ideas / Publishing', label: '技术出版' },
} as const;

export const regions = {
  rivet: { name: 'Rivet Bight', label: '铆湾' },
  vane: { name: 'Vane Divide', label: '风标岭' },
  refraction: { name: 'Refraction Reach', label: '折光汊' },
  farbeat: { name: 'Farbeat Isle', label: '远拍岛' },
  folio: { name: 'Folio Haven', label: '页港' },
} as const;

export type Category = keyof typeof categories;
export type Region = keyof typeof regions;
export type Landmark = 'terrace' | 'workshop' | 'observatory' | 'collector' | 'prism' | 'ribs' | 'gates' | 'archive';

type Entry = { label: string; href: string };
type Media = { src: string; alt: string };

export type Project = {
  slug: string;
  name: string;
  category: Category;
  region: Region;
  position: readonly [number, number];
  landmark: Landmark;
  description: string;
  links: readonly [Entry, Entry?];
  media: Media;
};

export const projects: readonly Project[] = [
  {
    slug: 'gofurry', name: 'GoFurry', category: 'platforms', region: 'rivet',
    position: [-5, 3], landmark: 'terrace',
    description: '面向 Furry 社群的可定制浏览器起始页与资源发现入口。',
    links: [{ label: '查看项目', href: 'https://github.com/librecosta/gofurry' }],
    media: { src: '/works/gofurry.webp', alt: 'GoFurry 起始页，显示搜索分类、常用站点和侧边工具' },
  },
  {
    slug: 'tool4furry', name: 'Tool4Furry', category: 'platforms', region: 'rivet',
    position: [-2, 4], landmark: 'workshop',
    description: '面向 Furry 创作者的开源浏览器工具箱。',
    links: [{ label: '查看工具箱', href: 'https://github.com/librecosta/tool4furry' }],
    media: { src: '/works/tool4furry.webp', alt: 'Tool4Furry 官方项目预览图' },
  },
  {
    slug: 'librecosta-uptime', name: 'LibreCosta Uptime', category: 'systems', region: 'vane',
    position: [-1, 1], landmark: 'observatory',
    description: '自托管 HTTP/HTTPS 可用性监测工具，附状态面板。',
    links: [{ label: '查看发布版', href: 'https://github.com/librecosta/uptime/releases' }],
    media: { src: '/works/uptime.webp', alt: 'LibreCosta Uptime 状态面板，显示端点状态和可用性时间线' },
  },
  {
    slug: 'harvest', name: 'Harvest', category: 'systems', region: 'vane',
    position: [-4, 0], landmark: 'collector',
    description: '支持持久化调度和可扩展采集源的分布式数据采集引擎。',
    links: [{ label: '查看项目文档', href: 'https://github.com/librecosta/harvest#readme' }],
    media: { src: '/works/harvest.webp', alt: 'Harvest 命令行帮助，列出控制面、Worker 和健康检查命令' },
  },
  {
    slug: 'liquid-glass', name: 'Liquid Glass', category: 'interaction', region: 'refraction',
    position: [4, 3], landmark: 'prism',
    description: '为原生 HTML 提供可定制 SVG 玻璃折射的开源库。',
    links: [
      { label: '查看库与用法', href: 'https://github.com/librecosta/liquid-glass#readme' },
      { label: '查看发布版', href: 'https://github.com/librecosta/liquid-glass/releases' },
    ],
    media: { src: '/works/liquid-glass.webp', alt: 'Liquid Glass Playground 中的折射演示与调节控件' },
  },
  {
    slug: 'wavefield', name: 'Wavefield', category: 'interaction', region: 'refraction',
    position: [2, 2], landmark: 'ribs',
    description: '以 WebGPU 绘制可交互的线框地形。',
    links: [
      { label: '查看项目', href: 'https://github.com/librecosta/wavefield#readme' },
      { label: '阅读技术文章', href: 'https://gopheratlas.com/notes/graphics-interaction/webgpu-wavefield-reconstruction/' },
    ],
    media: { src: '/works/wavefield.webp', alt: 'Wavefield 的线框地形演示，网格随柔和丘陵起伏' },
  },
  {
    slug: 'sofaraway', name: 'Sofaraway', category: 'interaction', region: 'farbeat',
    position: [1, 4], landmark: 'gates',
    description: '在程序化音乐和场景中穿过节拍门的浏览器节奏跑酷游戏。',
    links: [{ label: '查看游戏', href: 'https://github.com/librecosta/sofaraway#readme' }],
    media: { src: '/works/sofaraway.webp', alt: 'Sofaraway 游戏画面，紫色节拍门沿程序化隧道向远处延伸' },
  },
  {
    slug: 'gopheratlas', name: 'GopherAtlas', category: 'publishing', region: 'folio',
    position: [1, -5], landmark: 'archive',
    description: 'LibreCosta 团队的 Go 技术文章与实验笔记。',
    links: [
      { label: '阅读文章', href: 'https://gopheratlas.com/articles/' },
      { label: '访问博客', href: 'https://gopheratlas.com/' },
    ],
    media: { src: '/works/gopheratlas.webp', alt: 'GopherAtlas 官方预览图' },
  },
];
