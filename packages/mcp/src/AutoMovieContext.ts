import path from "node:path";

import {
  AutoMovieMcpFrameCapture,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
} from "./dto";
import { AutoMovieProject } from "./project/AutoMovieProject";

/**
 * Runtime context shared by the {@link AutoMovieApplication} facade and its
 * services, the deterministic infrastructure the tools run on, never LLM
 * orchestration.
 *
 * It carries the host-injected frame-capture adapter (#608) and the resident
 * {@link AutoMovieProject} (#614, the project directory itself, JSON AST plus 3D
 * assets, is the memory, unlike AutoBe's hidden `.autobe` JSON mirror). The
 * prerequisite graph (#615) will read the resident project from here.
 */
export class AutoMovieContext {
  private project_: AutoMovieProject | null = null;
  private geometryModels: IAutoMovieMcpGeometryModel[] = [];
  private geometryMotionsByBeat = new Map<
    string,
    Record<string, IAutoMovieMcpMotion>
  >();
  private performedMotionsByShot = new Map<
    string,
    Record<string, IAutoMovieMcpMotion>
  >();

  public constructor(
    /**
     * Frame-capture adapter owned by the host (a Playwright page, a render
     * worker), or `undefined` when the host has none, `seeFrame` then reports
     * `no-capture-adapter` honestly instead of pretending.
     */
    public readonly capture?: AutoMovieMcpFrameCapture,
    /** Project root to activate immediately, or `undefined` to start without. */
    projectRoot?: string,
  ) {
    if (projectRoot !== undefined) this.activateProject(projectRoot);
  }

  /**
   * Activate (open-or-create) the project at `rootDir`. Reloads only when the
   * root changes, so repeated activation with the same location keeps the live
   * instance (the AutoBe `activateProjectLocation` structure).
   */
  public activateProject(rootDir: string): AutoMovieProject {
    const normalized = path.resolve(rootDir);
    if (this.project_ === null || this.project_.root !== normalized) {
      this.project_ = AutoMovieProject.open(normalized);
      this.clearGeometryMemory();
    }
    return this.project_;
  }

  /** The resident project, or `null` when none has been activated. */
  public get project(): AutoMovieProject | null {
    return this.project_;
  }

  /** The resident project, or an actionable error naming the fix. */
  public requireProject(caller: string): AutoMovieProject {
    if (this.project_ !== null) return this.project_;
    throw new Error(
      `${caller} was called without a slate and no project is active. ` +
        `Call openProject with the project root first (or pass the slate explicitly).`,
    );
  }

  /** Remember the session-only model skeletons a resident commitScene received. */
  public rememberGeometryModels(models: IAutoMovieMcpGeometryModel[]): void {
    this.geometryModels = models.map((model) => ({
      id: model.id,
      skeleton: model.skeleton,
    }));
    this.geometryMotionsByBeat.clear();
    this.performedMotionsByShot.clear();
  }

  /**
   * Keep one resident `perform` result available for the following
   * `commitShot`. Compiled clips are still derived rather than persisted; this
   * is only the compact response's same-session handoff (#1365).
   */
  public rememberPerformedMotions(
    shot: string,
    motions: Record<string, IAutoMovieMcpMotion>,
  ): void {
    this.performedMotionsByShot.set(shot, cloneMotions(motions));
  }

  /** The compact resident result's registry, isolated from caller mutation. */
  public performedMotions(
    shot: string,
  ): Record<string, IAutoMovieMcpMotion> | undefined {
    const motions = this.performedMotionsByShot.get(shot);
    return motions === undefined ? undefined : cloneMotions(motions);
  }

  /** Consume a compact response's handoff after its shot commits. */
  public forgetPerformedMotions(shot: string): void {
    this.performedMotionsByShot.delete(shot);
  }

  /**
   * Remember session-only compiled motions a resident commit received, scoped
   * to the beat whose shot they animate (#1091). `compilePerformance` names
   * every actor's clip `perform:<actor>`, NOT beat-scoped, so a shared registry
   * let beat N's commit silently overwrite beat N−1's clip for the same actor,
   * and earlier beats' end states sampled the wrong clip. Each beat keeps its
   * own snapshot (replaced whole, like the shot it belongs to), and reads
   * resolve through the queried beat.
   */
  public rememberGeometryMotions(
    motions: Record<string, IAutoMovieMcpMotion>,
    beat: string,
  ): void {
    this.geometryMotionsByBeat.set(
      beat,
      Object.fromEntries(
        Object.values(motions).map((motion) => [motion.id, motion]),
      ),
    );
  }

  /**
   * Merge session-only compiled motions into a beat's snapshot, the surgical
   * counterpart for {@link rememberGeometryMotions}: `setActorPerformance`
   * updates ONE performance, so the beat's other remembered clips survive.
   */
  public mergeGeometryMotions(
    motions: Record<string, IAutoMovieMcpMotion>,
    beat: string,
  ): void {
    this.geometryMotionsByBeat.set(beat, {
      ...this.geometryMotionsByBeat.get(beat),
      ...Object.fromEntries(
        Object.values(motions).map((motion) => [motion.id, motion]),
      ),
    });
  }

  /** Clear non-persisted geometry memory when the resident scene root changes. */
  public clearGeometryMemory(): void {
    this.geometryModels = [];
    this.geometryMotionsByBeat.clear();
    this.performedMotionsByShot.clear();
  }

  /** Clear compiled clips when resident shots are invalidated. */
  public clearGeometryMotions(): void {
    this.geometryMotionsByBeat.clear();
    this.performedMotionsByShot.clear();
  }

  /**
   * Session-only geometry memory; project files do not persist these payloads.
   *
   * With a `beat`, motions are that beat's own snapshot. Without one, the view
   * unions all beats and DROPS any id whose content differs across beats
   * (#1091): a beat-less query against an ambiguous id must miss (the
   * downstream "motion not registered" reason names the fix, pass the beat)
   * rather than sample whichever beat committed last.
   */
  public geometryMemory(beat?: string): {
    models: IAutoMovieMcpGeometryModel[];
    motions: Record<string, IAutoMovieMcpMotion>;
  } {
    const motions: Record<string, IAutoMovieMcpMotion> = {};
    if (beat !== undefined)
      Object.assign(motions, this.geometryMotionsByBeat.get(beat));
    else {
      const ambiguous = new Set<string>();
      for (const registry of this.geometryMotionsByBeat.values())
        for (const [id, motion] of Object.entries(registry)) {
          if (ambiguous.has(id)) continue;
          const existing = motions[id];
          if (existing === undefined) motions[id] = motion;
          else if (JSON.stringify(existing) !== JSON.stringify(motion)) {
            Reflect.deleteProperty(motions, id);
            ambiguous.add(id);
          }
        }
    }
    return {
      models: this.geometryModels.map((model) => ({
        id: model.id,
        skeleton: model.skeleton,
      })),
      motions,
    };
  }
}

const cloneMotions = (
  motions: Record<string, IAutoMovieMcpMotion>,
): Record<string, IAutoMovieMcpMotion> =>
  JSON.parse(JSON.stringify(motions)) as Record<string, IAutoMovieMcpMotion>;
