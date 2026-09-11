import {
  resolveAutoMovieMaterial,
  validateModel,
  validateMotion,
  validateShotArtifact,
} from "@automovie/engine";
import { appendValidation, engineDiagnostic } from "@automovie/engine";
import {
  validateAutoMovieFormationGround,
  validateAutoMovieFormationMotions,
  validateAutoMovieFormationOverlap,
  validateAutoMovieFormationSlotMotions,
} from "@automovie/engine";
import { validateAutoMovieEffects } from "@automovie/engine";
import {
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieShotContract,
} from "@automovie/interface";

import { validateSceneArtifact } from "../validators/artifacts";

export const validateCompiledShot = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const id = contract.id;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (value.shot.id !== id)
    diagnostics.push(
      engineDiagnostic(id, "shot.id", `must equal contract id "${id}"`),
    );
  if (value.shot.duration !== contract.durationSeconds)
    diagnostics.push(
      engineDiagnostic(
        id,
        "shot.duration",
        `must equal contract duration ${contract.durationSeconds}`,
      ),
    );
  appendValidation(
    diagnostics,
    id,
    validateSceneArtifact(value.scene, value.models),
  );
  const motionIds = new Set(value.motions.map((motion) => motion.id));
  appendValidation(
    diagnostics,
    id,
    validateShotArtifact(value.shot, value.scene, motionIds),
  );
  diagnostics.push(...validateAutoMovieFormationMotions(contract, value));
  diagnostics.push(...validateAutoMovieFormationSlotMotions(contract, value));
  diagnostics.push(...validateAutoMovieFormationGround(contract, value));
  diagnostics.push(...validateAutoMovieFormationOverlap(contract, value));
  diagnostics.push(...validateAutoMovieEffects(contract, value));
  for (const model of value.models)
    appendValidation(diagnostics, id, validateModel({ model }));
  diagnostics.push(...validateCompiledMaterialBindings(id, value));
  const skeletons = new Map(
    value.models.flatMap((model) =>
      model.skeleton === null
        ? []
        : [[model.skeleton.id, model.skeleton] as const],
    ),
  );
  for (const motion of value.motions) {
    const skeleton = skeletons.get(motion.skeleton);
    if (skeleton === undefined)
      diagnostics.push(
        engineDiagnostic(
          id,
          `motion:${motion.id}`,
          `references missing skeleton "${motion.skeleton}"`,
        ),
      );
    else
      appendValidation(diagnostics, id, validateMotion({ motion, skeleton }));
  }
  return diagnostics;
};

/** Refuse every simulated-surface material citation that cannot resolve once. */
const validateCompiledMaterialBindings = (
  id: string,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const bindings: Array<{ path: string; material: string | null }> = [
    ...(value.waterFeatures ?? []).map((feature, index) => ({
      path: `waterFeatures[${index}].material`,
      material: feature.material,
    })),
    ...(value.softFurnishings ?? []).map((furnishing, index) => ({
      path: `softFurnishings[${index}].material`,
      material: furnishing.material,
    })),
    ...(value.plantingInstallations ?? []).flatMap((installation, index) => [
      {
        path: `plantingInstallations[${index}].branchMaterial`,
        material: installation.branchMaterial,
      },
      {
        path: `plantingInstallations[${index}].leafMaterial`,
        material: installation.leafMaterial,
      },
    ]),
  ];
  return bindings.flatMap((binding) => {
    if (binding.material === null) return [];
    try {
      resolveAutoMovieMaterial({
        models: value.models,
        material: binding.material,
      });
      return [];
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/\.$/u, "") : `${error}`;
      return [
        engineDiagnostic(
          id,
          binding.path,
          `must resolve to one compiled material definition, but ${message}`,
        ),
      ];
    }
  });
};
