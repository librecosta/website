export type WitnessRecord = { id: string; lines: readonly string[] };

export const witnessRecords = {
  opening: { id: '01', lines: ['我...在哪？', '那是什么？'] },
  passage: { id: '02', lines: ['城市...', '似乎和我记忆中的不同...'] },
  arrival: { id: '03', lines: ['我想……进去看看。'] },
} as const satisfies Record<string, WitnessRecord>;

export const expanseBrand = {
  title: '从荒原，到远岸。',
  description: '我们用心创造软件、工具与数字体验，为想象付出实践。',
  signature: 'LibreCosta · 远岸开物',
  actions: ['探索作品', '了解我们'],
} as const;

export type NarrativeBeat = keyof typeof witnessRecords | 'brand';
export type NarrativeCue = { beat: NarrativeBeat; animate: boolean } | null;

export const narrativeTiming = {
  // Path coordinates. The left ruin clears before the city entry, and the
  // central axis has settled into its last composition by the arrival entry.
  city: [.55, .76],
  arrival: .965,
  // Fractions of the stationary hold after the camera reaches u=1.
  logFade: [.18, .38],
  brandStart: .57,
} as const;
