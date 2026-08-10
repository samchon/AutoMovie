import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  AUTOMOVIE_SABINE_CONSTANT,
  IAutoMovieAcousticRequest,
  analyzeAutoMovieAcoustics,
} from "@automovie/engine";
import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisRun,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

/**
 * A room is solved for reverberation, equipment noise and partition
 * performance, and refuses to answer what a broadband estimate cannot.
 *
 * The fixture is chosen so every expectation is exact arithmetic rather than a
 * recorded output. 100 m2 of surface at 0.5 absorption is 50 m2 sabins, so
 * Sabine gives `0.161 * 100 / 50 = 0.322` s and the room constant is `50 / (1 -
 * 0.5) = 100` m2. A source of 80 dB at one metre with a directivity of `0.24 *
 * pi` contributes a direct term of exactly `0.24*pi / (4*pi) = 0.06` and a
 * diffuse term of `4 / 100 = 0.04`, so the receiver reads `80 + 10*log10(0.1) =
 * 70` dB. Ten square metres at 30 dB beside one at 10 dB average to a
 * transmittance of `(10*0.001 + 1*0.1) / 11 = 0.01`, which is 20 dB: the weak
 * panel governs, which is the whole reason a composite figure is computed at
 * all.
 *
 * The refusals are the other half. A speech transmission index needs an impulse
 * response nobody here computes, so it is permanently `unsupported`. A room
 * that absorbs everything has no diffuse field and one that absorbs nothing has
 * an unbounded one; both are gaps rather than infinities dressed as numbers.
 *
 * Scenarios:
 *
 * 1. The declared room reports the Sabine absorption, reverberation time, room
 *    constant, receiver level and composite transmission loss by hand
 *    arithmetic, with one field sample per receiver.
 * 2. Speech intelligibility is `unsupported` inside an otherwise solved run.
 * 3. A room with no source, and a room with sources but no receiver, gap the level
 *    metrics with their own distinct reasons.
 * 4. A perfectly absorbent room and a perfectly reflective room each gap the
 *    metrics they make undefined, and keep the ones they do not.
 * 5. A study with no partition, and one whose partitions transmit nothing at all,
 *    gap the composite loss instead of reporting infinity.
 * 6. Declared targets judge the reverberation time in its own unit.
 * 7. Every malformed room is refused at its own message, including a receiver
 *    standing on a source.
 */
