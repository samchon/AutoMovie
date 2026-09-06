import { digestAutoMovieSemanticMask } from "@automovie/engine";
import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  IAutoMovieModelRecipe,
  IAutoMoviePreviewFrameInput,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionContext,
  AutoMovieProductionProject,
  type IAutoMovieProductionSemanticMaskEvidence,
  captureAutoMovieProductionFrame,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { completedFilmEvidenceConfig } from "../internal/completedFilmFixture";
import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const CRATE: IAutoMovieModelRecipe = {
  id: "crate",
  role: "prop",
  archetype: "primitive-prop",
  parameters: { shape: "box", width: 0.8, height: 0.6, depth: 0.5 },
  palette: { body: "#8a6b3f" },
  lod: [{ tier: "hero", maxDistance: null, recipe: "crate" }],
  capabilities: [],
  attachments: [],
};

/** Complete zero-gap semantic evidence attributed to `shot`. */
const evidenceFor = (
  shot: string,
): IAutoMovieProductionSemanticMaskEvidence => {
  const payload = {
    version: 2,
    protocol: "automovie.semantic-mask.v2",
    background: "#000000",
    entries: [
      {
        id: "node:hero",
        kind: "node",
        label: null,
        color: "#123456",
        owner: null,
        nodes: ["hero"],
        slot: null,
      },
    ],
    unaddressed: [],
  } as unknown as Omit<IAutoMovieSemanticMask, "digest">;
  return {
    version: 1,
    shot,
    mask: { ...payload, digest: digestAutoMovieSemanticMask(payload) },
    coverage: { unresolved: [], unaddressed: 0 },
  };
};

type SemanticMaskObservation = Awaited<
  ReturnType<ReturnType<typeof recordingCapture>["adapter"]>
>["semanticMask"];

/**
 * Semantic-mask evidence rides the capture path only when it is the shot's own
 * mask evidence, and asset previews honor the pose and part the target names.
 *
 * Scenarios:
 *
 * 1. A shot mask frame whose host returns complete same-shot evidence is
 *    receipted with its semantic record, a second mask frame keeps the first
 *    record beside its own, incomplete same-shot evidence is receipted with
 *    its coverage gap, and the receipt reopens through the bundle.
 * 2. A shot mask frame without semantic evidence, a beauty frame carrying
 *    another shot's evidence, and an asset frame carrying any evidence are
 *    refused as capture failures naming the classification, and a context
 *    opened without the compile's own authoring declaration reads the compile
 *    as stale rather than capturing against a foreign identity.
 * 3. Range-of-motion extremes are previewed for a rigged model and refused for
 *    a rigless one; a named compiled part is framed and an unknown part is
 *    refused.
 * 4. A ground geometry query reads the compiled shots of the current compile.
 */
