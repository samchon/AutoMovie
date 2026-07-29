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
import { productionRenderTargetFingerprint } from "./production/renderIdentity";

/**
 * AutoMovie is the production-control MCP for coding agents. The agent authors
 * screenplay, TypeScript shot modules, tests and the final render command in
 * the project filesystem; these tools own only versioned guides, bounded design
 * records, deterministic compilation, geometry and frame oracles, and
 * evidence-gated review. Begin with
 * `getGuideDocument({name:"AUTOMOVIE_OVERALL"})`, then `openProject`. The
 * server never runs an internal LLM and never asks the model to invent or
 * recompute generated geometry, ownership manifests or review fingerprints.
 *
 * Use ordinary code for narrative and shot construction. Call MCP where the
 * answer must be derived from current repository bytes, engine constraints or
 * actual captured pixels, or where a tracked gate must prevent an unsupported
 * completion claim. Read the prerequisite guide named by a refusal, apply the
 * correction in the owning layer, and retry the same tool.
 *
 * @author Samchon
 */
export class AutoMovieApplication {
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
   * Return one exact, package-versioned production guide and record that it was
   * read in this MCP session. Read `AUTOMOVIE_OVERALL` before `openProject`,
   * then read the specific guide named by a refused design, compile, oracle or
   * review call. This tool exists because guide acknowledgement is a real
   * precondition of state-changing and evidence-producing tools, not advisory
   * prompt text. It does not inspect or mutate project files, and it does not
   * replace the coding agent's own repository reading. An unknown name fails
   * instead of returning a guessed or stale document.
   */
  public getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument {
    const output = this.guides.get(props.name);
    this.context.recordGuide(props.name);
    return output;
  }

  /**
   * Activate or initialize one resident production repository after the overall
   * guide has been read. The root becomes durable shared memory: tracked design
   * and review records, coding-agent-owned TypeScript source, compiler-owned
   * generated artifacts and content-addressed renders. This boundary belongs in
   * MCP because every later tool must resolve the same canonical root and
   * ownership policy. It does not author shots, install dependencies, compile,
   * render or review. When the host fixed a project root, a different root is
   * refused instead of silently switching projects.
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
   * Inspect the active repository's current design inventory, bound and missing
   * source, compiler ownership, diagnostics, review queue and render freshness
   * without echoing large source or design payloads into model context. Follow
   * `nextActions` as concrete corrections, then inspect again. This read-only
   * MCP tool is the authoritative status projection because it parses tracked
   * manifests and current filesystem identity; a coding agent should not infer
   * readiness from filenames or prior responses. It never repairs, compiles,
   * renders or marks a review complete.
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
    const reviews = services.review.queue(compilation);
    const renders = listNamedFiles(
      services.project.renderRoot(),
      "manifest.json",
    )
      .map((file) => ({
        path: normalizeSlash(path.relative(services.project.root, file)),
        current: (() => {
          const manifest = services.project.verifiedRenderManifest(file);
          return (
            compilation.success &&
            generated !== null &&
            generated.inputFingerprint ===
              compilation.compiler.inputFingerprint &&
            manifest !== null &&
            manifest.targetFingerprint ===
              productionRenderTargetFingerprint(
                services.project,
                generated,
                manifest.target,
              )
          );
        })(),
      }))
      .sort((left, right) => compareCodeUnits(left.path, right.path));
    const nextActions: IAutoMovieProductionNextAction[] = [
      ...diagnostics
        .filter((diagnostic) => diagnostic.category === "error")
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

  /**
   * Validate and atomically replace the singleton production design: film
   * identity, target runtime, frame format, art direction and required
   * deliverables. Read `PRODUCTION_DESIGN` first and send the complete object,
   * not a patch. This MCP mutation is retained because these invariants define
   * ownership and every downstream fingerprint; accepting an unvalidated file
   * edit would let compilation and review disagree about the production being
   * made. Rejection leaves tracked state unchanged and returns diagnostics and
   * consequences. It does not write screenplay, shot source or generated data.
   */
  public setProductionDesign(
    props: IAutoMovieSetProductionDesign.IProps,
  ): IAutoMovieSetProductionDesign {
    this.context.requireGuide("PRODUCTION_DESIGN", "setProductionDesign");
    return this.context
      .require("setProductionDesign")
      .project.setProductionDesign(props);
  }

