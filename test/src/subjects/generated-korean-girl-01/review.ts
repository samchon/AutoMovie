import type * as Blend from "../blendPortraitSkin";
import type * as Capture from "../captureProfile";
import type * as Geometry from "../geometry";
import type * as CaptureDiagnostic from "../portraitCaptureDiagnostic";
import type * as Component from "../portraitComponents";
import type * as Controls from "../portraitControlLayer";
import type * as Cornea from "../portraitCornea";
import type * as DirectionalContact from "../portraitDirectionalContact";
import type * as Gltf from "../portraitDocument";
import type * as Sphere from "../portraitEyeSphere";
import type * as FitBasis from "../portraitFitBasis";
import type * as Buffers from "../portraitMeshBuffers";
import type * as Relief from "../portraitRelief";
import type * as Topology from "../portraitSkinTopology";
import type * as Surface from "../portraitSurface";
import type * as SurfaceFit from "../portraitSurfaceFit";
import type * as Loop from "../subdivideControlMesh";
import type * as Quads from "../subdividePortraitQuads";
import type * as Anatomy from "./anatomy";
import type * as DentalArc from "./dentalArc";
import type * as Attachment from "./dentalComponent";
import type * as Crown from "./dentalCrown";
import type * as Dental from "./dentalRow";
import type * as Eyes from "./eyes";
import type * as Fitted from "./fittedModel";
import type * as Head from "./head";
import type * as LipSection from "./lipSection";
import type * as LowerLid from "./lowerLidSection";
import type * as Mouth from "./mouth";
import type * as Nasal from "./nose";
import type * as Nostril from "./nostrilRim";
import type * as Ocular from "./ocularTissues";

