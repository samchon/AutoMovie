import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const contractClaim = (
  name: string,
  files: string[],
  requirements: string[],
  specifications: string[],
): ITtscEvidenceGraphConfig["claims"][number] => ({
  name,
  type: "typescript",
  files,
  symbol: ["type", "function", "property"],
  reference: [
    {
      type: "markdown",
      root: "../../docs",
      files: requirements,
      symbol: ["h2", "h3"],
    },
    {
      type: "markdown",
      root: "../../docs",
      files: specifications,
      symbol: ["h2", "h3"],
    },
  ],
});

/**
 * Public interface contracts answer only for exact documentary files that the
 * selected source modules collectively represent.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    contractClaim(
      "sound propagation and room-response contracts",
      [
        "src/analysis/IAutoMovieEnvironmentContext.ts",
        "src/architecture/IAutoMovieBuiltEnvironment.ts",
        "src/material/IAutoMovieMaterialAssembly.ts",
        "src/production/IAutoMovieProductionDesign.ts",
        "src/production/IAutoMovieProductionSound.ts",
      ],
      [
        "requirements/interior/README.md",
        "requirements/interior/acoustics-and-sound-boundaries.md",
        "requirements/sound/README.md",
        "requirements/sound/event-cues-and-timing.md",
        "requirements/sound/interior-acoustics.md",
        "requirements/sound/spatialization-and-propagation.md",
      ],
      [
        "specifications/interior-space/README.md",
        "specifications/interior-space/lighting-acoustics-and-environment.md",
        "specifications/simulation-effects-and-sound/README.md",
        "specifications/simulation-effects-and-sound/ambience-music-spatial-and-acoustics.md",
        "specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md",
      ],
    ),
    contractClaim(
      "soft-body and moving-boundary contracts",
      [
        "src/soft/IAutoMovieSoftBodyDomain.ts",
        "src/soft/IAutoMovieSoftBodyState.ts",
        "src/soft/IAutoMovieSoftFurnishing.ts",
        "src/skeleton/AutoMovieHumanoidBone.ts",
      ],
      [
        "requirements/actors/README.md",
        "requirements/actors/appearance-costume-and-attachments.md",
        "requirements/effects-and-simulation/README.md",
        "requirements/effects-and-simulation/soft-bodies-and-deformation.md",
        "requirements/motion/README.md",
        "requirements/motion/secondary-motion.md",
      ],
      [
        "specifications/performance-motion-and-staging/README.md",
        "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
        "specifications/simulation-effects-and-sound/README.md",
        "specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md",
      ],
    ),
    contractClaim(
      "external-motion adoption and retarget contracts",
      [
        "src/core/IAutoMovieChannel.ts",
        "src/core/IAutoMovieClip.ts",
        "src/core/IAutoMovieTrack.ts",
        "src/motion/IAutoMovieMotion.ts",
        "src/production/IAutoMovieAssetManifest.ts",
        "src/production/IAutoMovieProductionCompiler.ts",
        "src/production/IAutoMovieProductionDesign.ts",
        "src/skeleton/IAutoMovieSkeleton.ts",
      ],
      [
        "requirements/actors/README.md",
        "requirements/actors/inputs-selection-and-replacement.md",
        "requirements/actors/skeleton-rig-and-retargeting.md",
        "requirements/asset-authoring/README.md",
        "requirements/asset-authoring/external-assets.md",
        "requirements/motion/README.md",
        "requirements/motion/external-motion-inputs.md",
        "requirements/motion/retargeting-and-scale.md",
      ],
      [
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/adoption-decisions-and-composition.md",
        "specifications/interchange-and-adoption/conversion-receipts-and-determinism.md",
        "specifications/performance-motion-and-staging/README.md",
        "specifications/performance-motion-and-staging/motion-sampling-and-composition.md",
        "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
      ],
    ),
    contractClaim(
      "caption readability and delivery contracts",
      [
        "src/production/IAutoMovieProductionCompiler.ts",
        "src/production/IAutoMovieProductionDesign.ts",
        "src/production/IAutoMovieProductionRendition.ts",
        "src/production/IAutoMovieProductionReview.ts",
      ],
      [
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/captions-subtitles-and-cues.md",
      ],
      [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
      ],
    ),
    contractClaim(
      "render observation, budget, and mask contracts",
      ["src/render/**/*.ts", "src/production/IAutoMovieProductionOracle.ts"],
      [
        "requirements/rendering/README.md",
        "requirements/rendering/budgets.md",
        "requirements/rendering/passes-channels-and-products.md",
        "requirements/rendering/validation.md",
      ],
      [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
        "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
      ],
    ),
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
