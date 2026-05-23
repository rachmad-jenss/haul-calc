import type { CustomMaterialEntry, CustomMaterialRequest } from "@/lib/types";

/** Strip client-side `id` before JSON-RPC (haul-pave `CustomMaterial`). */
export function customMaterialsToRpc(
  materials: CustomMaterialEntry[],
): CustomMaterialRequest[] | undefined {
  if (materials.length === 0) return undefined;
  return materials.map(
    ({ id: _id, ...m }) =>
      ({
        name: m.name,
        material_type: m.material_type,
        elastic_modulus_mpa: m.elastic_modulus_mpa,
        cbr_percent: m.cbr_percent,
        poisson_ratio: m.poisson_ratio,
        layer_coefficient: m.layer_coefficient,
        thickness_mm: m.thickness_mm,
        description: m.description,
      }) satisfies CustomMaterialRequest,
  );
}