/**
 * Current actually inspected active capture, with a partial construction-source
 * account. Relationships are being read and recorded before compiler-issued
 * fingerprints are inserted. Missing coverage/fingerprints remain errors; this
 * intermediate account does not claim whole-source or likeness acceptance.
 *
 * @evidence {@link LowerLid.IPortraitLowerLidPoint} Gives a named lower-tissue sample its planar offset and anterior section projection.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint} Read both millimetre fields through the eye's local outward-normal construction and support-depth bridge. Projection is not muscle thickness or a contact clearance; the two coordinates have separate geometric effects.
 * @evidence {@link LowerLid.IPortraitLowerLidPoint.offset} Places tissue in order from the aperture towards surrounding skin.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint.offset} Traced finite positive and strictly increasing admission for all six internal roles. Convex interpolation uses the same weights for each offset; the eye retains its inner aperture and derives the outer skin query from attachment distance.
 * @evidence {@link LowerLid.IPortraitLowerLidPoint.projection} Shapes each tissue sample relative to its common support bridge.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint.projection} Checked signed finite values, independent quarter-interval arithmetic and their replacement blend with basic row depths. A negative subtarsal projection is admitted; it does not move a separately guessed tissue mesh.
 * @evidence {@link LowerLid.IPortraitLowerLidSection} Separates margin, pretarsal body, subtarsal boundary and preseptal transition in one shared section.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection} Read all six points and outer attachment beside the explicit eye-row mapping. The ordering validator refuses crossed rows; all points still feed the same shared topology. This defines numerical shape freedom, not an accepted anatomical fit.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.margin} Owns the narrow outer skin margin before pretarsal fullness.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.margin} Followed this point to the ridge row while the inner aperture remains its own invariant. Its optional detailed offset/projection does not substitute for the separately drawn wet margin.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.pretarsalCrest} Places the roll's crest independently of its lower shoulder and crease.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.pretarsalCrest} Traced its mapping to the tarsal sampling row. The asymmetric-profile test changes this projection alone and verifies that higher lateral relief switches head-X side between anatomical eyes.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.pretarsalLower} Determines the roll's lower shoulder before the subtarsal boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.pretarsalLower} Read strict placement beyond the crest and before subtarsalInner, then its independent target in the shared skin row. It is not forced to equal the crest projection as in the basic envelope.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.subtarsalInner} Defines the roll-facing side of its lower boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.subtarsalInner} Checked the ordered offset and independent signed depth between pretarsalLower and subtarsalOuter. This local boundary is separate from the medial tear-trough field in orbital support.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.subtarsalOuter} Defines the preseptal-facing side of the subtarsal boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.subtarsalOuter} Read its separate interpolation and mapping beyond subtarsalInner. Both sides can describe a recessed transition without turning the whole lower lid into a single inflated band.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.preseptal} Supplies a broader transition outside the pretarsal body and its lower boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.preseptal} Followed its position between subtarsalOuter and the live attachment. It controls the uppermost inserted outer row, while actual host depth supplies the final attachment rather than a copied absolute Z.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.attachment} Selects the section's outer reach on resident supporting skin.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.attachment} Traced positive ordering beyond every tissue point, canthal width blending, the fit-stage depth query and the same append-stage section width. A missing host hit refuses; increasing reach is not itself a likeness correction.
 * @evidence {@link LowerLid.IPortraitLowerLidProfile} Carries the complete optional medial-to-lateral section population for one eye.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidProfile} Read the two-to-32 population, both required endpoint witnesses, strict progress and component-owned resolver. Omission reproduced the prior captured model and GLB exactly before selecting the trial profile.
 * @evidence {@link LowerLid.IPortraitLowerLidProfile.sections} Specifies longitudinal variation without coupling the two eyes' handedness.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidProfile.sections} Checked copied nested section data and uniform convex weights over each station interval. Returned samples are independently owned; mutation tests preserve the existing component and mirrored tests fail when right-side progress reversal is removed.
 * @evidence {@link LowerLid.createPortraitLowerLidProfile} Resolves ordered anatomical section witnesses for the actual eye consumer.
 * @evidenceReview {@link LowerLid.createPortraitLowerLidProfile} Read all admission branches, interval selection, smoothstep weights and returned point population against independent arithmetic and negative twins. The eye uses the result in fit and shared attachment; the a34f1fe4 full and close views show a clearer roll with unfinished margin/cheek continuity. The broader face inventory remains unfinished.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidProfile} Selects detailed lower-tissue sections while preserving the basic omission path.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidProfile} Followed constructor ownership, anatomical progress reversal, sine blending, shared fitting and standalone attachment. The actual omission export retains model177c63a8 and GLB454cd902. Replacing tissue sections does not replace or accept the separate corneal-contact construction.
 * @evidence {@link Mouth.IPortraitMouthShape.borderRefinement} Selects the outer vermilion's surface or independent closed-curve refinement rule.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.borderRefinement} Read admission and attach.curves through the generic head assembler. Omitted/surface output is identical, curve detail retains a shared border, and the current 454cd902 full views show a smoother colour outline without a newly observed detached lip. Later subdivision can propagate border changes toward the oral rim; its rule, rather than every final point, is retained.
 * @evidence {@link Mouth.createPortraitMouthComponent} Fits the curved lip bands and declares their shared skin border, oral opening and interior finisher.
 * @evidenceReview {@link Mouth.createPortraitMouthComponent} Traced copied socket/crown inputs, band and section closures, anatomical flood labels, exact constraints, original-face cuts and post-refinement cavity/teeth placement. The curve experiment changes the outer subdivision rule without a pigment overlay. First-round inner-rim equality is tested separately from later neighbouring adaptation; the visible smile is still simplified.
 * @evidence {@link Mouth.portraitLipTriangles} Selects the connected lip band bounded by the two authored anatomical loops.
 * @evidenceReview {@link Mouth.portraitLipTriangles} Read edge incidence, seed admission and flood traversal with barriers at both loops. It follows connectivity rather than face centroids, so material labels inherit the same complete border triangles through refinement. The seed must belong to the intended band; missing seed refuses, but this helper does not recover anatomy from positions.
 * @evidence {@link Loop.IControlMesh.positions} Preserves construction-space vertex identities during shared refinement.
 * @evidenceReview {@link Loop.IControlMesh.positions} Read XYZ arrays in the Loop masks and the host's final metric packing. Original indices survive as moved samples, while inserted edge positions are appended once per shared edge.
 * @evidence {@link Loop.IControlMesh.indices} Carries oriented triangles over the common vertex population.
 * @evidenceReview {@link Loop.IControlMesh.indices} Followed edge adjacency and four child triples per face. The array is topology, not an anatomical boundary label; the optional curves must name actual resident edges.
 * @evidence {@link Loop.IControlMesh.groups} Retains each triangle's material-region ownership through subdivision.
 * @evidenceReview {@link Loop.IControlMesh.groups} Read four copies per parent face and the head's later region extraction. Shared edge vertices are refined once even when adjacent labels differ; colour separation happens only after shared normals.
 * @evidence {@link DirectionalContact.createPortraitDirectionalContact} Resolves a contact target from resident triangles along a declared projection direction.
 * @evidenceReview {@link DirectionalContact.createPortraitDirectionalContact} Read its orthonormal frame, metre-valued triangle projection, foremost depth hit, identity returns and finite-output refusal. Independent frontal, slanted, reversed and Y-normal plane oracles pass; disabling the clearance branch fails the frontal oracle. This operation supplies point contact, not a smooth tissue transition or global intersection proof.
 * @evidence {@link FitBasis.assertPortraitFitBasis} Binds a recorded residual to the exact source-model and target-control bytes consumed by its producer.
 * @evidenceReview {@link FitBasis.assertPortraitFitBasis} Read both digest comparisons and distinct refusal paths with standard abc/empty SHA-256 vectors. Actual fitted-consumer probes changing eye distance or one target coordinate also refuse. A new digest cannot be substituted for recomputing coefficients against that basis.
 * @evidence {@link Fitted.buildFittedReferencePortrait} Applies the recorded anatomical fit only after checking its captured source and current target dependencies.
 * @evidenceReview {@link Fitted.buildFittedReferencePortrait} Read source-sampling reconstruction, both byte-basis checks, shared-skin fitting, optical centres and added grouped teeth/brows/hair. The refreshed 150-point record is derived from the current captured prior; evaluating its continuous field at another tessellation is distinct from changing the source construction. This does not accept the fitted likeness or its inferred depth.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealBoundary} Selects the closed shell's visible-aperture or full limbal boundary.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealBoundary} Read both extent branches through the shared eyeCornea builder. The two-opening test retains a full 12.8 mm diameter in limbus mode and exact omitted/aperture equivalence. The 0e51fa42 close capture shows why a circular shell alone does not establish lid contact.
 * @evidence {@link Eyes.IPortraitEyeShape.lidContact} Selects final shared-eyelid contact with the full resident optical surface.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidContact} Traced mode admission, registered skin region, immutable final-surface proposal and the same optical builder used by drawing. Independent Z queries confirm sampled clearance, while the pointwise 0f46c850 capture exposes ledges that the numeric contact assertion does not rule out.
 * @evidence {@link Eyes.IPortraitEyeShape.lidContactReach} Governs geodesic tissue adaptation around exact optical contact constraints.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidContactReach} Read the optional 3 mm default, explicit zero and nonnegative finite admission. The consumer keeps exact contact points and reaches more neighbouring vertices when enabled. A tiny optical surface with no contacted lid samples leaves positions unchanged; rendered section quality remains separate.
 *
 * @evidence {@link Controls.IPortraitSurfaceControl} Describes a named requested movement on the common refined surface.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl} Read all four fields with the coupled solver and nasal consumer. The displacement is a target right-hand side, while coefficients are solved from the whole population; treating it as an independent bump amplitude would miss neighbouring zero constraints.
 * @evidence {@link Controls.IPortraitSurfaceControl.name} Names each anatomical handle and fixes deterministic elimination order.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.name} Traced copied controls through compareCodeUnits sorting and nonempty/duplicate-name refusal. Reversing the two-point input reproduces the same emitted fields without changing an anchor's physical target.
 * @evidence {@link Controls.IPortraitSurfaceControl.anchor} Supplies the retained host vertex from which a control is located.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.anchor} Read integer/nonnegative admission and resident finite-datum lookup in fields(host). A changed host relocates the handle; a missing resident point refuses before interpolation rather than defaulting to the origin.
 * @evidence {@link Controls.IPortraitSurfaceControl.offset} Places an intermediate control relative to its live anatomical datum.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.offset} Compared the copied three-number offset and finite sum with the translated-frame test. The offset locates the kernel centre in millimetres and is not part of its requested movement.
 * @evidence {@link Controls.IPortraitSurfaceControl.displacement} Prescribes the combined XYZ movement at one control position.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.displacement} Followed all three right-hand sides through common elimination and final metre conversion. The independent two-point inverse reproduces a nonzero first target and a zero neighbour; coefficient overflow refuses before any final field is emitted.
 * @evidence {@link Controls.createPortraitControlLayer} Solves coupled anatomical targets into fields consumed by the shared surface assembler.
 * @evidenceReview {@link Controls.createPortraitControlLayer} Read normalized engine probes, pivot selection, singular refusal and the three-axis output against actual assembly tests. A 0.2 mm nasal target reaches its refined control and moves resident lining while the remote chin remains fixed. The engine checks the final field and triangles; neither those checks nor interpolation prove global nonintersection or likeness.
 * @evidence {@link Anatomy.IPortraitNasalDetail} Groups a complete optional nasal control field in place of basic support amplitudes.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail} Read its radius and control population beside portraitNasalLayerFor. Omission selects the original relief, while a supplied empty population explicitly removes that layer; detail is not silently added on top of the old nasal amplitudes.
 * @evidence {@link Anatomy.IPortraitNasalDetail.radius} Establishes one millimetre support extent for the coupled nasal group.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail.radius} Traced the value into both normalized matrix distances and every final field radius. The same extent governs exterior and recessed lining; it is an authored influence range rather than a recovered tissue thickness.
 * @evidence {@link Anatomy.IPortraitNasalDetail.controls} Supplies the complete named nasal target population, including stationary anchors.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail.controls} Compared active dorsal, tip, columellar and alar-facial handles with the solver's zero constraints. No control is discarded before solving merely because its displacement is zero; only solved zero coefficients produce no field.
 * @evidence {@link Anatomy.portraitNasalLayerFor} Selects exactly one basic or coupled nasal surface authority.
 * @evidenceReview {@link Anatomy.portraitNasalLayerFor} Read both branches and their shared layer identity. The omission test matches the original relief fields. The documented replacement path changes only the nasal layer; after rejecting 0af74958, the active assembly again selects omission and keeps the original nasal supports.
 * @evidence {@link Anatomy.portraitNasalDetail} Records the rejected coupled nasal fitting hypothesis for explicit replacement experiments.
 * @evidenceReview {@link Anatomy.portraitNasalDetail} Read each named datum, zero offset and signed three-axis movement with its frozen 0af74958 configuration. Eleven controls share a 22 mm support. Both image reviewers found a broad flat tip, so the preset is absent from the active assembly and is not an accepted anatomical fit.
 * @evidence {@link LipSection.IPortraitLipBandKnot} Defines one thickness-ratio witness along the curved oral span.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot} Read at and scale with the scalar/array resolver. Witness order belongs to the supplied profile, and fixed endpoint ratios preserve corner positions rather than introducing a separate mouth frame.
 * @evidence {@link LipSection.IPortraitLipBandKnot.at} Locates a thickness witness from anatomical right to left.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot.at} Traced finite strictly increasing progress with endpoint values -1 and +1. Duplicate or reversed positions refuse, while asymmetric interior positions retain their specified intervals.
 * @evidence {@link LipSection.IPortraitLipBandKnot.scale} Sets a positive local ratio of vertical vermilion thickness.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot.scale} Compared positive finite admission with identity endpoints and convex-hull interpolation. Zero cannot be interpreted as omission because it collapses thickness; explicit one is the neutral ratio.
 * @evidence {@link LipSection.createPortraitLipBandSampler} Supplies normalized lip coordinates and their authoritative inner/outer heights together.
 * @evidenceReview {@link LipSection.createPortraitLipBandSampler} Read the entire curved-boundary binder after extracting the legacy coordinate wrapper. The mouth uses this same innerY to scale thickness; a raised lower-band point is classified locally rather than by global head height. All bound curve data is copied.
 * @evidence {@link LipSection.createPortraitLipBandScale} Resolves omitted, scalar or ordered optional band profiles for mouth fitting.
 * @evidenceReview {@link LipSection.createPortraitLipBandScale} Read two-to-64 knot admission, fixed corners, cubic interval blending and query refusal. Independent scalar and asymmetric-array arithmetic pins interpolation; the annulus consumer test fails when thickness application is disabled and confirms unchanged inner rim and upper band under lower-only detail.
 *
 * @evidence {@link Component.IPortraitComponent} Separates an anatomical instance's identity, finishes and host-fitting operation.
 * @evidenceReview {@link Component.IPortraitComponent} #a0abcb5 Read all three members with head assembly and model material collection. The assembler calls fit on one unchanged host; the interface does not itself promise a correct external shape.
 * @evidence {@link Component.IPortraitComponent.id} Names the fitting owner used to reject duplicate component instances.
 * @evidenceReview {@link Component.IPortraitComponent.id} #759c65d Traced the head's unique-id check and its final-surface provider names. Separate eyes supply side-qualified identities, while nose and mouth each retain one owner.
 * @evidence {@link Component.IPortraitComponent.fit} Produces original-host constraints, cuts and the later attachment procedure.
 * @evidenceReview {@link Component.IPortraitComponent.fit} #9df446b Compared the head's complete plans map with subsequent blending. No component receives a predecessor's displaced host, so fit order cannot silently redefine its input surface.
 * @evidence {@link Component.IPortraitComponent.materials} Carries optional instance-owned finishes into the assembled palette.
 * @evidenceReview {@link Component.IPortraitComponent.materials} #71f2a1d Read the model's flatMap with an empty omission case and the eye factory's side-specific corneal materials. Optical thickness is captured with its eye rather than copied to a shared palette entry.
 * @evidence {@link Component.IPortraitComponentHost} Carries the original geometry and recorded view ray into every fitted part.
 * @evidenceReview {@link Component.IPortraitComponentHost} #5b3fb54 Read positions, indices and viewRay against eye, nose and mouth fitting. The data uses construction millimetres; it contains measured image witnesses and inferred depth rather than an anatomical ground truth.
 * @evidence {@link Component.IPortraitComponentHost.positions} Retains original skin identities and the non-skin gaze markers.
 * @evidenceReview {@link Component.IPortraitComponentHost.positions} #e5848ff Followed socket-index lookup and the eye's copied aperture array. Gaze markers remain addressable although they need not occur in a triangle, which differs from the compacted material meshes.
 * @evidence {@link Component.IPortraitComponentHost.indices} Establishes original triangle ordinals for component cuts.
 * @evidenceReview {@link Component.IPortraitComponentHost.indices} #000a7cf Traced cut validation against indices.length/3 and the later traversal of original triples. Removing a patch does not renumber another component's requested cut before collection.
 * @evidence {@link Component.IPortraitComponentHost.viewRay} Supplies the measured projection direction for ocular placement and optional nasal body depth.
 * @evidenceReview {@link Component.IPortraitComponentHost.viewRay} #ae05916 Read sphere intersection, socket translation and the final nasal adapter. Consumers use a direction, not a point; its recorded pose remains a monocular estimate.
 * @evidence {@link Component.IPortraitComponentPlan} Splits a fitted part into exact host requests and shared-topology attachment.
 * @evidenceReview {@link Component.IPortraitComponentPlan} #eac9055 Read its three members with all head stages. Attachment returns open boundaries and a post-refinement finisher, preventing an interior from being completed against an independently guessed seam.
 * @evidence {@link Component.IPortraitComponentPlan.constraints} Defines the complete exact attachment requests collected before skin blending.
 * @evidenceReview {@link Component.IPortraitComponentPlan.constraints} #dd57864 Followed plans.flatMap into blendPortraitSkin. Each request retains its vertex, target and reach; contradictory exact targets are the blend owner's refusal rather than a last-writer policy.
 * @evidence {@link Component.IPortraitComponentPlan.cutFaces} Identifies original faces replaced by component topology.
 * @evidenceReview {@link Component.IPortraitComponentPlan.cutFaces} #bf95039 Checked integral resident-ordinal and duplicate-cut refusal in buildPortraitHead. The list is not a set of post-subdivision material triangles.
 * @evidence {@link Component.IPortraitComponentPlan.attach} Appends shared geometry and returns the actual final-surface consumers.
 * @evidenceReview {@link Component.IPortraitComponentPlan.attach} #ebe7b31 Traced registered regions, declared openings, optional final proposals and finish(refined). The common surface is validated and refined before its interior consumer runs; a new hook remains subject to export validation.
 * @evidence {@link Eyes.IPortraitEyeSocket} Assigns this subject's anatomical boundary identities to a replaceable eye.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket} Read the six members beside loopOf, fitting and brow construction. Both aperture paths share canthi and run in head-X order; the instance's anatomical side is separate from that order.
 * @evidence {@link Eyes.IPortraitEyeSocket.name} Selects anatomical handedness and side-qualified output identities.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.name} Traced the left/right branches for outer-corner progress, medial tissues, lashes and brow bending. Positive head X is anatomical left; image-left is not substituted for that convention.
 * @evidence {@link Eyes.IPortraitEyeSocket.top} Supplies the upper aperture path and identifies which support rows receive a crease.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.top} Read top.includes in lidRows and the upper curve used by iris clipping and lashes. Its endpoint identities also participate in the lower loop, so corner membership does not create a second seam.
 * @evidence {@link Eyes.IPortraitEyeSocket.bottom} Supplies the lower aperture path in the same X direction as the upper path.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.bottom} Followed the lower-first closed loop and the lower clipping lookup. Reversing this path would change winding and interpolation rather than simply rename an eye.
 * @evidence {@link Eyes.IPortraitEyeSocket.iris} Locates the independent gaze marker projected onto the fitted globe.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.iris} Read the marker's exact zero-reach constraint and later sphere-ray intersection. It does not choose the lid-plane normal or a second spherical curvature.
 * @evidence {@link Eyes.IPortraitEyeSocket.browTop} Supplies the upper boundary of this eye's brow distribution.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.browTop} Followed its retained IDs into buildPortraitEyebrow, where interpolated XY chooses fibre locations and actual final skin supplies contact depth. The boundary's sparse Z values are not used as the contact surface.
 * @evidence {@link Eyes.IPortraitEyeSocket.browBottom} Supplies the lower boundary from which brow fibre spans begin.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.browBottom} Compared the lower spline with the separate upper spline and deterministic start/end fractions. Reusing the upper boundary here would collapse fibre spans; the factory copies this array independently.
 * @evidence {@link Eyes.IPortraitEyeShape} Groups aperture, surrounding tissue, optical and sampling inputs for one eye instance.
 * @evidenceReview {@link Eyes.IPortraitEyeShape} Read the full interface, its factory admission and fit/attach/finish consumers. Numerical roles are distinct from tessellation counts, and the current scalar optical approximation is not a measured physiological eye.
 * @evidence {@link Eyes.IPortraitEyeShape.widthScale} Multiplies the aperture span about its measured horizontal midpoint.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.widthScale} Read middleX+(x-middleX)*widthScale on both rim paths. The gaze marker is handled separately, so this dimension does not automatically scale the pupil or iris radius.
 * @evidence {@link Eyes.IPortraitEyeShape.openingScale} Multiplies aperture height about the extrema-derived vertical midpoint.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.openingScale} Traced the same Y transform on upper and lower samples before sphere intersection. Its positive-domain check prevents a reversed or collapsed opening; it does not control lower-lid tissue thickness.
 * @evidence {@link Eyes.IPortraitEyeShape.outerCornerLift} Adds a signed millimetre lift that increases toward the anatomical outer canthus.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.outerCornerLift} Compared u for the left eye with 1-u for the right eye. Both paths use the same outer progress, retaining one corner position instead of lifting only the upper boundary.
 * @evidence {@link Eyes.IPortraitEyeShape.socketLift} Translates aperture and gaze together along the recorded view direction.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.socketLift} Read the per-axis host.viewRay displacement and outer support's corresponding depth offset. This is a signed construction-distance control, not an increase in eye radius.
 * @evidence {@link Eyes.IPortraitEyeShape.blendReach} Limits the geodesic influence of the fitted outer eyelid on surrounding skin.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.blendReach} Followed this nonnegative value into each outer-row constraint, beside the gaze marker's separate zero reach. It controls neighbouring adaptation rather than the width of the lid section.
 * @evidence {@link Eyes.IPortraitEyeShape.foldWidth} Sets the upper crease's planar separation from the aperture.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.foldWidth} Read the sinusoid-weighted fold offsets across hood, crease and tarsal rows. The top-membership weight fades at both canthi and supplies no fold on the lower path.
 * @evidence {@link Eyes.IPortraitEyeShape.foldDepth} Recesses the upper crease relative to its ridge and hood.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.foldDepth} Compared the negative depth at both crease rows with the positive fractions used by hood/tarsal rows. Increasing it changes a section relationship, not the aperture's XY contour.
 * @evidence {@link Eyes.IPortraitEyeShape.upperLidVolume} Adds tarsal support above the upper aperture.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.upperLidVolume} Located its sole contribution in the tarsal row multiplied by the upper weight. It cannot thicken the lower roll, whose separate lowerVolume term owns that side.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidWidth} Controls the lower tissue transition's outward planar extent.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidWidth} Read lowerWeight and the successive fractions used by lower rows, including the full addition to outerWidth. The upper path receives zero lowerWidth and retains its independently set fold offsets.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidVolume} Raises the lower roll independently of its transition width.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidVolume} Traced lowerWeight through the tarsal and inner/outer lower rows. Its peak and taper are imposed by those section fractions; the visible band in the captured face remains an unresolved shape observation.
 * @evidence {@link Eyes.IPortraitEyeShape.lidThickness} Supplies the forward depth of the aperture margin and neighbouring lid rows.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidThickness} Compared the inner point's Z increment with the ridge's additional 0.08mm and the independently offset outer row. This controls a surface section and is not a closed anatomical eyelid thickness measurement.
 * @evidence {@link Eyes.IPortraitEyeShape.surfaceRadius} Selects the sphere fitted to the complete aperture plane.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.surfaceRadius} Read fitPortraitEyeSphere and the same sphere used by sclera/gaze sampling. Admission requires it to span the aperture and to be no smaller than the declared corneal curvature.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealRadius} Sets the anterior optical cap curvature above the fitted globe.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealRadius} Compared curvature against iris radius and globe radius, then read its sag contribution in buildPortraitCornea. The prescribed 7.8mm is a schematic assumption, not a recovered subject dimension.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealThickness} Separates the optical shell's front and back and sets its material volume thickness.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealThickness} Followed the millimetre axial back-surface offset and the side-owned material's division by 1000. Geometry and optical metadata use one input; neither models the cornea's internal layers.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealRimLift} Holds the optical shell above the underlying iris at its unclipped limbus.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealRimLift} Read the strict thickness+0.055 clearance admission and the constant rim offset in the cap surface. Angular clipping does not refit that lift or curvature for each column.
 * @evidence {@link Eyes.IPortraitEyeShape.irisRadius} Defines the pigment and corneal disk before the eyelid clips their visible reach.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.irisRadius} Traced per-angle extent bisection against both live lid curves and the shared extents passed into corneal construction. Increasing the radius does not enlarge the aperture itself.
 * @evidence {@link Eyes.IPortraitEyeShape.pupilRadius} Defines the inner dark disk independently of the iris extent.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.pupilRadius} Read the positive radius and pupil<iris refusal, then its separately clipped disk with the 0.09mm surface offset. This opaque approximation does not model an internal eye cavity.
 * @evidence {@link Eyes.IPortraitEyeShape.tissues} Optionally supplies medial conjunctiva and the narrow lower ocular margin.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.tissues} Checked the omission branch and copied tissue settings before fitting, followed by evaluation against final upper/lower curves and the globe. Omitting it removes those additional surfaces without selecting another aperture.
 * @evidence {@link Eyes.IPortraitEyeShape.browFibres} Selects the number of explicit brow strands generated on the final forehead.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.browFibres} Read the zero-fibre return and the 4096 upper bound in the brow owner. This integer controls a mesh population, not the brow boundary or anatomical eye opening.
 * @evidence {@link Eyes.IPortraitEyeShape.browProfile} Supplies strand dimensions while retaining subject-owned brow boundaries.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.browProfile} Traced the copied supplied/default profile through assertPortraitEyebrowProfile and final-skin contact. Changing fibre clearance or bending cannot substitute for moving the brow's upper/lower sockets.
 * @evidence {@link Eyes.IPortraitEyeShape.upperLashes} Sets the positive integer population of short lashes along the upper rim.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.upperLashes} Read the evenly distributed u values and side-dependent outward curl. The separately built lash-line tube remains present independently of this count.
 * @evidence {@link Eyes.IPortraitEyeShape.sampling} Separates ocular mesh resolution from the eye's anatomical dimensions.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.sampling} Followed eyeColumns/eyeRows into sclera sampling and irisColumns/irisRows into pigment and corneal sampling. Integer minima protect their lattices; a denser lattice does not certify likeness.
 *
 * @evidence {@link Geometry.portraitPoint} Supplies the common XYZ value used by the study's construction-space curves and component frames.
 * @evidenceReview {@link Geometry.portraitPoint} Read the direct x/y/z object construction: it retains millimetre coordinates without a hidden scale or axis swap, so the later portraitPart conversion remains the unit boundary.
 * @evidence {@link Geometry.portraitMix} Interpolates scalar coordinates and dimensions within the authored surface sections.
 * @evidenceReview {@link Geometry.portraitMix} Compared a+(b-a)*t with its callers' local curve progress. It preserves endpoints and permits extrapolation; callers, rather than this scalar helper, own admissible parameter intervals.
 * @evidence {@link Geometry.portraitRayIntersection} Provides a bracketed camera-ray intersection for a caller-owned finite height surface.
 * @evidenceReview {@link Geometry.portraitRayIntersection} Traced origin+t*direction and the signed height residual through forty bisections. Endpoint finiteness and sign bracketing are enforced; continuity and finiteness of the supplied surface remain caller preconditions, and the helper is not a general visibility query.
 * @evidence {@link Geometry.portraitNormals} Computes the shared skin/lining normal field before material regions are separated.
 * @evidenceReview {@link Geometry.portraitNormals} Read the unnormalized cross-product sums and final normalization. A vertex with no nonzero incident area stays zero, which explains the optical pole defect repaired at its spherical owner. The 1a4bb653 experiment also shows that equal shared normals do not establish the desired geometric tangent.
 * @evidence {@link Geometry.portraitRegion} Extracts named material geometry while preserving the common field and original vertex identity.
 * @evidenceReview {@link Geometry.portraitRegion} Followed first-use index remapping and copied position/normal triples. Only referenced vertices enter the child region, and coincident positions are not silently welded; this is the mapping the actual GLB witness audit must respect.
 * @evidence {@link Geometry.portraitPart} Converts completed construction meshes into static metre-space AutoMovie parts.
 * @evidenceReview {@link Geometry.portraitPart} Checked the engine transform's uniform 0.001 scale and null part transform/bone binding. Positions cross from millimetres to metres once while the engine preserves normal direction; the exported capture uses these resident buffers.
 * @evidence {@link Geometry.portraitPatch} Produces the shared rectangular sampling lattice used by authored parametric surfaces.
 * @evidenceReview {@link Geometry.portraitPatch} Read both triangle triples per cell and their du-cross-dv orientation. Sampling includes both parameter endpoints without pole welding or caps. Its area normals therefore cannot supply a direction at an entirely collapsed pole; spherical owners now provide that derivative explicitly.
 * @evidence {@link Geometry.portraitSpline} Interpolates ordered spatial landmarks for lid, dental and other study curves.
 * @evidenceReview {@link Geometry.portraitSpline} Compared the uniform Catmull-Rom polynomial, repeated endpoint neighbours and clamped progress. The parameter is not physical arc length, so dental spacing is delegated to its separate arc-distance sampler.
 * @evidence {@link Geometry.portraitTube} Sweeps the coarse lash/brow strands in their construction frame.
 * @evidenceReview {@link Geometry.portraitTube} Traced each shared ring frame from the sampled tangent and fixed Z guide. Zero, nonfinite and Z-parallel tangents refuse; eight-sided radius sections remain open-ended unless their owning surface closes them. The current strands remain coarse context rather than accepted detailed grooming.
 *
 * @evidence {@link Sphere.IPortraitEyeSphere} States the common centre and radius of the fitted optical surface in millimetres.
 * @evidenceReview {@link Sphere.IPortraitEyeSphere} Read both fields against the fit, intersection and height consumers. Radius is a positive authored curvature control and centre is behind the fitted aperture; neither field claims a physiological measurement of the adolescent source.
 * @evidence {@link Sphere.fitPortraitEyeSphere} Fits the globe from the lid plane independently of the gaze marker.
 * @evidenceReview {@link Sphere.fitPortraitEyeSphere} Followed the canthal chord, mean lid separation, camera-facing normal and mean rim residual. The unit-circle/radius-two oracle locates centre Z=-sqrt(3), including reversed lid order; zero fitting plane, missing ray and insufficient radius are refused.
 * @evidence {@link Sphere.portraitEyeSphereIntersection} Places gaze/lid samples on the fitted globe along the supplied viewing ray.
 * @evidenceReview {@link Sphere.portraitEyeSphereIntersection} Read the normalized-ray quadratic and camera-facing root. The slanted radius-two oracle retains collinearity, while a missed sphere or zero ray refuses. This preserves projection only for the declared viewing direction.
 * @evidence {@link Sphere.portraitEyeSphereHeight} Supplies the anterior spherical height shared by sclera and pigment surfaces.
 * @evidenceReview {@link Sphere.portraitEyeSphereHeight} Compared radius squared minus transverse squared distance with the positive square root. Tangency is finite, samples outside the disk refuse, and the same radius gives equal horizontal/vertical curvature.
 *
 * @evidence {@link Buffers.placePortraitMesh} Protects each part's actual placement before its final precision conversion.
 * @evidenceReview {@link Buffers.placePortraitMesh} Read the translation-free (0,b-a,c-a) reference transformed by the same engine operation. Redundancy is classified after linear scale, so an enlarged tiny source face cannot borrow a pole exemption when a large translation erases it; supported rotations and baked mirrors retain their intended winding.
 * @evidence {@link Buffers.portraitMeshBuffers} Materializes and validates the actual Float32/Uint32 geometry delivered to glTF.
 * @evidenceReview {@link Buffers.portraitMeshBuffers} Traced aligned finite attributes, exact redundant triangle ordinals, nonredundant face orientation and the unit-NORMAL check with Float32 roundoff. Independent collapse/inversion, swapped-ordinal and zero-normal cases refuse; the current a34f1fe4 GLB was read through every NORMAL accessor, with 217380 vectors and maximum unit-length error 4.84405e-8.
 * @evidence {@link Gltf.portraitGltfExtensions} Declares the optical extension classes registered on this study's GLTF readers and writers.
 * @evidenceReview {@link Gltf.portraitGltfExtensions} Compared the four registered classes with the exporter: clearcoat, IOR, transmission and volume are preserved by the actual SDK round trip. An unregistered reader/writer would be a different delivery path and is not covered by the captures.
 * @evidence {@link Gltf.portraitDocument} Converts the complete static study into resident GLTF material groups and attributes.
 * @evidenceReview {@link Gltf.portraitDocument} Read part placement, material grouping, actual buffer conversion, final topology and optical-closure checks, plus rig/texture/bone-binding refusal. Current binary inspection reads 29 material meshes and all their NORMAL accessors. The prior normal-pole repair is also exercised separately through its real buffer and optical binary consumers; material grouping does not establish anatomical completeness.
 *
 * @evidence {@link Loop.IControlMesh} Carries the shared triangular control positions, connectivity and one material label per face.
 * @evidenceReview {@link Loop.IControlMesh} #46c909f Read all three fields against the head and Loop consumers. Vertex identities support retained anatomical bindings, while groups belong to triangles and inherit to children; the type does not itself validate a manifold or choose a coordinate conversion.
 * @evidence {@link Loop.subdivideControlMesh} Refines the connected triangular cage before its shared normals and interiors are finalized.
 * @evidenceReview {@link Loop.subdivideControlMesh} #b8f2ad8 Read all default Loop masks, disjoint closed-curve admission, curve neighbour replacement, midpoint edges and interleaved next-round identities. Independent asymmetric-octahedron arithmetic distinguishes the surface and curve rules through two rounds, and removing curve midpoint ownership fails that oracle. The 454cd902 full capture has a smoother lip outline while retaining shared geometry; this does not accept likeness or guarantee every adjoining section.
 * @evidence {@link Quads.IPortraitQuadMesh} Retains quadrilateral topology for the inactive anatomical prior's common skin/neck refinement.
 * @evidenceReview {@link Quads.IPortraitQuadMesh} Read positions, four-corner faces and face labels as one connected cage in caller units. The separate quad representation preserves the face-centre refinement rule rather than treating the triangulated prior as a Loop cage.
 * @evidence {@link Quads.subdividePortraitQuads} Applies shared Catmull-Clark refinement to the anatomical skin and attached neck.
 * @evidenceReview {@link Quads.subdividePortraitQuads} Compared face centres, original edge-midpoint averages and boundary rules with the independent quad scenarios. Per-axis normalization protects finite large coordinates, while malformed quads, inconsistent manifold winding and invalid boundary valence refuse. These rules alone do not repair the stepped neck seen in the unfitted prior.
 * @evidence {@link Topology.assertPortraitSkinTopology} Audits the declared openings and stitches of the complete control cage before refinement.
 * @evidenceReview {@link Topology.assertPortraitSkinTopology} Read the exact expected-edge set, duplicate opening refusal and two opposite incident directions for internal edges. Missing or undeclared openings fail independently of vertex position, so this verifies connectivity rather than anatomical shape or global self-intersection.
 * @evidence {@link Blend.blendPortraitSkin} Adapts neighbouring skin to exact component attachments on one unchanged host.
 * @evidenceReview {@link Blend.blendPortraitSkin} Followed multi-source remaining-distance propagation and stable positive-weight displacement sweeps. Hard constraints stay exact and contradictory shared targets refuse. The 1a4bb653 collar falsifier confirms that a position-correct Laplace join can still have an unacceptable tangent and volume.
 * @evidence {@link Relief.IPortraitReliefRegion} Separates each support's live vertex binding and offset from its metric support radii and signed displacement.
 * @evidenceReview {@link Relief.IPortraitReliefRegion} Read the named anchor, XYZ offset, three positive radii and displacement fields against the layer adapter. All use head-space millimetres; the anchor follows replacement, while these envelopes remain visible-surface controls rather than reconstructed internal tissue.
 * @evidence {@link Relief.createPortraitReliefLayer} Converts owned anatomical support settings into engine deformation fields on the live skin.
 * @evidenceReview {@link Relief.createPortraitReliefLayer} Traced copied regions, unique names, resident-anchor checks and the millimetre-to-metre conversion of centre/radius/displacement. Zero displacement emits no field and stretch stays zero; the final surface assembler supplies aperture protection and common normals.
 *
 * @evidence {@link Capture.portraitCaptureProfile} Fixes the finite angle set, source crop, optics and lighting conditions used by these inspection frames.
 * @evidenceReview {@link Capture.portraitCaptureProfile} Read all nine yaw/pitch views, the 430-pixel source crop and the 64-sample denoised Cycles lights. Calibration, source pose and three clay captures complete the fourteen-frame set; hair is hidden in clay, and denoising leaves detailed strand judgments outside this stage.
 * @evidence {@link CaptureDiagnostic.IPortraitCaptureBytes} Enumerates the exact byte populations a diagnostic consumes while holding the preview lease.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitCaptureBytes} Compared receipt, profile, model, configuration, GLB, reference PNG and source-image fields with both real adapters. They are captured bytes rather than filenames reopened opportunistically after inference.
 * @evidence {@link CaptureDiagnostic.IPortraitCaptureReceipt} Binds the diagnostic's geometry/configuration/source identities and named captured frames.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitCaptureReceipt} Read the five artifact hashes and the frame name/file/hash triples. The minimal interpreted type omits renderer fields intentionally, but the generation digest still hashes the complete raw receipt containing them.
 * @evidence {@link CaptureDiagnostic.IPortraitDiagnosticProfile} Exposes only the source crop, planned views and measurement frame needed by these observers.
 * @evidenceReview {@link CaptureDiagnostic.IPortraitDiagnosticProfile} Traced crop width/height/extent checks and the exact comparison with the control net's measurement frame. This type does not claim a full renderer schema or certify unconsumed view pixels.
 * @evidence {@link CaptureDiagnostic.portraitCaptureDigest} Identifies exact consumed bytes with SHA-256 for capture-generation comparisons.
 * @evidenceReview {@link CaptureDiagnostic.portraitCaptureDigest} Read the direct byte hash and its raw-receipt use. Renderer-only or reference-frame receipt changes therefore alter generation identity even when the geometry and profile hashes remain equal.
 * @evidence {@link CaptureDiagnostic.inspectPortraitCapture} Admits a coherent source-pose diagnostic basis before inference and again before publication.
 * @evidenceReview {@link CaptureDiagnostic.inspectPortraitCapture} Compared every consumed-byte hash, target identity, measurement frame, finite crop and complete unique view inventory. Separate negative twins change each population; all seven individually disabled identity/generation guards failed before restoration.
 * @evidence {@link CaptureDiagnostic.runPortraitCaptureDiagnostic} Keeps observation and publication inside one publisher-compatible lease lifetime.
 * @evidenceReview {@link CaptureDiagnostic.runPortraitCaptureDiagnostic} Read acquire/read/observe/revalidate/publish/finally-release ordering and the failure cases. Same-GLB recapture is refused, acquisition failure releases no foreign owner, and publication remains leased. The Windows probe confirms the adapter's exclusive-create interoperability without claiming crash-atomic multi-file writes.
 *
 * @evidence {@link Surface.IPortraitSurfaceHost} Gives anatomical layers the shared post-subdivision coordinates, topology and normal field.
 * @evidenceReview {@link Surface.IPortraitSurfaceHost} Read the readonly millimetre position arrays, triangle identities and dimensionless flat normals against the layer consumers. This is a declared read-only view, not an assertion that an arbitrary callback is physically incapable of mutation.
 * @evidence {@link Surface.IPortraitSurfaceLayer} Separates a surface layer's identity from its derivation of metric engine fields on live attachments.
 * @evidenceReview {@link Surface.IPortraitSurfaceLayer} Compared the stable id and fields(host) callback with relief and cheek factories. They emit metre-valued deformation fields while host positions remain millimetres; the layer neither owns a detached shell nor performs material separation.
 * @evidence {@link Surface.applyPortraitSurfaceLayers} Applies the composed surface displacement with open-rim protection before common normals and material extraction.
 * @evidenceReview {@link Surface.applyPortraitSurfaceLayers} Read stable ID ordering, complete-skin edge distances, area-weighted distance gradients and the quintic mask derivative passed into the engine Jacobian. The folded-mask negative twins distinguish this final differential from the unfaded field. Open rims and isolated gaze markers remain fixed; sampled checks do not establish global self-intersection freedom.
 * @evidence {@link SurfaceFit.IPortraitSurfaceFit} Describes the numerical thin-plate residual and optional gaze/ray data consumed by the inactive fitted foundation.
 * @evidenceReview {@link SurfaceFit.IPortraitSurfaceFit} Read normalized centres, two-coordinate weights, four affine rows, positive scale and optional optical inputs. This numerical field type does not bind a particular model. The recorded subject recipe now supplies that separate relationship through source-model and target-control byte checks before evaluating its preset.
 * @evidence {@link SurfaceFit.createPortraitSurfaceFitter} Evaluates the inactive foundation's recorded X/Y residual while retaining prior depth.
 * @evidenceReview {@link SurfaceFit.createPortraitSurfaceFitter} Compared the copied coefficients and phi(r)=r squared log(r) kernel with its zero-distance and affine paths. Output Z stays input Z and nonfinite output refuses. The evaluator remains basis-agnostic; buildFittedReferencePortrait checks the current source and target identities before supplying its recorded coefficients, and that recipe's stale record was recomputed from a fresh observation.
 *
 * @evidence {@link Cornea.IPortraitCornea} Defines the closed optical shell's aperture, curvature, axial thickness and live globe support.
 * @evidenceReview {@link Cornea.IPortraitCornea} Read every field in the millimetre frame: unclipped radius bounds the angular extents, curvature exceeds that radius, globeRadius bounds curvature, and rimLift clears thickness. The surface callback supplies fitted depth; these controls are a rendering model, not measured physiology.
 * @evidence {@link Cornea.buildPortraitCornea} Constructs the joined anterior/posterior shell delivered with optical volume materials.
 * @evidenceReview {@link Cornea.buildPortraitCornea} Traced corneal sag minus globe sag, one axial vertex per pole, reversed back winding and shared outer-ring closure. Clipping changes radial reach without refitting curvature per column. The actual export's volume topology gate checks closure; opaque clay display does not judge refraction.
 * @evidence {@link Crown.IPortraitDentalCrown} Separates enamel width, height, half-depth, cervical narrowing and cutting-edge rise from arch placement.
 * @evidenceReview {@link Crown.IPortraitDentalCrown} Read the local gingival +Y/anterior +Z frame and all five dimensions. Cervical width is a ratio while edge rise is a length bounded by half-height, so neither can substitute for a dental-row spacing or rigid-placement control.
 * @evidence {@link Crown.assertPortraitDentalCrown} Admits usable enamel profiles before their width influences arch clearance.
 * @evidenceReview {@link Crown.assertPortraitDentalCrown} Compared finite positive dimensions, cervical ratio in (0,1] and rise in [0,height/2) with the crown's loft equations. The strict upper rise bound keeps the cutting edge from consuming the complete body height; the checker does not judge source likeness.
 * @evidence {@link Crown.buildPortraitDentalCrown} Builds each closed local crown before the row arranges it along one arch.
 * @evidenceReview {@link Crown.buildPortraitDentalCrown} Read the rounded transverse profile, sampled maximum breadth, cervical narrowing and two shared end caps. The declared width is reached for clearance accounting, while the current rendered crowns remain block-like and need finer anatomical sections.
 * @evidence {@link DentalArc.IPortraitDentalArc} Exposes physical horizontal arc distance and tangent to the dental-row arrangement.
 * @evidenceReview {@link DentalArc.IPortraitDentalArc} Read length, central distance and the sample result in the same millimetre frame. Position and horizontal unit tangent are returned together; the guide's inferred posterior continuation is not a source-image measurement.
 * @evidence {@link DentalArc.createPortraitDentalArc} Samples the supplied dental guide by cumulative XZ distance rather than projected width or spline progress.
 * @evidenceReview {@link DentalArc.createPortraitDentalArc} Traced the 257 core samples, cubic posterior continuations and positive-distance binary lookup. The active row supplies a planar elliptical guide, so this legacy oral-guide capability does not independently resample tooth heights from lip landmarks. Out-of-range distance and zero horizontal advance refuse.
 * @evidence {@link Dental.IPortraitDentalRow} Supplies one local arch and its ordered crown profiles to the grouped dentition builder.
 * @evidenceReview {@link Dental.IPortraitDentalRow} Compared halfWidth/depth with the elliptical guide, gap with cumulative clearance, and crowns with their independently validated enamel dimensions. Anatomical right-to-left order and the common gingival plane belong to this group rather than individual oral ray hits.
 * @evidence {@link Dental.IPortraitDentalAttachment} Defines the complete row's oral datum, orientation guides and metric offsets.
 * @evidenceReview {@link Dental.IPortraitDentalAttachment} Read both corner points, upper-lip centre, up guide, lift and recess against rigid attachment. The corner chord supplies X, orthogonalized up supplies Y, and their cross supplies anterior Z; lengths remain millimetres and no per-tooth transform is introduced.
 * @evidence {@link Dental.attachPortraitDentalRow} Places every crown vertex and normal through one orthonormal oral frame.
 * @evidenceReview {@link Dental.attachPortraitDentalRow} Traced copied mesh data, degenerate-chord/up refusal and the same frame multiplication for positions and normals. The rigid-group/translation scenarios preserve pairwise tooth arrangement; the visible rectangular crowns remain a shape problem outside this placement operation.
 *
 * @evidence {@link LipSection.IPortraitLipSection} Gives upper body/tubercle and lower body/pads independent signed relief controls.
 * @evidenceReview {@link LipSection.IPortraitLipSection} Read millimetre projections separately from half-width fractions for tubercle width, pad width and offset. Zero projections retain the prior band, so a small measured final effect does not make these controls inactive.
 * @evidence {@link LipSection.IPortraitLipCoordinate} Locates a sample inside one curved vermilion band without subject-specific vertex identities.
 * @evidenceReview {@link LipSection.IPortraitLipCoordinate} Compared upper/lower classification, signed lateral progress and cutaneous-to-aperture across progress with the coordinate binder. These are normalized band coordinates, not head-Y labels or a new dental frame.
 * @evidence {@link LipSection.createPortraitLipSection} Evaluates copied, independent vermilion relief while keeping both band edges and corners pinned.
 * @evidenceReview {@link LipSection.createPortraitLipSection} Read the quartic lateral fade, sine-squared across envelope and separate central/paired Gaussian terms. The boundary return is exact zero; final zero-section comparison moves only head/lips, with maximum lip effect 0.46749 mm, while the rendered bands remain anatomically simplified.
 * @evidence {@link LipSection.createPortraitLipCoordinates} Binds outer and inner lip curves to the section's normalized coordinates.
 * @evidenceReview {@link LipSection.createPortraitLipCoordinates} Traced the two extreme-X outer paths, strict forward ordering, shared inner corners and local upper/lower midpoint classification. Normalized interpolation prevents large-coordinate subtraction overflow; the raised lower-lip test guards against replacing this curved frame with a global Y threshold.
 * @evidence {@link Nostril.resizePortraitNostrilRim} Changes aperture dimensions inside its fitted plane without independently flattening the rim.
 * @evidenceReview {@link Nostril.resizePortraitNostrilRim} Read projected head-X width, the exact-X-normal head-Y guide, perpendicular height and retained normal residual. Unit scales copy all points exactly. The component applies overall nasal width and tilt later, so these local factors do not guarantee the same final footprint after a body-depth change.
 * @evidence {@link Nostril.fitPortraitNostrilRim} Regularizes an authored nasal cut boundary while preserving cyclic vertex ownership and centroid.
 * @evidenceReview {@link Nostril.fitPortraitNostrilRim} Traced normalized fitting coordinates, area normal, principal ellipse axes, perimeter phase and recentering. Zero amount preserves input exactly; a nonzero fit changes the sampled shape in its own plane. The cut points remain authored bindings rather than a measured physical nostril outline.
 *
 * @evidence {@link Head.buildPortraitHead} Assembles component cuts, shared skin, optional anatomical curves and final-surface proposals before material separation and attached interiors.
 * @evidenceReview {@link Head.buildPortraitHead} #a66a8d7 Read unchanged-host fitting, cut and region refusals, common cranium/neck topology, optional curves, post-layer proposals and finish(refined). The lip test confirms actual shared skin/colour-border positions; all fourteen a34f1fe4 frames retain assembled skin and neck. The nasal underside and eye pads remain visible defects outside a topology-only conclusion.
 * @evidence {@link Dental.buildPortraitDentalRow} Read the elliptical guide, cumulative arc-length crown centres, tangent rotation and common cervical Y plane, then inspected the current front/profiles/clay. One arch is retained behind the lip; rectangular crowns and the dark lower gap still differ from the photographed smile.
 * @evidence {@link Attachment.createPortraitDentalComponent} Checked that the interior submits no cuts or skin constraints and constructs its rigid frame only from final refined oral anchors. The current exported tooth-upper-arch stays grouped; its placement protocol does not solve the remaining crown and lip appearance.
 * @evidence {@link Nasal.createPortraitNoseComponent} Traced optional loft depth through rim-plane fitting, sizing, tilt and shared lining construction. The active recovered preset omits the loft. Current source/bottom/clay views retain connected openings but weak tip/alar separation; changing exterior depth can still alter the fitted aperture frame.
 * @evidence {@link Ocular.createPortraitOcularTissues} Read the copied tissue profile, mirrored medial distance, caruncle/plica envelopes and lower strip clipped to half the live aperture. Current source views retain the small medial tissue and lower margin; their lid/globe attachment does not resolve the conspicuous lid bands or synthetic eye presentation.
 * @evidence {@link Eyes.buildPortraitEye} Read the final lid curves, fitted spherical height, camera-ray gaze, clipped pigment/corneal layers and radial sclera normal. Independent radius-two/translated-cap and actual GLB tests cover the corrected canthi; all fourteen a34f1fe4 frames and eight close colour/clay views were opened. The lower body is clearer but the central pad and upper-inner wedge remain, so overall ocular likeness is unaccepted.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  sourceCommit: "83d929bc",
  gltfSha256:
    "a34f1fe42215a312787c9bdd2b9e34c65981171efc127ac70229240e3b025540",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
