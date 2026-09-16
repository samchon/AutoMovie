import type * as Capture from "../captureProfile";
import type * as CaptureDiagnostic from "../portraitCaptureDiagnostic";
import type * as FitBasis from "../portraitFitBasis";
import type * as JoinReference from "../portraitJoinReference";
import type * as JoinTangency from "../portraitJoinTangency";
import type * as MeshPatch from "../portraitMeshPatch";
import type * as PatchAttachment from "../portraitPatchAttachment";
import type * as Fairing from "../portraitSurfaceFairing";
import type * as SurfaceFit from "../portraitSurfaceFit";
import type * as JoinRefinement from "../refinePortraitJoin";
import type * as RimReplacement from "../replacePortraitRim";
import type * as Quads from "../subdividePortraitQuads";

/**
 * Capture identities, fit bases and historical join diagnostics.
 * The frozen study root retains this domain through the native evidence graph.
 * Existing source inspections and historical capture limitations are preserved
 * verbatim. This carrier neither changes geometry nor accepts current likeness;
 * artifact observations and identities remain in review.md and the root record.
 *
 * @evidence {@link JoinRefinement.refinePortraitJoin} Refines a joining annulus while retaining its fixed attachment boundaries.
 * @evidenceReview {@link JoinRefinement.refinePortraitJoin} #60e4cd6 Read resident triangle admission, shared edge midpoint reuse, centroid fans and bounded rounds beside join tests. Existing boundary vertices remain exact while interior samples are appended deterministically.
 * @evidence {@link JoinTangency.fitPortraitJoinBoundary} Fits the first joining row to the actual supporting planes on both sides.
 * @evidenceReview {@link JoinTangency.fitPortraitJoinBoundary} #913a264 Read two-sided boundary discovery, forward-facing plane admission, local midpoint fraction and positive projected-area checks. The discrete chart owns only the compact annulus and does not prove curvature continuity globally.
 * @evidence {@link JoinReference.fitPortraitJoinReference} Adapts a supplied source height surface across a joining annulus.
 * @evidenceReview {@link JoinReference.fitPortraitJoinReference} #66e0184 Read tangent targets, source height lookup, finite reach accumulation and positive-weight skin adaptation beside fairing. Fixed native/host boundaries remain authoritative and the result is not a global intersection proof.
 * @evidence {@link RimReplacement.IPortraitRimMeshes} Groups the skin and lining meshes returned for one replaced nasal rim.
 * @evidenceReview {@link RimReplacement.IPortraitRimMeshes} #f29c7f8 Read the paired skin/lining outputs beside rim replacement and its shared boundary IDs. The result keeps exterior and interior geometry separate while preserving one aperture ownership contract.
 * @evidence {@link RimReplacement.IPortraitRimMeshes.skin} Supplies the exterior nasal-rim mesh after replacement.
 * @evidenceReview {@link RimReplacement.IPortraitRimMeshes.skin} #8e9f9fa Read skin mesh indices, positions and group labels through the replacement attachment; it remains joined to the host skin rather than becoming a detached nose shell.
 * @evidence {@link RimReplacement.IPortraitRimMeshes.lining} Supplies the interior lining mesh corresponding to the replaced rim.
 * @evidenceReview {@link RimReplacement.IPortraitRimMeshes.lining} #37f37c9 Read lining mesh construction from the shared inner boundary beside the exterior rim. Its separate material/geometry identity does not alter the outer aperture shape.
 * @evidence {@link RimReplacement.replacePortraitRim} Replaces a selected nasal rim region while retaining its resident opening boundary.
 * @evidenceReview {@link RimReplacement.replacePortraitRim} #2720d63 Read source-region selection, boundary remapping, orientation checks and skin/lining extraction before cage mutation. The operation owns declared rim topology and does not infer unrecorded anatomy.
 * @evidence {@link RimReplacement.replacePortraitRimAttachment} Attaches the replaced rim meshes to the live refined host.
 * @evidenceReview {@link RimReplacement.replacePortraitRimAttachment} #c200c98 Read copied host bindings, resident boundary admission and deferred attachment ordering beside rim replacement tests. Shared identities preserve the seam while the lining remains a separate group.
 * @evidence {@link Fairing.fairPortraitSurface} Shapes the annulus interior against both fixed neighbouring skin regions while preserving the recorded image ray.
 * @evidenceReview {@link Fairing.fairPortraitSurface} #4419c06 Read region-interior selection, boundary-adjacent rows, cotangent weights and lumped areas, the scalar ray-offset energy and conditioned conjugate-gradient solve. Single and nine-point plane oracles recover fixed surrounding heights; zero/one-step budgets refuse incomplete solves and suppressing offsets fails the plane oracle. The full b3306ba5 and nasal close images show softer bridge/sidewall joins but a persistent lower nasal line. This does not certify exact C1 continuity or anatomical likeness.
 * @evidence {@link PatchAttachment.IPortraitPatchAttachment} Gives the patch group physical skin reach and a bounded view-ray search interval.
 * @evidenceReview {@link PatchAttachment.IPortraitPatchAttachment} #e95789d Read nonnegative reach separately from positive travel in millimetres. Reach zero still places boundary targets but leaves unbound skin fixed; travel limits root search and is not a nasal projection parameter.
 * @evidence {@link PatchAttachment.fitPortraitPatchBoundary} Places host boundary controls on the full reference surface without changing their recorded image-plane coordinates.
 * @evidenceReview {@link PatchAttachment.fitPortraitPatchBoundary} #b81f0dd Traced unit-ray normalization, existing metre conversion/depth sampling and the shared ray intersection. A z=2 hand plane gives [3,2,2] from [1,2,0] on [1,0,1], preserving x-z. Missed/unbracketed surfaces refuse. The real patch consumer supplies these targets to the existing connected skin blend; no additional smoothing field is introduced.
 * @evidence {@link MeshPatch.IPortraitMeshPatch} Names the source mesh and its oriented, anatomically phased attachment loop.
 * @evidenceReview {@link MeshPatch.IPortraitMeshPatch} #e1e42ee Read the common millimetre frame and strict XY containment of the source boundary inside the host. The provider supplies native nasal skin; connectivity selects only the declared patch. Boundary placement and matching winding remain group obligations rather than assumptions supplied by a closed topology check.
 * @evidence {@link MeshPatch.createPortraitMeshPatchComponent} Replaces the enclosed host region with a selected patch and an engine-triangulated annulus.
 * @evidenceReview {@link MeshPatch.createPortraitMeshPatchComponent} #de4a475 Traced copied source selection, exact XY identity remapping and orientation admission before cage mutation. The attached annulus retains a separate face label through subdivision, then its final provider calls fairPortraitSurface with native core and host boundaries fixed. Omission retains the original unfaired patch path. Nonplanar triangulation and assembled plane tests exercise both paths; b3306ba5 improves the bridge while leaving the nasal base unfinished.
 * @evidence {@link FitBasis.assertPortraitFitBasis} Binds a recorded residual to the exact source-model and target-control bytes consumed by its producer.
 * @evidenceReview {@link FitBasis.assertPortraitFitBasis} #7dcb216 Read both digest comparisons and distinct refusal paths with standard abc/empty SHA-256 vectors. Actual fitted-consumer probes changing eye distance or one target coordinate also refuse. A new digest cannot be substituted for recomputing coefficients against that basis.
 * @evidence {@link Quads.IPortraitQuadMesh} Retains quadrilateral topology for the inactive anatomical prior's common skin/neck refinement.
 * @evidenceReview {@link Quads.IPortraitQuadMesh} #05ce667 Read positions, four-corner faces and face labels as one connected cage in caller units. The separate quad representation preserves the face-centre refinement rule rather than treating the triangulated prior as a Loop cage.
 * @evidence {@link Quads.subdividePortraitQuads} Applies shared Catmull-Clark refinement to the anatomical skin and attached neck.
 * @evidenceReview {@link Quads.subdividePortraitQuads} #879f3b2 Compared face centres, original edge-midpoint averages and boundary rules with the independent quad scenarios. Per-axis normalization protects finite large coordinates, while malformed quads, inconsistent manifold winding and invalid boundary valence refuse. These rules alone do not repair the stepped neck seen in the unfitted prior.
 * @evidence {@link Capture.portraitCaptureProfile} Fixes the finite angle set, source crop, optics and lighting conditions used by these inspection frames.
 * @evidenceReview {@link Capture.portraitCaptureProfile} #fb7d532 Read all nine yaw/pitch views, the 430-pixel source crop and the 64-sample denoised Cycles lights. Calibration, source pose and three clay captures complete the fourteen-frame set; hair is hidden in clay, and denoising leaves detailed strand judgments outside this stage.
 * @evidence {@link CaptureDiagnostic.IPortraitCaptureBytes} Enumerates the exact byte populations a diagnostic consumes while holding the preview lease.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitCaptureBytes} #39633de Compared receipt, profile, model, configuration, GLB, reference PNG and source-image fields with both real adapters. They are captured bytes rather than filenames reopened opportunistically after inference.
 * @evidence {@link CaptureDiagnostic.IPortraitCaptureReceipt} Binds the diagnostic's geometry/configuration/source identities and named captured frames.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitCaptureReceipt} #b8d12f9 Read the five artifact hashes and the frame name/file/hash triples. The minimal interpreted type omits renderer fields intentionally, but the generation digest still hashes the complete raw receipt containing them.
 * @evidence {@link CaptureDiagnostic.IPortraitDiagnosticProfile} Exposes only the source crop, planned views and measurement frame needed by these observers.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitDiagnosticProfile} #3f5ecd3 Traced crop width/height/extent checks and the exact comparison with the control net's measurement frame. This type does not claim a full renderer schema or certify unconsumed view pixels.
 * @evidence {@link CaptureDiagnostic.portraitCaptureDigest} Identifies exact consumed bytes with SHA-256 for capture-generation comparisons.
 * @evidenceReview {@link CaptureDiagnostic.portraitCaptureDigest} #58e1892 Read the direct byte hash and its raw-receipt use. Renderer-only or reference-frame receipt changes therefore alter generation identity even when the geometry and profile hashes remain equal.
 * @evidence {@link CaptureDiagnostic.inspectPortraitCapture} Admits a coherent source-pose diagnostic basis before inference and again before publication.
 * @evidenceReview {@link CaptureDiagnostic.inspectPortraitCapture} #093a779 Compared every consumed-byte hash, target identity, measurement frame, finite crop and complete unique view inventory. Separate negative twins change each population; all seven individually disabled identity/generation guards failed before restoration.
 * @evidence {@link CaptureDiagnostic.runPortraitCaptureDiagnostic} Keeps observation and publication inside one publisher-compatible lease lifetime.
 * @evidenceReview {@link CaptureDiagnostic.runPortraitCaptureDiagnostic} #71b7713 Read acquire/read/observe/revalidate/publish/finally-release ordering and the failure cases. Same-GLB recapture is refused, acquisition failure releases no foreign owner, and publication remains leased. The Windows probe confirms the adapter's exclusive-create interoperability without claiming crash-atomic multi-file writes.
 * @evidence {@link SurfaceFit.IPortraitSurfaceFit} Describes the numerical thin-plate residual and optional gaze/ray data consumed by the inactive fitted foundation.
 * @evidenceReview {@link SurfaceFit.IPortraitSurfaceFit} #2143f50 Read normalized centres, two-coordinate weights, four affine rows, positive scale and optional optical inputs. This numerical field type does not bind a particular model. The recorded subject recipe now supplies that separate relationship through source-model and target-control byte checks before evaluating its preset.
 * @evidence {@link SurfaceFit.createPortraitSurfaceFitter} Evaluates the inactive foundation's recorded X/Y residual while retaining prior depth.
 * @evidenceReview {@link SurfaceFit.createPortraitSurfaceFitter} #098dcac Compared the copied coefficients and phi(r)=r squared log(r) kernel with its zero-distance and affine paths. Output Z stays input Z and nonfinite output refuses. The evaluator remains basis-agnostic; buildFittedReferencePortrait checks the current source and target identities before supplying its recorded coefficients, and that recipe's stale record was recomputed from a fresh observation.
 */
export const portraitDiagnosticsReview = {
  scope: "diagnostics construction inspection",
};