  /**
   * Validate and atomically upsert one bounded primitive model recipe after
   * `MODEL_RECIPE` is read. The recipe describes reusable low-detail geometry
   * and semantic rig intent; the compiler, not the coding agent, materializes
   * the runtime model and owns its generated identity. This narrow MCP call
   * keeps numeric bounds, references, invalidation and correction local to one
   * model instead of forcing a giant production rewrite. Send the complete
   * recipe for its id. This tool never imports arbitrary meshes. Rejection
   * changes nothing and writes no compiler-owned model artifact.
   */
  public setModelRecipe(
    props: IAutoMovieSetModelRecipe.IProps,
  ): IAutoMovieSetModelRecipe {
    this.context.requireGuide("MODEL_RECIPE", "setModelRecipe");
    return this.context.require("setModelRecipe").project.setModelRecipe(props);
  }

  /**
   * Validate and atomically replace the singleton named production world after
   * `WORLD_DESIGN` is read. The world gives terrain, surfaces, landmarks,
   * routes, and bounded effect recipes and zones stable identifiers that source
   * code and geometry queries can share. It remains an MCP-owned record because
   * later ground, distance, camera, and effect answers must come from one
   * validated world rather than coordinates independently invented in prose and
   * code. Send the complete world, not a patch. Rejection preserves current
   * state; this tool does not stage actors, author action or render scenery.
   */
  public setWorldDesign(
    props: IAutoMovieSetWorldDesign.IProps,
  ): IAutoMovieSetWorldDesign {
    this.context.requireGuide("WORLD_DESIGN", "setWorldDesign");
    return this.context.require("setWorldDesign").project.setWorldDesign(props);
  }

  /**
   * Validate and atomically upsert one compact deterministic formation after
   * `FORMATION_DESIGN` is read. Describe one bounded layout, orientation and
   * model assignment; line/column/wedge layouts own explicit spacing, while
   * arc/scatter layouts derive separation from radius, angle and count. The
   * compiler stores at most 100,000 deterministic slots as compact chunks and
   * promotes named heroes, so a coding agent need not emit each transform. This
   * is an MCP tool because slot identity, bounds, references and invalidation
   * must be reproducible across compilation and review. It does not animate
   * troops or choose tactics; a rejected complete replacement leaves prior
   * state intact.
   */
  public setFormationDesign(
    props: IAutoMovieSetFormationDesign.IProps,
  ): IAutoMovieSetFormationDesign {
    this.context.requireGuide("FORMATION_DESIGN", "setFormationDesign");
    return this.context
      .require("setFormationDesign")
      .project.setFormationDesign(props);
  }

  /**
   * Validate and atomically upsert one shot contract after `SHOT_CONTRACT` is
   * read. The contract binds a shot id to one coding-agent TypeScript export
   * and declares duration, participants, required opening and closing states,
   * events, camera coverage and formation realization. The agent still authors
   * the shot algorithm in ordinary code; MCP owns this boundary because the
   * compiler must compare observable source output with an independent, tracked
   * specification. Send the complete contract. It neither creates the source
   * module nor accepts source-authored compliance claims.
   */
  public setShotContract(
    props: IAutoMovieSetShotContract.IProps,
  ): IAutoMovieSetShotContract {
    this.context.requireGuide("SHOT_CONTRACT", "setShotContract");
    return this.context
      .require("setShotContract")
      .project.setShotContract(props);
  }

  /**
   * Validate and atomically upsert one observable acceptance scenario after
   * `ACCEPTANCE` is read. A scenario names a target, sampled observation and
   * numeric or categorical expectation that compilation and review can verify
   * independently of persuasive prose. This MCP record is necessary because the
   * final quality loop needs executable, fingerprinted evidence rather than a
   * checklist the same model may waive. Send one complete scenario for its id.
   * It does not implement tests or declare success; unmet expectations remain
   * diagnostics and incomplete review work.
   */
  public setAcceptanceScenario(
    props: IAutoMovieSetAcceptanceScenario.IProps,
  ): IAutoMovieSetAcceptanceScenario {
    this.context.requireGuide("ACCEPTANCE", "setAcceptanceScenario");
    return this.context
      .require("setAcceptanceScenario")
      .project.setAcceptanceScenario(props);
  }

