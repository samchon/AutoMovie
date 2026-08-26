import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionGuideName,
  IAutoMovieCompileProjectOutput,
} from "@automovie/interface";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  findAutoMovieProjectRoot,
  openAutoMovieProduction,
} from "./openAutoMovieProduction";
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";

/**
 * Active services for one resident production repository.
 */
export interface IAutoMovieProductionServices {
  /**
   * Tracked production project.
   */
  project: AutoMovieProductionProject;
  /**
   * Deterministic compiler.
   */
  compiler: AutoMovieProductionCompiler;
  /**
   * Geometry and actual-frame oracle.
   */
  oracle: AutoMovieProductionOracleService;
  /**
   * Read-only source-gate status.
   */
  compileStatus: () => IAutoMovieCompileProjectOutput;
}

/**
 * Session context: guide reads, fixed root and current production services.
 */
export class AutoMovieProductionContext {
  private readonly guides = new Set<AutoMovieProductionGuideName>();
  private readonly root: string;
  private readonly services = new Map<string, IAutoMovieProductionServices>();

  /** Open one host-fixed MCP production context. */
  public constructor(
    private readonly capture?: AutoMovieProductionFrameCapture,
    projectRoot?: string,
    private readonly defaultProductionId?: string,
    /** Archetype catalogue every production opened here is judged against. */
    private readonly archetypes?: AutoMovieModelArchetypeRegistry,
  ) {
    validateProductionId(defaultProductionId);
    this.root = findAutoMovieProjectRoot(projectRoot);
  }

  /**
   * Record delivery of one exact guide.
   */
  public recordGuide(name: AutoMovieProductionGuideName): void {
    this.guides.add(name);
  }

  /**
   * Whether one exact guide received session credit.
   */
  public hasGuide(name: AutoMovieProductionGuideName): boolean {
    return this.guides.has(name);
  }

  /**
   * Resolve one production under the immutable host root.
   */
  public forProduction(productionId?: string): IAutoMovieProductionServices {
    validateProductionId(productionId);
    const registered = AutoMovieProductionProject.registeredProductionIds(
      this.root,
    );
    let selected = productionId ?? this.defaultProductionId;
    if (selected === undefined) {
      if (registered.length !== 1)
        throw new Error(
          registered.length === 0
            ? "The project has no registered production. Create and compile one through the non-MCP project API before requesting evidence."
            : `The project has ${registered.length} registered productions. Configure one productionId from: ${registered.join(", ")}.`,
        );
      selected = registered[0]!;
    }
    if (registered.includes(selected) === false)
      throw new Error(
        `Production "${selected}" is not registered. Choose one current productionId from: ${registered.join(", ")}.`,
      );
    const retained = this.services.get(selected);
    if (retained !== undefined) return retained;
    const opened = openAutoMovieProduction({
      projectRoot: this.root,
      productionId: selected,
      capture: this.capture,
      archetypes: this.archetypes,
    });
    this.services.set(opened.project.productionId, opened);
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
