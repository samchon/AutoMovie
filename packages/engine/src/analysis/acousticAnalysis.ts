import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisMetricGap,
  IAutoMovieAnalysisRun,
  IAutoMovieAnalysisSample,
  IAutoMovieAnalysisTarget,
  IAutoMovieAnalysisWarning,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  assertAutoMovieAnalysisTargets,
  autoMovieAnalysisMetric,
  sealAutoMovieAnalysisRun,
  warnAutoMovieAnalysisTargetKeys,
} from "./analysisRun";

/**
 * Sabine's constant in metric units, `0.161 s*m^-1`.
 *
 * It is the constant of the equation `T60 = 0.161 * V / A`, not a property of
 * any room or material, which is why it lives in the solver rather than in a
 * table a production would have to supply.
 */
export const AUTOMOVIE_SABINE_CONSTANT = 0.161;

/** Distances shorter than this are the same point. */
const EPSILON = 1e-12;

/** One absorbing surface of a room. */
export interface IAutoMovieAcousticSurface {
  /** Stable surface identity within the request. */
  id: string;
  /** Area in m^2; strictly positive. */
  area: number;
  /** Sabine absorption coefficient within `[0, 1]`. */
  absorption: number;
}

/** One partition sound passes through on its way out of the room. */
export interface IAutoMovieAcousticPartition {
  /** Stable partition identity within the request. */
  id: string;
  /** Area in m^2; strictly positive. */
  area: number;
  /** Sound reduction index in dB; finite. */
  transmissionLoss: number;
}

/** One steady noise source inside the room, such as a fan or a diffuser. */
export interface IAutoMovieAcousticSource {
  /** Stable source identity within the request. */
  id: string;
  /** World position in metres. */
  position: IAutoMovieVector3;
  /** Sound power level in dB re 1 pW; finite. */
  soundPower: number;
  /** Directivity factor; strictly positive, `1` being omnidirectional. */
  directivity: number;
}

/** One place the room is listened from. */
export interface IAutoMovieAcousticReceiver {
  /** Stable receiver identity within the request. */
  id: string;
  /** World position in metres. */
  position: IAutoMovieVector3;
}

/** Everything one room-acoustic study is configured with. */
export interface IAutoMovieAcousticRequest {
  /** Stable run identity. */
  id: string;
  /** Logical space being listened to. */
  subject: string;
  /** Design revision being read. */
  inputRevision: string;
  /** Room volume in m^3; strictly positive. */
  volume: number;
  /** Absorbing surfaces; at least one. */
  surfaces: readonly IAutoMovieAcousticSurface[];
  /** Partitions whose composite transmission loss is asked for. */
  partitions: readonly IAutoMovieAcousticPartition[];
  /** Steady sources inside the room. */
  sources: readonly IAutoMovieAcousticSource[];
  /** Listening positions the field is reported at. */
  receivers: readonly IAutoMovieAcousticReceiver[];
  /** Targets the production declares for this study. */
  targets: readonly IAutoMovieAnalysisTarget[];
}

/**
 * Solve one room for reverberation, equipment noise and partition performance.
 *
 * Three closed forms, each stated so a reader can check the arithmetic:
 *
 * - The Sabine absorption `A = sum(S * alpha)` and `T60 = 0.161 * V / A`;
 * - The room constant `R = A / (1 - alpha_mean)`, and at each receiver `Lp = 10 *
 *   log10(sum over sources of 10^(Lw/10) * (Q / (4*pi*r^2) + 4/R))`, the direct
 *   field plus the diffuse field;
 * - The composite transmission loss `R_c = -10 * log10(sum(tau * S) / sum(S))`
 *   with `tau = 10^(-R/10)`, which is why one weak panel dominates a strong
 *   wall.
 *
 * The exclusions are stated as loudly as the results. A single broadband
 * absorption coefficient cannot produce a speech transmission index, which
 * needs a modulation transfer function over an impulse response, so that metric
 * is `unsupported` rather than estimated.
 *
 * The reverberation time, the room constant and the receiver level are all
 * statements about a diffuse field, so all three gap wherever there is none: a
 * room that absorbs nothing rings forever, and a room that absorbs everything
 * never rings at all. Neither extreme is reported as a number. The second is
 * the one worth naming, because Sabine does not diverge there but keeps
 * returning `0.161 * V / A`, a positive decay time for an anechoic chamber,
 * which is the arithmetic of the model rather than a property of the room.
 *
 * @author Samchon
 */
