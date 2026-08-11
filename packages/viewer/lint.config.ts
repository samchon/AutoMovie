import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Viewer evidence is partitioned by the runtime surface that can truthfully
 * implement each contract. A renderer adapter does not answer for camera
 * authorship, and a scene observer does not answer for publication authority.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "viewer cameras implement projection and visible-frame requirements",
      type: "typescript",
      files: ["src/buildScene.ts", "src/captureSize.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/camera/clipping-occlusion-and-spatial-constraints.md",
          "requirements/camera/projection-lens-and-sensor.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer cameras implement projection and visible-frame specifications",
      type: "typescript",
      files: ["src/buildScene.ts", "src/captureSize.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/camera-light-and-visibility/camera-state-projection-and-gate.md",
          "specifications/camera-light-and-visibility/visibility-and-image-space-observation.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer lights implement resolved illumination requirements",
      type: "typescript",
      files: [
        "src/applyLightMotion.ts",
        "src/buildScene.ts",
        "src/sceneEnvironment.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/lighting/budgets-and-representation.md",
          "requirements/lighting/color-exposure-and-display-boundary.md",
          "requirements/lighting/shadows-reflections-and-transmission.md",
          "requirements/lighting/sources-and-photometry.md",
          "requirements/lighting/sun-sky-and-environment.md",
          "requirements/lighting/temporal-state-and-continuity.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer lights implement resolved illumination specifications",
      type: "typescript",
      files: [
        "src/applyLightMotion.ts",
        "src/buildScene.ts",
        "src/sceneEnvironment.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/camera-light-and-visibility/light-source-photometry-and-environment.md",
          "specifications/camera-light-and-visibility/light-transport-color-and-budget.md",
          "specifications/camera-light-and-visibility/temporal-state-and-continuity.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer playback implements staged performance requirements",
      type: "typescript",
      files: [
        "src/applyExpression.ts",
        "src/applyObjectMotion.ts",
        "src/applyPose.ts",
        "src/AutoMoviePlayer.ts",
        "src/propArticulation.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/staging/events-and-timing.md",
          "requirements/staging/interactions-and-choreography.md",
          "requirements/staging/state-handoff-and-continuity.md",
          "requirements/staging/subjects-and-object-staging.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer playback implements staged performance specifications",
      type: "typescript",
      files: [
        "src/applyExpression.ts",
        "src/applyObjectMotion.ts",
        "src/applyPose.ts",
        "src/AutoMoviePlayer.ts",
        "src/propArticulation.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md",
          "specifications/performance-motion-and-staging/motion-sampling-and-composition.md",
          "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
          "specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md",
          "specifications/performance-motion-and-staging/staging-space-state-and-choreography.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer formations implement staged group requirements",
      type: "typescript",
      files: [
        "src/formation.ts",
        "src/formationCycle.ts",
        "src/instanceSet.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/staging/budgets-safety-and-validation.md",
          "requirements/staging/marks-zones-and-blocking.md",
          "requirements/staging/shot-contracts-and-deliveries.md",
          "requirements/staging/visibility-and-readability.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer formations implement staged group specifications",
      type: "typescript",
      files: [
        "src/formation.ts",
        "src/formationCycle.ts",
        "src/instanceSet.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md",
          "specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md",
          "specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer scene materialization implements render-state requirements",
      type: "typescript",
      files: [
        "src/buildModel.ts",
        "src/buildSpace.ts",
        "src/effect.ts",
        "src/fluidSurface.ts",
        "src/geometry.ts",
        "src/importedModel.ts",
        "src/plantingInstances.ts",
        "src/softBodySurface.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/rendering/geometry-visibility-and-culling.md",
          "requirements/rendering/materials-lighting-and-color.md",
          "requirements/rendering/scene-lowering-and-runtime-state.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer scene materialization implements render-state specifications",
      type: "typescript",
      files: [
        "src/buildModel.ts",
        "src/buildSpace.ts",
        "src/effect.ts",
        "src/fluidSurface.ts",
        "src/geometry.ts",
        "src/importedModel.ts",
        "src/plantingInstances.ts",
        "src/softBodySurface.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
          "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer passes and capture implement render-product requirements",
      type: "typescript",
      files: [
        "src/applyDissolve.ts",
        "src/captureSize.ts",
        "src/mount.ts",
        "src/renderMode.ts",
        "src/sceneEnvironment.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/rendering/frame-schedules-and-sampling.md",
          "requirements/rendering/headless-and-platform-determinism.md",
          "requirements/rendering/materials-lighting-and-color.md",
          "requirements/rendering/passes-channels-and-products.md",
          "requirements/rendering/validation.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer passes and capture implement render-product specifications",
      type: "typescript",
      files: [
        "src/applyDissolve.ts",
        "src/captureSize.ts",
        "src/mount.ts",
        "src/renderMode.ts",
        "src/sceneEnvironment.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
          "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer observations implement review-evidence requirements",
      type: "typescript",
      files: [
        "src/analysisOverlay.ts",
        "src/renderObservation.ts",
        "src/semanticMask.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/rendering/budgets.md",
          "requirements/rendering/passes-channels-and-products.md",
          "requirements/rendering/validation.md",
          "requirements/review/annotations-findings-and-verdicts.md",
          "requirements/review/criteria-and-comparison.md",
          "requirements/review/frame-range-and-whole-work.md",
          "requirements/review/records-and-completeness.md",
          "requirements/review/reproducible-context.md",
          "requirements/review/scope-and-authority.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer observations implement review-evidence specifications",
      type: "typescript",
      files: [
        "src/analysisOverlay.ts",
        "src/renderObservation.ts",
        "src/semanticMask.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
          "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
          "specifications/review-and-acceptance/criteria-tolerance-and-comparison.md",
          "specifications/review-and-acceptance/evidence-freshness-and-completeness.md",
          "specifications/review-and-acceptance/observations-findings-and-defects.md",
          "specifications/review-and-acceptance/surfaces-and-sampling.md",
          "specifications/review-and-acceptance/target-scope-and-context.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer scene placement implements staging-space requirements",
      type: "typescript",
      files: ["src/buildScene.ts", "src/buildSpace.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/staging/marks-zones-and-blocking.md",
          "requirements/staging/scope-and-source-of-truth.md",
          "requirements/staging/subjects-and-object-staging.md",
          "requirements/staging/visibility-and-readability.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "viewer scene placement implements staging-space specifications",
      type: "typescript",
      files: ["src/buildScene.ts", "src/buildSpace.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/staging-space-state-and-choreography.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
  ],
};

export default {
  extends: "../../config/lint.config.ts",
  plugins: { evidence },
  rules: {
    "evidence/documented": [
      "error",
      { symbol: ["type", "function", "property"] },
    ],
    "evidence/graph": ["error", graph],
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
