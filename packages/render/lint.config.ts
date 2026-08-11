import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const H2_ONLY_MARKDOWN = new Set([
  "specifications/editorial-render-and-delivery/rational-timeline-and-composition.md",
  "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
  "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
  "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
  "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
]);

const markdownReferences = (files: string[]): ITtscEvidenceGraphReference[] => {
  const readmes = files.filter((file) => file.endsWith("/README.md"));
  const h2Only = files.filter((file) => H2_ONLY_MARKDOWN.has(file));
  const h3 = files.filter(
    (file) => !file.endsWith("/README.md") && !H2_ONLY_MARKDOWN.has(file),
  );
  return [
    {
      type: "markdown",
      root: "../../docs",
      files: readmes,
      symbol: ["h1", "h2", "h3"],
    },
    ...(h3.length === 0
      ? []
      : [
          {
            type: "markdown" as const,
            root: "../../docs",
            files: h3,
            symbol: ["h3" as const],
          },
        ]),
    ...(h2Only.length === 0
      ? []
      : [
          {
            type: "markdown" as const,
            root: "../../docs",
            files: h2Only,
            symbol: ["h2" as const],
          },
        ]),
  ];
};

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "model serialization implements bounded representation requirements",
      type: "typescript",
      files: ["src/exportModel.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/asset-authoring/README.md",
        "requirements/asset-authoring/representations-bounds-and-lod.md",
        "requirements/product/README.md",
        "requirements/product/scope-and-exclusions.md",
      ]),
    },
    {
      name: "model serialization implements bounded representation specifications",
      type: "typescript",
      files: ["src/exportModel.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/asset-and-representation/README.md",
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
      ]),
    },
    {
      name: "screenplay formatting implements editorial text requirements",
      type: "typescript",
      files: ["src/screenplay.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/captions-subtitles-and-cues.md",
        "requirements/story/README.md",
        "requirements/story/scenes-and-observable-action.md",
      ]),
    },
    {
      name: "screenplay formatting implements editorial text specifications",
      type: "typescript",
      files: ["src/screenplay.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
        "specifications/narrative-and-intent/README.md",
        "specifications/narrative-and-intent/story-authority-and-hierarchy.md",
      ]),
    },
    {
      name: "caption sidecars implement timed-text requirements",
      type: "typescript",
      files: ["src/caption*.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/captions-subtitles-and-cues.md",
        "requirements/rendering/README.md",
        "requirements/rendering/frame-schedules-and-sampling.md",
      ]),
    },
    {
      name: "caption sidecars implement delivery specifications",
      type: "typescript",
      files: ["src/caption*.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
      ]),
    },
    {
      name: "pose sidecars implement control-pass requirements",
      type: "typescript",
      files: ["src/poseKeypoint*.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/rendering/README.md",
        "requirements/repaint/README.md",
        "requirements/repaint/source-frames-and-reference-locking.md",
      ]),
    },
    {
      name: "pose sidecars implement control-pass specifications",
      type: "typescript",
      files: ["src/poseKeypoint*.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
      ]),
    },
    {
      name: "render planning implements schedule and pass requirements",
      type: "typescript",
      files: ["src/guidePasses.ts", "src/plan.ts", "src/sequenceRenderPlan.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/editorial/README.md",
        "requirements/editorial/rational-time-and-ranges.md",
        "requirements/rendering/README.md",
        "requirements/rendering/encoding-and-multiplexing.md",
        "requirements/rendering/frame-schedules-and-sampling.md",
        "requirements/rendering/passes-channels-and-products.md",
        "requirements/rendering/scope-and-artifact-identity.md",
      ]),
    },
    {
      name: "render planning implements schedule and pass specifications",
      type: "typescript",
      files: ["src/guidePasses.ts", "src/plan.ts", "src/sequenceRenderPlan.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/rational-timeline-and-composition.md",
        "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
        "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
      ]),
    },
    {
      name: "render execution implements capture and encode requirements",
      type: "typescript",
      files: [
        "src/renderAndSee.ts",
        "src/renderVideo.ts",
        "src/sequenceRenderVideo.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/rendering/README.md",
        "requirements/rendering/encoding-and-multiplexing.md",
        "requirements/rendering/frame-schedules-and-sampling.md",
        "requirements/rendering/scope-and-artifact-identity.md",
      ]),
    },
    {
      name: "render execution implements capture and encode specifications",
      type: "typescript",
      files: [
        "src/renderAndSee.ts",
        "src/renderVideo.ts",
        "src/sequenceRenderVideo.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
      ]),
    },
    {
      name: "chunk planning implements bounded render requirements",
      type: "typescript",
      files: ["src/chunkSequenceRender.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/rendering/README.md",
        "requirements/rendering/chunks-resume-and-recovery.md",
      ]),
    },
    {
      name: "chunk planning implements bounded render specifications",
      type: "typescript",
      files: ["src/chunkSequenceRender.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
      ]),
    },
    {
      name: "headless capture implements platform and pass requirements",
      type: "typescript",
      files: ["src/headlessCapture.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/rendering/README.md",
        "requirements/rendering/headless-and-platform-determinism.md",
        "requirements/rendering/passes-channels-and-products.md",
      ]),
    },
    {
      name: "headless capture implements platform and pass specifications",
      type: "typescript",
      files: ["src/headlessCapture.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-products-visibility-and-color.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
      ]),
    },
    {
      name: "render budget evidence implements measurement requirements",
      type: "typescript",
      files: ["src/renderBudgetPreflight.ts", "src/renderObservationAudit.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/rendering/README.md",
        "requirements/rendering/budgets.md",
      ]),
    },
    {
      name: "render budget evidence implements measurement specifications",
      type: "typescript",
      files: ["src/renderBudgetPreflight.ts", "src/renderObservationAudit.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
      ]),
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