  /**
   * Erase exactly one current, unreferenced design artifact and record a
   * non-empty audit reason after `PRODUCTION_DESIGN` is read. Use this instead
   * of deleting tracked JSON by hand: the project graph must prove that no
   * shot, formation or acceptance record still references the target, compute
   * the downstream invalidation, and commit the deletion atomically. Missing or
   * referenced targets are refused without mutation. The tool never cascades
   * silently and never removes coding-agent source, generated files, renders or
   * review evidence.
   */
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
      .project.eraseDesignArtifact(props.target, props.reason);
  }

  /**
   * Compile current validated design and coding-agent TypeScript through the
   * requested atomic gate after `COMPILATION` is read. Source runs in the
   * deterministic no-I/O compiler boundary; AutoMovie materializes primitive
   * models, compact formation runtimes, promoted heroes, bounded effect
   * streams, shots and contract realization, validates them with engine rules,
   * and owns the generated manifest and fingerprints. This must be an MCP tool
   * because only the engine can authoritatively bind current repository bytes
   * to generated identity. A failed gate returns diagnostics without publishing
   * a partial generation. It does not render the movie or write the agent's
   * source.
   */
  public compileProject(
    props: IAutoMovieCompileProject.IProps,
  ): IAutoMovieCompileProject {
    this.context.requireGuide("COMPILATION", "compileProject");
    return this.context.require("compileProject").compiler.compile(props);
  }

  /**
   * Answer one bounded distance, reach, resolved-pose, ground, formation,
   * effect, or camera question from the current compiled production after
   * `GEOMETRY` is read. Use it when physics or spatial feedback is materially
   * safer than estimating coordinates in source. The result is derived from
   * engine math, semantic selectors and the active generated fingerprint, which
   * is why this oracle belongs in MCP. Missing or stale compilation returns
   * diagnostics and no guessed result. It is read-only: it does not move
   * actors, rewrite a shot, persist a pose or certify artistic quality.
   */
  public queryGeometry(
    props: IAutoMovieQueryGeometry.IProps,
  ): IAutoMovieQueryGeometry {
    this.context.requireGuide("GEOMETRY", "queryGeometry");
    return this.context.require("queryGeometry").oracle.query(props);
  }

  /**
   * Request one actual PNG frame from the host capture adapter after
   * `PRODUCTION_RENDER` is read, verify its dimensions and bytes, and commit it
   * into a content-addressed bundle bound to target-local inputs and the
   * host-declared renderer identity. Use this bounded oracle for visual
   * diagnosis and review evidence, not as the full-film rendering workflow. MCP
   * is necessary because the review gate must cite pixels actually captured
   * from current artifacts rather than imagined by the model. A missing
   * adapter, stale compile, invalid capture runtime identity, unsafe path or
   * malformed PNG is refused without fabricated evidence.
   */
  public async previewFrame(
    props: IAutoMoviePreviewFrame.IProps,
  ): Promise<IAutoMoviePreviewFrame> {
    this.context.requireGuide("PRODUCTION_RENDER", "previewFrame");
    return this.context.require("previewFrame").oracle.preview(props);
  }

  /**
   * Prepare the current review worksheet for one design, source, shot or film
   * target after `PRODUCTION_REVIEW` is read. It returns the exact target
   * fingerprint, mandatory criteria and selectors for quotable source, verified
   * frame and acceptance evidence. Call it immediately before reviewing and
   * again after any relevant edit. This read-only MCP step prevents the coding
   * agent from reviewing remembered or stale material and makes omissions
   * machine-visible. It does not perform aesthetic judgment, generate review
   * prose, accept completion or mutate the reviewed artifact.
   */
  public prepareReview(
    props: IAutoMoviePrepareReview.IProps,
  ): IAutoMoviePrepareReview {
    this.context.requireGuide("PRODUCTION_REVIEW", "prepareReview");
    return this.context.require("prepareReview").review.prepare(props);
  }

  /**
   * Validate and atomically store one external coding-agent review worksheet
   * after `PRODUCTION_REVIEW` is read. Every required criterion must be
   * covered; quotations, frame references and acceptance outcomes must resolve
   * against the freshly prepared fingerprint. Copy `prepareReview.fingerprint`
   * unchanged into `preparedFingerprint`; the server refuses a worksheet after
   * any relevant state change. Observations, corrections and completion basis
   * must be self-consistent. This MCP gate cannot decide taste, but it can
   * prevent unsupported or stale claims from becoming `complete: true`. Refusal
   * returns exact diagnostics and stores no false completion. The tool never
   * edits source, design or pixels; apply corrections in their owner and
   * prepare a new review.
   */
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
      diagnostic.code === "generated-unowned" ||
      diagnostic.code === "generated-path-outside"
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
