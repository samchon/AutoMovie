import path from "node:path";

import { AutoMovieMcpFrameCapture } from "./dto";
import { AutoMovieProject } from "./project/AutoMovieProject";

/**
 * Runtime context shared by the {@link AutoMovieApplication} facade and its
 * services — the deterministic infrastructure the tools run on, never LLM
 * orchestration.
 *
 * It carries the host-injected frame-capture adapter (#608) and the resident
 * {@link AutoMovieProject} (#614 — the project directory itself, JSON AST plus
 * 3D assets, is the memory, unlike AutoBe's hidden `.autobe` JSON mirror). The
 * prerequisite graph (#615) will read the resident project from here.
 */
export class AutoMovieContext {
  private project_: AutoMovieProject | null = null;

  public constructor(
    /**
     * Frame-capture adapter owned by the host (a Playwright page, a render
     * worker), or `undefined` when the host has none — `seeFrame` then reports
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
    if (this.project_ === null || this.project_.root !== normalized)
      this.project_ = AutoMovieProject.open(normalized);
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
}
