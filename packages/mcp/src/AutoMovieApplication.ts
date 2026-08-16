import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionShotRepaint,
  IAutoMovieCaptureFrame,
  IAutoMovieCaptureTurntable,
  IAutoMovieGetGuideDocument,
  IAutoMoviePrepareReview,
  IAutoMovieRepaintShot,
  IAutoMovieSubmitReview,
} from "@automovie/interface";

import { AutoMovieProductionContext } from "./production/AutoMovieProductionContext";
import { AutoMovieProductionGuideService } from "./production/AutoMovieProductionGuideService";
import { AutoMovieProductionRepaintService } from "./production/AutoMovieProductionRepaintService";
import { captureAutoMovieProductionFrame } from "./production/captureProductionFrame";
import { captureAutoMovieProductionTurntable } from "./production/captureProductionTurntable";
import type { AutoMovieModelArchetypeRegistry } from "./production/productionArchetypes";
import {
  prepareAutoMovieReviewWorksheet,
  submitAutoMovieReviewWorksheet,
} from "./production/reviewWorksheet";
import {
  type AutoMovieProductionSubjectInspection,
  AutoMovieProductionSubjectInspectionService,
  type IAutoMovieInspectSubject,
} from "./production/subjectInspection";

export {
  findAutoMovieDiagnosticCatalogEntry,
  listAutoMovieDiagnosticCatalog,
} from "./production/diagnosticCatalog";
export type { IAutoMovieDiagnosticCatalogEntry } from "./production/diagnosticCatalog";

/**
 * AutoMovie's MCP surface: authoring knowledge, host-produced pixel evidence,
 * subject inspection, optional repaint, and evidence-bound review.
 *
 * `getGuideDocument` serves one packaged guide and is the only ungated call.
 * `captureFrame`, `captureTurntable`, `repaintShot`, `inspectSubject`,
 * `prepareReview`, and `submitReview` refuse until this session has read the
 * guides they name. Start with `getGuideDocument({ name: "AUTOMOVIE_OVERALL" })`,
 * then read what a refusal names and retry the tool unchanged.
 *
 * Screenplay and TypeScript authoring, compilation, project-state loading,
 * geometry, status, migration, rendering, and verification are ordinary package
 * or CLI APIs, never tools here.
 *
 * The host fixes the project root and the default production at startup. No
 * tool payload reaches another root.
 *
 * @author Samchon
 */
export class AutoMovieApplication {
  private readonly context: AutoMovieProductionContext;
  private readonly guides = new AutoMovieProductionGuideService();
  private readonly repaints: AutoMovieProductionRepaintService;
  private readonly inspections: AutoMovieProductionSubjectInspectionService;

  /** Bind the application to host-selected scope and adapters. */
  public constructor(props?: {
    /** Host-owned actual PNG capture. */
    capture?: AutoMovieProductionFrameCapture;
    /** Host-owned optional diffusion rendition. */
    repaint?: AutoMovieProductionShotRepaint;
    /**
     * Host-owned subject inspection instrument.
     *
     * Deliberately separate from `capture`. An inspection view is not delivery
     * evidence, and giving the two one adapter is how an inspection frame would
     * eventually acquire the receipt shape a shot review consumes.
     */
    inspect?: AutoMovieProductionSubjectInspection;
    /** Host seed at or below the immutable project root. */
    projectRoot?: string;
    /** Host-selected default production for review and asset tools. */
    productionId?: string;
    /**
     * Archetype catalogue the served productions register.
     *
     * Omitted leaves the primitive catalogue this package ships with, which is
     * what a project that authors only shipped archetypes wants.
     */
    archetypes?: AutoMovieModelArchetypeRegistry;
  }) {
    this.context = new AutoMovieProductionContext(
      props?.capture,
      props?.projectRoot,
      props?.productionId,
      props?.archetypes,
    );
    this.repaints = new AutoMovieProductionRepaintService(props?.repaint);
    this.inspections = new AutoMovieProductionSubjectInspectionService(
      props?.inspect,
    );
  }

