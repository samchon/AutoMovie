/** Compiler-owned runtime identity for one project model recipe. */
export const productionRuntimeModelId = (recipe: string): string =>
  `automovie:model:${recipe}`;

/** Compiler-owned skeleton identity for one rigged project model recipe. */
export const productionRuntimeSkeletonId = (recipe: string): string =>
  `automovie:skeleton:${recipe}`;
