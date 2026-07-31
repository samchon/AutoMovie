import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionGuideName,
  IAutoMovieCompileProjectOutput,
} from "@automovie/interface";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { AutoMovieProductionReviewService } from "./AutoMovieProductionReviewService";
import {
  findAutoMovieProjectRoot,
  openAutoMovieProduction,
} from "./openAutoMovieProduction";

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

/** Session context: guide reads, fixed root and current production services. */
export class AutoMovieProductionContext {
  private readonly guides = new Set<AutoMovieProductionGuideName>();
  private readonly root: string;
  private readonly services = new Map<string, IAutoMovieProductionServices>();

  public constructor(
    private readonly capture?: AutoMovieProductionFrameCapture,
    projectRoot?: string,
    private readonly defaultProductionId?: string,
  ) {
    validateProductionId(defaultProductionId);
    this.root = findAutoMovieProjectRoot(projectRoot);
  }

  /** Record delivery of one exact guide. */
  public recordGuide(name: AutoMovieProductionGuideName): void {
    this.guides.add(name);
  }

  /** Whether one exact guide received session credit. */
  public hasGuide(name: AutoMovieProductionGuideName): boolean {
    return this.guides.has(name);
  }

  /** Resolve one production under the immutable host root. */
  public forProduction(productionId?: string): IAutoMovieProductionServices {
    validateProductionId(productionId);
    const selected = productionId ?? this.defaultProductionId;
    const key = selected ?? "";
    const retained = this.services.get(key);
    if (retained !== undefined) return retained;
    const opened = openAutoMovieProduction({
      projectRoot: this.root,
      productionId: selected,
      capture: this.capture,
    });
    this.services.set(opened.project.productionId, opened);
    if (selected === undefined) this.services.set("", opened);
    return opened;
  }
}

const validateProductionId = (productionId: string | undefined): void => {
  if (
    productionId !== undefined &&
    (productionId.trim().length === 0 || productionId.trim() !== productionId)
  )
    throw new Error(
      "Host productionId must be a trimmed non-empty production namespace.",
    );
};
