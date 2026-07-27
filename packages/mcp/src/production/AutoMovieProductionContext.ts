import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionGuideName,
  IAutoMovieCompileProjectOutput,
} from "@automovie/interface";
import path from "node:path";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { AutoMovieProductionReviewService } from "./AutoMovieProductionReviewService";

/** Active services for one resident production repository. */
export interface IAutoMovieProductionServices {
  /** Tracked production project. */
  project: AutoMovieProductionProject;
  /** Deterministic compiler. */
  compiler: AutoMovieProductionCompiler;
  /** Geometry and actual-frame oracle. */
  oracle: AutoMovieProductionOracleService;
  /** Evidence-bound review ledger. */
  review: AutoMovieProductionReviewService;
  /** Read-only source-gate status without review-queue recursion. */
  compileStatus: () => IAutoMovieCompileProjectOutput;
}

/** One root activation and whether this exact call initialized its manifest. */
export interface IAutoMovieProductionActivation {
  /** Active resident services. */
  services: IAutoMovieProductionServices;
  /** True only when this call created the format-v2 manifest. */
  initialized: boolean;
}

/** Session context: guide reads, fixed root and current production services. */
export class AutoMovieProductionContext {
  private readonly guides = new Set<AutoMovieProductionGuideName>();
  private readonly fixedRoot: string | null;
  private active: IAutoMovieProductionServices | null = null;

  public constructor(
    private readonly capture?: AutoMovieProductionFrameCapture,
    projectRoot?: string,
  ) {
    this.fixedRoot =
      projectRoot === undefined ? null : path.resolve(projectRoot);
  }

  /** Record delivery of one exact guide. */
  public recordGuide(name: AutoMovieProductionGuideName): void {
    this.guides.add(name);
  }

  /** Require a guide before a mutating or specialized operation. */
  public requireGuide(
    name: AutoMovieProductionGuideName,
    operation: string,
  ): void {
    if (this.guides.has(name)) return;
    throw new Error(
      `${operation} requires its guide first. Call getGuideDocument({ name: "${name}" }) and then retry.`,
    );
  }

  /** Activate or reopen one production root. */
  public activate(rootInput: string): IAutoMovieProductionActivation {
    const root = path.resolve(rootInput);
    if (this.fixedRoot !== null && path.relative(this.fixedRoot, root) !== "")
      throw new Error(
        `This MCP host is fixed to "${this.fixedRoot}". Open that root instead of model-controlled path "${root}".`,
      );
    if (this.active !== null && this.active.project.root === root)
      return { services: this.active, initialized: false };
    const project = AutoMovieProductionProject.open(root);
    const statusCompiler = new AutoMovieProductionCompiler(project);
    const review = new AutoMovieProductionReviewService(project, () =>
      statusCompiler.lint({ scope: "source" }),
    );
    const compiler = new AutoMovieProductionCompiler(project, (status) =>
      review.queue(status),
    );
    this.active = {
      project,
      review,
      compiler,
      compileStatus: () => statusCompiler.lint({ scope: "source" }),
      oracle: new AutoMovieProductionOracleService(project, this.capture, () =>
        statusCompiler.lint({ scope: "source" }),
      ),
    };
    return {
      services: this.active,
      initialized: project.summary().initialized,
    };
  }

  /** Require an active resident project. */
  public require(operation: string): IAutoMovieProductionServices {
    if (this.active !== null) return this.active;
    throw new Error(
      `${operation} requires an active production repository. Call openProject({ root }) first.`,
    );
  }
}
