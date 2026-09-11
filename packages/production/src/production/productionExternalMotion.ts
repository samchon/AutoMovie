import { retargetHumanoidMotion } from "@automovie/engine";
import { type IAutoMovieExternalMotionAdoption as IAutoMovieIngestExternalMotionAdoption } from "@automovie/ingest";
import {
  AutoMovieHumanoidBone,
  IAutoMovieDiagnostic,
  IAutoMovieExternalMotionBasis,
  IAutoMovieExternalMotionConversionReceipt,
  IAutoMovieExternalMotionLossEntry,
  IAutoMovieExternalMotionReceiptCharacterization,
  IAutoMovieExternalMotionTake,
  IAutoMovieExternalMotionTransformActivity,
  IAutoMovieMotion,
  IAutoMovieExternalMotionAdoption as IAutoMovieProductionExternalMotionAdoption,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import {
  AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
  AUTOMOVIE_PRODUCTION_BUILD_VERSION,
} from "./productionBuildProtocol";
import { createAutoMovieSourceRuntimeModelRegistry } from "./sourceRuntimeModelRegistry";

/** Retain an adopted motion and the input facts required for retargeting. */
export interface IProductionExternalMotionAdoption {
  /** The authored external-motion selection. */
  declaration: IAutoMovieProductionExternalMotionAdoption;
  /** The ingest result that validated the selected input. */
  receipt: IAutoMovieIngestExternalMotionAdoption;
  /** Files and content identities that comprise the external motion input. */
  sourceClosure: IAutoMovieExternalMotionConversionReceipt["source"]["closure"];
  /** Coordinate and unit conventions carried by the source motion. */
  sourceBasis: IAutoMovieExternalMotionBasis;
  /** The selected take within the imported motion input. */
  sourceTake: IAutoMovieExternalMotionTake;
  /** The normalized source motion before target-skeleton retargeting. */
  sourceMotion: IAutoMovieMotion;
}

/** Receipt facts whose result path and bytes are sealed during materialization. */
export interface IProductionExternalMotionConversionDraft extends Omit<
  IAutoMovieExternalMotionConversionReceipt,
  "result"
> {
  /** Retargeted motion to publish with the conversion receipt. */
  motion: IAutoMovieMotion;
}

/** Retarget each adopted motion to the actor skeleton selected by the shot. */
export const resolveExternalMotionClips = (props: {
  adoptions: readonly IProductionExternalMotionAdoption[];
  program: IAutoMovieProductionShotProgram;
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
  target: string;
  sourcePath: string;
}): {
  clips: IAutoMovieMotion[];
  conversions: IProductionExternalMotionConversionDraft[];
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const clips: IAutoMovieMotion[] = [];
  const conversions: IProductionExternalMotionConversionDraft[] = [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const modelRegistry = createAutoMovieSourceRuntimeModelRegistry(
    props.runtimeModels,
  );
  const authoredClipIds = new Set(
    (props.program.clips ?? []).map((clip) => clip.id),
  );
  for (const adoption of props.adoptions) {
    const declaration = adoption.declaration;
    if (authoredClipIds.has(declaration.clip)) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" targets clip id "${declaration.clip}", but the shot source already declares that clip. Choose a distinct adoption clip id instead of replacing source-authored motion by map insertion order.`,
      });
      continue;
    }
    const actor = props.program.actors.find(
      (candidate) => candidate.node === declaration.actor,
    );
    const targetModel =
      actor === undefined ? undefined : modelRegistry.resolve(actor.model);
    const targetSkeleton = targetModel?.skeleton ?? null;
    if (actor === undefined || targetSkeleton === null) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" targets actor "${declaration.actor}", but that actor is absent or has no resolved articulated runtime model in this shot. Correct the explicit actor or model binding.`,
      });
      continue;
    }
    const actions =
      props.program.performance.revise.final ?? props.program.performance.draft;
    const consumers = actions.filter(
      (action) => action.verb === "enact" && action.clip === declaration.clip,
    );
    if (consumers.length === 0) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" exposes clip "${declaration.clip}" for actor "${declaration.actor}", but the final performance never enacts it. Remove the unused adoption or enact that exact clip with the declared actor.`,
      });
      continue;
    }
    const wrongConsumer = consumers.find((action) => {
      const actors = Array.isArray(action.actor)
        ? action.actor
        : [action.actor];
      return actors.length !== 1 || actors[0] !== declaration.actor;
    });
    if (wrongConsumer !== undefined) {
      const actors = Array.isArray(wrongConsumer.actor)
        ? wrongConsumer.actor
        : [wrongConsumer.actor];
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" belongs only to actor "${declaration.actor}", but final enact clip "${declaration.clip}" names actor set [${actors.map((value) => `"${value}"`).join(", ")}]. Use the declared actor alone; same-rig or mixed actors do not inherit this adoption.`,
      });
      continue;
    }
    if (adoption.receipt.handoff.mode === "native") {
      if (
        adoption.sourceMotion.skeleton !== targetSkeleton.id ||
        nativeExternalMotionRigCompatible(
          adoption.receipt.handoff.sourceRig,
          adoption.receipt.handoff.mapping.map((entry) => entry.bone),
          targetSkeleton,
        ) === false
      ) {
        diagnostics.push({
          code: "source-motion-adoption-invalid",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.sourcePath,
          message: `Native external motion adoption "${declaration.id}" was authored for source rig "${adoption.sourceMotion.skeleton}" but actor "${declaration.actor}" does not resolve the same mapped hierarchy, rest transforms, constraints, and rig identity in "${targetSkeleton.id}". Choose retarget mode or bind a byte-compatible native rig.`,
        });
        continue;
      }
      clips.push(adoption.sourceMotion);
      conversions.push(
        externalMotionConversionDraft({
          adoption,
          shot: declaration.shot,
          targetModel: actor.model,
          targetSkeleton,
          motion: adoption.sourceMotion,
          characterization: { status: "compatible", findings: [] },
          losses: [],
        }),
      );
      continue;
    }
    const retargeted = retargetHumanoidMotion({
      motion: adoption.sourceMotion,
      source: adoption.receipt.handoff.sourceRig,
      target: targetSkeleton,
      rootScale: adoption.receipt.handoff.translationScale,
      id: declaration.clip,
    });
    const findings =
      retargeted.validation.success === false
        ? retargeted.validation.violations
        : (retargeted.validation.warnings ?? []);
    diagnostics.push(
      ...findings.map(
        (finding): IAutoMovieDiagnostic => ({
          code: "source-motion-retarget-invalid",
          category: finding.severity === "error" ? "error" : "warning",
          phase: "source",
          target: props.target,
          path: props.sourcePath,
          message: `External motion adoption "${declaration.id}" retarget ${finding.path}: ${finding.expected}. Correct the declared source rig, target actor, mapping, or translation scale.`,
        }),
      ),
    );
    if (retargeted.motion !== null) {
      clips.push(retargeted.motion);
      const characterization: IAutoMovieExternalMotionReceiptCharacterization =
        findings.length === 0
          ? { status: "compatible", findings: [] }
          : {
              status: "override-required",
              findings: findings.map(
                (finding) => `${finding.path}: ${finding.expected}`,
              ),
            };
      const losses: IAutoMovieExternalMotionLossEntry[] = findings.map(
        (finding) => ({
          kind: "semantic-loss",
          source: [finding.path],
          consequence: finding.expected,
          authorized: false,
        }),
      );
      conversions.push(
        externalMotionConversionDraft({
          adoption,
          shot: declaration.shot,
          targetModel: actor.model,
          targetSkeleton,
          motion: retargeted.motion,
          characterization,
          losses,
        }),
      );
    }
  }
  return { clips, conversions, diagnostics };
};

