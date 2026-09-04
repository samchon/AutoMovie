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

/** Stable result of contextual caption and sound publication verification. */
export interface IAutoMovieProductionNonVideoVerification {
  caption: "absent" | "verified";
  sound: "absent" | "verified";
}

/**
 * Parse complete version-2 sound evidence without projecting away identity.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-evidence-identity-freshness Keeps the complete plan, analysis, TTS, and sibling-audio identity available to the final gate.
 * @evidence specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md#sound-delivery-status-and-failure-propagation Refuses legacy or malformed evidence instead of reducing it to aggregate counts.
 */
export const parseProductionSoundEvidence = (
  bytes: Uint8Array,
): IAutoMovieProductionSoundEvidence => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
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
      throw new Error(
        `Sound evidence contains a non-finite or non-JSON value: ${error instanceof Error ? error.message : String(error)}`,
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
