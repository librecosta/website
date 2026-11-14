export const categories = {
  platforms: { name: 'Platforms', label: '平台' },
  systems: { name: 'Systems', label: '系统' },
  interaction: { name: 'Interaction / Visual Computing', label: '交互与视觉计算' },
  publishing: { name: 'Ideas / Publishing', label: '技术出版' },
} as const;

export type Category = keyof typeof categories;
export type Landmark = 'terrace' | 'workshop' | 'observatory' | 'collector' | 'prism' | 'ribs' | 'gates' | 'archive';

type Entry = { label: string; href: string };
type Media = { src: string; alt: string };

export type Project = {
  slug: string;
  name: string;
  category: Category;
  island: { name: string; chart: readonly [number, number]; width: number; bearing: number; model?: string };
  status: string;
  note?: string;
  landmark: Landmark;
  description: string;
  links: readonly [Entry, Entry?];
  media: Media;
};

export const projects: readonly Project[] = [
  {
    slug: 'gofurry', name: 'GoFurry', category: 'platforms',
    island: { name: '铆湾', chart: [-79, 45], width: 39, bearing: 85, model: 'bay' },
    landmark: 'terrace', status: '开源项目',
    description: '面向 Furry 社群的可定制浏览器起始页与资源发现入口。',
    links: [{ label: '查看项目', href: 'https://github.com/librecosta/gofurry' }],
    media: { src: '/works/gofurry.webp', alt: 'GoFurry 起始页，显示搜索分类、常用站点和侧边工具' },
  },
  {
    slug: 'tool4furry', name: 'Tool4Furry', category: 'platforms',
    island: { name: '砧石屿', chart: [-68, -38], width: 35, bearing: 24, model: 'foundry' },
    landmark: 'workshop', status: '开源项目',
    description: '面向 Furry 创作者的开源浏览器工具箱。',
    links: [{ label: '查看工具箱', href: 'https://github.com/librecosta/tool4furry' }],
    media: { src: '/works/tool4furry.webp', alt: 'Tool4Furry 官方项目预览图' },
  },
  {
    slug: 'librecosta-uptime', name: 'LibreCosta Uptime', category: 'systems',
    island: { name: '风标岭', chart: [-35, 106], width: 28, bearing: 45, model: 'signal' },
    landmark: 'observatory', status: '已发布版本',
    description: '自托管 HTTP/HTTPS 可用性监测工具，附状态面板。',
    links: [{ label: '查看发布版', href: 'https://github.com/librecosta/uptime/releases' }],
    media: { src: '/works/uptime.webp', alt: 'LibreCosta Uptime 状态面板，显示端点状态和可用性时间线' },
  },
  {
    slug: 'harvest', name: 'Harvest', category: 'systems',
    island: { name: '层畴屿', chart: [-14, -47], width: 37, bearing: -14 },
    landmark: 'collector', status: '开源项目',
    description: '支持持久化调度和可扩展采集源的分布式数据采集引擎。',
    links: [{ label: '查看项目文档', href: 'https://github.com/librecosta/harvest#readme' }],
    media: { src: '/works/harvest.webp', alt: 'Harvest 命令行帮助，列出控制面、Worker 和健康检查命令' },
  },
  {
    slug: 'liquid-glass', name: 'Liquid Glass', category: 'interaction',
    island: { name: '折光屿', chart: [66, 83], width: 34, bearing: 30, model: 'prism' },
    landmark: 'prism', status: '已发布版本',
    description: '为原生 HTML 提供可定制 SVG 玻璃折射的开源库。',
    links: [
      { label: '查看库与用法', href: 'https://github.com/librecosta/liquid-glass#readme' },
      { label: '查看发布版', href: 'https://github.com/librecosta/liquid-glass/releases' },
    ],
    media: { src: '/works/liquid-glass.webp', alt: 'Liquid Glass Playground 中的折射演示与调节控件' },
  },
  {
    slug: 'wavefield', name: 'Wavefield', category: 'interaction',
    island: { name: '回波岬', chart: [80, 7], width: 45, bearing: 34, model: 'wave' },
    landmark: 'ribs', status: '开源项目',
    description: '以 WebGPU 绘制可交互的线框地形。',
    links: [
      { label: '查看项目', href: 'https://github.com/librecosta/wavefield#readme' },
      { label: '阅读技术文章', href: 'https://gopheratlas.com/notes/graphics-interaction/webgpu-wavefield-reconstruction/' },
    ],
    media: { src: '/works/wavefield.webp', alt: 'Wavefield 的线框地形演示，网格随柔和丘陵起伏' },
  },
  {
    slug: 'sofaraway', name: 'Sofaraway', category: 'interaction',
    island: { name: '远拍岛', chart: [49, -88], width: 44, bearing: 39 },
    landmark: 'gates', status: '游戏作品',
    description: '在程序化音乐和场景中穿过节拍门的浏览器节奏跑酷游戏。',
    note: '在持续生成的赛道上读出节拍，穿过与音乐同步出现的门架。',
    links: [{ label: '查看游戏', href: 'https://github.com/librecosta/sofaraway#readme' }],
    media: { src: '/works/sofaraway.webp', alt: 'Sofaraway 游戏画面，紫色节拍门沿程序化隧道向远处延伸' },
  },
  {
    slug: 'gopheratlas', name: 'GopherAtlas', category: 'publishing',
    island: { name: '页港', chart: [-4, 28], width: 36, bearing: 8 },
    landmark: 'archive', status: '技术博客',
    description: 'LibreCosta 团队的 Go 技术文章与实验笔记。',
    links: [
      { label: '阅读文章', href: 'https://gopheratlas.com/articles/' },
      { label: '访问博客', href: 'https://gopheratlas.com/' },
    ],
    media: { src: '/works/gopheratlas.webp', alt: 'GopherAtlas 官方预览图' },
  },
];
