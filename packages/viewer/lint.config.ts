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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/camera/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/camera/clipping-occlusion-and-spatial-constraints.md",
            "requirements/camera/projection-lens-and-sensor.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer cameras implement projection and visible-frame specifications",
      type: "typescript",
      files: ["src/buildScene.ts", "src/captureSize.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/camera-light-and-visibility/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/camera-light-and-visibility/camera-state-projection-and-gate.md",
            "specifications/camera-light-and-visibility/visibility-and-image-space-observation.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/lighting/README.md"],
          symbol: ["h2", "h3"],
        },
        {
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
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/camera-light-and-visibility/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/camera-light-and-visibility/light-source-photometry-and-environment.md",
            "specifications/camera-light-and-visibility/light-transport-color-and-budget.md",
            "specifications/camera-light-and-visibility/temporal-state-and-continuity.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/motion/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/motion/channels-controls-and-drivers.md",
            "requirements/motion/clips-keyframes-and-interpolation.md",
            "requirements/motion/constraints-and-inverse-kinematics.md",
            "requirements/motion/contact-weight-and-support.md",
            "requirements/motion/layers-blends-and-transitions.md",
            "requirements/motion/object-motion-and-interaction.md",
            "requirements/motion/root-motion-and-trajectories.md",
            "requirements/motion/scope-and-identity.md",
            "requirements/motion/secondary-motion.md",
            "requirements/motion/timing-and-semantic-events.md",
            "requirements/motion/validation-and-determinism.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md",
            "specifications/performance-motion-and-staging/motion-sampling-and-composition.md",
            "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/formations/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/formations/budgets-and-validation.md",
            "requirements/formations/heroes-variation-and-state.md",
            "requirements/formations/hierarchies-and-units.md",
            "requirements/formations/layouts-and-slots.md",
            "requirements/formations/reform-and-group-motion.md",
            "requirements/formations/resolution-culling-and-evidence.md",
            "requirements/formations/scope-and-identity.md",
            "requirements/formations/spacing-overlap-and-avoidance.md",
            "requirements/formations/terrain-and-routes.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md",
            "specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer imported models implement adopted-asset requirements",
      type: "typescript",
      files: ["src/importedModel.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/README.md",
            "requirements/external-inputs/README.md",
            "requirements/motion/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/external-assets.md",
            "requirements/external-inputs/adoption-modes-and-composition.md",
            "requirements/external-inputs/identity-coordinates-and-units.md",
            "requirements/motion/retargeting-and-scale.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer imported models implement adopted-asset specifications",
      type: "typescript",
      files: ["src/importedModel.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/README.md",
            "specifications/interchange-and-adoption/README.md",
            "specifications/performance-motion-and-staging/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/identity-resources-and-lifecycle.md",
            "specifications/interchange-and-adoption/adoption-decisions-and-composition.md",
            "specifications/interchange-and-adoption/identity-coordinates-and-units.md",
            "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer scene materialization implements render-state requirements",
      type: "typescript",
      files: [
        "src/buildModel.ts",
        "src/buildSpace.ts",
        "src/geometry.ts",
        "src/importedModel.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/rendering/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/rendering/geometry-visibility-and-culling.md",
            "requirements/rendering/materials-lighting-and-color.md",
            "requirements/rendering/scene-lowering-and-runtime-state.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer scene materialization implements render-state specifications",
      type: "typescript",
      files: [
        "src/buildModel.ts",
        "src/buildSpace.ts",
        "src/geometry.ts",
        "src/importedModel.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/editorial-render-and-delivery/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
            "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer particle materialization implements bounded effect requirements",
      type: "typescript",
      files: ["src/effect.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/effects-and-simulation/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/effects-and-simulation/budgets-and-bounded-work.md",
            "requirements/effects-and-simulation/clock-seek-and-determinism.md",
            "requirements/effects-and-simulation/particles-and-emission.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer particle materialization implements bounded effect specifications",
      type: "typescript",
      files: ["src/effect.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/simulation-effects-and-sound/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/simulation-effects-and-sound/budget-admission.md",
            "specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md",
            "specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer fluid materialization implements water-surface requirements",
      type: "typescript",
      files: ["src/fluidSurface.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/effects-and-simulation/README.md",
            "requirements/interior/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/effects-and-simulation/clock-seek-and-determinism.md",
            "requirements/effects-and-simulation/environment-coupling.md",
            "requirements/effects-and-simulation/fluids-and-water.md",
            "requirements/interior/water-and-fluid-features.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer fluid materialization implements water-surface specifications",
      type: "typescript",
      files: ["src/fluidSurface.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/README.md",
            "specifications/simulation-effects-and-sound/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/services-wet-and-fluid.md",
            "specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer soft-body materialization implements deformation requirements",
      type: "typescript",
      files: ["src/softBodySurface.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/effects-and-simulation/README.md",
            "requirements/interior/README.md",
            "requirements/motion/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/effects-and-simulation/soft-bodies-and-deformation.md",
            "requirements/interior/soft-materials-plants-and-deformation.md",
            "requirements/motion/secondary-motion.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer soft-body materialization implements deformation specifications",
      type: "typescript",
      files: ["src/softBodySurface.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/README.md",
            "specifications/simulation-effects-and-sound/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/elements-furnishing-and-clearance.md",
            "specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer planting materialization implements vegetation requirements",
      type: "typescript",
      files: ["src/plantingInstances.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/interior/README.md",
            "requirements/map/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/interior/soft-materials-plants-and-deformation.md",
            "requirements/map/vegetation-and-ecology.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer planting materialization implements vegetation specifications",
      type: "typescript",
      files: ["src/plantingInstances.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/README.md",
            "specifications/world-and-site/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/interior-space/elements-furnishing-and-clearance.md",
            "specifications/world-and-site/ecology-weather-and-calendar.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/rendering/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/rendering/frame-schedules-and-sampling.md",
            "requirements/rendering/headless-and-platform-determinism.md",
            "requirements/rendering/materials-lighting-and-color.md",
            "requirements/rendering/passes-channels-and-products.md",
            "requirements/rendering/validation.md",
          ],
          symbol: ["h3"],
        },
      ],
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
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/editorial-render-and-delivery/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
            "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer observations implement render-observation requirements",
      type: "typescript",
      files: [
        "src/analysisOverlay.ts",
        "src/renderObservation.ts",
        "src/semanticMask.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/rendering/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/rendering/budgets.md",
            "requirements/rendering/passes-channels-and-products.md",
            "requirements/rendering/validation.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer observations implement render-observation specifications",
      type: "typescript",
      files: [
        "src/analysisOverlay.ts",
        "src/renderObservation.ts",
        "src/semanticMask.ts",
        "src/snapshot.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/editorial-render-and-delivery/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
            "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer scene placement implements staging-space requirements",
      type: "typescript",
      files: ["src/buildScene.ts", "src/buildSpace.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/staging/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/staging/marks-zones-and-blocking.md",
            "requirements/staging/scope-and-source-of-truth.md",
            "requirements/staging/subjects-and-object-staging.md",
            "requirements/staging/visibility-and-readability.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "viewer scene placement implements staging-space specifications",
      type: "typescript",
      files: ["src/buildScene.ts", "src/buildSpace.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/staging-space-state-and-choreography.md",
          ],
          symbol: ["h3"],
        },
      ],
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