export const analyzeAutoMovieAcoustics = (props: {
  request: IAutoMovieAcousticRequest;
}): IAutoMovieAnalysisRun => {
  const request = props.request;
  validateAcousticRequest(request);
  const warnings: IAutoMovieAnalysisWarning[] = [];
  const area = request.surfaces.reduce((sum, surface) => sum + surface.area, 0);
  const absorption = request.surfaces.reduce(
    (sum, surface) => sum + surface.area * surface.absorption,
    0,
  );
  const meanAbsorption = absorption / area;
  // A room that absorbs nothing and a room that absorbs everything both leave
  // the diffuse field without a value: one is unbounded, the other does not
  // exist. Either way the honest answer is a gap and not a number.
  const roomConstant =
    absorption === 0 || meanAbsorption === 1
      ? null
      : absorption / (1 - meanAbsorption);
  const deadRoom: IAutoMovieAnalysisMetricGap = {
    reason:
      "every surface of the room absorbs completely, so it has no diffuse field and no reverberation to measure",
    remedy:
      "declare the reflective surfaces the room actually has, or treat the space as a free field",
  };
  const liveRoom: IAutoMovieAnalysisMetricGap = {
    reason:
      "no surface of the room absorbs anything, so the reverberation time and the diffuse-field room constant are both unbounded rather than large",
    remedy:
      "declare the absorption of at least one surface, or read the room as perfectly reflective by intent",
  };

  const levels =
    roomConstant === null || request.sources.length === 0
      ? null
      : request.receivers.map((receiver) => ({
          receiver,
          level: receiverLevel(request, receiver, roomConstant),
        }));
  const noField: IAutoMovieAnalysisMetricGap =
    request.sources.length === 0
      ? {
          reason:
            "the room declares no noise source, so there is no equipment sound pressure level to report",
          remedy:
            "declare the sound power of the plant serving this space, or stop requesting an equipment noise metric",
        }
      : absorption === 0
        ? liveRoom
        : deadRoom;
  const noReceiver: IAutoMovieAnalysisMetricGap = {
    reason:
      "the room declares no receiver, so no sound pressure level was evaluated anywhere",
    remedy: "declare at least one listening position inside the space",
  };
  // A decibel is a ratio, and the ratio of nothing has no logarithm. A source
  // whose declared power underflows to zero energy leaves a receiver with no
  // level at all, which is a gap and not the very large negative number the
  // arithmetic would otherwise hand back.
  const inaudible =
    levels !== null && levels.some((entry) => !Number.isFinite(entry.level));
  const energies =
    levels === null || levels.length === 0 || inaudible ? null : levels;
  const levelGap: IAutoMovieAnalysisMetricGap | undefined =
    levels === null
      ? noField
      : levels.length === 0
        ? noReceiver
        : inaudible
          ? {
              reason:
                "a receiver reads no acoustic energy at all, so its sound pressure level is not a number; every declared source is silent to the limits of double precision",
              remedy:
                "declare the sound power the plant serving this space actually radiates",
            }
          : undefined;

  const transmissionArea = request.partitions.reduce(
    (sum, partition) => sum + partition.area,
    0,
  );
  const transmittance =
    request.partitions.length === 0
      ? null
      : request.partitions.reduce(
          (sum, partition) =>
            sum +
            partition.area * Math.pow(10, -partition.transmissionLoss / 10),
          0,
        ) / transmissionArea;

  const metric = (entry: {
    key: string;
    unit: string;
    value: number | null;
    gap?: IAutoMovieAnalysisMetricGap;
    status?: "unsupported" | "not-run";
  }): IAutoMovieAnalysisMetric =>
    autoMovieAnalysisMetric({
      key: entry.key,
      unit: entry.unit,
      value: entry.value,
      targets: request.targets,
      warnings,
      gap: entry.gap,
      status: entry.status,
    });

  const metrics: IAutoMovieAnalysisMetric[] = [
    metric({ key: "room.absorptionArea", unit: "m2sab", value: absorption }),
    metric({
      key: "room.reverberationTime",
      unit: "s",
      // Sabine's decay is a statement about a diffuse field, so it is reported
      // exactly where one exists and nowhere else. A room that absorbs nothing
      // never stops ringing; a room that absorbs everything never rings at all,
      // and there the equation still hands back 0.161*V/A, a positive decay
      // time for an anechoic chamber. That number is an artefact of the model
      // rather than a property of the room, and reporting it beside a gap that
      // says the room has no reverberation would make one run answer its own
      // question twice.
      value:
        roomConstant === null
          ? null
          : (AUTOMOVIE_SABINE_CONSTANT * request.volume) / absorption,
      gap:
        roomConstant === null
          ? absorption === 0
            ? liveRoom
            : deadRoom
          : undefined,
    }),
    metric({
      key: "room.constant",
      unit: "m2",
      value: roomConstant,
      gap:
        roomConstant === null
          ? absorption === 0
            ? liveRoom
            : deadRoom
          : undefined,
    }),
    metric({
      key: "room.soundPressureLevel",
      unit: "dB",
      value:
        energies === null
          ? null
          : 10 *
            Math.log10(
              energies.reduce(
                (sum, entry) => sum + Math.pow(10, entry.level / 10),
                0,
              ) / energies.length,
            ),
      gap: levelGap,
    }),
    metric({
      key: "room.soundPressureLevel.max",
      unit: "dB",
      value:
        energies === null
          ? null
          : Math.max(...energies.map((entry) => entry.level)),
      gap: levelGap,
    }),
    metric({
      key: "partition.compositeTransmissionLoss",
      unit: "dB",
      value:
        transmittance === null || transmittance === 0
          ? null
          : -10 * Math.log10(transmittance),
      gap:
        transmittance === null
          ? {
              reason:
                "the study declares no partition, so there is no composite transmission loss to compute",
              remedy:
                "declare the partitions enclosing the space and the sound reduction index of each",
            }
          : transmittance === 0
            ? {
                reason:
                  "every declared partition transmits nothing at all, so the composite loss is unbounded rather than large",
                remedy:
                  "declare the finite sound reduction index each partition actually achieves",
              }
            : undefined,
    }),
    metric({
      key: "room.speechTransmissionIndex",
      unit: "ratio",
      value: null,
      gap: {
        reason:
          "a speech transmission index needs a modulation transfer function over an impulse response, and this host computes a broadband Sabine estimate only",
        remedy:
          "bind a room impulse-response adapter and record its result as its own run",
      },
      status: "unsupported",
    }),
  ];
  warnAutoMovieAnalysisTargetKeys({
    targets: request.targets,
    keys: metrics.map((entry) => entry.key),
    warnings,
  });
  const samples: IAutoMovieAnalysisSample[] =
    energies === null
      ? []
      : energies.map((entry) => ({
          id: entry.receiver.id,
          key: "room.soundPressureLevel",
          position: entry.receiver.position,
          value: entry.level,
        }));

  return sealAutoMovieAnalysisRun({
    id: request.id,
    domain: "acoustic",
    subject: request.subject,
    inputRevision: request.inputRevision,
    solver: {
      id: "automovie.acoustic.sabine-diffuse-field",
      version: "1",
      model:
        "Sabine A=sum(S*alpha), T60=0.161V/A, room constant R=A/(1-alpha_mean), Lp=10log10(sum 10^(Lw/10)*(Q/(4 pi r^2)+4/R)), composite tau-weighted transmission loss; no impulse response, so speech intelligibility is unsupported",
    },
    settings: acousticSettings(request),
    outcome: { status: "solved", metrics, samples, warnings },
  });
};

