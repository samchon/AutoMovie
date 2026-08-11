import {
  type IAutoMovieAcousticRequest,
  applyAutoMovieInteriorAcousticResponse,
  deriveAutoMovieInteriorAcousticResponse,
  renderProductionSound,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieAcousticResponseProfile,
  IAutoMovieProductionAcousticResponse,
  IAutoMovieProductionSoundPlan,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

const digest =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as AutoMovieContentDigest;

const profile: IAutoMovieAcousticResponseProfile = {
  kind: "derived-room-analysis",
  id: "sabine",
  solver: "sabine-broadband-v1",
};

const request = (absorption = 0.5): IAutoMovieAcousticRequest => ({
  id: "room-analysis",
  subject: "room-a",
  inputRevision: digest,
  volume: 100,
  surfaces: [{ id: "shell", area: 100, absorption }],
  partitions: [{ id: "wall", area: 20, transmissionLoss: 20 }],
  sources: [
    {
      id: "event",
      position: { x: 0, y: 0, z: 0 },
      soundPower: 80,
      directivity: 1,
    },
  ],
  receivers: [{ id: "listener", position: { x: 1, y: 0, z: 0 } }],
  targets: [],
});

const soundPlan = (
  acousticResponse?: IAutoMovieProductionAcousticResponse,
): IAutoMovieProductionSoundPlan => ({
  version: 1,
  inputFingerprint: digest,
  fps: 10,
  totalFrames: 10,
  sampleRate: 48_000,
  channels: 2,
  events: [
    {
      id: "event",
      shot: "shot",
      event: "hit",
      kind: "contact",
      frame: 0,
      timeSeconds: 0,
      emitter: { x: 0, y: 0, z: 0 },
      listener: { x: 1, y: 0, z: 0 },
      distanceMeters: 1,
      memberCount: 1,
      spreadRadiusMeters: 0,
      densityGain: 1,
      pan: 0,
      attenuation: 1,
      ...(acousticResponse === undefined ? {} : { acousticResponse }),
      seed: 1,
    },
  ],
  cues: [],
  dialogue: [],
});

/** Room classification, shared analysis consumption, finite response, and gaps. */
export const test_engine_interior_acoustic_response = (): void => {
  const same = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-a",
    inputRevision: digest,
    request: request(),
    profile,
  });
  const across = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-b",
    inputRevision: digest,
    request: request(),
    profile,
  });
  TestValidator.equals(
    "same-room and cross-room paths consume the shared Sabine analysis",
    {
      sameStatus: same.status,
      samePath: same.status === "available" ? same.path : null,
      reverberation:
        same.status === "available"
          ? nclose(same.reverberationTimeSeconds!, 0.322)
          : false,
      ratio: same.status === "available" && same.directToDiffuseRatio! > 0,
      acrossStatus: across.status,
      acrossPath: across.status === "available" ? across.path : null,
      transmission:
        across.status === "available"
          ? nclose(across.transmissionGain!, 0.1)
          : false,
    },
    {
      sameStatus: "available",
      samePath: "same-room",
      reverberation: true,
      ratio: true,
      acrossStatus: "available",
      acrossPath: "different-room",
      transmission: true,
    },
  );

  const outdoor = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: null,
    listenerSpace: null,
    inputRevision: digest,
    request: null,
    profile,
  });
  const unresolved = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: null,
    inputRevision: digest,
    request: null,
    profile,
  });
  const adopted = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-b",
    inputRevision: digest,
    request: null,
    profile: {
      kind: "adopted-response",
      id: "external-ir",
      asset: "assets/ir.wav",
      digest,
      sampleRate: 48_000,
      roomMappings: [
        { source: "room-a", listener: "room-b", response: "a-to-b" },
      ],
    },
  });
  TestValidator.equals(
    "outdoor, unresolved, and adopted-byte paths stay distinct",
    {
      outdoor: outdoor.status === "available" ? outdoor.path : null,
      unresolved:
        unresolved.status === "unsupported" ? unresolved.path : "wrong",
      adopted: adopted.status,
    },
    { outdoor: "outdoor", unresolved: null, adopted: "not-run" },
  );

  const gap = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-a",
    inputRevision: digest,
    request: request(0),
    profile,
  });
  TestValidator.equals(
    "a room without a bounded diffuse result remains unsupported",
    gap.status,
    "unsupported",
  );

  const reflective = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-a",
    inputRevision: digest,
    request: request(0.2),
    profile,
  });
  const absorptive = deriveAutoMovieInteriorAcousticResponse({
    sourceSpace: "room-a",
    listenerSpace: "room-a",
    inputRevision: digest,
    request: request(0.8),
    profile,
  });
  if (reflective.status !== "available" || absorptive.status !== "available")
    throw new Error("positive material twins unexpectedly lacked responses");
  const reflectivePcm = applyAutoMovieInteriorAcousticResponse({
    samples: Float32Array.from([1, 0]),
    channels: 1,
    sampleRate: 100,
    response: reflective,
  });
  const absorptivePcm = applyAutoMovieInteriorAcousticResponse({
    samples: Float32Array.from([1, 0]),
    channels: 1,
    sampleRate: 100,
    response: absorptive,
  });
  const tailEnergy = (pcm: Float32Array): number =>
    pcm.slice(1).reduce((sum, sample) => sum + Math.abs(sample), 0);
  TestValidator.equals(
    "material absorption changes both the Sabine result and the audible bounded tail",
    {
      reflectiveT60: nclose(reflective.reverberationTimeSeconds!, 0.805),
      absorptiveT60: nclose(absorptive.reverberationTimeSeconds!, 0.20125),
      ordered:
        reflective.reverberationTimeSeconds! >
        absorptive.reverberationTimeSeconds!,
      longerTail: reflectivePcm.length > absorptivePcm.length,
      greaterTailEnergy: tailEnergy(reflectivePcm) > tailEnergy(absorptivePcm),
    },
    {
      reflectiveT60: true,
      absorptiveT60: true,
      ordered: true,
      longerTail: true,
      greaterTailEnergy: true,
    },
  );

  if (same.status !== "available" || across.status !== "available")
    throw new Error("positive acoustic responses unexpectedly unavailable");
  const dry = Float32Array.from([1, 0]);
  const wet = applyAutoMovieInteriorAcousticResponse({
    samples: dry,
    channels: 1,
    sampleRate: 100,
    response: same,
  });
  const transmitted = applyAutoMovieInteriorAcousticResponse({
    samples: dry,
    channels: 1,
    sampleRate: 100,
    response: across,
  });
  const outdoors = applyAutoMovieInteriorAcousticResponse({
    samples: dry,
    channels: 1,
    sampleRate: 100,
    response: outdoor,
  });
  TestValidator.equals(
    "the bounded tier adds a finite tail, transmits across rooms, and copies outdoors",
    {
      wetStartsDry: wet[0],
      wetHasTail: wet.length > dry.length && wet.slice(1).some((x) => x !== 0),
      transmitted: nclose(transmitted[0]!, 0.1),
      outdoorBytes: Buffer.from(outdoors.buffer).equals(
        Buffer.from(dry.buffer),
      ),
      renderConsumesResponse:
        renderProductionSound({ plan: soundPlan(across) }).pcm[0]! <
        renderProductionSound({ plan: soundPlan() }).pcm[0]!,
    },
    {
      wetStartsDry: 1,
      wetHasTail: true,
      transmitted: true,
      outdoorBytes: true,
      renderConsumesResponse: true,
    },
  );

  TestValidator.equals(
    "unavailable response and mismatched revisions are refused",
    {
      unavailable: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: unresolved,
          }),
        "unsupported",
      ),
      revision: throwsError(
        () =>
          deriveAutoMovieInteriorAcousticResponse({
            sourceSpace: "room-a",
            listenerSpace: "room-a",
            inputRevision:
              "sha256:2222222222222222222222222222222222222222222222222222222222222222" as AutoMovieContentDigest,
            request: request(),
            profile,
          }),
        "revision",
      ),
    },
    { unavailable: true, revision: true },
  );

  const derive = (
    values: Partial<{
      sourceSpace: string | null;
      listenerSpace: string | null;
      inputRevision: AutoMovieContentDigest;
      request: IAutoMovieAcousticRequest | null;
      profile: IAutoMovieAcousticResponseProfile;
    }> = {},
  ) =>
    deriveAutoMovieInteriorAcousticResponse({
      sourceSpace: "room-a",
      listenerSpace: "room-a",
      inputRevision: digest,
      request: request(),
      profile,
      ...values,
    });
  TestValidator.equals(
    "room-response derivation refuses every unresolved or malformed input boundary",
    {
      blankProfile: throwsError(
        () => derive({ profile: { ...profile, id: " " } }),
        "id must not be blank",
      ),
      badRevision: throwsError(
        () =>
          derive({
            inputRevision: "not-a-digest" as AutoMovieContentDigest,
          }),
        "SHA-256",
      ),
      otherOutdoorEndpoint:
        derive({ sourceSpace: null, listenerSpace: "room-a", request: null })
          .status === "unsupported",
      missingAnalysis: derive({ request: null }).status === "not-run",
      unsupportedSolver: throwsError(
        () =>
          derive({
            profile: {
              ...profile,
              solver: "other",
            } as unknown as IAutoMovieAcousticResponseProfile,
          }),
        "solver is unsupported",
      ),
      subjectMismatch: throwsError(
        () => derive({ request: { ...request(), subject: "room-b" } }),
        "does not match source space",
      ),
      missingSource:
        derive({ request: { ...request(), sources: [] } }).status ===
        "unsupported",
      missingReceiver:
        derive({ request: { ...request(), receivers: [] } }).status ===
        "unsupported",
      coincident: throwsError(
        () =>
          derive({
            request: {
              ...request(),
              receivers: [{ id: "listener", position: { x: 0, y: 0, z: 0 } }],
            },
          }),
        "inverse square law has no value",
      ),
      noPartition:
        derive({
          listenerSpace: "room-b",
          request: { ...request(), partitions: [] },
        }).status === "unsupported",
    },
    {
      blankProfile: true,
      badRevision: true,
      otherOutdoorEndpoint: true,
      missingAnalysis: true,
      unsupportedSolver: true,
      subjectMismatch: true,
      missingSource: true,
      missingReceiver: true,
      coincident: true,
      noPartition: true,
    },
  );

  const availableSame = same as Extract<
    IAutoMovieProductionAcousticResponse,
    { status: "available" }
  >;
  const availableAcross = across as Extract<
    IAutoMovieProductionAcousticResponse,
    { status: "available" }
  >;
  TestValidator.equals(
    "PCM application refuses invalid clocks, shapes, and path-specific facts",
    {
      fractionalChannels: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1.5,
            sampleRate: 100,
            response: availableSame,
          }),
        "positive integer",
      ),
      zeroChannels: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 0,
            sampleRate: 100,
            response: availableSame,
          }),
        "positive integer",
      ),
      fractionalRate: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100.5,
            response: availableSame,
          }),
        "sample rate",
      ),
      zeroRate: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 0,
            response: availableSame,
          }),
        "sample rate",
      ),
      incompleteFrame: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: Float32Array.from([1]),
            channels: 2,
            sampleRate: 100,
            response: availableSame,
          }),
        "complete frames",
      ),
      nullTransmission: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableAcross, transmissionGain: null },
          }),
        "transmission gain",
      ),
      negativeTransmission: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableAcross, transmissionGain: -1 },
          }),
        "transmission gain",
      ),
      excessTransmission: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableAcross, transmissionGain: 2 },
          }),
        "transmission gain",
      ),
      nullReverberation: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: {
              ...availableSame,
              reverberationTimeSeconds: null,
            },
          }),
        "reverberation time",
      ),
      zeroReverberation: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableSame, reverberationTimeSeconds: 0 },
          }),
        "reverberation time",
      ),
      nullRatio: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableSame, directToDiffuseRatio: null },
          }),
        "direct-to-diffuse ratio",
      ),
      zeroRatio: throwsError(
        () =>
          applyAutoMovieInteriorAcousticResponse({
            samples: dry,
            channels: 1,
            sampleRate: 100,
            response: { ...availableSame, directToDiffuseRatio: 0 },
          }),
        "direct-to-diffuse ratio",
      ),
    },
    {
      fractionalChannels: true,
      zeroChannels: true,
      fractionalRate: true,
      zeroRate: true,
      incompleteFrame: true,
      nullTransmission: true,
      negativeTransmission: true,
      excessTransmission: true,
      nullReverberation: true,
      zeroReverberation: true,
      nullRatio: true,
      zeroRatio: true,
    },
  );
};
