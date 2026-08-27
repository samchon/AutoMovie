import type {
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimelineSegment,
  IAutoMovieProductionDialogueLine,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { softPanel } from "../internal/softFixtures";

interface IConfigurationModule {
  readProductionDialogueSynthesis: (selected: unknown) => unknown;
  assertProductionDialogueSynthesis: (props: {
    selected: unknown;
    dialogue: readonly unknown[];
  }) => unknown;
  readProductionSpeakerBindings: (
    selected: unknown,
  ) => Array<{ speaker: string; actor: string }>;
  readProductionLiveWearableSoftBodies: (selected: unknown) => string[];
  productionSoftBodyUsesMovingBoundary: (
    domain: Pick<IAutoMovieSoftBodyDomain, "anchors" | "colliders">,
  ) => boolean;
  selectProductionLiveWearableSoftBodies: (
    domains: readonly IAutoMovieSoftBodyDomain[],
    selected: unknown,
  ) => Array<{
    domain: IAutoMovieSoftBodyDomain;
    subjectIndex: number;
    maxSubjects: number;
  }>;
  assertProductionLiveWearableSoftBodies: (props: {
    selected: unknown;
    shots: ReadonlyMap<
      string,
      Pick<IAutoMovieCompiledShotSource, "softBodyDomains">
    >;
  }) => string[];
  assertProductionSpeakerBindings: (props: {
    bindings: readonly { speaker: string; actor: string }[];
    dialogue: readonly Pick<
      IAutoMovieProductionDialogueLine,
      "id" | "speaker" | "startFrame" | "endFrame"
    >[];
    timeline: { segments: IAutoMovieFilmTimelineSegment[] };
    shots: ReadonlyMap<string, Pick<IAutoMovieCompiledShotSource, "scene">>;
  }) => void;
}

const dialogueSelection = (): Record<string, unknown> => ({
  provider: "kokoro-local-v1",
  model: "onnx-community/Kokoro-82M-v1.0-ONNX",
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
  dtype: "q8",
  device: "cpu",
  voice: "af_heart",
  speed: 1,
  generatorProvenance: {
    source: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX",
    license: "reviewed-license-record",
    termsCheckedAt: "2026-08-27",
    cost: "local compute; no per-request provider fee",
    consumer: {
      kind: "dialogue-synthesis",
      reason: "the authored guide needs one fixed local speaking voice",
    },
  },
});

const movingPanel = (id: string): IAutoMovieSoftBodyDomain =>
  softPanel({
    columns: 2,
    rows: 2,
    overrides: {
      id,
      anchors: [
        {
          id: "moving-seam",
          particle: 0,
          position: null,
          binding: {
            kind: "node",
            node: "speaker-actor",
            offset: { x: 0, y: 0, z: 0 },
          },
        },
      ],
    },
  });

const bodyPanel = (id: string): IAutoMovieSoftBodyDomain =>
  softPanel({
    columns: 2,
    rows: 2,
    overrides: {
      id,
      colliders: [
        {
          kind: "body-capsule",
          id: "body",
          actor: "speaker-actor",
          capsule: {
            from: "hips",
            to: "head",
            radius: 0.25,
          },
        },
      ],
    },
  });

const staticPanel = (id: string): IAutoMovieSoftBodyDomain =>
  softPanel({ columns: 2, rows: 2, overrides: { id } });

const segment = (
  shot: string,
  startFrame: number,
  endFrame: number,
): IAutoMovieFilmTimelineSegment => ({
  shot,
  sourceInFrame: 0,
  sourceOutFrame: endFrame - startFrame,
  startFrame,
  endFrame,
  headHandleFrames: 0,
  tailHandleFrames: 0,
  transitionIn: { kind: "cut" },
  transitionOut: { kind: "cut" },
});

const compiledSoftShot = (
  domains: IAutoMovieSoftBodyDomain[],
): Pick<IAutoMovieCompiledShotSource, "softBodyDomains"> => ({
  softBodyDomains: domains,
});

const compiledActorShot = (
  actors: string[],
): Pick<IAutoMovieCompiledShotSource, "scene"> =>
  ({
    scene: {
      nodes: actors.map((id) => ({ id })),
    },
  }) as Pick<IAutoMovieCompiledShotSource, "scene">;

const messageOf = (operation: () => unknown): string | null => {
  try {
    operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const withValue = (
  source: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> => ({ ...source, [key]: value });

/**
 * The generated-project config is an executable authoring boundary.
 *
 * Scenarios:
 *
 * 1. Dialogue adoption accepts only the pinned adapter plus complete source,
 *    license, terms, cost, and consumer provenance, including the null choice.
 * 2. Missing, extra, malformed, secret-like, stale, and ambiguous dialogue
 *    configuration is refused instead of being ignored or defaulted.
 * 3. Speaker bindings are unique, used, and connected to the actor present in
 *    every compiled shot interval in which that bound speaker talks.
 * 4. The production-wide live-soft declaration equals the union of actual
 *    moving-boundary domains, while another shot's selected id may be absent.
 * 5. Missing moving domains, selected static domains, unknown ids, duplicate
 *    ids, and malformed identities fail before a static substitute can render.
 */
export const test_cli_scaffold_production_configuration =
  async (): Promise<void> => {
    const configSource = path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/productionConfiguration.ts",
    );
    const configuration = (
      process.env.AUTOMOVIE_ISSUE_2129_ESM === "1"
        ? await import(pathToFileURL(configSource).href)
        : require(configSource)
    ) as IConfigurationModule;

    const selected = dialogueSelection();
    const parsed = configuration.readProductionDialogueSynthesis(selected) as {
      voice: string;
      generatorProvenance: { consumer: { kind: string; reason: string } };
    };
    TestValidator.equals(
      "dialogue selection preserves the exact adopted generator identity",
      {
        nullChoice: configuration.readProductionDialogueSynthesis(null),
        voice: parsed.voice,
        consumer: parsed.generatorProvenance.consumer,
      },
      {
        nullChoice: null,
        voice: "af_heart",
        consumer: {
          kind: "dialogue-synthesis",
          reason: "the authored guide needs one fixed local speaking voice",
        },
      },
    );
    TestValidator.equals(
      "dialogue use and generator selection agree in both valid states",
      [
        configuration.assertProductionDialogueSynthesis({
          selected: null,
          dialogue: [],
        }),
        (
          configuration.assertProductionDialogueSynthesis({
            selected,
            dialogue: [{}],
          }) as { voice: string }
        ).voice,
      ],
      [null, "af_heart"],
    );
    TestValidator.equals(
      "dialogue use and generator selection refuse both mismatch directions",
      [
        messageOf(() =>
          configuration.assertProductionDialogueSynthesis({
            selected: null,
            dialogue: [{}],
          }),
        ),
        messageOf(() =>
          configuration.assertProductionDialogueSynthesis({
            selected,
            dialogue: [],
          }),
        ),
      ].map((message) => message !== null),
      [true, true],
    );

    const exactFailures = [
      undefined,
      [],
      { ...selected, apiKey: "must-not-enter-config" },
      Object.fromEntries(
        Object.entries(selected).filter(([key]) => key !== "voice"),
      ),
    ].map((value) =>
      messageOf(() => configuration.readProductionDialogueSynthesis(value)),
    );
    const pinnedFailures = [
      "provider",
      "model",
      "modelRevision",
      "dtype",
      "device",
    ].map((key) =>
      messageOf(() =>
        configuration.readProductionDialogueSynthesis(
          withValue(selected, key, "another-value"),
        ),
      ),
    );
    const voiceAndSpeedFailures = [
      withValue(selected, "voice", 10),
      withValue(selected, "voice", ""),
      withValue(selected, "voice", " padded "),
      withValue(selected, "speed", "1"),
      withValue(selected, "speed", Number.POSITIVE_INFINITY),
      withValue(selected, "speed", 0),
    ].map((value) =>
      messageOf(() => configuration.readProductionDialogueSynthesis(value)),
    );
    const provenance = selected.generatorProvenance as Record<string, unknown>;
    const provenanceFailures = [
      withValue(selected, "generatorProvenance", null),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        credential: "forbidden-extra-field",
      }),
      withValue(
        selected,
        "generatorProvenance",
        Object.fromEntries(
          Object.entries(provenance).filter(([key]) => key !== "source"),
        ),
      ),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        termsCheckedAt: "today",
      }),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        termsCheckedAt: "2026-02-30",
      }),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        consumer: "dialogue-synthesis",
      }),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        consumer: { kind: "repaint", reason: "wrong lane" },
      }),
      withValue(selected, "generatorProvenance", {
        ...provenance,
        consumer: { kind: "dialogue-synthesis", reason: "" },
      }),
      ...["source", "license", "cost"].map((key) =>
        withValue(selected, "generatorProvenance", {
          ...provenance,
          [key]: "",
        }),
      ),
    ].map((value) =>
      messageOf(() => configuration.readProductionDialogueSynthesis(value)),
    );
    TestValidator.predicate(
      "dialogue config refuses every unowned or malformed adoption field",
      [
        ...exactFailures,
        ...pinnedFailures,
        ...voiceAndSpeedFailures,
        ...provenanceFailures,
      ].every((message) => typeof message === "string" && message.length > 0),
    );
    const receipt: IAutoMovieProductionTtsReceipt = {
      version: 3,
      line: "line-1",
      cacheKey: "sha256:cache",
      model: "onnx-community/Kokoro-82M-v1.0-ONNX",
      modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
      voice: "af_heart",
      generatorProvenance:
        parsed.generatorProvenance as IAutoMovieProductionTtsReceipt["generatorProvenance"],
      sourceSampleRate: 24_000,
      sourceSamples: 1,
      pcmDigest: "sha256:pcm",
      phonemes: "a",
      phonemeChunks: [{ phonemes: "a", startSample: 0, endSample: 1 }],
      runtimeAssets: [{ path: "voice.bin", digest: "sha256:voice" }],
      visemes: [],
    };
    const { generatorProvenance: omittedProvenance, ...receiptWithoutIt } =
      receipt;
    void omittedProvenance;
    // @ts-expect-error Schema v3 makes external-generator provenance required.
    const missingProvenanceReceipt: IAutoMovieProductionTtsReceipt =
      receiptWithoutIt;
    const staleVersionReceipt: IAutoMovieProductionTtsReceipt = {
      ...receipt,
      // @ts-expect-error Adding provenance changed the public receipt schema.
      version: 2,
    };
    void missingProvenanceReceipt;
    void staleVersionReceipt;
    const receiptRoundTrip = JSON.parse(
      JSON.stringify(receipt),
    ) as IAutoMovieProductionTtsReceipt;
    TestValidator.equals(
      "the public TTS receipt preserves generator provenance through JSON",
      receiptRoundTrip.generatorProvenance,
      selected.generatorProvenance as IAutoMovieProductionTtsReceipt["generatorProvenance"],
    );
    TestValidator.predicate(
      "the receipt provenance shape is subject to the same negative parser",
      messageOf(() =>
        configuration.readProductionDialogueSynthesis({
          ...selected,
          generatorProvenance: {
            ...receiptRoundTrip.generatorProvenance,
            consumer: { kind: "repaint", reason: "wrong lane" },
          },
        }),
      ) !== null,
    );

    const bindings = configuration.readProductionSpeakerBindings([
      { speaker: "guide", actor: "speaker-actor" },
    ]);
    TestValidator.equals(
      "speaker config preserves exact settings and actor identities",
      bindings,
      [{ speaker: "guide", actor: "speaker-actor" }],
    );
    const bindingFailures = [
      null,
      [null],
      [{ speaker: "guide" }],
      [{ speaker: "guide", actor: "speaker-actor", inferred: true }],
      [{ speaker: 1, actor: "speaker-actor" }],
      [{ speaker: "", actor: "speaker-actor" }],
      [{ speaker: " guide ", actor: "speaker-actor" }],
      [{ speaker: "guide", actor: 1 }],
      [{ speaker: "guide", actor: "" }],
      [
        { speaker: "guide", actor: "speaker-actor" },
        { speaker: "guide", actor: "other" },
      ],
    ].map((value) =>
      messageOf(() => configuration.readProductionSpeakerBindings(value)),
    );
    TestValidator.predicate(
      "speaker config rejects malformed and ambiguous joins",
      bindingFailures.every(
        (message) => typeof message === "string" && message.length > 0,
      ),
    );

    const line = {
      id: "line-1",
      speaker: "guide",
      startFrame: 2,
      endFrame: 8,
    };
    const timeline = {
      segments: [segment("opening", 0, 10), segment("answer", 10, 20)],
    };
    const actorShots = new Map([
      ["opening", compiledActorShot(["speaker-actor"])],
      ["answer", compiledActorShot([])],
    ]);
    configuration.assertProductionSpeakerBindings({
      bindings,
      dialogue: [line],
      timeline,
      shots: actorShots,
    });
    configuration.assertProductionSpeakerBindings({
      bindings: [],
      dialogue: [line],
      timeline,
      shots: actorShots,
    });
    const speakerCoverageFailures = [
      () =>
        configuration.assertProductionSpeakerBindings({
          bindings,
          dialogue: [],
          timeline,
          shots: actorShots,
        }),
      () =>
        configuration.assertProductionSpeakerBindings({
          bindings,
          dialogue: [{ ...line, startFrame: 20, endFrame: 21 }],
          timeline,
          shots: actorShots,
        }),
      () =>
        configuration.assertProductionSpeakerBindings({
          bindings,
          dialogue: [{ ...line, startFrame: 9, endFrame: 11 }],
          timeline,
          shots: new Map([["opening", actorShots.get("opening")!]]),
        }),
      () =>
        configuration.assertProductionSpeakerBindings({
          bindings,
          dialogue: [{ ...line, startFrame: 10, endFrame: 11 }],
          timeline,
          shots: actorShots,
        }),
    ].map((operation) => messageOf(operation));
    TestValidator.equals(
      "speaker coverage failures identify unused, out-of-edit, absent-shot, and absent-actor joins",
      speakerCoverageFailures.map((message) => message !== null),
      [true, true, true, true],
    );

    const movingA = movingPanel("moving-a");
    const movingB = bodyPanel("moving-b");
    const staticA = staticPanel("static-a");
    TestValidator.equals(
      "moving-boundary classification covers anchors, capsules, and static domains",
      [movingA, movingB, staticA].map((domain) =>
        configuration.productionSoftBodyUsesMovingBoundary(domain),
      ),
      [true, true, false],
    );
    TestValidator.equals(
      "live-soft config preserves production budget order",
      configuration.readProductionLiveWearableSoftBodies([
        "moving-b",
        "moving-a",
      ]),
      ["moving-b", "moving-a"],
    );
    const liveConfigFailures = [
      null,
      [1],
      [""],
      [" moving-a"],
      ["moving-a", "moving-a"],
    ].map((value) =>
      messageOf(() =>
        configuration.readProductionLiveWearableSoftBodies(value),
      ),
    );
    TestValidator.predicate(
      "live-soft config refuses malformed and duplicate ids",
      liveConfigFailures.every(
        (message) => typeof message === "string" && message.length > 0,
      ),
    );

    const softShots = new Map([
      ["opening", compiledSoftShot([movingA, staticA])],
      ["answer", compiledSoftShot([movingB])],
      ["empty", {}],
    ]);
    TestValidator.equals(
      "production validation equals the selected and actual moving-domain sets",
      configuration.assertProductionLiveWearableSoftBodies({
        selected: ["moving-b", "moving-a"],
        shots: softShots,
      }),
      ["moving-b", "moving-a"],
    );
    const liveSetFailures = [
      () =>
        configuration.assertProductionLiveWearableSoftBodies({
          selected: ["moving-b"],
          shots: softShots,
        }),
      () =>
        configuration.assertProductionLiveWearableSoftBodies({
          selected: ["moving-a", "moving-b", "static-a"],
          shots: softShots,
        }),
      () =>
        configuration.assertProductionLiveWearableSoftBodies({
          selected: ["moving-a", "moving-b", "absent"],
          shots: softShots,
        }),
      () =>
        configuration.assertProductionLiveWearableSoftBodies({
          selected: ["moving-a"],
          shots: new Map([
            ["opening", compiledSoftShot([movingA, { ...movingA }])],
          ]),
        }),
      () =>
        configuration.assertProductionLiveWearableSoftBodies({
          selected: [],
          shots: new Map([
            ["opening", compiledSoftShot([{ ...staticA, id: " " }])],
          ]),
        }),
    ].map((operation) => messageOf(operation));
    TestValidator.equals(
      "production validation rejects every selection-to-compiled mismatch",
      liveSetFailures.map((message) => message !== null),
      [true, true, true, true, true],
    );

    const openingSelections =
      configuration.selectProductionLiveWearableSoftBodies(
        [movingA],
        ["moving-b", "moving-a"],
      );
    TestValidator.equals(
      "one shot keeps production-wide subject index while ignoring another shot's id",
      openingSelections.map((selection) => ({
        id: selection.domain.id,
        subjectIndex: selection.subjectIndex,
        maxSubjects: selection.maxSubjects,
      })),
      [{ id: "moving-a", subjectIndex: 1, maxSubjects: 2 }],
    );
    TestValidator.equals(
      "a shot with no matching domain selects no live solve",
      configuration.selectProductionLiveWearableSoftBodies([], ["moving-a"]),
      [],
    );
    const shotFailures = [
      () => configuration.selectProductionLiveWearableSoftBodies([movingA], []),
      () =>
        configuration.selectProductionLiveWearableSoftBodies(
          [staticA],
          ["static-a"],
        ),
      () =>
        configuration.selectProductionLiveWearableSoftBodies(
          [{ ...staticA, id: "" }],
          [],
        ),
      () =>
        configuration.selectProductionLiveWearableSoftBodies(
          [{ ...staticA, id: " static-a" }],
          [],
        ),
      () =>
        configuration.selectProductionLiveWearableSoftBodies(
          [staticA, { ...staticA }],
          [],
        ),
    ].map((operation) => messageOf(operation));
    TestValidator.equals(
      "shot selection refuses missing, static, malformed, and duplicate domain identities",
      shotFailures.map((message) => message !== null),
      [true, true, true, true, true],
    );
  };
