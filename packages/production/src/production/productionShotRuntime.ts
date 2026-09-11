import {
  IAutoMovieActorContext,
  validateBuiltEnvironment,
  validateDesignLineage,
  validateModel,
  validatePropPlacements,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieDefinedShotContract,
  IAutoMovieDiagnostic,
  IAutoMovieModel,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
  IAutoMovieShotContract,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { buildingBoundDiagnostics } from "./productionEnvironmentValidation";
import {
  IAutoMovieSourceContentFinding,
  autoMovieSourceContentDiagnostic,
  autoMovieSourceContentFinding,
  autoMovieValidationFindings,
} from "./sourceContentDiagnostics";
import { createAutoMovieSourceRuntimeModelRegistry } from "./sourceRuntimeModelRegistry";

interface ISourceRuntime {
  runtimeModels: Readonly<Record<string, IAutoMovieModel>>;
  models: IAutoMovieModel[];
  authoredModels: IAutoMovieModel[];
  diagnostics: IAutoMovieDiagnostic[];
}

/** Validate and bind models and buildings created by deterministic shot code. */
export const sourceRuntimeOf = (props: {
  program: IAutoMovieProductionShotProgram;
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
  target: string;
  sourcePath: string;
}): ISourceRuntime => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const authoredModels: IAutoMovieModel[] = [];
  const authoredDigests = new Map<string, AutoMovieContentDigest>();
  const registry = createAutoMovieSourceRuntimeModelRegistry(
    props.runtimeModels,
  );
  const runtimeIds = new Set([
    ...registry.keys(),
    ...registry.values().map((model) => model.id),
  ]);

  const report = (message: string): void => {
    diagnostics.push({
      code: "source-scene-content-invalid",
      category: "error",
      phase: "source",
      target: props.target,
      path: props.sourcePath,
      message,
    });
  };
  /**
   * Report one finding under the identity and severity its kind decides.
   *
   * `report` above is for the checks this builder performs itself, where there
   * is no engine classification to preserve and the answer is always a blocking
   * content error. Anything a validator found comes through here instead, so a
   * physical conflict and a coverage gap keep their own catalog entries and a
   * warning stays a warning.
   */
  const classify = (finding: IAutoMovieSourceContentFinding): void => {
    diagnostics.push(
      autoMovieSourceContentDiagnostic({
        finding,
        target: props.target,
        path: props.sourcePath,
      }),
    );
  };
  const acceptModel = (
    model: IAutoMovieModel,
    modelPath: string,
    /** The registered appearance this model borrows, when a prop cites one. */
    modelRef: string | null = null,
  ): void => {
    const digest = digestAutoMovieBytes(canonicalAutoMovieJsonBytes(model));
    const existing = authoredDigests.get(model.id);
    if (existing !== undefined) {
      if (existing !== digest)
        report(
          `${modelPath}.id "${model.id}" conflicts with another source-owned model of the same id. Keep one byte-identical generated model per id.`,
        );
      return;
    }
    authoredDigests.set(model.id, digest);
    if (runtimeIds.has(model.id)) {
      report(
        `${modelPath}.id "${model.id}" shadows a builder-owned runtime model. Rename the source model or cite the existing runtime id.`,
      );
      return;
    }
    // A prop that cites a registered appearance is the one case where source
    // may hand back an imported model, and it is only allowed to hand back the
    // one the builder already sealed. Everything the prop means -- its proxy
    // parts, its body, its affordances, its articulation -- stays in the
    // record, so borrowing bytes never buys an escape from the semantics.
    if (modelRef === null) {
      if (model.origin !== "generated")
        report(
          `${modelPath}.origin is "${model.origin}". Shot source may create generated geometry only; register imported asset bytes in the production model registry and cite that runtime id.`,
        );
    } else {
      const registered = registry.resolve(modelRef);
      if (registered === undefined)
        report(
          `${modelPath} cites modelRef "${modelRef}", which does not resolve to a builder-owned runtime model. Register the asset or model recipe, or drop the reference.`,
        );
      else if (
        registered.imported === undefined ||
        registered.imported === null
      )
        report(
          `${modelPath} cites modelRef "${modelRef}", which is not a registered external appearance. Register glTF, GLB or VRM bytes for it, or drop the reference.`,
        );
      else if (
        digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(registered.imported),
        ) !==
        digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(model.imported ?? null),
        )
      )
        report(
          `${modelPath}.imported is not the closure the builder sealed for "${modelRef}". Restate the registered closure verbatim, or recompile after registering the asset again.`,
        );
      else if (model.asset !== registered.asset)
        report(
          `${modelPath}.asset "${String(model.asset)}" is not the registered appearance "${String(registered.asset)}" of "${modelRef}".`,
        );
    }
    const validation = validateModel({ model });
    if (validation.success === false)
      for (const violation of validation.violations)
        report(
          `${modelPath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the source-owned model before compiling the shot.`,
        );
    // A cited appearance is judged by the reference checks rather than by its
    // origin, so it is allowed past here; a source-authored import is not, for
    // the same reason it was refused above.
    if (
      validation.success === false ||
      (modelRef === null && model.origin !== "generated")
    )
      return;
    authoredModels.push(model);
    registry.define(model.id, model);
  };

  (props.program.models ?? []).forEach((model, index) =>
    acceptModel(model, `$program.models[${index}]`),
  );
  (props.program.props ?? []).forEach((prop, index) =>
    acceptModel(
      prop.model,
      `$program.props[${index}].model`,
      prop.modelRef ?? null,
    ),
  );
  (props.program.builtEnvironments ?? []).forEach((environment, index) => {
    const environmentPath = `$program.builtEnvironments[${index}]`;
    const validation = validateBuiltEnvironment({ environment });
    if (validation.success === false)
      for (const violation of validation.violations)
        report(
          `${environmentPath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the code-authored building before compiling the shot.`,
        );
    environment.models.forEach((model, modelIndex) =>
      acceptModel(model, `${environmentPath}.models[${modelIndex}]`),
    );
    environment.modelReferences.forEach((id, referenceIndex) => {
      if (registry.resolve(id) === undefined)
        report(
          `${environmentPath}.modelReferences[${referenceIndex}] "${id}" does not resolve to a builder-owned runtime model. Register the asset/model recipe or remove the reference.`,
        );
    });
  });

  // Lineage is checked for coherence here, where the shot that authored it is
  // in hand, and bound to published identities later, where the production's
  // assets are. Splitting it that way is what lets a phase cite a texture the
  // shot itself never names.
  (props.program.designLineages ?? []).forEach((lineage, index) => {
    const lineagePath = `$program.designLineages[${index}]`;
    for (const violation of autoMovieValidationFindings(
      validateDesignLineage({ lineage }),
    ))
      classify(
        autoMovieSourceContentFinding(
          violation,
          `${lineagePath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the construction phase, alternative or derivation record before compiling the shot.`,
        ),
      );
  });

  for (const finding of buildingBoundDiagnostics(props.program))
    classify(finding);

  for (const violation of autoMovieValidationFindings(
    validatePropPlacements({
      props: props.program.props ?? [],
      set: props.program.stage.set ?? [],
      builtEnvironments: props.program.builtEnvironments ?? [],
    }),
  ))
    classify(
      autoMovieSourceContentFinding(
        violation,
        `${violation.path} ${violation.expected}. Correct the code-authored prop registry or staged placement before compiling the shot.`,
      ),
    );

  const available = new Set([
    ...registry.keys(),
    ...registry.values().map((model) => model.id),
  ]);
  (props.program.stage.set ?? []).forEach((piece, index) => {
    if (!available.has(piece.model))
      report(
        `$program.stage.set[${index}].model "${piece.model}" is unavailable. Add a generated source model or cite a builder-owned runtime model.`,
      );
  });

  return {
    runtimeModels: registry.record,
    models: registry.values(),
    authoredModels,
    diagnostics,
  };
};

