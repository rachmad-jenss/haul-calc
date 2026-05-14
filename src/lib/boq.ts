import type { PavementLayer } from "@/lib/types";
import type { BoqGeometry } from "@/lib/store";

// Standard bulk densities in t/m³
const DENSITY: Record<string, number> = {
  "wearing course": 2.3,
  "base course": 2.2,
  "base": 2.2,
  "sub-base": 2.0,
  "selected fill": 1.8,
  "subgrade": 1.6,
};

function densityFor(layerName: string): number {
  const key = layerName.toLowerCase();
  for (const [k, v] of Object.entries(DENSITY)) {
    if (key.includes(k)) return v;
  }
  // Fallback: try first word of each density key
  for (const [k, v] of Object.entries(DENSITY)) {
    const firstWord = k.split(" ")[0];
    if (key.includes(firstWord)) return v;
  }
  return 2.0; // default
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
    const density = densityFor(layer.name);
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
