import type {
  AutoMovieContentDigest,
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundEvidence,
  IAutoMovieProductionSoundPlan,
} from "@automovie/interface";
import {
  parseProductionSoundEvidence,
  verifyProductionNonVideoDeliverables,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (value: string): AutoMovieContentDigest =>
  `sha256:${value.repeat(64).slice(0, 64)}` as AutoMovieContentDigest;

const plan = (): IAutoMovieProductionSoundPlan => ({
  version: 1,
  inputFingerprint: digest("1"),
  fps: 24,
  frameRate: { numerator: 24, denominator: 1 },
  totalFrames: 24,
  sampleRate: 48_000,
  channels: 2,
  events: [],
  cues: [],
  dialogue: [],
});

const analysis = (): IAutoMovieProductionSoundAnalysis => ({
  version: 1,
  sampleRate: 48_000,
  sampleFrames: 48_000,
  runtimeSeconds: 1,
  integratedLoudness: null,
  samplePeak: 0,
  clippingSamples: 0,
  longestSilenceSeconds: 1,
  eventAlignment: [],
});

const evidence = (): IAutoMovieProductionSoundEvidence => ({
  version: 2,
  plan: plan(),
  analysis: analysis(),
  tts: [],
  audio: {
    path: "audio.mp4",
    mediaType: "audio/mp4",
    bytes: 128,
    digest: digest("2"),
  },
  measurement: {
    source: "pre-encode-pcm",
    algorithm: "automovie-production-sound-analysis-v1",
  },
});

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

const verifySound = (actual: IAutoMovieProductionSoundEvidence | Uint8Array) =>
  verifyProductionNonVideoDeliverables({
    caption: null,
    sound: {
      expectedPlan: plan(),
      expectedAnalysis: analysis(),
      expectedTts: [],
      expectedAudio: evidence().audio,
      evidence: actual,
    },
  });

/**
 * Validate semantic closure for final caption and sound evidence bytes.
 *
 * Scenarios:
 * 1. Exact canonical caption bytes and complete version-2 sound evidence bind
 *    to their current plans and sibling audio identity.
 * 2. Caption payload substitution, required absence, foreign plan identity,
 *    analysis substitution, and sibling-audio substitution each refuse.
 * 3. Optional absence, empty plans, malformed UTF-8/JSON, legacy schemas,
 *    object input, and non-finite evidence exercise every boundary.
 */
export const test_production_media_semantic_closure = (): void => {
  const caption =
    "WEBVTT film\n\nline\n00:00:00.000 --> 00:00:01.000\n<lang en>Hello.</lang>\n";
  const exactEvidence = evidence();
  TestValidator.equals(
    "exact caption and sound identities close against their current owners",
    verifyProductionNonVideoDeliverables({
      caption: {
        required: true,
        expected: caption,
        actual: Buffer.from(caption, "utf8"),
      },
      sound: {
        expectedPlan: plan(),
        expectedAnalysis: analysis(),
        expectedTts: [],
        expectedAudio: exactEvidence.audio,
        evidence: Buffer.from(`${JSON.stringify(exactEvidence)}\n`, "utf8"),
      },
    }),
    { caption: "verified", sound: "verified" },
  );
  TestValidator.equals(
    "absent optional populations and direct typed evidence retain exact states",
    {
      absent: verifyProductionNonVideoDeliverables({
        caption: { required: false, expected: "", actual: null },
        sound: null,
      }),
      typed: verifySound(exactEvidence),
      parsed: parseProductionSoundEvidence(
        Buffer.from(JSON.stringify(exactEvidence), "utf8"),
      ).version,
    },
    {
      absent: { caption: "absent", sound: "absent" },
      typed: { caption: "absent", sound: "verified" },
      parsed: 2,
    },
  );
  const foreignPlan = evidence();
  foreignPlan.plan.inputFingerprint = digest("3");
  const changedAnalysis = evidence();
  changedAnalysis.analysis.sampleFrames = 47_999;
  const changedAudio = evidence();
  changedAudio.audio.digest = digest("4");
  const nonFinite = evidence();
  nonFinite.analysis.samplePeak = Number.POSITIVE_INFINITY;
  TestValidator.equals(
    "semantic substitutions and malformed evidence fail closed",
    {
      captionText: refused(
        () =>
          verifyProductionNonVideoDeliverables({
            caption: {
              required: true,
              expected: caption,
              actual: Buffer.from(caption.replace("Hello", "Foreign"), "utf8"),
            },
            sound: null,
          }),
        "complete current canonical",
      ),
      captionMissing: refused(
        () =>
          verifyProductionNonVideoDeliverables({
            caption: { required: true, expected: caption, actual: null },
            sound: null,
          }),
        "Required current caption",
      ),
      captionUtf8: refused(
        () =>
          verifyProductionNonVideoDeliverables({
            caption: {
              required: true,
              expected: caption,
              actual: Uint8Array.from([0xc3, 0x28]),
            },
            sound: null,
          }),
        "not valid UTF-8",
      ),
      foreignPlan: refused(
        () => verifySound(foreignPlan),
        "complete current plan",
      ),
      changedAnalysis: refused(
        () => verifySound(changedAnalysis),
        "complete current plan",
      ),
      changedAudio: refused(
        () => verifySound(changedAudio),
        "sibling audio identity",
      ),
      nonFinite: refused(() => verifySound(nonFinite), "non-finite"),
      legacy: refused(
        () =>
          parseProductionSoundEvidence(
            Buffer.from(JSON.stringify({ ...evidence(), version: 1 }), "utf8"),
          ),
        "version-2",
      ),
      arrayRoot: refused(
        () =>
          parseProductionSoundEvidence(
            Buffer.from(JSON.stringify([{ version: 2 }]), "utf8"),
          ),
        "version-2",
      ),
      incomplete: refused(
        () =>
          parseProductionSoundEvidence(
            Buffer.from(JSON.stringify({ version: 2 }), "utf8"),
          ),
        "complete version-2",
      ),
      foreignField: refused(
        () =>
          parseProductionSoundEvidence(
            Buffer.from(
              JSON.stringify({ ...evidence(), aggregateOnly: true }),
              "utf8",
            ),
          ),
        "complete version-2",
      ),
      invalidJson: refused(
        () => parseProductionSoundEvidence(Buffer.from("{", "utf8")),
        "not valid UTF-8 JSON",
      ),
      invalidUtf8: refused(
        () => parseProductionSoundEvidence(Uint8Array.from([0xc3, 0x28])),
        "not valid UTF-8 JSON",
      ),
    },
    {
      captionText: true,
      captionMissing: true,
      captionUtf8: true,
      foreignPlan: true,
      changedAnalysis: true,
      changedAudio: true,
      nonFinite: true,
      legacy: true,
      arrayRoot: true,
      incomplete: true,
      foreignField: true,
      invalidJson: true,
      invalidUtf8: true,
    },
  );
};
