import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicSurface = [
  "src/AutoMovieApplication.ts",
  "src/convert.ts",
  "src/createAutoMovieMcpServer.ts",
  "src/dto.ts",
  "src/project/AutoMovieProject.ts",
  "src/project/commitLock.ts",
  "src/production/acceptanceScope.ts",
  "src/production/assetAcquisition.ts",
  "src/production/AutoMovieLegacyImporter.ts",
  "src/production/AutoMovieProductionCompiler.ts",
  "src/production/AutoMovieProductionContext.ts",
  "src/production/AutoMovieProductionGuideService.ts",
  "src/production/AutoMovieProductionOracleService.ts",
  "src/production/AutoMovieProductionProject.ts",
  "src/production/AutoMovieProductionReviewService.ts",
  "src/production/captureRuntimeIdentity.ts",
  "src/production/contentIdentity.ts",
  "src/production/decodeProductionAudioAsset.ts",
  "src/production/designReferenceDiagnostics.ts",
  "src/production/diagnosticCatalog.ts",
  "src/production/filmGrammarDiagnostics.ts",
  "src/production/filmTimeline.ts",
  "src/production/inspectDesignReferenceAsset.ts",
  "src/production/linkProductionSource.ts",
  "src/production/materializeProduction.ts",
  "src/production/muxProductionFeatureMp4.ts",
  "src/production/openAutoMovieProduction.ts",
  "src/production/probeProductionMedia.ts",
  "src/production/productionArchetypes.ts",
  "src/production/productionPublicationSnapshot.ts",
  "src/production/productionRegistry.ts",
  "src/production/productionRenderGc.ts",
  "src/production/productionRenderJob.ts",
  "src/production/renditionIdentity.ts",
  "src/production/renderIdentity.ts",
  "src/production/rootNamespaceLock.ts",
  "src/production/sandboxEngineBridge.ts",
  "src/production/sandboxEngineSurface.ts",
  "src/production/storySyncDiagnostics.ts",
  "src/production/trimProductionAudioPresentation.ts",
  "src/production/validateProductionDesign.ts",
];

const requirementReadmes = ["requirements/**/README.md"];
const requirementContent = [
  "requirements/**/*.md",
  "!requirements/**/README.md",
];
const specificationReadmes = ["specifications/**/README.md"];
const specificationContent = [
  "specifications/**/*.md",
  "!specifications/**/README.md",
];

/**
 * The public MCP surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public MCP exports implement requirements",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: requirementReadmes,
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: requirementContent,
          symbol: "h3",
        },
      ],
    },
    {
      name: "public MCP exports implement specifications",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: specificationReadmes,
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: specificationContent,
          symbol: "h3",
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
