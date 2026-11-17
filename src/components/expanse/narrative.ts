export const observationCodes = { bones: 'S01', ruin: 'S02', ring: 'S03', airship: 'S04', dune: 'S05' } as const;
export type ObservationId = keyof typeof observationCodes;
export const observationIds = Object.keys(observationCodes) as ObservationId[];

export const narrativeTiming = {
  city: .55,
  arrival: .965,
  arrivalHoldSeconds: 2,
  brandSettledPath: .99995,
  brandExitPixels: 2,
} as const;

export const witnessSequence = [
  { id: '01', path: 0 },
  { id: '02', path: narrativeTiming.city },
  { id: '03', path: narrativeTiming.arrival },
] as const;

export type WitnessId = typeof witnessSequence[number]['id'];
export type NarrativeEndpoint = 'away' | 'near' | 'reached';