export const test_production_capture_semantic_mask =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      fs.writeFileSync(
        path.join(
          fixture.root,
          "automovie",
          "design",
          "shared",
          "models",
          "crate.json",
        ),
        `${JSON.stringify(CRATE, null, 2)}\n`,
        "utf8",
      );
      const project = AutoMovieProductionProject.open(fixture.root);
      // Review scope admits a shot only through its reviewed source-owner
      // binding, so both compiles read the fixture's own authoring evidence.
      const evidence = readAutoMovieProductionEvidence({
        root: fixture.root,
        productionEvidence: completedFilmEvidenceConfig(fixture.root),
      });
      const compiled = new AutoMovieProductionCompiler(
        project,
        evidence,
        () => evidence,
      ).compile({ scope: "source" });
      if (
        productionCompileSucceeded("semantic capture fixture", compiled) ===
        false
      )
        throw new Error("The semantic-mask capture fixture did not compile.");
      const host = recordingCapture();
      const withSemantic = (
        semanticMask: (
          input: IAutoMoviePreviewFrameInput,
        ) => SemanticMaskObservation,
      ): AutoMovieProductionContext =>
        new AutoMovieProductionContext(
          async (input) => ({
            ...(await host.adapter(input)),
            semanticMask: semanticMask(input),
          }),
          fixture.root,
          undefined,
          undefined,
          evidence,
          () => evidence,
        );
      const notRun: SemanticMaskObservation = {
        status: "not-run",
        reason: "The capture stub derives no semantic mask.",
      };
      const sameShot = withSemantic((input) =>
        input.pass === "mask" && input.target.kind === "shot"
          ? { status: "available", value: evidenceFor(input.target.id) }
          : notRun,
      );
      const shotMask = (
        context: AutoMovieProductionContext,
        time: number,
      ): ReturnType<typeof captureAutoMovieProductionFrame> =>
        captureAutoMovieProductionFrame(context, {
          target: {
            kind: "shot",
            productionId: "fixture-film",
            id: "opening",
            time,
            pass: "mask",
          },
        });
      const incompleteEvidence = withSemantic((input) =>
        input.pass === "mask" && input.target.kind === "shot"
          ? {
              status: "available",
              value: {
                ...evidenceFor(input.target.id),
                coverage: { unresolved: [], unaddressed: 1 },
              },
            }
          : notRun,
      );
      const firstMask = await shotMask(sameShot, 0);
      const secondMask = await shotMask(sameShot, 1 / 24);
      const incompleteMask = await shotMask(incompleteEvidence, 2 / 24);
      const secondManifest =
        secondMask.receipt === null
          ? null
          : project.verifiedRenderManifest(
              path.join(
                fixture.root,
                secondMask.receipt.bundle,
                "manifest.json",
              ),
            );
      TestValidator.equals(
        "same-shot mask evidence is receipted and retained beside later frames",
        {
          captured: [
            firstMask.captured,
            secondMask.captured,
            incompleteMask.captured,
          ],
          firstRecord:
            firstMask.receipt?.semanticMask === null
              ? null
              : {
                  frame: firstMask.receipt?.semanticMask?.frame,
                  pass: firstMask.receipt?.semanticMask?.pass,
                  shot: firstMask.receipt?.semanticMask?.shot,
                },
          retainedFrames: secondManifest?.semanticMasks
            .map((record) => record.frame)
            .sort((left, right) => left - right),
        },
        {
          captured: [true, true, true],
          firstRecord: { frame: 0, pass: "mask", shot: "opening" },
          retainedFrames: [0, 1, 2],
        },
      );

      const plain = new AutoMovieProductionContext(
        host.adapter,
        fixture.root,
        undefined,
        undefined,
        evidence,
        () => evidence,
      );
      // The compile identity carries the reviewed owner bindings, so a context
      // that never read the declaration cannot match the generated manifest.
      const undeclared = new AutoMovieProductionContext(
        host.adapter,
        fixture.root,
        undefined,
      );
      const foreignEvidence = withSemantic(() => ({
        status: "available",
        value: evidenceFor("answer"),
      }));
      const refusals = {
        maskWithoutEvidence: await shotMask(plain, 0),
        withoutDeclaration: await captureAutoMovieProductionFrame(undeclared, {
          target: {
            kind: "shot",
            productionId: "fixture-film",
            id: "opening",
            time: 0,
          },
        }),
        foreignOnBeauty: await captureAutoMovieProductionFrame(
          foreignEvidence,
          {
            target: {
              kind: "shot",
              productionId: "fixture-film",
              id: "opening",
              time: 0,
            },
          },
        ),
        assetWithEvidence: await captureAutoMovieProductionFrame(
          foreignEvidence,
          {
            target: {
              kind: "asset",
              productionId: "fixture-film",
              id: "soloist",
              angleDeg: 0,
            },
          },
        ),
      };
      const refusalPrefixes: Record<keyof typeof refusals, string> = {
        maskWithoutEvidence:
          "The capture host returned not-run semantic evidence: ",
        withoutDeclaration: "Generated input ",
        foreignOnBeauty:
          "The capture host returned foreign semantic evidence: ",
        assetWithEvidence:
          "The capture host returned foreign semantic evidence.",
      };
      TestValidator.equals(
        "evidence that is not the shot's own mask evidence refuses the capture",
        Object.fromEntries<{
          captured: boolean;
          code: string | undefined;
          named: boolean | undefined;
        }>(
          Object.entries(refusals).map(([name, output]) => [
            name,
            {
              captured: output.captured,
              code: output.diagnostics[0]?.code,
              named: output.diagnostics[0]?.message.startsWith(
                refusalPrefixes[name as keyof typeof refusals],
              ),
            },
          ]),
        ),
        {
          maskWithoutEvidence: {
            captured: false,
            code: "capture-failed",
            named: true,
          },
          withoutDeclaration: {
            captured: false,
            code: "generated-stale",
            named: true,
          },
          foreignOnBeauty: {
            captured: false,
            code: "capture-failed",
            named: true,
          },
          assetWithEvidence: {
            captured: false,
            code: "capture-failed",
            named: true,
          },
        },
      );

      const compiledCrate = JSON.parse(
        fs.readFileSync(
          path.join(project.generatedRoot(), "models", "crate.json"),
          "utf8",
        ),
      ) as { parts: Array<{ id: string }> };
      const asset = (target: {
        id: string;
        pose?: "rest" | "rom-extremes";
        part?: string;
      }): ReturnType<typeof captureAutoMovieProductionFrame> =>
        captureAutoMovieProductionFrame(plain, {
          target: {
            kind: "asset",
            productionId: "fixture-film",
            angleDeg: 0,
            ...target,
          },
        });
      const poses = {
        riggedExtremes: await asset({ id: "soloist", pose: "rom-extremes" }),
        riglessExtremes: await asset({ id: "crate", pose: "rom-extremes" }),
        namedPart: await asset({
          id: "crate",
          part: compiledCrate.parts[0]!.id,
        }),
        unknownPart: await asset({ id: "crate", part: "no-such-part" }),
      };
      TestValidator.equals(
        "range-of-motion extremes and named parts follow the compiled model",
        Object.fromEntries<{
          captured: boolean;
          code: string | null;
          names: boolean | undefined;
        }>(
          Object.entries(poses).map(([name, output]) => [
            name,
            {
              captured: output.captured,
              code: output.diagnostics[0]?.code ?? null,
              names: output.diagnostics[0]?.message.includes(
                name === "riglessExtremes"
                  ? "the compiled model has no humanoid skeleton"
                  : 'has no part "no-such-part"',
              ),
            },
          ]),
        ),
        {
          riggedExtremes: { captured: true, code: null, names: undefined },
          riglessExtremes: {
            captured: false,
            code: "preview-input-invalid",
            names: true,
          },
          namedPart: { captured: true, code: null, names: undefined },
          unknownPart: {
            captured: false,
            code: "preview-input-invalid",
            names: true,
          },
        },
      );

      // A compile after the captures reads every retained view, including the
      // semantic coverage the mask frames carry, as review evidence; the mask
      // frame at the cue apex satisfies the contract declared mask evidence.
      await shotMask(sameShot, 2);
      const reviewed = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
        evidence,
        () => evidence,
      ).lint({ scope: "review" });
      TestValidator.equals(
        "captured mask frames are read back as review evidence with their coverage",
        reviewed.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "review-evidence-missing" &&
            diagnostic.target === "shot:opening" &&
            diagnostic.message.includes("(mask)") === false,
        ),
        true,
      );
      const ground = plain.forProduction("fixture-film").oracle.query({
        request: { query: "ground", point: { x: 0, z: 0 } },
      });
      TestValidator.equals(
        "a ground query answers from the compiled shots of the current compile",
        { diagnostics: ground.diagnostics, kind: ground.result?.kind },
        { diagnostics: [], kind: "ground" },
      );
    } finally {
      fixture.dispose();
    }
  };
