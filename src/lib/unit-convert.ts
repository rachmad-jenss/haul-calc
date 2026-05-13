export type UnitSystem = 'SI' | 'Imperial';

export const unitLabels = {
  SI: {
    payload: 'kN',
    thickness: 'mm',
    distance: 'km',
    force: 'kN',
  },
  Imperial: {
    payload: 'kips',
    thickness: 'in',
    distance: 'mi',
    force: 'kips',
  },
} as const;

export function convertPayload(kn: number, system: UnitSystem): number {
  return system === 'Imperial' ? kn * 0.2248089 : kn;
}

export function convertThickness(mm: number, system: UnitSystem): number {
  return system === 'Imperial' ? mm / 25.4 : mm;
}

export function convertDistance(km: number, system: UnitSystem): number {
  return system === 'Imperial' ? km * 0.621371 : km;
}
