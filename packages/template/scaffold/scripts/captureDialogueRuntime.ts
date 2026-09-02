import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  encodeAutoMoviePathSegment,
  readAutoMovieFilmTimeline,
} from "@automovie/production";
import path from "node:path";

import type { IProductionFrameCaptureRuntime } from "./capture";
import {
  readProductionDialogueSynthesis,
  readProductionSpeakerBindings,
} from "./productionConfiguration";
import {
  type IAutoMovieProductionDialogueRuntime,
  productionDialogueRuntimeIdentity,
} from "./productionRuntimeState";
import { createNodeProductionRenderHostWithCapture } from "./renderHost";
import { createProductionSoundRuntime } from "./renderSoundRuntime";

/** Current dialogue state installed for one preview, viewer, or repaint host. */
export interface IPreparedProductionCaptureDialogue {
  /** Exact current runtime, or null when the production has no dialogue. */
  dialogue: IAutoMovieProductionDialogueRuntime | null;
  /** Canonical content identity persisted beside captured pixels. */
  identity: ReturnType<typeof productionDialogueRuntimeIdentity>;
}

/** Invocation-owned current-dialogue preparation shared by visual consumers. */
export interface IProductionCaptureDialogueRuntime {
  prepare: () => Promise<IPreparedProductionCaptureDialogue>;
}

/**
 * Bind the sound planner to the exact capture runtime that will draw pixels.
 *
 * Preview, the live viewer, final render, and repaint must not each invent a
 * mouth timeline. This owner reopens one read-only current compile, prepares
 * the final-byte receipt through the render sound runtime, and installs that
 * same immutable dialogue state in the caller's capture session.
 */
export const createProductionCaptureDialogueRuntime = (props: {
  capture: IProductionFrameCaptureRuntime;
  productionId: string;
  root: string;
  progress?: (
    stage: string,
    details?: Readonly<Record<string, number | string>>,
  ) => void;
}): IProductionCaptureDialogueRuntime => {
  const root = path.resolve(props.root);
  const host = createNodeProductionRenderHostWithCapture(props.capture);
  /** The sound decisions this production authored, read from its own design. */
  const design = AutoMovieProductionProject.productionDesign(
    root,
    props.productionId,
  );
  const sound = createProductionSoundRuntime({
    dialogueSelection: readProductionDialogueSynthesis(
      design?.sound?.dialogueSynthesis ?? null,
    ),
    host,
    liveWearableSoftBodies: design?.simulation?.liveWearableSoftBodies ?? [],
    productionStateRoot: path.join(
      root,
      "automovie",
      "productions",
      encodeAutoMoviePathSegment(props.productionId),
    ),
    progress: props.progress ?? (() => undefined),
    speakerBindings: readProductionSpeakerBindings(
      design?.sound?.speakerBindings ?? [],
    ),
  });
  return {
    prepare: async () => {
      const project = AutoMovieProductionProject.openReadOnly(
        root,
        props.productionId,
      );
      const current = new AutoMovieProductionCompiler(project).lint({
        scope: "source",
      });
      if (current.success === false)
        throw new Error(
          `Dialogue capture requires a current source compile: ${JSON.stringify(
            current.diagnostics,
          )}`,
        );
      const production = project.graph().production;
      if (production === null)
        throw new Error(
          "Capture preparation requires a current production frame format.",
        );
      await props.capture.installDeliveryCrop(
        production.frameFormat.crop ?? null,
      );
      const generated = project.generatedManifest();
      if (
        generated === null ||
        generated.inputFingerprint !== current.compiler.inputFingerprint
      )
        throw new Error(
          "Dialogue capture requires generated output from the current source compile. Run npm run compile, then retry.",
        );
      if (
        generated.files.some((file) => file.path === "film-timeline.json") ===
        false
      ) {
        await props.capture.installDialogue(null);
        return { dialogue: null, identity: null };
      }
      const timeline = readAutoMovieFilmTimeline(
        project,
        current.compiler.inputFingerprint,
      );
      const prepared = await sound.prepare({
        project,
        compileFingerprint: current.compiler.inputFingerprint,
        timeline,
      });
      if (
        prepared.dialogueRuntime.inputFingerprint !== generated.inputFingerprint
      )
        throw new Error(
          "Prepared dialogue does not belong to the current generated compile.",
        );
      await props.capture.installDialogue(
        prepared.plan.dialogue.length === 0 ? null : prepared.dialogueRuntime,
      );
      const dialogue = props.capture.dialogue();
      return {
        dialogue,
        identity: productionDialogueRuntimeIdentity(dialogue),
      };
    },
  };
};
