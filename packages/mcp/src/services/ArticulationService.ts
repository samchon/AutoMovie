import { resolveFrame, sceneToNodes } from "@automovie/engine";
import { AutoMovieContext } from "../AutoMovieContext";
import { toEnginePropSpec } from "../convert";
import { IAutoMovieGetResolvedPropFrameOutput } from "../dto";
import { shotIdOf } from "../project/shotKey";

/** Resolve a committed articulated prop through its declared profile. */
export class ArticulationService {
  public constructor(private readonly context: AutoMovieContext) {}

  public getResolvedPropFrame(props: {
    beat: string;
    t?: number;
  }): IAutoMovieGetResolvedPropFrameOutput {
    const project = this.context.requireProject("getResolvedPropFrame");
    if (typeof props !== "object" || props === null || Array.isArray(props))
      throw new Error(
        "getResolvedPropFrame request at $input must be a JSON object",
      );
    if (typeof props.beat !== "string" || props.beat.trim().length === 0)
      return { frame: null, reason: "beat must be a non-empty string" };
    const seconds = props.t ?? 0;
    if (!Number.isFinite(seconds) || seconds < 0)
      return { frame: null, reason: "t must be a finite number >= 0" };
    const slate = project.writableSlate();
    if (slate.scene === null)
      return {
        frame: null,
        reason: "commitScene before resolving a prop frame",
      };
    const shot = slate.shots.find((entry) => entry.id === shotIdOf(props.beat));
    if (shot === undefined)
      return {
        frame: null,
        reason: `no committed shot for beat "${props.beat}", perform then commitShot first`,
      };
    if (seconds > shot.duration)
      return {
        frame: null,
        reason: `t ${seconds} lies after shot "${shot.id}" ending at ${shot.duration}`,
      };
    try {
      const specs = project.storedProps();
      const propsByModel = Object.fromEntries(
        specs.map((spec) => [spec.node, toEnginePropSpec(spec)]),
      );
      const nodes = sceneToNodes({
        scene: slate.scene,
        props: propsByModel,
        allowPartialModels: true,
      });
      const placements = new Map(
        slate.scene.nodes.map((placement) => [placement.id, placement]),
      );
      const profiles = specs.flatMap((spec) => {
        if (spec.articulation === null) return [];
        const articulation = toEnginePropSpec(spec).articulation!;
        return [...placements.values()]
          .filter((placement) => placement.model === spec.node)
          .map((placement) => ({
            profile: articulation.profile,
            binding: articulation.binding,
            nodePrefix: `${placement.id}/`,
          }));
      });
      const resolved = resolveFrame({
        nodes,
        clip: shot.objectMotions,
        limits: [],
        profiles,
        seconds,
      });
      return {
        frame: {
          world: Object.fromEntries(resolved.world),
          clamps: resolved.violations.map((violation) => ({
            channel: violation.channel,
            profile: violation.profile!,
            component: violation.component,
            bound: violation.bound,
            actual: violation.actual,
            limit: violation.limit,
          })),
          deferredDriverTypes: resolved.deferredDrivers.map(
            (driver) => driver.type,
          ),
        },
        reason: null,
      };
    } catch (error) {
      return { frame: null, reason: String((error as Error).message) };
    }
  }
}
