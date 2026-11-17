export const englishAbout = {
  opening: { brand: 'LibreCosta', description: 'Productivity tools and digital experiences.', explore: 'Explore LibreCosta' },
  studio: {
    label: 'FROM USEFUL SOFTWARE TO CREATIVE EXPERIENCES',
    first: 'We start with real needs and always leave room for curiosity.',
    second: 'Every tool and every experiment brings an idea one step closer to reality.',
  },
  profile: {
    brand: 'Brand:', operator: 'Operated by:', company: 'Chengdu Yuanan Kaiwu Technology Co., Ltd.',
    first: 'LibreCosta builds software for communities, creators, and developers—from online services and productivity tools to self-hosted open-source systems. We also explore web interaction, graphics technology, and digital experiences.',
    second: 'We maintain open-source projects on GitHub and share technical articles, experiments, and engineering notes through GopherAtlas. Together, they document what we build and the decisions we make along the way.',
  },
  collections: {
    label: 'PROJECT ARCHIVE', source: 'View Source', site: 'Visit Website', releases: 'View Releases',
    descriptions: [
      'A customizable browser start page and resource discovery platform for the furry community.',
      'An open-source browser toolbox built for furry creators.',
      'A technical publication for Go developers, bringing together original engineering notes, curated articles, and topic-based reading.',
      'A lightweight, self-hosted uptime monitoring and alerting tool for HTTP/HTTPS services.',
      'A high-speed rhythm flight game where every visual and every note is generated at runtime.',
    ],
    statuses: ['In Development', 'In Development', 'Ongoing', 'Released', 'In Development'],
  },
  practice: {
    intro: "We care about more than getting features to work. We ask why they matter, how people will use them, and whether they'll stand the test of time.",
    titles: ['Useful First', 'Experience First', 'Built to Last'],
    carousel: 'Principles carousel', pagination: 'Choose a principle', previous: 'Previous Principle', next: 'Next Principle',
    pause: 'Pause Autoplay', resume: 'Resume Autoplay',
  },
  closing: { intro: "Want to talk about software, open source, or interactive design? We'd love to hear from you.", contact: 'Get in Touch', links: 'More LibreCosta links' },
  sections: { opening: 'Opening', studio: 'Studio', collections: 'Archive', practice: 'Practice', closing: 'Contact' },
} as const;
