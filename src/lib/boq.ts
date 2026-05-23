import type { MaterialType, PavementLayer } from "@/lib/types";
import type { BoqGeometry } from "@/lib/store";

/** Bulk density hints by haul-pave material type [t/m³]. */
export const DENSITY_BY_MATERIAL_TYPE: Record<MaterialType, number> = {
  granular: 2.0,
  stabilized: 2.2,
  asphalt: 2.3,
  concrete: 2.4,
};

// Name-based fallbacks for catalog / default layer splits (no material_type on wire)
const DENSITY_BY_NAME: Record<string, number> = {
  "wearing course": 2.3,
  "surface": 2.3,
  "asphalt": 2.3,
  "base course": 2.2,
  base: 2.2,
  "sub-base": 2.0,
  "selected fill": 1.8,
  subgrade: 1.6,
  concrete: 2.4,
};

function densityForName(layerName: string): number {
  const key = layerName.toLowerCase();
  const byLength = Object.entries(DENSITY_BY_NAME).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [k, v] of byLength) {
    if (key.includes(k)) return v;
  }
  return 2.0;
}

function densityFromMaterialType(type: string): number | undefined {
  if (type in DENSITY_BY_MATERIAL_TYPE) {
    return DENSITY_BY_MATERIAL_TYPE[type as MaterialType];
  }
  return undefined;
}

export function densityForLayer(layer: PavementLayer): number {
  if (layer.material_type) {
    const fromType = densityFromMaterialType(layer.material_type);
    if (fromType !== undefined) return fromType;
  }
  return densityForName(layer.name);
}

export interface BoqRow {
  layer: string;
  thicknessMm: number;
  areaM2: number;
  volumeM3: number;
  massT: number;
  densityTm3: number;
}

export function computeBoq(layers: PavementLayer[], geometry: BoqGeometry): BoqRow[] {
  const lengthM = geometry.roadLengthKm * 1000;
  const totalWidthM = geometry.roadWidthM + 2 * geometry.shoulderWidthM;
  const areaM2 = lengthM * totalWidthM;

  return layers.map((layer) => {
    const thicknessM = layer.thickness_mm / 1000;
    const volumeM3 = areaM2 * thicknessM;
    const density = densityForLayer(layer);
    const massT = volumeM3 * density;
    return {
      layer: layer.name,
      thicknessMm: layer.thickness_mm,
      areaM2,
      volumeM3,
      massT,
      densityTm3: density,
    };
  });
}
