import {
  AutoMovieProductionFrameCapture,
  IAutoMovieCompileProject,
  IAutoMovieDiagnostic,
  IAutoMovieEraseDesignArtifact,
  IAutoMovieGetGuideDocument,
  IAutoMovieInspectProject,
  IAutoMovieOpenProject,
  IAutoMoviePrepareReview,
  IAutoMoviePreviewFrame,
  IAutoMovieProductionNextAction,
  IAutoMovieQueryGeometry,
  IAutoMovieSetAcceptanceScenario,
  IAutoMovieSetFormationDesign,
  IAutoMovieSetModelRecipe,
  IAutoMovieSetProductionDesign,
  IAutoMovieSetShotContract,
  IAutoMovieSetWorldDesign,
  IAutoMovieSubmitReview,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import { AutoMovieProductionContext } from "./production/AutoMovieProductionContext";
import { AutoMovieProductionGuideService } from "./production/AutoMovieProductionGuideService";
import { compareCodeUnits } from "./production/contentIdentity";

/**
 * AutoMovie is a deterministic production compiler, oracle and review gate for
 * coding agents. The agent writes screenplay, TypeScript shots and tests as
 * files; AutoMovie owns bounded design, generated identity, physics queries,
 * actual-frame evidence and freshness. Start with
 * `getGuideDocument({name:"AUTOMOVIE_OVERALL"})`, then `openProject`. The
 * server never runs an internal LLM.
 */
export class AutoMovieProductionApplication {
  private readonly context: AutoMovieProductionContext;
  private readonly guides = new AutoMovieProductionGuideService();

  public constructor(props?: {
    /** Host-owned actual PNG capture. */
    capture?: AutoMovieProductionFrameCapture;
    /** Optional project-fixed root. */
    projectRoot?: string;
  }) {
    this.context = new AutoMovieProductionContext(
      props?.capture,
      props?.projectRoot,
    );
  }

  /**
   * Read one exact production guide. Start with `AUTOMOVIE_OVERALL`; read the
   * guide named by a setter, compiler, oracle or review prerequisite before
   * calling that method.
   */
  public getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument {
    const output = this.guides.get(props.name);
    this.context.recordGuide(props.name);
    return output;
  }

  /**
   * Activate a resident production repository. The folder is durable memory:
   * tracked design and review records, coding-agent source, compiler-owned
   * generated output, and content-addressed renders.
   */
  public openProject(
    props: IAutoMovieOpenProject.IProps,
  ): IAutoMovieOpenProject {
    this.context.requireGuide("AUTOMOVIE_OVERALL", "openProject");
    const activation = this.context.activate(props.root);
    return {
      project: {
        ...activation.services.project.summary(),
        initialized: activation.initialized,
      },
    };
  }

  /**
   * Inspect compact design, source, generated, review and render status without
   * echoing large design or source payloads. Use nextActions as exact
   * corrections.
   */
  public inspectProject(
    props: IAutoMovieInspectProject.IProps,
  ): IAutoMovieInspectProject {
    void props;
    const services = this.context.require("inspectProject");
    const graph = services.project.graph();
    const bound: string[] = [];
    const missing: string[] = [];
    for (const source of new Set(
      [...graph.shots.values()].map((shot) => shot.source.module),
    ))
      try {
        services.project.readSource(source);
        bound.push(source);
      } catch {
        missing.push(source);
      }
    bound.sort(compareCodeUnits);
    missing.sort(compareCodeUnits);
    const generated = services.project.generatedManifest();
    const owned = new Set(generated?.files.map((file) => file.path) ?? []);
    const unownedGenerated = listFiles(services.project.generatedRoot())
      .map((file) =>
        normalizeSlash(path.relative(services.project.generatedRoot(), file)),
      )
      .filter((file) => owned.has(file) === false);
    const compilation = services.compileStatus();
    const diagnostics = compilation.diagnostics;
    const reviews = services.review.queue();
    const renders = listNamedFiles(
      services.project.renderRoot(),
      "manifest.json",
    )
      .map((file) => ({
        path: normalizeSlash(path.relative(services.project.root, file)),
        current:
          compilation.success &&
          generated !== null &&
          generated.inputFingerprint ===
            compilation.compiler.inputFingerprint &&
          renderCompileFingerprint(file) === generated.inputFingerprint,
      }))
      .sort((left, right) => compareCodeUnits(left.path, right.path));
    const nextActions: IAutoMovieProductionNextAction[] = [
      ...(generated === null && compilation.success
        ? [
            {
              owner: "compile" as const,
              action: "compileProject",
              target: "generated-manifest",
              reason:
                "Current design and source pass lint but no compiler-owned output exists.",
            },
          ]
        : []),
      ...diagnostics
        .filter(
          (diagnostic) =>
            diagnostic.category === "error" ||
            diagnostic.code === "generated-stale",
        )
        .map(diagnosticNextAction),
      ...reviews.entries
        .filter((entry) => entry.state !== "complete")
        .map((entry) => ({
          owner: "review" as const,
          action: "prepareReview",
          target: JSON.stringify(entry.target),
          reason: `Current review state is ${entry.state}.`,
        })),
    ];
    return {
      revision: services.project.revision(),
      design: services.project.inventory(),
      source: { bound, missing, unownedGenerated },
      diagnostics,
      reviews,
      renders,
      nextActions,
    };
  }

  /** Set the singleton global production invariants. */
  public setProductionDesign(
    props: IAutoMovieSetProductionDesign.IProps,
  ): IAutoMovieSetProductionDesign {
    this.context.requireGuide("PRODUCTION_DESIGN", "setProductionDesign");
    return this.context
      .require("setProductionDesign")
      .project.setProductionDesign(props);
  }

  /** Upsert one bounded primitive model recipe. */
  public setModelRecipe(
    props: IAutoMovieSetModelRecipe.IProps,
  ): IAutoMovieSetModelRecipe {
    this.context.requireGuide("MODEL_RECIPE", "setModelRecipe");
    return this.context.require("setModelRecipe").project.setModelRecipe(props);
  }

  /** Set the singleton named and queryable production world. */
  public setWorldDesign(
    props: IAutoMovieSetWorldDesign.IProps,
  ): IAutoMovieSetWorldDesign {
    this.context.requireGuide("WORLD_DESIGN", "setWorldDesign");
    return this.context.require("setWorldDesign").project.setWorldDesign(props);
  }

  /** Upsert one compact deterministic formation. */
  public setFormationDesign(
    props: IAutoMovieSetFormationDesign.IProps,
  ): IAutoMovieSetFormationDesign {
    this.context.requireGuide("FORMATION_DESIGN", "setFormationDesign");
    return this.context
      .require("setFormationDesign")
      .project.setFormationDesign(props);
  }

  /** Upsert one source-bound shot contract. */
  public setShotContract(
    props: IAutoMovieSetShotContract.IProps,
  ): IAutoMovieSetShotContract {
    this.context.requireGuide("SHOT_CONTRACT", "setShotContract");
    return this.context
      .require("setShotContract")
      .project.setShotContract(props);
  }

  /** Upsert one observable acceptance scenario. */
  public setAcceptanceScenario(
    props: IAutoMovieSetAcceptanceScenario.IProps,
  ): IAutoMovieSetAcceptanceScenario {
    this.context.requireGuide("ACCEPTANCE", "setAcceptanceScenario");
    return this.context
      .require("setAcceptanceScenario")
      .project.setAcceptanceScenario(props);
  }

  /** Erase exactly one unreferenced design artifact with an audit reason. */
  public eraseDesignArtifact(
    props: IAutoMovieEraseDesignArtifact.IProps,
  ): IAutoMovieEraseDesignArtifact {
    if (props.reason.trim().length === 0)
      throw new Error(
        "eraseDesignArtifact requires a non-empty reason before changing tracked design.",
      );
    this.context.requireGuide("PRODUCTION_DESIGN", "eraseDesignArtifact");
    return this.context
      .require("eraseDesignArtifact")
      .project.eraseDesignArtifact(props.target);
  }

  /** Compile design and coding-agent source through the requested atomic gate. */
  public compileProject(
    props: IAutoMovieCompileProject.IProps,
  ): IAutoMovieCompileProject {
    this.context.requireGuide("COMPILATION", "compileProject");
    return this.context.require("compileProject").compiler.compile(props);
  }

  /** Query one current distance, reach, pose, ground, formation or camera fact. */
  public queryGeometry(
    props: IAutoMovieQueryGeometry.IProps,
  ): IAutoMovieQueryGeometry {
    this.context.requireGuide("GEOMETRY", "queryGeometry");
    return this.context.require("queryGeometry").oracle.query(props);
  }

  /** Capture one verified actual PNG in a current content-addressed bundle. */
  public async previewFrame(
    props: IAutoMoviePreviewFrame.IProps,
  ): Promise<IAutoMoviePreviewFrame> {
    this.context.requireGuide("PRODUCTION_RENDER", "previewFrame");
    return this.context.require("previewFrame").oracle.preview(props);
  }

  /** Prepare current criteria and exact quotable evidence for one review target. */
  public prepareReview(
    props: IAutoMoviePrepareReview.IProps,
  ): IAutoMoviePrepareReview {
    this.context.requireGuide("PRODUCTION_REVIEW", "prepareReview");
    return this.context.require("prepareReview").review.prepare(props);
  }

  /** Validate and store one evidence-first external-agent review worksheet. */
  public submitReview(
    props: IAutoMovieSubmitReview.IProps,
  ): IAutoMovieSubmitReview {
    this.context.requireGuide("PRODUCTION_REVIEW", "submitReview");
    return this.context.require("submitReview").review.submit(props);
  }
}

const listFiles = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) output.push(child);
      else if (status.isDirectory()) visit(child);
      else if (status.isFile()) output.push(child);
    }
  };
  visit(root);
  return output;
};

const diagnosticNextAction = (
  diagnostic: IAutoMovieDiagnostic,
): IAutoMovieProductionNextAction => {
  if (diagnostic.phase === "design")
    return {
      owner: "design",
      action: "correct-design",
      target: diagnostic.target,
      reason: diagnostic.message,
    };
  if (diagnostic.phase === "source")
    return {
      owner: "source",
      action: "correct-source",
      target: diagnostic.path!,
      reason: diagnostic.message,
    };
  return {
    owner: "compile",
    action:
      diagnostic.code === "generated-unowned"
        ? "remove-unowned-generated"
        : "compileProject",
    target: diagnostic.target,
    reason: diagnostic.message,
  };
};

const listNamedFiles = (root: string, name: string): string[] =>
  listFiles(root).filter((file) => path.basename(file) === name);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const renderCompileFingerprint = (file: string): string | null => {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "compileFingerprint" in value &&
      typeof value.compileFingerprint === "string"
    )
      return value.compileFingerprint;
  } catch {
    // Malformed render manifests are never current.
  }
  return null;
};