export const test_analysis_room_acoustics = (): void => {
  const request = (
    overrides: Partial<IAutoMovieAcousticRequest> = {},
  ): IAutoMovieAcousticRequest => ({
    id: "hall-acoustics",
    subject: "space:hall",
    inputRevision: "r7",
    volume: 100,
    surfaces: [{ id: "boundaries", area: 100, absorption: 0.5 }],
    partitions: [
      { id: "wall", area: 10, transmissionLoss: 30 },
      { id: "door", area: 1, transmissionLoss: 10 },
    ],
    sources: [
      {
        id: "fan",
        position: { x: 0, y: 0, z: 0 },
        soundPower: 80,
        directivity: 0.24 * Math.PI,
      },
    ],
    receivers: [{ id: "desk", position: { x: 1, y: 0, z: 0 } }],
    targets: [],
    ...overrides,
  });
  const study = (
    overrides: Partial<IAutoMovieAcousticRequest> = {},
  ): IAutoMovieAnalysisRun =>
    analyzeAutoMovieAcoustics({ request: request(overrides) });
  const metrics = (run: IAutoMovieAnalysisRun): IAutoMovieAnalysisMetric[] =>
    run.outcome.status === "solved" ? run.outcome.metrics : [];
  const of = (run: IAutoMovieAnalysisRun, key: string): number | null =>
    metrics(run).find((metric) => metric.key === key)?.value ?? null;
  const statusOf = (run: IAutoMovieAnalysisRun, key: string): string =>
    metrics(run).find((metric) => metric.key === key)?.status ?? "absent";

  const hall = study();
  TestValidator.equals(
    "the declared room reports Sabine, the room constant and the composite loss",
    {
      domain: hall.domain,
      sabine: AUTOMOVIE_SABINE_CONSTANT,
      absorption: of(hall, "room.absorptionArea"),
      reverberation: of(hall, "room.reverberationTime"),
      constant: of(hall, "room.constant"),
      transmission: of(hall, "partition.compositeTransmissionLoss"),
      speech: statusOf(hall, "room.speechTransmissionIndex"),
      fields:
        hall.outcome.status === "solved"
          ? hall.outcome.samples.map((sample) => [sample.id, sample.key])
          : [],
    },
    {
      domain: "acoustic",
      sabine: 0.161,
      absorption: 50,
      reverberation: 0.322,
      constant: 100,
      transmission: 20,
      speech: "unsupported",
      fields: [["desk", "room.soundPressureLevel"]],
    },
  );
  TestValidator.predicate(
    "the receiver reads the direct field plus the diffuse field exactly",
    nclose(of(hall, "room.soundPressureLevel") ?? Number.NaN, 70, 1e-9) &&
      nclose(of(hall, "room.soundPressureLevel.max") ?? Number.NaN, 70, 1e-9) &&
      nclose(
        hall.outcome.status === "solved"
          ? (hall.outcome.samples[0]?.value ?? Number.NaN)
          : Number.NaN,
        70,
        1e-9,
      ),
  );

  const silent = study({ sources: [] });
  const unheard = study({ receivers: [] });
  TestValidator.equals(
    "no source and no receiver gap the level metrics for their own reasons",
    {
      silent: [
        statusOf(silent, "room.soundPressureLevel"),
        metrics(silent)
          .find((metric) => metric.key === "room.soundPressureLevel")
          ?.gap?.reason.includes("no noise source"),
        silent.outcome.status === "solved" ? silent.outcome.samples.length : -1,
      ],
      unheard: [
        statusOf(unheard, "room.soundPressureLevel.max"),
        metrics(unheard)
          .find((metric) => metric.key === "room.soundPressureLevel.max")
          ?.gap?.reason.includes("no receiver"),
        unheard.outcome.status === "solved"
          ? unheard.outcome.samples.length
          : -1,
      ],
    },
    {
      silent: ["not-run", true, 0],
      unheard: ["not-run", true, 0],
    },
  );

  const anechoic = study({
    surfaces: [{ id: "boundaries", area: 100, absorption: 1 }],
  });
  const reflective = study({
    surfaces: [{ id: "boundaries", area: 100, absorption: 0 }],
  });
  TestValidator.equals(
    "a perfectly absorbent and a perfectly reflective room each gap what they make undefined",
    {
      anechoic: [
        of(anechoic, "room.absorptionArea"),
        of(anechoic, "room.reverberationTime"),
        statusOf(anechoic, "room.constant"),
        metrics(anechoic)
          .find((metric) => metric.key === "room.constant")
          ?.gap?.reason.includes("absorbs completely"),
        statusOf(anechoic, "room.soundPressureLevel"),
      ],
      reflective: [
        of(reflective, "room.absorptionArea"),
        statusOf(reflective, "room.reverberationTime"),
        statusOf(reflective, "room.constant"),
        metrics(reflective)
          .find((metric) => metric.key === "room.constant")
          ?.gap?.reason.includes("absorbs anything"),
        statusOf(reflective, "room.soundPressureLevel"),
      ],
    },
    {
      anechoic: [100, 0.161, "not-run", true, "not-run"],
      reflective: [0, "not-run", "not-run", true, "not-run"],
    },
  );

  const mute = study({
    sources: [
      {
        id: "fan",
        position: { x: 0, y: 0, z: 0 },
        soundPower: -4000,
        directivity: 1,
      },
    ],
  });
  TestValidator.equals(
    "a source whose power underflows to no energy leaves a gap, not minus infinity",
    {
      level: statusOf(mute, "room.soundPressureLevel"),
      max: statusOf(mute, "room.soundPressureLevel.max"),
      reason: metrics(mute)
        .find((metric) => metric.key === "room.soundPressureLevel")
        ?.gap?.reason.includes("no acoustic energy at all"),
      samples: mute.outcome.status === "solved" ? mute.outcome.samples : null,
    },
    { level: "not-run", max: "not-run", reason: true, samples: [] },
  );

  const bare = study({ partitions: [] });
  const perfect = study({
    partitions: [{ id: "vault", area: 10, transmissionLoss: 4000 }],
  });
  TestValidator.equals(
    "a room with no partition, or with one that transmits nothing, gaps the composite loss",
    {
      bare: [
        statusOf(bare, "partition.compositeTransmissionLoss"),
        metrics(bare)
          .find(
            (metric) => metric.key === "partition.compositeTransmissionLoss",
          )
          ?.gap?.reason.includes("declares no partition"),
      ],
      perfect: [
        statusOf(perfect, "partition.compositeTransmissionLoss"),
        metrics(perfect)
          .find(
            (metric) => metric.key === "partition.compositeTransmissionLoss",
          )
          ?.gap?.reason.includes("transmits nothing at all"),
      ],
    },
    { bare: ["not-run", true], perfect: ["not-run", true] },
  );

  TestValidator.equals(
    "declared targets judge the reverberation time in its own unit",
    {
      met: statusOf(
        study({
          targets: [
            {
              key: "room.reverberationTime",
              unit: "s",
              value: 0.5,
              comparison: "at-most",
            },
          ],
        }),
        "room.reverberationTime",
      ),
      missed: statusOf(
        study({
          targets: [
            {
              key: "room.reverberationTime",
              unit: "s",
              value: 0.2,
              comparison: "at-most",
            },
          ],
        }),
        "room.reverberationTime",
      ),
    },
    { met: "meets", missed: "misses" },
  );

  TestValidator.equals(
    "every malformed room is refused at its own message",
    namedFacts([
      [
        "blank revision",
        () =>
          throwsError(
            () => study({ inputRevision: " " }),
            "non-blank input revision",
          ),
      ],
      [
        "non-positive volume",
        () =>
          throwsError(
            () => study({ volume: 0 }),
            "room volume must be a finite number above zero",
          ),
      ],
      [
        "no surface",
        () =>
          throwsError(
            () => study({ surfaces: [] }),
            "at least one absorbing surface",
          ),
      ],
      [
        "blank surface id",
        () =>
          throwsError(
            () => study({ surfaces: [{ id: "", area: 1, absorption: 0.5 }] }),
            "surface must carry a non-blank id",
          ),
      ],
      [
        "duplicated surface",
        () =>
          throwsError(
            () =>
              study({
                surfaces: [
                  { id: "s", area: 1, absorption: 0.5 },
                  { id: "s", area: 1, absorption: 0.5 },
                ],
              }),
            'acoustic surface "s" is declared twice',
          ),
      ],
      [
        "non-positive surface area",
        () =>
          throwsError(
            () => study({ surfaces: [{ id: "s", area: 0, absorption: 0.5 }] }),
            "area must be a finite number above zero",
          ),
      ],
      [
        "out of range absorption",
        () =>
          throwsError(
            () => study({ surfaces: [{ id: "s", area: 1, absorption: 1.2 }] }),
            "absorption must be a fraction within [0, 1]",
          ),
      ],
      [
        "blank partition id",
        () =>
          throwsError(
            () =>
              study({
                partitions: [{ id: " ", area: 1, transmissionLoss: 30 }],
              }),
            "partition must carry a non-blank id",
          ),
      ],
      [
        "duplicated partition",
        () =>
          throwsError(
            () =>
              study({
                partitions: [
                  { id: "p", area: 1, transmissionLoss: 30 },
                  { id: "p", area: 1, transmissionLoss: 30 },
                ],
              }),
            'acoustic partition "p" is declared twice',
          ),
      ],
      [
        "non-positive partition area",
        () =>
          throwsError(
            () =>
              study({
                partitions: [{ id: "p", area: -1, transmissionLoss: 30 }],
              }),
            "area must be a finite number above zero",
          ),
      ],
      [
        "non-finite transmission loss",
        () =>
          throwsError(
            () =>
              study({
                partitions: [
                  {
                    id: "p",
                    area: 1,
                    transmissionLoss: Number.POSITIVE_INFINITY,
                  },
                ],
              }),
            "transmission loss must be finite",
          ),
      ],
      [
        "blank source id",
        () =>
          throwsError(
            () =>
              study({
                sources: [
                  {
                    id: "",
                    position: { x: 0, y: 0, z: 0 },
                    soundPower: 80,
                    directivity: 1,
                  },
                ],
              }),
            "source must carry a non-blank id",
          ),
      ],
      [
        "duplicated source",
        () =>
          throwsError(
            () =>
              study({
                sources: [
                  {
                    id: "s",
                    position: { x: 0, y: 0, z: 0 },
                    soundPower: 80,
                    directivity: 1,
                  },
                  {
                    id: "s",
                    position: { x: 0, y: 0, z: 0 },
                    soundPower: 80,
                    directivity: 1,
                  },
                ],
              }),
            'acoustic source "s" is declared twice',
          ),
      ],
      [
        "non-finite sound power",
        () =>
          throwsError(
            () =>
              study({
                sources: [
                  {
                    id: "s",
                    position: { x: 0, y: 0, z: 0 },
                    soundPower: Number.NaN,
                    directivity: 1,
                  },
                ],
              }),
            "sound power must be finite",
          ),
      ],
      [
        "non-positive directivity",
        () =>
          throwsError(
            () =>
              study({
                sources: [
                  {
                    id: "s",
                    position: { x: 0, y: 0, z: 0 },
                    soundPower: 80,
                    directivity: 0,
                  },
                ],
              }),
            "directivity must be a finite number above zero",
          ),
      ],
      [
        "non-finite source position",
        () =>
          throwsError(
            () =>
              study({
                sources: [
                  {
                    id: "s",
                    position: { x: Number.NaN, y: 0, z: 0 },
                    soundPower: 80,
                    directivity: 1,
                  },
                ],
              }),
            "position x must be finite",
          ),
      ],
      [
        "too many receivers",
        () =>
          throwsError(
            () =>
              study({
                receivers: Array.from(
                  { length: AUTOMOVIE_ANALYSIS_MAX_SAMPLES + 1 },
                  (_, index) => ({
                    id: `r${index}`,
                    position: { x: index + 1, y: 0, z: 0 },
                  }),
                ),
              }),
            "may not exceed 4096",
          ),
      ],
      [
        "blank receiver id",
        () =>
          throwsError(
            () =>
              study({
                receivers: [{ id: " ", position: { x: 1, y: 0, z: 0 } }],
              }),
            "receiver must carry a non-blank id",
          ),
      ],
      [
        "duplicated receiver",
        () =>
          throwsError(
            () =>
              study({
                receivers: [
                  { id: "r", position: { x: 1, y: 0, z: 0 } },
                  { id: "r", position: { x: 2, y: 0, z: 0 } },
                ],
              }),
            'acoustic receiver "r" is declared twice',
          ),
      ],
      [
        "non-finite receiver position",
        () =>
          throwsError(
            () =>
              study({
                receivers: [
                  { id: "r", position: { x: 1, y: Number.NaN, z: 0 } },
                ],
              }),
            "position y must be finite",
          ),
      ],
      [
        "a receiver standing on a source",
        () =>
          throwsError(
            () =>
              study({
                receivers: [{ id: "r", position: { x: 0, y: 0, z: 0 } }],
              }),
            "where the inverse square law has no value",
          ),
      ],
      [
        "duplicated target",
        () =>
          throwsError(
            () =>
              study({
                targets: [
                  {
                    key: "room.reverberationTime",
                    unit: "s",
                    value: 1,
                    comparison: "at-most",
                  },
                  {
                    key: "room.reverberationTime",
                    unit: "s",
                    value: 2,
                    comparison: "at-most",
                  },
                ],
              }),
            "declared more than once",
          ),
      ],
    ]),
    {
      "blank revision": true,
      "non-positive volume": true,
      "no surface": true,
      "blank surface id": true,
      "duplicated surface": true,
      "non-positive surface area": true,
      "out of range absorption": true,
      "blank partition id": true,
      "duplicated partition": true,
      "non-positive partition area": true,
      "non-finite transmission loss": true,
      "blank source id": true,
      "duplicated source": true,
      "non-finite sound power": true,
      "non-positive directivity": true,
      "non-finite source position": true,
      "too many receivers": true,
      "blank receiver id": true,
      "duplicated receiver": true,
      "non-finite receiver position": true,
      "a receiver standing on a source": true,
      "duplicated target": true,
    },
  );
};