/** Build the deterministic receipt facts available before output bytes exist. */
const externalMotionConversionDraft = (props: {
  adoption: IProductionExternalMotionAdoption;
  shot: string;
  targetModel: string;
  targetSkeleton: IAutoMovieSkeleton;
  motion: IAutoMovieMotion;
  characterization: IAutoMovieExternalMotionReceiptCharacterization;
  losses: IAutoMovieExternalMotionLossEntry[];
}): IProductionExternalMotionConversionDraft => {
  const declaration = props.adoption.declaration;
  const mapping = declaration.mapping
    .map((entry) => ({ ...entry }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.source, right.source) ||
        compareCodeUnits(left.target, right.target),
    );
  const channelSources = props.adoption.receipt.take.tracks.map((track) =>
    track.channel.kind === "node"
      ? `${track.channel.node}:${track.channel.path}`
      : `${track.channel.pointer}:${track.channel.valueType}`,
  );
  const boneByNode = new Map(
    mapping.map((entry) => [entry.source, entry.target] as const),
  );
  const channelTargets = props.adoption.receipt.take.tracks.map((track) =>
    track.channel.kind === "node"
      ? `${boneByNode.get(track.channel.node)!}:${track.channel.path}`
      : track.channel.pointer,
  );
  const transforms: IAutoMovieExternalMotionTransformActivity[] = [
    {
      kind: "channel-conversion",
      source: channelSources,
      target: channelTargets,
      parameters: {
        take: declaration.take,
        sourceTracks: channelSources.length,
        resultChannels: channelTargets.length,
      },
    },
  ];
  if (declaration.mode.kind === "humanoid-retarget") {
    transforms.push({
      kind: "retarget",
      source: mapping.map((entry) => entry.source),
      target: mapping.map((entry) => entry.target),
      parameters: {
        sourceRig: declaration.sourceRig.id,
        targetRig: props.targetSkeleton.id,
      },
    });
    transforms.push({
      kind: "translation-scale",
      source: ["hips:translation"],
      target: ["hips:translation"],
      parameters: { scale: declaration.mode.translationScale },
    });
  }
  return {
    version: 1,
    builder: {
      packageVersion: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
      protocolVersion: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
    },
    adoption: declaration.id,
    source: {
      asset: {
        path: props.adoption.receipt.source.path,
        digest: props.adoption.receipt.source.digest,
      },
      closure: props.adoption.sourceClosure.map((entry) => ({ ...entry })),
      take: { ...props.adoption.sourceTake },
      basis: structuredClone(props.adoption.sourceBasis),
      basisDigest: digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(props.adoption.sourceBasis),
      ),
    },
    decision: {
      shot: props.shot,
      actor: declaration.actor,
      clip: declaration.clip,
      mode: declaration.mode.kind,
      mapping,
      translationScale:
        declaration.mode.kind === "humanoid-retarget"
          ? declaration.mode.translationScale
          : null,
    },
    target: {
      model: props.targetModel,
      skeleton: props.targetSkeleton.id,
      basisDigest: digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(props.targetSkeleton),
      ),
    },
    transforms,
    losses: props.losses.map((entry) => ({
      ...entry,
      source: [...entry.source],
    })),
    characterization: {
      status: props.characterization.status,
      findings: [...props.characterization.findings],
    },
    motion: structuredClone(props.motion),
  };
};

