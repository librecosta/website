export type WitnessRecord = { id: string; lines: readonly string[] };

export const witnessRecords = {
  opening: { id: '01', lines: ['我...在哪？', '那是什么？'] },
  passage: { id: '02', lines: ['城市...', '似乎和我记忆中的不同...'] },
  arrival: { id: '03', lines: ['我想……进去看看。'] },
} as const satisfies Record<string, WitnessRecord>;

export const observationRecords = {
  bones: { id: 'S01', name: '沙中遗骸', lines: ['动物骸骨……', '这片苍白的荒原，曾经也有生命。'] },
  ruin: { id: 'S02', name: '信号塔遗迹', lines: ['信号塔……它应该能收发信号。', '不过已经废弃了。'] },
  ring: { id: 'S03', name: '断续的巨环', lines: ['无声运转的巨环，在沙暴之中也能看见。', '令人震惊。'] },
  airship: { id: 'S04', name: '远航飞艇', lines: ['庞大的飞艇，或许承载着许多人的梦想。'] },
  dune: { id: 'S05', name: '风成沙丘', lines: ['或许是风沙的沉积造就了这片土地。'] },
} as const satisfies Record<string, WitnessRecord & { name: string }>;

export type ObservationId = keyof typeof observationRecords;
export const observationIds = Object.keys(observationRecords) as ObservationId[];

export const expanseBrand = {
  title: '从荒原，到远岸。',
  description: ['我们用心创造软件、工具与数字体验。', '敢于想象，同时也付出实践。'],
  signature: 'LibreCosta · 远岸开物',
} as const;

export const narrativeTiming = {
  city: .55,
  arrival: .965,
  arrivalHoldSeconds: 2,
  brandSettledPath: .99995,
  brandExitPixels: 2,
} as const;

export const witnessSequence = [
  { ...witnessRecords.opening, path: 0 },
  { ...witnessRecords.passage, path: narrativeTiming.city },
  { ...witnessRecords.arrival, path: narrativeTiming.arrival },
] as const;
export type WitnessId = typeof witnessSequence[number]['id'];
export type NarrativeEndpoint = 'away' | 'near' | 'reached';
