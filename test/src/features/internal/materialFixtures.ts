import type {
  IAutoMovieMaterialAssembly,
  IAutoMovieMaterialLayer,
  IAutoMovieMaterialSubstance,
} from "@automovie/interface";

/**
 * Builders for layered material build-ups.
 *
 * Every field a case does not care about gets a valid default, so a case that
 * pins one defect states only that defect and a reader can tell the deliberate
 * property from the scaffolding around it.
 */
export const substance = (
  id: string,
  overrides: Partial<IAutoMovieMaterialSubstance> = {},
): IAutoMovieMaterialSubstance => ({
  id,
  name: null,
  classification: "authored",
  density: null,
  thermalConductivity: null,
  specificHeat: null,
  soundAbsorption: null,
  vapourResistance: null,
  serviceLife: null,
  surface: null,
  ...overrides,
});

export const layer = (
  id: string,
  thickness: number,
  overrides: Partial<IAutoMovieMaterialLayer> = {},
): IAutoMovieMaterialLayer => ({
  id,
  role: id,
  substance: "solid",
  thickness,
  material: `${id}-substance`,
  finish: false,
  wrapsOpening: false,
  ...overrides,
});

export const assembly = (
  layers: IAutoMovieMaterialLayer[],
  overrides: Partial<IAutoMovieMaterialAssembly> = {},
): IAutoMovieMaterialAssembly => ({
  id: "build-up",
  axis: "z",
  sense: "positive",
  offset: 0,
  faces: { first: "concealed", last: "concealed" },
  layers,
  ...overrides,
});
