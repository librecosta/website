export const categories = {
  platforms: { name: 'Platforms', label: '平台' },
  systems: { name: 'Systems', label: '系统' },
  interaction: { name: 'Interaction / Visual Computing', label: '交互与视觉计算' },
  publishing: { name: 'Ideas / Publishing', label: '技术出版' },
} as const;

export const regions = {
  rivet: { name: 'Rivet Bight', label: '铆湾', labelAt: [231, 529] },
  vane: { name: 'Vane Divide', label: '风标岭', labelAt: [255, 123] },
  refraction: { name: 'Refraction Reach', label: '折光汊', labelAt: [701, 391] },
  farbeat: { name: 'Farbeat Isle', label: '远拍岛', labelAt: [856, 553] },
  folio: { name: 'Folio Haven', label: '页港', labelAt: [867, 226] },
} as const;

export type Category = keyof typeof categories;
export type Region = keyof typeof regions;
export type Landmark = 'terrace' | 'workshop' | 'observatory' | 'collector' | 'prism' | 'ribs' | 'gates' | 'archive';

type Entry = { label: string; href: string };
type Media =
  | { src: string; alt: string; caption: string; fit?: 'contain' | 'mark' }
  | { title: string; detail: string };

export type Project = {
  slug: string;
  name: string;
  category: Category;
  region: Region;
  position: readonly [number, number];
  landmark: Landmark;
  anchor?: boolean;
  labelSide?: 'left';
  description: string;
  status: string;
  links: readonly [Entry, Entry?];
  media: Media;
};

export const projects: readonly Project[] = [
  {
    slug: 'gofurry', name: 'GoFurry', category: 'platforms', region: 'rivet',
    position: [145, 422], landmark: 'terrace', anchor: true,
    description: '面向 Furry 社群的可定制浏览器起始页与资源发现入口。',
    status: '开源项目',
    links: [{ label: '查看项目', href: 'https://github.com/librecosta/gofurry' }],
    media: { src: '/works/gofurry.svg', alt: 'GoFurry 的兽首图形标识', caption: 'GoFurry 项目标识', fit: 'mark' },
  },
  {
    slug: 'tool4furry', name: 'Tool4Furry', category: 'platforms', region: 'rivet',
    position: [320, 493], landmark: 'workshop', anchor: true,
    description: '为 Furry 创作者提供在浏览器本地处理文件的开源工具箱。',
    status: '开源项目',
    links: [{ label: '查看工具箱', href: 'https://github.com/librecosta/tool4furry' }],
    media: { src: '/works/tool4furry.webp', alt: 'Tool4Furry 的双兽首图形与字标', caption: 'Tool4Furry 官方品牌图' },
  },
  {
    slug: 'librecosta-uptime', name: 'LibreCosta Uptime', category: 'systems', region: 'vane',
    position: [383, 140], landmark: 'observatory',
    description: '自托管 HTTP/HTTPS 可用性监测工具，附状态面板。',
    status: '已发布版本',
    links: [{ label: '查看发布版', href: 'https://github.com/librecosta/uptime/releases' }],
    media: { src: '/works/uptime.webp', alt: 'LibreCosta Uptime 状态面板，显示端点状态和可用性时间线', caption: 'Uptime 项目文档 · 状态面板' },
  },
  {
    slug: 'harvest', name: 'Harvest', category: 'systems', region: 'vane',
    position: [540, 308], landmark: 'collector',
    description: '支持持久化调度、采集源适配及结构化结果的分布式数据采集引擎。',
    status: '开源项目',
    links: [{ label: '查看项目文档', href: 'https://github.com/librecosta/harvest#readme' }],
    media: { title: 'Harvest', detail: '采集 · 调度 · 结构化观测' },
  },
  {
    slug: 'liquid-glass', name: 'Liquid Glass', category: 'interaction', region: 'refraction',
    position: [588, 512], landmark: 'prism',
    description: '为原生 HTML 提供可定制 SVG 玻璃折射的开源库。',
    status: '已发布版本',
    links: [
      { label: '查看库与用法', href: 'https://github.com/librecosta/liquid-glass#readme' },
      { label: '查看发布版', href: 'https://github.com/librecosta/liquid-glass/releases' },
    ],
    media: { src: '/works/liquid-glass.webp', alt: 'Liquid Glass Playground 中的折射演示与调节控件', caption: 'Liquid Glass 项目文档 · Playground', fit: 'contain' },
  },
  {
    slug: 'wavefield', name: 'Wavefield', category: 'interaction', region: 'refraction',
    position: [764, 347], landmark: 'ribs', labelSide: 'left',
    description: '用 WebGPU 生成可交互线框地形的网页视觉项目。',
    status: '已发布版本',
    links: [
      { label: '查看项目', href: 'https://github.com/librecosta/wavefield#readme' },
      { label: '阅读技术文章', href: 'https://gopheratlas.com/notes/graphics-interaction/webgpu-wavefield-reconstruction/' },
    ],
    media: { src: '/works/wavefield.webp', alt: 'Wavefield 的线框地形演示，网格随柔和丘陵起伏', caption: 'Wavefield 项目文档 · 地形静帧' },
  },
  {
    slug: 'sofaraway', name: 'Sofaraway', category: 'interaction', region: 'farbeat',
    position: [856, 567], landmark: 'gates', anchor: true, labelSide: 'left',
    description: '在程序化音乐和场景中穿过节拍门的浏览器节奏跑酷游戏。',
    status: '开源游戏作品',
    links: [{ label: '查看游戏', href: 'https://github.com/librecosta/sofaraway#readme' }],
    media: { src: '/works/sofaraway.webp', alt: 'Sofaraway 游戏画面，紫色节拍门沿程序化隧道向远处延伸', caption: 'Sofaraway 项目文档 · 游戏静帧' },
  },
  {
    slug: 'gopheratlas', name: 'GopherAtlas', category: 'publishing', region: 'folio',
    position: [835, 143], landmark: 'archive', anchor: true, labelSide: 'left',
    description: 'LibreCosta 团队发布 Go 技术文章、实验与学习随笔的技术博客。',
    status: '技术博客',
    links: [
      { label: '阅读文章', href: 'https://gopheratlas.com/articles/' },
      { label: '访问博客', href: 'https://gopheratlas.com/' },
    ],
    media: { src: '/works/gopheratlas.webp', alt: 'GopherAtlas 官方预览图', caption: 'GopherAtlas 官方出版视觉' },
  },
];