  /**
   * Serve one exact package-versioned guide and credit this session for it.
   *
   * The credit is what opens the tools gated on that guide. A gated refusal
   * names the guides to request here, and nothing else recovers them.
   *
   * An unknown name fails with the complete valid guide list. The call reads
   * and mutates no project file.
   */
  public getGuideDocument(
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument {
    return this.guides.serve(this.context, props);
  }

  /**
   * Capture one registry-owned shot frame or asset turntable view through the
   * host adapter.
   *
   * What AutoMovie proves before the pixels count as evidence:
   *
   * - the target is registered by the current compile;
   * - the returned PNG bytes decode at the requested raster;
   * - the capture runtime identity and target fingerprint are recorded;
   * - the frame reopens through its own atomic content-addressed receipt.
   *
   * A `captured:false` answer carries the diagnostic that refused it. It is
   * never review evidence, however the caller describes it.
   */
  public async captureFrame(
    props: IAutoMovieCaptureFrame.IProps,
  ): Promise<IAutoMovieCaptureFrame> {
    return captureAutoMovieProductionFrame(this.context, props);
  }

  /**
   * Capture the complete view set one asset review is judged from: four
   * horizontal quarters, the steep outline pass, and a rigged model's
   * extreme-range pose.
   *
   * The views are the ones the review requires, not ones the caller picks, so
   * an asset cannot be covered from whichever side happened to look correct.
   * Each view carries the same proof one `captureFrame` carries.
   *
   * `captured` is true only when every required view committed pixels. A view
   * that refused reports `frame: null`, and the diagnostic targeting
   * `<asset>#<view id>` states what to correct.
   */
  public async captureTurntable(
    props: IAutoMovieCaptureTurntable.IProps,
  ): Promise<IAutoMovieCaptureTurntable> {
    return captureAutoMovieProductionTurntable(this.context, props);
  }

  /**
   * Derive one optional diffusion rendition from current deterministic shot
   * pixels.
   *
   * The request is refused until the tracked design declares repaint delivery,
   * the source compile and its review are current, and the structural controls
   * and manifest-owned references align with that source. Each refusal names
   * the correction it owes.
   *
   * A host with no repaint adapter is refused with the exact configuration
   * that provisions one. AutoMovie fabricates no diffusion output.
   *
   * Accepted output is parsed and atomically committed with its source, model,
   * parameters, references, and output digests in one immutable receipt.
   */
  public async repaintShot(
    props: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot> {
    return this.repaints.serve(this.context, props);
  }

  /**
   * Open one compiled subject from every planned viewpoint and return the
   * observation set.
   *
   * This is how an agent that cannot see a screen judges one object or one room
   * on its own. A named space is sectioned automatically, because the outside
   * of a room is what hides its inside.
   *
   * The observations are written outside the render root and carry
   * `deliveryEvidence: false`. They are how you decide what to fix, never what
   * a shot review accepts.
   *
   * Without a host instrument the call refuses and names how to provide one.
   */
  public async inspectSubject(
    props: IAutoMovieInspectSubject.IProps,
  ): Promise<IAutoMovieInspectSubject> {
    return this.inspections.serve(this.context, props);
  }

  /**
   * Prepare the current review worksheet for one target.
   *
   * It returns that target's exact fingerprint, the axes its kind must answer,
   * and the current evidence that kind carries. A kind that carries no frame or
   * outcome returns an empty inventory rather than a stand-in.
   *
   * It judges nothing and stores nothing. Recording a verdict is
   * `submitReview`.
   */
  public prepareReview(
    props: IAutoMoviePrepareReview.IProps,
  ): IAutoMoviePrepareReview {
    return prepareAutoMovieReviewWorksheet(this.context, props);
  }

  /**
   * Validate one submitted worksheet against its freshly prepared fingerprint
   * and store it atomically.
   *
   * Every criterion and every current evidence digest is rechecked here.
   * Rejected or stale input stores no completion at all.
   *
   * Corrections and completion basis precede the final boolean deliberately.
   * The reviewer states what it saw and what it corrected before it declares
   * the target done.
   */
  public submitReview(
    props: IAutoMovieSubmitReview.IProps,
  ): IAutoMovieSubmitReview {
    return submitAutoMovieReviewWorksheet(this.context, props);
  }
}