/** Whether every mapped native source bone is byte-compatible with its target. */
const nativeExternalMotionRigCompatible = (
  source: IAutoMovieSkeleton,
  mapped: readonly AutoMovieHumanoidBone[],
  target: IAutoMovieSkeleton,
): boolean => {
  if (source.id !== target.id) return false;
  const sourceBones = new Map(source.bones.map((bone) => [bone.bone, bone]));
  const targetBones = new Map(target.bones.map((bone) => [bone.bone, bone]));
  const mappedBones = new Set(mapped);
  for (const bone of mappedBones) {
    const from = sourceBones.get(bone);
    const to = projectedNativeBone(targetBones, mappedBones, bone);
    if (
      from === undefined ||
      to === null ||
      Buffer.from(canonicalAutoMovieJsonBytes(from)).equals(
        Buffer.from(canonicalAutoMovieJsonBytes(to)),
      ) === false
    )
      return false;
  }
  return true;
};

/**
 * Collapse unmapped target helpers exactly as byte-grounded source mapping
 * does.
 */
const projectedNativeBone = (
  bones: ReadonlyMap<
    AutoMovieHumanoidBone,
    IAutoMovieSkeleton["bones"][number]
  >,
  mapped: ReadonlySet<AutoMovieHumanoidBone>,
  bone: AutoMovieHumanoidBone,
): IAutoMovieSkeleton["bones"][number] | null => {
  const terminal = bones.get(bone);
  if (terminal === undefined) return null;
  const chain: IAutoMovieSkeleton["bones"][number][] = [terminal];
  let parent = terminal.parent;
  while (parent !== null && mapped.has(parent) === false) {
    const helper = bones.get(parent);
    if (helper === undefined) return null;
    chain.push(helper);
    parent = helper.parent;
  }
  let rest: IAutoMovieSkeleton["bones"][number]["rest"] = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  for (const member of chain.reverse())
    rest = composeNativeRest(rest, member.rest);
  return {
    bone,
    parent,
    rest,
    constraint: structuredClone(terminal.constraint),
  };
};

/** Compose two parent-local TRS values without introducing matrix ambiguity. */
const composeNativeRest = (
  parent: IAutoMovieSkeleton["bones"][number]["rest"],
  local: IAutoMovieSkeleton["bones"][number]["rest"],
): IAutoMovieSkeleton["bones"][number]["rest"] => {
  const scaled = {
    x: local.translation.x * parent.scale.x,
    y: local.translation.y * parent.scale.y,
    z: local.translation.z * parent.scale.z,
  };
  const q = parent.rotation;
  const uv = {
    x: q.y * scaled.z - q.z * scaled.y,
    y: q.z * scaled.x - q.x * scaled.z,
    z: q.x * scaled.y - q.y * scaled.x,
  };
  const uuv = {
    x: q.y * uv.z - q.z * uv.y,
    y: q.z * uv.x - q.x * uv.z,
    z: q.x * uv.y - q.y * uv.x,
  };
  const rotated = {
    x: scaled.x + 2 * (q.w * uv.x + uuv.x),
    y: scaled.y + 2 * (q.w * uv.y + uuv.y),
    z: scaled.z + 2 * (q.w * uv.z + uuv.z),
  };
  const a = parent.rotation;
  const b = local.rotation;
  return {
    translation: {
      x: parent.translation.x + rotated.x,
      y: parent.translation.y + rotated.y,
      z: parent.translation.z + rotated.z,
    },
    rotation: {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    },
    scale: {
      x: parent.scale.x * local.scale.x,
      y: parent.scale.y * local.scale.y,
      z: parent.scale.z * local.scale.z,
    },
  };
};
