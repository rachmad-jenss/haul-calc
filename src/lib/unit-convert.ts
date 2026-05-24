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

/** Typical fleet payload guardrails (always evaluated against stored SI kN). */
export const PAYLOAD_TYPICAL_MAX_KN = 5_000;
export const PAYLOAD_TYPICAL_LOW_KN = 200;

export function convertPayload(kn: number, system: UnitSystem): number {
  return system === 'Imperial' ? kn * 0.2248089 : kn;
}

export function convertThickness(mm: number, system: UnitSystem): number {
  return system === 'Imperial' ? mm / 25.4 : mm;
}

export function convertDistance(km: number, system: UnitSystem): number {
  return system === 'Imperial' ? km * 0.621371 : km;
}

export function labelWithUnit(
  name: string,
  system: UnitSystem,
  unit: keyof (typeof unitLabels)['SI'],
): string {
  return `${name} (${unitLabels[system][unit]})`;
}

export function formatForceKn(
  kn: number,
  system: UnitSystem,
  options?: { decimals?: number },
): string {
  const decimals = options?.decimals ?? (system === 'Imperial' ? 0 : 0);
  const value = system === 'Imperial' ? convertPayload(kn, system) : kn;
  const label = unitLabels[system].force;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${label}`;
}

export function formatThicknessMm(
  mm: number,
  system: UnitSystem,
  options?: { decimals?: number },
): string {
  const decimals = options?.decimals ?? (system === 'Imperial' ? 1 : 0);
  const value = convertThickness(mm, system);
  const label = unitLabels[system].thickness;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${label}`;
}