/** Direct plus diffuse sound pressure level at one receiver. */
const receiverLevel = (
  request: IAutoMovieAcousticRequest,
  receiver: IAutoMovieAcousticReceiver,
  roomConstant: number,
): number => {
  let energy = 0;
  for (const source of request.sources) {
    const distance = Vector3.length(
      Vector3.subtract(receiver.position, source.position),
    );
    energy +=
      Math.pow(10, source.soundPower / 10) *
      (source.directivity / (4 * Math.PI * distance * distance) +
        4 / roomConstant);
  }
  return 10 * Math.log10(energy);
};

const validateAcousticRequest = (request: IAutoMovieAcousticRequest): void => {
  for (const [label, value] of [
    ["id", request.id],
    ["subject", request.subject],
    ["input revision", request.inputRevision],
  ] as const)
    if (value.trim().length === 0)
      throw new Error(`an acoustic study must state a non-blank ${label}`);
  if (!Number.isFinite(request.volume) || request.volume <= 0)
    throw new Error(
      `a room volume must be a finite number above zero, but was ${request.volume}`,
    );
  if (request.surfaces.length === 0)
    throw new Error("an acoustic study needs at least one absorbing surface");
  const surfaces = new Set<string>();
  for (const surface of request.surfaces) {
    if (surface.id.trim().length === 0)
      throw new Error("every acoustic surface must carry a non-blank id");
    if (surfaces.has(surface.id))
      throw new Error(`acoustic surface "${surface.id}" is declared twice`);
    surfaces.add(surface.id);
    if (!Number.isFinite(surface.area) || surface.area <= 0)
      throw new Error(
        `acoustic surface "${surface.id}" area must be a finite number above zero, but was ${surface.area}`,
      );
    if (
      !Number.isFinite(surface.absorption) ||
      surface.absorption < 0 ||
      surface.absorption > 1
    )
      throw new Error(
        `acoustic surface "${surface.id}" absorption must be a fraction within [0, 1], but was ${surface.absorption}`,
      );
  }
  const partitions = new Set<string>();
  for (const partition of request.partitions) {
    if (partition.id.trim().length === 0)
      throw new Error("every acoustic partition must carry a non-blank id");
    if (partitions.has(partition.id))
      throw new Error(`acoustic partition "${partition.id}" is declared twice`);
    partitions.add(partition.id);
    if (!Number.isFinite(partition.area) || partition.area <= 0)
      throw new Error(
        `acoustic partition "${partition.id}" area must be a finite number above zero, but was ${partition.area}`,
      );
    if (!Number.isFinite(partition.transmissionLoss))
      throw new Error(
        `acoustic partition "${partition.id}" transmission loss must be finite, but was ${partition.transmissionLoss}`,
      );
  }
  const sources = new Set<string>();
  for (const source of request.sources) {
    if (source.id.trim().length === 0)
      throw new Error("every acoustic source must carry a non-blank id");
    if (sources.has(source.id))
      throw new Error(`acoustic source "${source.id}" is declared twice`);
    sources.add(source.id);
    if (!Number.isFinite(source.soundPower))
      throw new Error(
        `acoustic source "${source.id}" sound power must be finite, but was ${source.soundPower}`,
      );
    if (!Number.isFinite(source.directivity) || source.directivity <= 0)
      throw new Error(
        `acoustic source "${source.id}" directivity must be a finite number above zero, but was ${source.directivity}`,
      );
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(source.position[axis]))
        throw new Error(
          `acoustic source "${source.id}" position ${axis} must be finite, but was ${source.position[axis]}`,
        );
  }
  if (request.receivers.length > AUTOMOVIE_ANALYSIS_MAX_SAMPLES)
    throw new Error(
      `an acoustic study carries one sample per receiver and may not exceed ${AUTOMOVIE_ANALYSIS_MAX_SAMPLES}, but had ${request.receivers.length}`,
    );
  const receivers = new Set<string>();
  for (const receiver of request.receivers) {
    if (receiver.id.trim().length === 0)
      throw new Error("every acoustic receiver must carry a non-blank id");
    if (receivers.has(receiver.id))
      throw new Error(`acoustic receiver "${receiver.id}" is declared twice`);
    receivers.add(receiver.id);
    for (const axis of ["x", "y", "z"] as const)
      if (!Number.isFinite(receiver.position[axis]))
        throw new Error(
          `acoustic receiver "${receiver.id}" position ${axis} must be finite, but was ${receiver.position[axis]}`,
        );
    for (const source of request.sources)
      if (
        Vector3.length(Vector3.subtract(receiver.position, source.position)) <=
        EPSILON
      )
        throw new Error(
          `acoustic receiver "${receiver.id}" sits on source "${source.id}", where the inverse square law has no value`,
        );
  }
  assertAutoMovieAnalysisTargets(request.targets);
};

/** The canonical settings text one acoustic study is digested against. */
const acousticSettings = (request: IAutoMovieAcousticRequest): string =>
  JSON.stringify({
    volume: request.volume,
    surfaces: request.surfaces.map((surface) => ({
      id: surface.id,
      area: surface.area,
      absorption: surface.absorption,
    })),
    partitions: request.partitions.map((partition) => ({
      id: partition.id,
      area: partition.area,
      transmissionLoss: partition.transmissionLoss,
    })),
    sources: request.sources.map((source) => ({
      id: source.id,
      position: source.position,
      soundPower: source.soundPower,
      directivity: source.directivity,
    })),
    receivers: request.receivers.map((receiver) => ({
      id: receiver.id,
      position: receiver.position,
    })),
    targets: request.targets.map((target) => ({
      key: target.key,
      unit: target.unit,
      value: target.value,
      comparison: target.comparison,
    })),
  });
