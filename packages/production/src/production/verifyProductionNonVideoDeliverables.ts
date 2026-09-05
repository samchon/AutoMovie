import type {
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundEvidence,
  IAutoMovieProductionSoundEvidenceAudio,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import { TextDecoder } from "node:util";
import typia from "typia";

import { canonicalizeAutoMovieJson } from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";

/** Stable result of contextual caption and sound publication verification. */
export interface IAutoMovieProductionNonVideoVerification {
  /** Whether the plan had no caption sidecar or the delivered one verified against it. */
  caption: "absent" | "verified";
  /** Whether the plan had no sound master or the delivered one verified against it. */
  sound: "absent" | "verified";
}

/**
 * Parse complete version-2 sound evidence without projecting away identity.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Keeps the complete plan, analysis, TTS, and sibling-audio identity available to the final gate.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-delivery-status-and-failure-propagation Refuses legacy or malformed evidence instead of reducing it to aggregate counts.
 * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-status Reads the planned, rendered, probed and not-run states of sound evidence as distinct facts without projecting identity away.
 */
export const parseProductionSoundEvidence = (
  bytes: Uint8Array,
): IAutoMovieProductionSoundEvidence => {
  let parsed: unknown;
  try {
    parsed = parseAutoMovieStructuredJson({ record: "sound-evidence", bytes });
  } catch {
    throw new Error("Sound evidence bytes are not valid UTF-8 JSON.");
  }
  try {
    return typia.assertEquals<IAutoMovieProductionSoundEvidence>(parsed);
  } catch {
    throw new Error(
      "Sound evidence is not the complete version-2 current-plan schema.",
    );
  }
};

/**
 * Bind final caption and sound evidence bytes to their current semantic owners.
 *
 * Generic manifest and receipt byte gates run before this verifier. This adds
 * exact current-plan closure and never substitutes semantic aggregates for the
 * pre-existing byte identity.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness Prevents same-count caption text, language, speaker, or timing substitution after a manifest is regenerated.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Compares delivered canonical WebVTT bytes with the complete current caption plan.
 * @evidence requirements/sound/validation-and-delivery.md#sound-picture-delivery-join Binds measured sound evidence to the exact sibling audio deliverable.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Implements the complete plan, analysis, dialogue, and audio identity join.
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-silence Distinguishes a missing, undecodable or not-run sound deliverable from a verified one instead of reading absent energy as authored silence.
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-refusal Refuses a delivered stream whose duration, digest or plan binding contradicts the current sound plan, naming the stream rather than marking the set complete.
 * @evidence requirements/sound/validation-and-delivery.md#sound-delivery-inventory Verifies each sound deliverable's role, duration and digest against the current plan inventory rather than accepting a placeholder as the master.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-audio-streams Verifies the master stream's role, sample facts and digest against the current sound plan and keeps missing, undecodable and not-run states separate.
 */
export const verifyProductionNonVideoDeliverables = (props: {
  caption: {
    required: boolean;
    expected: string;
    actual: Uint8Array | null;
  } | null;
  sound: {
    expectedPlan: IAutoMovieProductionSoundPlan;
    expectedAnalysis: IAutoMovieProductionSoundAnalysis;
    expectedTts: readonly IAutoMovieProductionTtsReceipt[];
    expectedAudio: IAutoMovieProductionSoundEvidenceAudio;
    evidence: IAutoMovieProductionSoundEvidence | Uint8Array;
  } | null;
}): IAutoMovieProductionNonVideoVerification => {
  let caption: IAutoMovieProductionNonVideoVerification["caption"] = "absent";
  if (props.caption !== null) {
    if (props.caption.actual === null) {
      if (props.caption.required)
        throw new Error("Required current caption bytes are absent.");
    } else {
      const actual = decodeUtf8(props.caption.actual, "Caption");
      if (actual !== props.caption.expected)
        throw new Error(
          "Caption bytes differ from the complete current canonical WebVTT plan.",
        );
      caption = "verified";
    }
  }
  let sound: IAutoMovieProductionNonVideoVerification["sound"] = "absent";
  if (props.sound !== null) {
    const actual =
      props.sound.evidence instanceof Uint8Array
        ? parseProductionSoundEvidence(props.sound.evidence)
        : props.sound.evidence;
    const expected: IAutoMovieProductionSoundEvidence = {
      version: 2,
      plan: props.sound.expectedPlan,
      analysis: props.sound.expectedAnalysis,
      tts: [...props.sound.expectedTts],
      audio: props.sound.expectedAudio,
      measurement: {
        source: "pre-encode-pcm",
        algorithm: "automovie-production-sound-analysis-v1",
      },
    };
    let actualJson: string;
    let expectedJson: string;
    try {
      actualJson = canonicalizeAutoMovieJson(actual);
      expectedJson = canonicalizeAutoMovieJson(expected);
    } catch (error) {
      // Canonicalization throws nothing but its typed Error refusal.
      throw new Error(
        `Sound evidence contains a non-finite or non-JSON value: ${(error as Error).message}`,
      );
    }
    if (actualJson !== expectedJson)
      throw new Error(
        "Sound evidence differs from the complete current plan, analysis, TTS receipts, sibling audio identity, or measurement provenance.",
      );
    sound = "verified";
  }
  return { caption, sound };
};

const decodeUtf8 = (bytes: Uint8Array, label: string): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} bytes are not valid UTF-8.`);
  }
};