/** Remove source-module binding fields from the contract passed to defineShot. */
export const contractOfRegistration = (
  contract: IAutoMovieShotContract,
): IAutoMovieDefinedShotContract => {
  const { id: _id, source: _source, ...registration } = contract;
  return registration;
};

interface IShotActorRuntime {
  actors: Map<string, IAutoMovieActorContext>;
  nodes: Map<string, IAutoMovieVector3>;
  models: Map<string, IAutoMovieModel>;
  diagnostics: IAutoMovieDiagnostic[];
}

/** Bind a thin program's actor facts to builder-owned runtime models. */
export const actorRuntimeOf = (
  program: IAutoMovieProductionShotProgram,
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"],
  target = `shot:${program.blocking.beat}`,
  sourcePath: string | null = null,
): IShotActorRuntime => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const actors = new Map<string, IAutoMovieActorContext>();
  const models = new Map<string, IAutoMovieModel>();
  const modelRegistry =
    createAutoMovieSourceRuntimeModelRegistry(runtimeModels);
  const stageActors = new Map(
    program.stage.actors.map((actor) => [actor.node, actor]),
  );
  program.actors.forEach((actor, index) => {
    const path = `$program.actors[${index}]`;
    const staged = stageActors.get(actor.node);
    const model = modelRegistry.resolve(actor.model);
    const gaitNames = new Set<string>();
    const gaits =
      model?.profiles
        ?.flatMap((profile) => profile.gaits ?? [])
        .filter((gait) => {
          if (gaitNames.has(gait.name)) {
            diagnostics.push({
              code: "source-actor-runtime-invalid",
              category: "error",
              phase: "source",
              target,
              path: sourcePath,
              message: `${path}.model "${actor.model}" supplies duplicate gait "${gait.name}". Keep each builder-owned gait name unique before rebuilding this shot.`,
            });
            return false;
          }
          gaitNames.add(gait.name);
          return true;
        }) ?? [];
    const fact = actors.has(actor.node)
      ? `duplicates actor node "${actor.node}"`
      : staged === undefined
        ? `names actor node "${actor.node}" that is absent from stage.actors`
        : model === undefined
          ? `names unavailable runtime model "${actor.model}"`
          : model.skeleton === null
            ? `names rig-less runtime model "${actor.model}"`
            : Number.isFinite(actor.speed) === false || actor.speed <= 0
              ? `sets speed ${JSON.stringify(actor.speed)} instead of a finite value above zero`
              : Number.isFinite(actor.eyeHeight) === false ||
                  actor.eyeHeight < 0
                ? `sets eyeHeight ${JSON.stringify(actor.eyeHeight)} instead of a finite non-negative value`
                : null;
    if (fact !== null) {
      diagnostics.push({
        code: "source-actor-runtime-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message: `${path} ${fact}. Correct the node/model join or measured actor runtime fact; the builder will not guess a rig, speed, or eye height.`,
      });
      return;
    }
    const boundModel = model!;
    const boundSkeleton = boundModel.skeleton!;
    const placement = staged!;
    actors.set(actor.node, {
      skeleton: boundSkeleton.id,
      gaits,
      position: placement.position,
      speed: actor.speed,
      facingDeg: placement.facingDeg,
      eyeHeight: actor.eyeHeight,
      restPose: {
        skeleton: boundSkeleton.id,
        root: null,
        joints: [],
      },
      rig: boundSkeleton,
    });
    models.set(actor.node, boundModel);
  });
  const clips = new Map<string, number>();
  (program.clips ?? []).forEach((clip, index) => {
    const first = clips.get(clip.id);
    if (clip.id.trim().length === 0 || first !== undefined)
      diagnostics.push({
        code: "source-clip-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message:
          first === undefined
            ? `$program.clips[${index}].id is blank. Give every enact clip one stable non-blank id.`
            : `$program.clips[${index}].id duplicates $program.clips[${first}].id "${clip.id}". Keep one authoritative clip per id.`,
      });
    else clips.set(clip.id, index);
  });
  const actions = program.performance.revise.final ?? program.performance.draft;
  actions.forEach((action, index) => {
    if (action.verb === "enact" && clips.has(action.clip) === false)
      diagnostics.push({
        code: "source-clip-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message: `$program.performance action ${index} enacts absent clip "${action.clip}". Add that exact clip to program.clips or replace enact with a supported thin verb.`,
      });
  });
  const nodes = new Map<string, IAutoMovieVector3>([
    ...program.stage.actors.map(
      (actor) => [actor.node, actor.position] as const,
    ),
    ...(program.stage.set ?? []).map(
      (piece) => [piece.node, piece.position] as const,
    ),
    ...program.stage.cameras.map(
      (camera) => [camera.node, camera.position] as const,
    ),
  ]);
  return { actors, nodes, models, diagnostics };
};
