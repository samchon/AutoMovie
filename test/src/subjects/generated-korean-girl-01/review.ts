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
import type * as FinalSurface from "../portraitFinalSurface";
import type * as FitBasis from "../portraitFitBasis";
import type * as JoinReference from "../portraitJoinReference";
import type * as JoinTangency from "../portraitJoinTangency";
import type * as Buffers from "../portraitMeshBuffers";
import type * as MeshPatch from "../portraitMeshPatch";
import type * as OralContact from "../portraitOralContact";
import type * as PatchAttachment from "../portraitPatchAttachment";
import type * as Replacement from "../portraitRegionReplacement";
import type * as Relief from "../portraitRelief";
import type * as Topology from "../portraitSkinTopology";
import type * as Surface from "../portraitSurface";
import type * as Fairing from "../portraitSurfaceFairing";
import type * as SurfaceFit from "../portraitSurfaceFit";
import type * as ReferenceAnatomy from "../reference-anatomy/model";
import type * as JoinRefinement from "../refinePortraitJoin";
import type * as RimReplacement from "../replacePortraitRim";
import type * as SkinReservation from "../reservePortraitSkin";
import type * as Loop from "../subdivideControlMesh";
import type * as Quads from "../subdividePortraitQuads";
import type * as Anatomy from "./anatomy";
import type * as Cheeks from "./cheeks";
import type * as Configuration from "./configuration";
import type * as ControlNet from "./controlNet";
import type * as Cranium from "./cranium";
import type * as DentalArc from "./dentalArc";
import type * as Attachment from "./dentalComponent";
import type * as Crown from "./dentalCrown";
import type * as Dental from "./dentalRow";
import type * as Ears from "./ears";
import type * as Eyebrows from "./eyebrows";
import type * as Eyes from "./eyes";
import type * as Fitted from "./fittedModel";
import type * as Hair from "./hairProxy";
import type * as Head from "./head";
import type * as Pigment from "./irisPigment";
import type * as LipSection from "./lipSection";
import type * as LowerLid from "./lowerLidSection";
import type * as Materials from "./materials";
import type * as Model from "./model";
import type * as Mouth from "./mouth";
import type * as NasalAperture from "./nasalAperture";
import type * as NasalBody from "./nasalBody";
import type * as NasalBodySurface from "./nasalBodySurface";
import type * as NasalLobule from "./nasalLobule";
import type * as NasalReference from "./nasalReference";
import type * as RimSection from "./nasalRimSection";
import type * as NasalSection from "./nasalSection";
import type * as NasalSupport from "./nasalSupport";
import type * as Nasal from "./nose";
import type * as Nostril from "./nostrilRim";
import type * as Ocular from "./ocularTissues";
import type * as OrbitalSupport from "./orbitalSupport";

/**
 * Partial construction-source account. Individual notes retain the explicitly
 * named historical capture that was inspected; a historical observation is not
 * a current-source attestation. In particular, the b3306ba5 patch/fairing notes
 * predate late source insertion and XYZ tangent-row fairing and need a renewed
 * literal source review. Current image observations belong to review.md.
 * Relationships are recorded before compiler-issued fingerprints are inserted.
 * Missing coverage/fingerprints remain errors; this intermediate account does
 * not claim whole-source or likeness acceptance.
 *
 * @evidence {@link SkinReservation.reservePortraitSkin} Selects a connected host-skin reservation that contains a component's proposed outer seam before the component removes its original faces.
 * @evidenceReview {@link SkinReservation.reservePortraitSkin} #bec1190 Read the target/loop cardinality guard, connected face-ring growth, simple-boundary test and finite termination before the shared annulus is attached. The host remains immutable and the reservation returns original face ordinals plus its outer boundary; this topology operation does not claim a 3D collision certificate.
 * @evidence {@link SkinReservation.portraitSkinAnnulus} Bridges a reserved outer host boundary to the component's inner boundary with the existing planar region triangulator.
 * @evidenceReview {@link SkinReservation.portraitSkinAnnulus} #346bf5e Read both loop winding checks, complete finite coordinate conversion, planar-region rejection and the returned oriented triangle order. The bridge preserves the two boundary identities for the eye attachment; it does not alter the component's optical or lower-lid dimensions.
 *
 * @evidence {@link Anatomy.portraitOrbitalRelief} Supplies the subject's named orbital support regions consumed by the shared surface layer.
 * @evidenceReview {@link Anatomy.portraitOrbitalRelief} #a1b1558 Read the medial upper-orbit region additions, resident anchors, XYZ offsets, radii and signed displacement beside the layer consumer. These authored envelopes adjust shared skin support and do not claim measured orbital anatomy.
 * @evidence {@link Anatomy.portraitPerioralRelief} Supplies the subject's named perioral transition regions consumed by the shared surface layer.
 * @evidenceReview {@link Anatomy.portraitPerioralRelief} #7f2a730 Read the updated philtral and lip-to-chin support radii and displacement beside the live-skin layer consumer. They remain surface envelopes with authored values, separate from the mouth component and dental placement.
 * @evidence {@link Configuration.portraitEyeShape} Selects the active eye's optional skin attachment, lower-lid profile and optical/material controls.
 * @evidenceReview {@link Configuration.portraitEyeShape} #e879bf8 Read the reserved attachment mode, compact pretarsal/subtarsal profile, aperture and optical scale controls, pigment endpoints and their consumers. These values select one authored assembly and do not certify likeness.
 * @evidence {@link Configuration.portraitNoseShape} Selects the active nose's fitted aperture dimensions and restrained alar projection.
 * @evidenceReview {@link Configuration.portraitNoseShape} #f7ab8e1 Read the coupled tip and alar relief beside the aperture and rim consumers. The two amplitudes soften the bridge-to-tip and paired wing transition while nostril topology and cavity attachment remain owned by the nose component.
 * @evidence {@link Configuration.portraitMouthShape} Selects the active mouth's corner, section, and grouped crown controls.
 * @evidenceReview {@link Configuration.portraitMouthShape} #ad3adf7 Read the narrower fitted oral frame, reduced vermilion relief and the central-incisor mesial/distal cutting-edge contours beside the shared lip and dental consumers. The grouped settings do not replace the oral attachment frame.
 * @evidence {@link Configuration.portraitCheekShape} Selects paired medial and buccal cheek support radii and transition controls.
 * @evidenceReview {@link Configuration.portraitCheekShape} #4df9f58 Read the malar cushion's coupled projection/lift and the medial transition beside portraitCheekLayersFor. The offset follows the shared live anchor and does not create an independent detached cheek mesh.
 * @evidence {@link Configuration.portraitOrbitalSupportShapes} Selects the station-wise brow and sulcus support values for the active orbital layer.
 * @evidenceReview {@link Configuration.portraitOrbitalSupportShapes} #16623d4 Read the changed medial station brow/sulcus projections beside the orbital support factory. Station order and resident anchors remain the authority; these values do not alter the eye's optical shell.
 * @evidence {@link Cranium.portraitNeckShape} Selects the active cranial/neck section dimensions and crop.
 * @evidenceReview {@link Cranium.portraitNeckShape} #f3f6e13 Read the upper-section Y adjustment beside appendPortraitNeck and the profile capture. The neck shape remains an authored crop/transition control, separate from facial likeness claims.
 * @evidence {@link Materials.createPortraitMaterials} Produces the active subject's owned skin and component material records.
 * @evidenceReview {@link Materials.createPortraitMaterials} #d196a93 Read the warmer skin base colour and roughness beside the material factory's copied records. This appearance-only change leaves component geometry and attachment topology to their separate owners.
 *
 * @evidence {@link Configuration.portraitEyeSockets} Binds the active eye aperture, iris and brow boundary identities.
 * @evidenceReview {@link Configuration.portraitEyeSockets} #fc103a2 Read both handed socket loops and their shared canthus/iris/brow anchors beside eye construction. These identities select resident host vertices and do not encode a second eye shape.
 * @evidence {@link Configuration.alternatePortraitEye} Supplies an independently replaceable eye profile for component-assembly scenarios.
 * @evidenceReview {@link Configuration.alternatePortraitEye} #855a356 Read the copied alternate profile beside portraitComponentsFor and the replacement tests. Its replacement path is independent of the active eye and does not mutate the active configuration.
 * @evidence {@link Configuration.portraitNoseSocket} Binds the active nose's cut, aperture and lining anchors.
 * @evidenceReview {@link Configuration.portraitNoseSocket} #817b474 Read the resident socket IDs and their use by the nose component. These are attachment identities, separate from nasal dimensions and fitted aperture shape.
 * @evidence {@link Configuration.portraitNasalSection} Selects the optional cubic nasal-section evaluator input.
 * @evidenceReview {@link Configuration.portraitNasalSection} #0b359ee Read the retained section stations, transverse basis and join width beside the nasal evaluator. The active assembly keeps this optional path distinct from the recovered basic nose.
 * @evidence {@link Configuration.alternatePortraitNose} Supplies an independently replaceable nose profile for component-assembly scenarios.
 * @evidenceReview {@link Configuration.alternatePortraitNose} #48a088f Read the alternate nose's copied dimensions beside portraitComponentsFor and the replacement tests. It is an assembly alternative, not a second active nasal authority.
 * @evidence {@link Configuration.portraitMouthSocket} Binds the active mouth opening, lip and dental attachment identities.
 * @evidenceReview {@link Configuration.portraitMouthSocket} #ec358d3 Read the resident mouth loop and oral anchors beside mouth and dental attachment. These identities do not determine optional lip relief or crown profiles.
 *
 * @evidence {@link Configuration.portraitDentalRow} Selects the ordered upper dental profiles, arch dimensions and contact policy.
 * @evidenceReview {@link Configuration.portraitDentalRow} #c55c28c Read the row's ordered profiles, arch dimensions and optional contact gap beside dental-row construction; proximal clearance remains resolved after rigid placement.
 * @evidence {@link Configuration.portraitDentalSocket} Binds the dental row to the refined oral anchors.
 * @evidenceReview {@link Configuration.portraitDentalSocket} #4507b8c Read the three resident attachment identities beside createPortraitDentalComponent; the socket owns placement data and does not reshape crowns.
 * @evidence {@link Configuration.portraitDentalPlacement} Selects grouped dental lift and recess in millimetres.
 * @evidenceReview {@link Configuration.portraitDentalPlacement} #0cd2005 Read lift/recess beside the rigid oral frame; these offsets move one group and do not introduce per-tooth transforms.
 * @evidence {@link Configuration.portraitCheekSockets} Binds paired cheek support regions to resident refined-surface anchors.
 * @evidenceReview {@link Configuration.portraitCheekSockets} #6a3f08e Read anatomical-side ordering and live anchors beside cheek-layer construction; sockets provide locations while paired shapes own radii and offsets.
 * @evidence {@link Configuration.portraitCheekLayersFor} Builds paired cheek surface layers from independently supplied shape controls.
 * @evidenceReview {@link Configuration.portraitCheekLayersFor} #88d021b Read copied right/left shapes, side mirroring and named malar/buccal fields beside the layer factory; it emits shared-skin fields rather than detached cheek parts.
 * @evidence {@link Configuration.portraitComponentsFor} Composes replaceable eye, nose and mouth owners with shared sockets.
 * @evidenceReview {@link Configuration.portraitComponentsFor} #08bcb1e Read copied component settings, defaults and optional mouth replacement beside assembly tests; each part retains independent attachment/detail parameters.
 * @evidence {@link Configuration.portraitNasalSupportDetail} Holds the optional nasal-control replacement selected by an assembly.
 * @evidenceReview {@link Configuration.portraitNasalSupportDetail} #cfdf698 Read its explicit undefined/default branch beside portraitNasalLayerFor and assembly construction; it remains separate from basic support.
 * @evidence {@link Configuration.measuredPortraitAssembly} Supplies the active component and surface-layer assembly.
 * @evidenceReview {@link Configuration.measuredPortraitAssembly} #31c6970 Read shared components, paired cheek layers and named supports beside buildReferencePortrait; this is an authored assembly datum, not likeness evidence.
 * @evidence {@link Configuration.portraitAssembly} Supplies the complete default assembly input.
 * @evidenceReview {@link Configuration.portraitAssembly} #532a6ea Read default component/layer composition and stable references; replacement helpers retain independent owners.
 *
 * @evidence {@link Ears.IPortraitEarShape} Groups the resident ear datum, scale, projection and embedding controls.
 * @evidenceReview {@link Ears.IPortraitEarShape} #580d580 Read the copied ear shape inputs beside its sampler and builder. The profile separates height/depth scale from projection and embedding, while keeping the shell as an authored external ear approximation.
 * @evidence {@link Ears.IPortraitEarShape.centerY} Locates the ear datum along the construction Y axis.
 * @evidenceReview {@link Ears.IPortraitEarShape.centerY} #fe0ab55 Read centerY into the sampled ear frame and its finite coordinate admission.
 * @evidence {@link Ears.IPortraitEarShape.centerZ} Locates the ear datum along the construction Z axis.
 * @evidenceReview {@link Ears.IPortraitEarShape.centerZ} #0cc974c Read centerZ into the sampled ear frame; it remains separate from the ear's anterior projection scale.
 * @evidence {@link Ears.IPortraitEarShape.heightScale} Scales the ear's vertical extent around its resident datum.
 * @evidenceReview {@link Ears.IPortraitEarShape.heightScale} #5beb13f Traced heightScale into the outer and inner ear sample rows beside positive finite scale checks.
 * @evidence {@link Ears.IPortraitEarShape.depthScale} Scales the ear's depth extent around its resident datum.
 * @evidenceReview {@link Ears.IPortraitEarShape.depthScale} #9e9dac6 Read depthScale into the ear shell's depth coordinates beside its positive finite admission.
 * @evidence {@link Ears.IPortraitEarShape.projection} Controls the ear's anterior placement relative to the sampled head surface.
 * @evidenceReview {@link Ears.IPortraitEarShape.projection} #cd9ec32 Read projection into the final ear frame beside the head-surface attachment; it does not move the shared facial sockets.
 * @evidence {@link Ears.IPortraitEarShape.embedding} Controls lateral embedding of the ear shell into its host surface.
 * @evidenceReview {@link Ears.IPortraitEarShape.embedding} #5a7d808 Traced embedding into the ear attachment frame and its bounded admission; the shell remains a separate component group.
 * @evidence {@link Ears.buildPortraitEars} Samples and attaches both authored ear shells to the final cranial surface.
 * @evidenceReview {@link Ears.buildPortraitEars} #ff76f86 Read side mirroring, copied shape inputs, live head-surface depth sampling and separate ear material groups beside ear attachment tests. This external shell does not claim detailed helix anatomy or likeness acceptance.
 * @evidence {@link Ears.portraitEarShape} Supplies the default authored ear profile when no replacement is selected.
 * @evidenceReview {@link Ears.portraitEarShape} #e2cf74e Read the default datum, scales, projection and embedding beside both ear consumers. These values are procedural defaults rather than measured subject anatomy.
 *
 * @evidence {@link NasalAperture.IPortraitNasalJet} Groups one sampled nasal-section point and its derivative.
 * @evidenceReview {@link NasalAperture.IPortraitNasalJet} #c776965 Read the point and derivative pair beside nasal-section sampling. The jet is a local parametric witness and does not independently place the finished nose.
 * @evidence {@link NasalAperture.IPortraitNasalJet.point} Supplies one finite nasal-section point in the construction frame.
 * @evidenceReview {@link NasalAperture.IPortraitNasalJet.point} #30d94d6 Read point into the section sampler's returned XYZ datum and finite coordinate guard.
 * @evidence {@link NasalAperture.IPortraitNasalJet.derivative} Supplies the local tangent used by nasal aperture fitting.
 * @evidenceReview {@link NasalAperture.IPortraitNasalJet.derivative} #e923e9c Read derivative beside the section's transverse/vertical parameter directions; it is a local frame witness rather than a global normal.
 * @evidence {@link NasalAperture.IPortraitNasalRimJet} Groups one nasal rim point with its tangent and transverse directions.
 * @evidenceReview {@link NasalAperture.IPortraitNasalRimJet} #5febf4d Read the three rim-vector fields beside rim-section fitting. Their shared local frame preserves aperture ownership and does not create an additional detached rim.
 * @evidence {@link NasalAperture.IPortraitNasalRimJet.point} Supplies the rim point retained by the aperture boundary.
 * @evidenceReview {@link NasalAperture.IPortraitNasalRimJet.point} #42602aa Read point beside the shared rim boundary and its finite XYZ admission.
 * @evidence {@link NasalAperture.IPortraitNasalRimJet.tangent} Supplies the longitudinal direction along the nasal rim.
 * @evidenceReview {@link NasalAperture.IPortraitNasalRimJet.tangent} #e57983f Traced tangent into the rim annulus orientation and its local normalization.
 * @evidence {@link NasalAperture.IPortraitNasalRimJet.transverse} Supplies the transverse direction across the nasal rim section.
 * @evidenceReview {@link NasalAperture.IPortraitNasalRimJet.transverse} #a57f5eb Read transverse beside tangent to preserve the aperture-plane frame and its signed normal relationship.
 * @evidence {@link NasalAperture.IPortraitNasalApertureFrame} Groups the origin and inward axis of one fitted nasal aperture plane.
 * @evidenceReview {@link NasalAperture.IPortraitNasalApertureFrame} #308170b Read copied origin/inward values beside aperture sizing and tilt. The frame is local to the authored rim and does not replace the nose's shared skin support.
 * @evidence {@link NasalAperture.IPortraitNasalApertureFrame.origin} Locates the fitted aperture plane in the construction frame.
 * @evidenceReview {@link NasalAperture.IPortraitNasalApertureFrame.origin} #9565747 Read origin beside centroid-preserving aperture resizing and finite point checks.
 * @evidence {@link NasalAperture.IPortraitNasalApertureFrame.inward} Selects the aperture plane's inward direction.
 * @evidenceReview {@link NasalAperture.IPortraitNasalApertureFrame.inward} #9297734 Traced inward into plane-normal orientation and the signed rim/cavity relationship; it is not an independent nose projection amount.
 *
 * @evidence {@link NasalBody.IPortraitNasalBodyStation} Defines one ordered lower-nasal station and its midline, shoulder and alar extents.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyStation} #d614402 Read the four station fields beside the C1 longitudinal interpolator; endpoint extents and ordering remain explicit profile invariants.
 * @evidence {@link NasalBody.IPortraitNasalBodyStation.height} Locates one lower-nasal station along head Y.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyStation.height} #b79e800 Read increasing height into station spans and endpoint sampling.
 * @evidence {@link NasalBody.IPortraitNasalBodyStation.centre} Sets the midline forward extent at one station.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyStation.centre} #66bedc7 Traced centre into the midline transverse section and its zero-end admission.
 * @evidence {@link NasalBody.IPortraitNasalBodyStation.shoulder} Sets paired lower-tip shoulder extent at one station.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyStation.shoulder} #af540a8 Read shoulder into the paired transverse supports beside the station interpolator.
 * @evidence {@link NasalBody.IPortraitNasalBodyStation.ala} Sets paired alar-body extent at one station.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyStation.ala} #db3554e Read ala into the paired alar supports and peak-phase calculation.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape} Groups the ordered lower-nasal stations and independent midline, shoulder, alar and crease controls.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape} #b8092fb Read copied stations and all transverse controls beside the connected lower-nose evaluator. The profile owns one shared surface field and leaves aperture pose to its separate owner.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.stations} Supplies ordered longitudinal samples whose endpoint extents join the surrounding surface.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.stations} #ef04243 Traced ordered station admission, zero endpoint extents and harmonic-mean slope construction through the body evaluator.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.centreWidth} Sets the midline transverse half-width.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.centreWidth} #04d83a2 Read centreWidth into the midline envelope and positive-width admission.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.shoulderOffset} Sets paired shoulder distance from the midline.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.shoulderOffset} #73a4735 Read shoulderOffset into the paired shoulder envelopes and nonnegative admission.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.shoulderWidth} Sets each shoulder transverse half-width.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.shoulderWidth} #9ea34ff Read shoulderWidth into the shoulder envelopes beside positive-width checks.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.alarOffset} Sets paired alar distance from the midline.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.alarOffset} #9f8125e Traced alarOffset into the paired alar transverse supports.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.alarWidth} Sets each alar transverse half-width.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.alarWidth} #ec97130 Read alarWidth beside the positive transverse-domain admission.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.fullness} Adds independent right/left alar forward extent at the profile peak.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.fullness} #90cee34 Read the two side-qualified fullness values through alar phase; zero peak disables this optional term.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.spread} Adds independent right/left lateral support at the alar peak.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.spread} #a961178 Traced signed side spread through the lateral output and preserved anatomical handedness.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.creaseOffset} Sets lateral distance from each alar centre to its facial crease.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.creaseOffset} #059f25b Read creaseOffset into the paired crease envelopes beside nonnegative admission.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.creaseWidth} Sets each alar-facial crease half-width.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.creaseWidth} #2704044 Read creaseWidth into crease recession support beside positive-width checks.
 * @evidence {@link NasalBody.IPortraitNasalBodyShape.crease} Adds independent right/left crease recession at the alar peak.
 * @evidenceReview {@link NasalBody.IPortraitNasalBodyShape.crease} #83e7b6e Traced signed right/left crease values into the forward field and the absent-alar refusal.
 * @evidence {@link NasalBody.createPortraitNasalBody} Builds the connected lower-nasal surface field from ordered stations and transverse controls.
 * @evidenceReview {@link NasalBody.createPortraitNasalBody} #caeff2b Read copied array inputs, station slope limiting, endpoint joins, transverse envelopes and finite output checks. Midline, shoulder, alar and crease controls share one field rather than overlapping detached shells.
 * @evidence {@link NasalBody.portraitNasalViewRay} Derives the image-depth ray from the captured horizontal and vertical camera rows.
 * @evidenceReview {@link NasalBody.portraitNasalViewRay} #e91e045 Read finite three-component admission, normalized cross product and independent-axis refusal. The ray preserves image-plane coordinates for nasal depth controls and does not itself alter geometry.
 *
 * @evidence {@link NasalSection.IPortraitNasalSectionStation} Defines one transverse depth-control row of the optional nasal loft.
 * @evidenceReview {@link NasalSection.IPortraitNasalSectionStation} #e2d459b Read station height and ordered depth poles beside the cubic loft's axis mapping. The row supplies authored controls rather than sampled source vertices.
 * @evidence {@link NasalSection.IPortraitNasalSectionStation.height} Locates a nasal loft row along local head Y.
 * @evidenceReview {@link NasalSection.IPortraitNasalSectionStation.height} #beb4849 Read increasing heights into the open-uniform station axis and its finite spacing checks.
 * @evidence {@link NasalSection.IPortraitNasalSectionStation.depths} Supplies the ordered local head-Z poles for one station.
 * @evidenceReview {@link NasalSection.IPortraitNasalSectionStation.depths} #63262ba Traced depth poles into the tensor-product control grid and depth-hull interpolation.
 * @evidence {@link NasalSection.IPortraitNasalSection} Groups transverse poles, station rows and bounded identity-transition controls.
 * @evidenceReview {@link NasalSection.IPortraitNasalSection} #285c27c Read copied axes, station rows, join width and influence beside the loft evaluator. The optional field is a single connected depth authority and leaves aperture pose to its separate owner.
 * @evidence {@link NasalSection.IPortraitNasalSection.transverse} Supplies the strictly increasing local-X control positions.
 * @evidenceReview {@link NasalSection.IPortraitNasalSection.transverse} #8ef8a98 Read transverse poles into the normalized inversion and four-to-64 control bound.
 * @evidence {@link NasalSection.IPortraitNasalSection.stations} Supplies strictly increasing local-Y control rows.
 * @evidenceReview {@link NasalSection.IPortraitNasalSection.stations} #2e231a7 Read station rows into the tensor-product grid and matching depth-array admission.
 * @evidence {@link NasalSection.IPortraitNasalSection.joinWidth} Sets the positive identity-transition width at the domain edges.
 * @evidenceReview {@link NasalSection.IPortraitNasalSection.joinWidth} #d0a3e18 Traced joinWidth into the half-span bound and quintic edge transition.
 * @evidence {@link NasalSection.IPortraitNasalSection.influence} Sets the bounded blend from host depth to the local loft.
 * @evidenceReview {@link NasalSection.IPortraitNasalSection.influence} #1b124cc Read influence into the [0,1] blend, where zero preserves host identity.
 * @evidence {@link NasalSection.createPortraitNasalSection} Evaluates the optional continuous nasal depth loft against a translated host datum.
 * @evidenceReview {@link NasalSection.createPortraitNasalSection} #e2fe69c Read copied inputs, open-uniform cubic evaluation, physical-coordinate inversion, edge transition and finite output/refusal paths. The loft's bounded scalar depth does not assert post-subdivision likeness or global intersection safety.
 *
 * @evidence {@link NasalAperture.samplePortraitNasalSection} Interpolates one nasal section jet while retaining its point and derivative.
 * @evidenceReview {@link NasalAperture.samplePortraitNasalSection} #c38fee2 Read signed span interpolation, endpoint derivative scaling and finite output guards beside aperture consumers. The helper is a local section operation and does not choose the finished nose depth.
 * @evidence {@link NasalAperture.portraitNasalJetCorrection} Extends a nasal boundary jet toward an unchanged far end.
 * @evidenceReview {@link NasalAperture.portraitNasalJetCorrection} #ec044ca Read signed-distance orientation, derivative reversal and clamped section progress beside nasal entry construction. The correction preserves one local jet and does not refit the outer aperture.
 * @evidence {@link NasalAperture.portraitNasalRimJets} Derives tangent/transverse rim jets from the shared aperture points, normals and exterior samples.
 * @evidenceReview {@link NasalAperture.portraitNasalRimJets} #f0861d7 Read cyclic tangent, normalized common normal, exterior-side sign agreement and degenerate refusal. The result fixes a local rim frame for lining and does not add a separate rim shell.
 * @evidence {@link NasalAperture.samplePortraitNasalEntry} Samples the connected vestibular meridian from a shared rim jet and aperture frame.
 * @evidenceReview {@link NasalAperture.samplePortraitNasalEntry} #f8e842b Read finite jet/frame admission, contracted middle section and common floor pole construction. This is an authored lining approximation and not an airway or likeness model.
 * @evidence {@link Anatomy.portraitNasalRelief} Supplies the retained basic nasal surface envelopes when no optional replacement detail is selected.
 * @evidenceReview {@link Anatomy.portraitNasalRelief} #d38d104 Read named nasal support regions, live anchors, radii and signed displacements beside portraitNasalLayerFor. They are visible-surface controls and remain separate from the nasal body and aperture groups.
 * @evidence {@link NasalBodySurface.createPortraitNasalBodySurface} Adapts a lower-nasal body field to the shared skin surface and its recorded view ray.
 * @evidenceReview {@link NasalBodySurface.createPortraitNasalBodySurface} #8b70114 Read body evaluator ownership, skin depth sampling, view-ray projection and finite field conversion beside the nasal assembly. The adapter shares one host surface and does not produce overlapping nasal shells.
 * @evidence {@link ControlNet.referenceControlNet} Supplies the frozen measured control positions, camera basis and triangle topology for this subject.
 * @evidenceReview {@link ControlNet.referenceControlNet} #0720aae Read source/model/topology digests, camera basis and resident position population beside fitting and assembly. Image-plane observations are measured inputs; depth remains an authored estimate and is not a likeness certificate.
 * @evidence {@link JoinRefinement.refinePortraitJoin} Refines a joining annulus while retaining its fixed attachment boundaries.
 * @evidenceReview {@link JoinRefinement.refinePortraitJoin} #60e4cd6 Read resident triangle admission, shared edge midpoint reuse, centroid fans and bounded rounds beside join tests. Existing boundary vertices remain exact while interior samples are appended deterministically.
 * @evidence {@link JoinTangency.fitPortraitJoinBoundary} Fits the first joining row to the actual supporting planes on both sides.
 * @evidenceReview {@link JoinTangency.fitPortraitJoinBoundary} #913a264 Read two-sided boundary discovery, forward-facing plane admission, local midpoint fraction and positive projected-area checks. The discrete chart owns only the compact annulus and does not prove curvature continuity globally.
 * @evidence {@link JoinReference.fitPortraitJoinReference} Adapts a supplied source height surface across a joining annulus.
 * @evidenceReview {@link JoinReference.fitPortraitJoinReference} #66e0184 Read tangent targets, source height lookup, finite reach accumulation and positive-weight skin adaptation beside fairing. Fixed native/host boundaries remain authoritative and the result is not a global intersection proof.
 * @evidence {@link Hair.buildPortraitHairProxy} Builds the coarse scalp cap and side curtain used for face silhouette inspection.
 * @evidenceReview {@link Hair.buildPortraitHairProxy} #43369f0 Read copied scalp/side attachment points, ellipsoid enclosure, forehead support, continuous hairline transition, ear clearance and finite metric checks. This remains an unfinished coarse proxy with no fibre simulation or detailed hair likeness claim.
 * @evidence {@link Model.buildReferencePortrait} Assembles the selected foundation, components, shared skin layers, ears, hair and oral contacts into the inspectable portrait model.
 * @evidenceReview {@link Model.buildReferencePortrait} #910745a Read foundation branching, control-net handoff, component assembly, final-skin ear/hair attachment and oral-contact application. The builder returns deterministic model data but does not turn passing construction checks into a likeness verdict.
 *
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
 *
 * @evidence {@link Cranium.IPortraitNeckSection} Describes one cross-section of the authored neck continuation.
 * @evidenceReview {@link Cranium.IPortraitNeckSection} #9f21ae5 Read the section's Y coordinate, width, front, centre and back depths beside appendPortraitNeck. These values define one closed continuation sample and do not claim measured cervical anatomy.
 * @evidence {@link Cranium.IPortraitNeckSection.y} Locates a neck section along the construction Y axis.
 * @evidenceReview {@link Cranium.IPortraitNeckSection.y} #988de89 Read the ordered section Y samples and their positive spacing admission beside neck loft construction.
 * @evidence {@link Cranium.IPortraitNeckSection.width} Sets the lateral half-width of one neck section.
 * @evidenceReview {@link Cranium.IPortraitNeckSection.width} #efb1575 Traced width into the section's paired lateral points and finite positive admission; it does not alter the facial component sockets.
 * @evidence {@link Cranium.IPortraitNeckSection.front} Sets the anterior depth of one neck section.
 * @evidenceReview {@link Cranium.IPortraitNeckSection.front} #3d71dce Read front depth beside the section loft's anterior boundary and its finite-domain checks.
 * @evidence {@link Cranium.IPortraitNeckSection.centre} Sets the central depth of one neck section.
 * @evidenceReview {@link Cranium.IPortraitNeckSection.centre} #e8cc6cf Read centre depth beside the neck surface sample; this is a construction datum, not a facial soft-tissue measurement.
 * @evidence {@link Cranium.IPortraitNeckSection.back} Sets the posterior depth of one neck section.
 * @evidenceReview {@link Cranium.IPortraitNeckSection.back} #36fc572 Read back depth beside the posterior closure and section admission; it remains separate from the visible jawline controls.
 * @evidence {@link Cranium.IPortraitNeckShape} Groups upper/lower neck sections and the crop policy for the cranial continuation.
 * @evidenceReview {@link Cranium.IPortraitNeckShape} #821259c Read copied upper/lower section groups and crop value beside appendPortraitNeck. The group owns the neck continuation and does not substitute for facial likeness evidence.
 * @evidence {@link Cranium.IPortraitNeckShape.upper} Supplies the upper neck section at the cranial attachment.
 * @evidenceReview {@link Cranium.IPortraitNeckShape.upper} #b8b35ad Read the upper section's shared neck datum beside the head/neck join.
 * @evidence {@link Cranium.IPortraitNeckShape.lower} Supplies the lower neck section at the crop boundary.
 * @evidenceReview {@link Cranium.IPortraitNeckShape.lower} #24a6126 Read the lower section's crop-side datum beside the closed neck continuation.
 * @evidence {@link Cranium.IPortraitNeckShape.crop} Selects the authored lower crop applied during neck construction.
 * @evidenceReview {@link Cranium.IPortraitNeckShape.crop} #c9c248d Read crop admission and its branch in appendPortraitNeck; it limits the authored continuation rather than moving face component anchors.
 * @evidence {@link Cranium.appendPortraitCranium} Appends the cranial continuation to the shared control cage.
 * @evidenceReview {@link Cranium.appendPortraitCranium} #bf4d6e0 Read copied control positions, cranium section sampling and shared face boundary handoff before component refinement. The operation preserves the host's resident identities.
 * @evidence {@link Cranium.appendPortraitNeck} Appends the authored neck continuation and its crop to the cranial cage.
 * @evidenceReview {@link Cranium.appendPortraitNeck} #93a6b33 Read section ordering, finite loft samples, crop closure and shared boundary stitching beside the neck attachment tests. The result is a structural continuation, not a global self-intersection or likeness certificate.
 *
 * @evidence {@link Crown.IPortraitDentalSideContour} Supplies optional mesial/distal detail within one crown's basic profile.
 * @evidenceReview {@link Crown.IPortraitDentalSideContour} #9395cb4 Read the three independently optional overrides and their nullish defaults in admission and loft construction. Empty side objects reproduce the basic mesh exactly. Mesial direction comes from the row, so a side profile does not carry an independently guessed world orientation.
 * @evidence {@link Crown.IPortraitDentalSideContour.contactHeight} Locates the proximal breadth crest along the normalized loft height.
 * @evidenceReview {@link Crown.IPortraitDentalSideContour.contactHeight} #8725c13 Followed the default 0.3 and strict (0,1) range into the breadth branches and the union of sampling levels. Off-grid 0.23 and 0.37 crests are explicitly sampled. Actual Y additionally includes the decaying incisal-rise term, so this parameter is not the final Y coordinate divided by crown height.
 * @evidence {@link Crown.IPortraitDentalSideContour.cervicalWidth} Overrides one side's cervical-to-maximum half-width ratio.
 * @evidenceReview {@link Crown.IPortraitDentalSideContour.cervicalWidth} #94ab7d1 Compared the per-side fallback with the post-crest narrowing formula and its (0,1] admission. The asymmetric eight-millimetre crown ends at cervical X=-2.8 and +3.6 mm while retaining maximum X=-4 and +4 mm elsewhere. Swapping the row's mesial direction exchanges those sides.
 * @evidence {@link Crown.IPortraitDentalSideContour.incisalRise} Overrides one proximal cutting-edge corner's rise from the central edge.
 * @evidenceReview {@link Crown.IPortraitDentalSideContour.incisalRise} #2cf9d34 Read the signed-X side selection, nonnegative half-height bound and rise*x²*(1-v)^4 contribution to Y. Explicit zero is retained instead of falling back to the crown's base rise; the asymmetric scenario gives the two independently calculated edge heights without rotating the tooth.
 *
 * @evidence {@link Eyes.createPortraitEyeComponent} Fits one owned eye configuration into shared skin and supplies its optical and tissue finishers.
 * @evidenceReview {@link Eyes.createPortraitEyeComponent} #aecbb77 Read the complete input-copy/admission, aperture transform, gaze-independent sphere, inner corneal support, outer-skin depth query, shared rings, reservation branch and final face-contact proposal. The final eye uses the same corneal builder and fitted sphere as contact. Colour is captured into owned materials, while aperture and tissue geometry remain distinct from palette choice. The reservation branch removes a containing host patch and joins its annulus without changing optical dimensions; current views retain connected lids with positive measured contact but still lack the photographed localized lower-lid fullness.
 * @evidence {@link Eyes.appendPortraitEyeMargins} Attaches the section rings to retained outer skin identities and returns the new inner boundary mapping.
 * @evidenceReview {@link Eyes.appendPortraitEyeMargins} #c363758 Traced the retained outer ring, seven appended section rings, two triangles per longitudinal cell and paired material labels. The map returns original socket IDs to final inner-ring IDs for later eye construction. Optional group zero, lower-section resolution and the sphere-projected guide are exercised by the component/contact scenarios; this attachment precedes subdivision and does not itself perform final optical contact.
 * @evidence {@link Eyes.IPortraitEyeShape.irisPigment} Selects an instance-owned pigment palette without changing the aperture or optical shell.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.irisPigment} #53e8e02 Followed immediate createPortraitIrisMaterials evaluation and the later side-qualified material bindings. The pigment scenario mutates the caller's colour array after eye creation and retains the captured colour; its complete geometry buffers equal the omitted-pigment twin. The retained shape reference determines palette naming, while returned materials own the numerical colours.
 *
 * @evidence {@link Pigment.IPortraitIrisPigment} Defines two linear-RGB endpoints for the eight-band iris palette.
 * @evidenceReview {@link Pigment.IPortraitIrisPigment} #0f525ea Read base and signed variation together with exact-three-element, finite and unit-range endpoint admission. Every intermediate band is a convex combination of the admitted endpoints. This data describes authored reflectance controls and contains no sampled photograph or geometry.
 * @evidence {@link Pigment.IPortraitIrisPigment.base} Supplies the first palette endpoint and limbal/dark-band colour.
 * @evidenceReview {@link Pigment.IPortraitIrisPigment.base} #9d87262 Located the original component in value+variation*(i/7) and the independent base [0.2,0.4,0.6] colour oracle. Modifying the caller's array afterward cannot change returned materials because each band stores a fresh colour object.
 * @evidence {@link Pigment.IPortraitIrisPigment.variation} Supplies signed displacement from the base to the opposite palette endpoint.
 * @evidenceReview {@link Pigment.IPortraitIrisPigment.variation} #b6f2672 Compared negative, zero and positive increments against the endpoint checks. The hand oracle advances red by 0.1 and reduces green by 0.05 per band, while zero variation preserves uniform colour. The interval applies to base+variation rather than forbidding all negative increments.
 * @evidence {@link Pigment.createPortraitIrisMaterials} Produces independently named, owned opaque pigment finishes from those admitted endpoints.
 * @evidenceReview {@link Pigment.createPortraitIrisMaterials} #0a2093f Read prefix admission, all array/domain failures and eight linear interpolations into fresh material records. Roughness is 0.65 and no texture is attached; the eye owns radial membership and chooses these IDs without moving a vertex. Palette names and scalar finishes do not establish optical or subject likeness.
 *
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile} Separates strand dimensions and local support clearance from the brow's boundary binding.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile} #c3ca9aa Read radius variation, taper, clearance, arch, outward bend and segment count with admission and tube consumers. None of these seven controls constructs a supraorbital rim or relocates the bound brow region. The profile is copied before sampling final skin.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.radius} Sets base strand radius and the scale of the local normal estimate.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.radius} #ca26526 Traced the positive dimension into the tapered tube radius and max(0.001,radius) finite-difference step. The centreline offset includes radius(t), so the added clearance is measured outside the strand rather than from its centre.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.radiusStep} Adds deterministic radius variation across each group of three strands.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.radiusStep} #294c7cd Located (i%3)*radiusStep before the taper factor. The admission sum includes twice this nonnegative value, which catches an unrepresentable largest strand/offset combination; zero retains one base radius across the population.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.taper} Controls loss of strand radius toward the free end.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.taper} #9035ba0 Read multiplication by 1-taper*t and the [0,1) admission interval. Zero retains constant radius; rejecting one keeps the tip from collapsing to zero cross-section through this control.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.clearance} Adds separation beyond the strand radius along the estimated skin normal.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.clearance} #cf9c267 Compared the centreline offset radius(t)+clearance+arch*sin(pi*t) with the sloped-plane oracle's signed perpendicular distance. That test checks every emitted strand vertex. It verifies the planar contact mechanism, while arbitrary curved-surface clearance still needs its own measurement and render.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.arch} Raises the strand midpoint from the local supporting surface.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.arch} #308f248 Followed its sine contribution into the normal offset. It vanishes at strand endpoints and is independent of the tangent-plane bend; a nonnegative arch cannot represent a negative supraorbital skin groove.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.outwardBend} Bends strand XY paths toward the anatomical outer side.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.outwardBend} #f7351f8 Read the side-signed t² displacement in X and its participation in the nonzero-path check. A negative value bends oppositely; a path leaving the sampled skin refuses rather than retaining a guessed endpoint depth.
 * @evidence {@link Eyebrows.IPortraitEyebrowProfile.segments} Sets bounded longitudinal sampling of each tube.
 * @evidenceReview {@link Eyebrows.IPortraitEyebrowProfile.segments} #54a49df Traced the integral 1..32 range into portraitTube. The boundary scenarios admit both endpoints and reject zero, 33 and a fractional count. This resolution control does not alter the separately authored fibre count or brow region.
 * @evidence {@link Eyebrows.portraitEyebrowProfile} Supplies the authored basic strand dimensions when a caller omits detail.
 * @evidenceReview {@link Eyebrows.portraitEyebrowProfile} #718eee1 Read the 0.035 mm radius, 0.0075 mm radius step, 0.8 taper, 0.03 mm clearance, 0.08 mm arch, 1.2 mm bend and five segments beside both default consumers. Eye creation copies this profile; these values are provisional rendering choices rather than measured hair data.
 * @evidence {@link Eyebrows.assertPortraitEyebrowProfile} Admits bounded strand populations and finite profile arithmetic before allocation.
 * @evidenceReview {@link Eyebrows.assertPortraitEyebrowProfile} #fc4e44c Checked 0..4096 integral fibres, each dimensional interval, the combined radius/offset overflow check and integral segment bounds. The profile scenario includes missing radius, adjacent invalid limits and caller mutation through a disabled-brow eye. Profile validation still runs before the zero-fibre early return.
 * @evidence {@link Eyebrows.buildPortraitEyebrow} Samples the final skin beneath each independently named strand.
 * @evidenceReview {@link Eyebrows.buildPortraitEyebrow} #a7ad6ee Read owned profile admission, zero-population exit, binding checks, engine foremost-depth queries, central-difference normals and deterministic start/end fractions. The sloping-plane and translated-host scenarios retain normal clearance and geometry ownership; missing support and collapsed paths refuse. The local tangent construction is explicitly weaker than a general curved-mesh collision certificate.
 *
 * @evidence {@link Ocular.IPortraitOcularTissueShape} Separates the medial conjunctival profile from the narrow lower ocular margin.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape} #e9c3846 Read the five scalar dimensions and the factory's owned copy. All are finite and nonnegative; zero corner length or margin width disables its corresponding surface, while zero relief retains that surface's underlying support. This type does not describe the external lower-lid body.
 * @evidence {@link Ocular.IPortraitOcularTissueShape.cornerLength} Sets medial tissue extent along the live aperture's X span.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape.cornerLength} #9c218b8 Followed the dimension into the side-dependent X interpolation and the half-aperture admission bound. The exact-half-width case is admitted, a larger medial extent refuses, and zero returns a null corner without removing the lower margin.
 * @evidence {@link Ocular.IPortraitOcularTissueShape.caruncleProjection} Scales the medial mound's additional anterior relief.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape.caruncleProjection} #d1db376 Located its Gaussian centred at normalized medial distance 0.42 with width 0.26, multiplied by both sinusoidal boundary fades. Setting the amplitude to zero removes that mound term but leaves the support interpolation and fixed 0.02 mm tissue contribution.
 * @evidence {@link Ocular.IPortraitOcularTissueShape.plicaProjection} Scales a separate ridge lateral to the caruncular mound.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape.plicaProjection} #387c9dc Read the narrower Gaussian at distance 0.82 and width 0.08. The isolated-amplitude test places its peak lateral to the caruncle, while both terms retain the same actual upper/lower boundaries; neither coefficient is a recovered subject measurement.
 * @evidence {@link Ocular.IPortraitOcularTissueShape.lowerMarginWidth} Limits how far the wet strip enters the visible eye opening.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape.lowerMarginWidth} #b8670b3 Read the minimum of the canthus-faded width and half the local upper/lower Y separation. The parabolic-lid oracle places a 0.4 mm strip at Y=-1.6 mm in the centre and clips an oversized request to Y=0. Width zero disables this mesh independently.
 * @evidence {@link Ocular.IPortraitOcularTissueShape.lowerMarginLift} Rounds the wet strip above its boundary-to-support interpolation.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueShape.lowerMarginLift} #dae1967 Traced the product of this amplitude, the longitudinal sine fade and sin(pi*v). Its contribution vanishes at both transverse boundaries and both canthi; the later eye-owned mesh contact may still advance the strip when zero lift would penetrate optical support.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary} Supplies the live eye frame consumed by both tissue surfaces.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary} #1eb1b53 Read side, ordered X endpoints, upper/lower callbacks and support height together with the consuming section and globe closures. The current eye supplies refined lids and an engine-sampled support including cornea. No independent aperture or frozen tissue origin is created here.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.side} Chooses which end of the increasing-X aperture is medial.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.side} #82bd582 Compared left's minimum-X origin with right's maximum-X origin and reversed normalized distance. The mirror oracle reverses column order while retaining outward winding; side changes anatomical placement rather than triangle orientation.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.minimumX} Establishes the shared lower endpoint of the tissue sampling interval.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.minimumX} #3b143ed Read its participation in finite positive span admission and both strip/corner X formulas. Reversing or collapsing the interval refuses; translating both endpoints and the callbacks moves the constructed tissues in the same head frame.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.maximumX} Establishes the opposite endpoint and the right eye's medial origin.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.maximumX} #f7ce724 Followed maximumX-minimumX into the medial half-width bound and maximumX-cornerLength*(1-u) into right-side construction. This is a supplied aperture boundary, not a maximum inferred separately from the generated strip.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.upper} Supplies the upper surface of each local tissue section.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.upper} #4a96399 Read finite XYZ admission and upper.y>=lower.y before vertical interpolation and half-opening clipping. Returned Y/Z shape the patch; the lattice keeps the requested X coordinate. A nonfinite upper depth refuses during actual sampling.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.lower} Anchors the wet margin and the lower side of the medial patch.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.lower} #8abda28 Traced lower.y into the strip origin and lower.z into both support bridges. The lower callback remains live, so translated lid functions move the tissue; a crossed lower height or nonfinite returned coordinate refuses instead of silently inverting the section.
 * @evidence {@link Ocular.IPortraitOcularTissueBoundary.globe} Supplies ocular support height in the same millimetre construction frame.
 * @evidenceReview {@link Ocular.IPortraitOcularTissueBoundary.globe} #f78bd9b Read the finite-height gate and both interpolation consumers. Despite the retained field name, the documented support may include cornea, as the current eye's engine depth query does. This callback shapes sampled positions; complete emitted-triangle clearance is enforced separately by the eye finisher.
 *
 * @evidence {@link DirectionalContact.portraitDirectionalSurfaceTargets} Converts complete engine face-clearance deficits into shared metric vertex targets.
 * @evidenceReview {@link DirectionalContact.portraitDirectionalSurfaceTargets} #be04133 Read frame projection, retained front triangle ordinals and maximum travel per shared vertex. Every corner of an offending face receives at least that face's deficit, so its interpolated interior cannot retain the original directional penetration. The small enclosed-support oracle moves all three otherwise clear corners; clear/empty support, shared maxima and unrepresentable output are exercised. The host still owns skin adaptation and normals.
 * @evidence {@link OralContact.applyPortraitOralContact} Resolves one optional named lip/enamel/cavity relationship on assembled head parts.
 * @evidenceReview {@link OralContact.applyPortraitOralContact} #72dd87c Read omission identity, distinct requested names, exactly one resident match, mesh/transform/bone-frame admission and replacement of only enamel and lining. The binding scenario rejects missing, ambiguous, duplicate-role and foreign-frame inputs while retaining the actual lip and unrelated part objects. It does not infer contact ownership from every mesh whose bounds happen to overlap.
 * @evidence {@link OralContact.fitPortraitOralContact} Places the rigid enamel group behind its lip and then fits the cavity behind that placed group.
 * @evidenceReview {@link OralContact.fitPortraitOralContact} #a9cafe0 Traced the largest engine lip/enamel deficit into one posterior translation shared by all crown vertices, with normals retained. The negative-Z cavity targets use the translated enamel and recompute lining normals. Independent planes require 1.2 units of enamel retreat and final cavity Z=-0.4 for a 0.2-unit gap; disabling retreat fails that oracle. Current full/close renders retain a grouped arch, while its crown shape remains unaccepted.
 *
 * @evidence {@link Mouth.IPortraitMouthSocket} Binds the oral opening and surrounding vermilion to subject-owned vertex identities.
 * @evidenceReview {@link Mouth.IPortraitMouthSocket} #fd28022 Read the closed outer loop, two equally directed inner paths and interior seed beside band flooding and coordinate construction. The mouth copies all three arrays; their anatomical ownership is supplied by the subject rather than inferred from arbitrary point height.
 * @evidence {@link Mouth.IPortraitMouthSocket.outer} Defines the cutaneous-vermilion boundary shared with surrounding skin.
 * @evidenceReview {@link Mouth.IPortraitMouthSocket.outer} #a90f5c6 Traced this loop into flood barriers, lip-band coordinates and the optional shared curve returned at attachment. It bounds the colour/tissue band and is not the inner oral opening that the host removes.
 * @evidence {@link Mouth.IPortraitMouthSocket.upper} Supplies the upper inner lip in increasing head-X order.
 * @evidenceReview {@link Mouth.IPortraitMouthSocket.upper} #7924c92 Read its reversed interior contribution to the closed oral loop, its role in local band classification and its later use by cavity and legacy dental-arch construction. Its endpoints are shared with the lower path rather than duplicated corners.
 * @evidence {@link Mouth.IPortraitMouthSocket.lower} Supplies the lower inner lip in the same longitudinal direction.
 * @evidenceReview {@link Mouth.IPortraitMouthSocket.lower} #c75c417 Followed its direct contribution to innerLoop and the lower surface of the interpolated cavity. The local lip sampler distinguishes this curved boundary from the upper one even near raised smile corners.
 * @evidence {@link Mouth.IPortraitMouthSocket.lipSeed} Identifies the connected vermilion region for material assignment.
 * @evidenceReview {@link Mouth.IPortraitMouthSocket.lipSeed} #003eb28 Read selection of an incident seed triangle before flooding between the two barrier loops. A missing seed refuses; the subject must place the seed inside the intended band because merely appearing in a triangle does not infer the correct anatomy.
 * @evidence {@link Mouth.IPortraitMouthShape} Declares lip fitting and the separate legacy cavity/crown settings.
 * @evidenceReview {@link Mouth.IPortraitMouthShape} #0e7dfe3 Read all sixteen fields with constructor admission and fit/finish consumers. The active assembly supplies an empty crowns list and a separate grouped dental component, so this type's legacy dental controls must not be presented as active controls of that grouped row.
 * @evidence {@link Mouth.IPortraitMouthShape.widthScale} Scales band and opening X positions about the measured oral midpoint.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.widthScale} #f261a81 Located centerX+(pointX-centerX)*widthScale in each selected lip target. It has positive finite admission and changes the mouth's geometry, while legacy tooth widths remain independently supplied enamel dimensions.
 * @evidence {@link Mouth.IPortraitMouthShape.openingScale} Scales fitted Y positions about the measured inner opening centre.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.openingScale} #3837797 Read its application after optional local band-thickness scaling and before corner lift. The positive multiplier affects opening and band placement around centerY; it is not the same operation as upper/lower band ratios anchored to their local inner curves.
 * @evidence {@link Mouth.IPortraitMouthShape.cornerLift} Applies a signed smile-corner Y adjustment with a quadratic lateral weight.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.cornerLift} #81d2c75 Traced the clamped absolute lateral fraction and cornerLift*corner². The term vanishes at the midpoint and reaches its configured value at the sides, while the independent Z projection uses the complementary weight.
 * @evidence {@link Mouth.IPortraitMouthShape.upperLipProjection} Adds the basic upper-band Z projection.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.upperLipProjection} #2ce6f29 Read selection by the local curved band side and multiplication by 1-corner². Zero removes this term, but optional section relief and later skin fields remain separate contributors; the scalar does not independently locate a vermilion crest.
 * @evidence {@link Mouth.IPortraitMouthShape.lowerLipProjection} Adds basic lower-band projection independently of the upper value.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.lowerLipProjection} #38a77c2 Compared the lower branch of the same local-side choice with upperLipProjection. It keeps the same corner fade and Z direction without using global Y to decide which band a raised corner belongs to.
 * @evidence {@link Mouth.IPortraitMouthShape.section} Supplies optional body, tubercle and pad relief inside the retained lip bands.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.section} #d3f1a79 Followed the owned createPortraitLipSection closure into the additional Z term of each lip target. Omission contributes zero; the section's edge/corner fade is distinct from the basic upper/lower projection terms and does not move a second lip mesh.
 * @evidence {@link Mouth.IPortraitMouthShape.band} Selects independent scalar or knot-array thickness ratios for the two curved bands.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.band} #7eea962 Read upper/lower scale resolvers and height=innerY+(pointY-innerY)*ratio, with an exact identity branch. The local inner curve anchors each change before overall openingScale and cornerLift; neighbouring outer skin follows the resulting fitting constraints.
 * @evidence {@link Mouth.IPortraitMouthShape.blendReach} Limits original-skin adaptation around the fitted lip targets.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.blendReach} #a42ef98 Traced nonnegative finite admission and the same reach on every selected-band constraint. It controls the geodesic fitting stage, while the later shared subdivision and surface fields have their own effects on neighbouring samples.
 * @evidence {@link Mouth.IPortraitMouthShape.cavityDepth} Recesses the cavity behind the actual refined oral opening.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.cavityDepth} #13976a2 Read the positive value multiplying 1+0.8*sin(pi*v) in cavity Z. The cavity lies one configured depth behind its boundary interpolation and 1.8 depths behind the transverse centre; this dark backdrop is not modeled tongue or gum tissue.
 * @evidence {@link Mouth.IPortraitMouthShape.dentalOffset} Shifts the legacy crown row along the sampled dental arch.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.dentalOffset} #382855a Located the signed offset in arch.center+dentalOffset-rowLength/2 before walking individual crown widths. It changes longitudinal placement rather than width or recession, and is unused when this mouth's crowns list is empty.
 * @evidence {@link Mouth.IPortraitMouthShape.dentalRecess} Moves legacy crown placement posterior to the sampled upper-lip guide.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.dentalRecess} #fdf128f Checked nonnegative admission and subtraction from at.z before the rotated local crown contribution. The active grouped dentition has its own placement owner; this value applies only to buildPortraitMouth's nonempty legacy row.
 * @evidence {@link Mouth.IPortraitMouthShape.dentalDrop} Places legacy crowns below their sampled arch Y coordinate.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.dentalDrop} #d3837ce Read at.y-dentalDrop+localY after crown construction. This nonnegative millimetre offset is not crown height and does not influence the cavity when the early empty-row return is taken.
 * @evidence {@link Mouth.IPortraitMouthShape.dentalDepth} Supplies the common local half-depth of legacy crowns.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.dentalDepth} #f319326 Followed the positive finite dimension into both crown validation and construction. It changes enamel geometry before arch rotation, unlike dentalRecess, which changes placement; it is not the depth control of the active separate dental group.
 * @evidence {@link Mouth.IPortraitMouthShape.toothGap} Adds longitudinal clearance between legacy crown widths.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.toothGap} #73cf006 Read its nonnegative contribution to total rowLength and each cursor advance. It does not shrink the authored widths to force a fit; actual crown and curved-arch appearance remain subject to inspection.
 * @evidence {@link Mouth.IPortraitMouthShape.crowns} Supplies owned individual enamel profiles for the optional legacy row.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.crowns} #3311561 Read deep copying, per-crown admission, optional cervical/edge defaults and proximal contour forwarding. Empty returns after the cavity, which is how the active assembly gives the separate grouped dental component sole ownership of teeth.
 * @evidence {@link Mouth.buildPortraitMouth} Builds the recessed cavity and, when requested, the legacy upper crowns from final lip curves.
 * @evidenceReview {@link Mouth.buildPortraitMouth} #be0f92a Read complete cavity interpolation, the empty-row return, physical arch-distance placement, per-crown dimensions and the shared rotation of positions/normals. The active restored face uses its cavity output and disables its crowns. The synthetic lip/crown appearance in current captures is not resolved by this placement routine.
 *
 * @evidence {@link Cheeks.IPortraitCheekSocket} Names the live skin attachments for one side's four cheek envelopes and fold path.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket} #25f27ab Read the six bindings with constructor and fields(host) admission. The layer copies the socket but resolves positions on each supplied refined host, so a changed mouth or nose can move an attachment without an independently frozen cheek origin.
 * @evidence {@link Cheeks.IPortraitCheekSocket.side} Selects the anatomical instance name and outward-offset handedness.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.side} #8d28ba6 Traced left/right validation into the layer ID and the sign of only offset[0]. Projection and lift keep the shared Z/Y directions; the offset test moves both inward controls toward the midline at mirrored centres +/-13mm.
 * @evidence {@link Cheeks.IPortraitCheekSocket.malar} Binds upper-cheek support beneath the lateral orbit.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.malar} #1318e64 Located its retained vertex in the named-envelope loop and its matching shape.malar dimensions. The volume scenario moves the current host centre while preserving field radius and displacement, showing that the attachment is an identity rather than stored XYZ.
 * @evidence {@link Cheeks.IPortraitCheekSocket.medial} Binds the medial cheek envelope beside the nasal region.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.medial} #55e0015 Read lookup of host.positions[socket.medial] before the optional local offset. The hand-defined offset scenario starts at [-20,-10,3]mm and obtains [-13,-4,7]mm on the right; it does not move the underlying datum itself.
 * @evidence {@link Cheeks.IPortraitCheekSocket.buccal} Supplies the lower/lateral cheek's own retained support datum.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.buccal} #7c71d02 Compared the buccal binding with the separately indexed malar and medial fields. It is checked for a finite resident position before field construction; sharing dimensions with another envelope does not silently replace this identity.
 * @evidence {@link Cheeks.IPortraitCheekSocket.modiolus} Binds local support outside the oral commissure.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.modiolus} #57fb297 Followed its named lookup into the fourth envelope. This datum belongs to neighbouring skin rather than an independent lip endpoint, and its support is evaluated on the same refined host as the other cheek regions.
 * @evidence {@link Cheeks.IPortraitCheekSocket.nasolabial} Supplies the ordered retained skin path used by the fold integration.
 * @evidenceReview {@link Cheeks.IPortraitCheekSocket.nasolabial} #e444486 Read minimum-two/distinct-ID admission, live point resolution and spline sampling. Active folds require nonzero finite path travel; the disabled-fold scenario allows coincident positions without running that integration, while still requiring valid bindings.
 * @evidence {@link Cheeks.IPortraitCheekVolume} Separates support placement and extent from signed surface movement.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume} #6152713 Compared offset and three radii with projection/lift in the field emitter. Both amplitudes zero omit the envelope, but the constructor still validates its declared dimensions. The type describes one axis-aligned deformation envelope, not a reconstructed fat compartment.
 * @evidence {@link Cheeks.IPortraitCheekVolume.offset} Positions an envelope relative to its current skin anchor.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.offset} #df1c92b Checked owned finite triples, zero/omitted equivalence and right-side reversal of the outward component. Later caller mutation cannot alter the existing layer, and adding an unrepresentable offset to the host refuses before emitting a centre.
 * @evidence {@link Cheeks.IPortraitCheekVolume.width} Sets the field's horizontal support radius in millimetres.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.width} #17c02c1 Read positive finite admission and conversion to radius.x/1000 in engine metres. The volume test gives 27/64 of central displacement halfway across the radius and zero at its boundary; this value is a support radius, not the complete cheek width.
 * @evidence {@link Cheeks.IPortraitCheekVolume.height} Sets vertical support independently of horizontal spread.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.height} #023da86 Traced this positive finite dimension into the engine field's Y radius. It changes where a displacement decays vertically without itself lifting the centre or prescribing upward skin movement.
 * @evidence {@link Cheeks.IPortraitCheekVolume.reach} Limits the envelope through the depth of the head.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.reach} #3583a6b Located conversion into radius.z beside independent X/Y radii. This is ellipsoidal depth support; unlike a fitting constraint's reach, it is not a distance propagated along mesh edges.
 * @evidence {@link Cheeks.IPortraitCheekVolume.projection} Supplies signed anterior displacement at the envelope centre.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.projection} #518bac6 Read finite signed admission and displacement.z=projection/1000. The two-millimetre centre oracle produces 0.002m through the actual engine deformer, while support dimensions and the optional centre shift retain separate roles.
 * @evidence {@link Cheeks.IPortraitCheekVolume.lift} Supplies signed vertical movement independently of anterior projection.
 * @evidenceReview {@link Cheeks.IPortraitCheekVolume.lift} #129bebb Followed displacement.y=lift/1000 and the active-envelope condition using projection OR lift. The lift-only scenario emits [0,0.003,0]m, so a zero projection does not suppress an independently requested lift.
 * @evidence {@link Cheeks.IPortraitCheekShape} Groups four support envelopes and a separately controlled nasolabial fold.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape} #9111264 Read all seven members with the copied shape and field population. Support and groove are authored separately and summed by the common surface assembler; their names do not imply that the current smiling cheek has been anatomically completed.
 * @evidence {@link Cheeks.IPortraitCheekShape.malar} Supplies the upper-cheek envelope's own dimensions and motion.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.malar} #5226350 Traced it to socket.malar and the first named field. The paired-layer test retains distinct 1mm and 4mm malar projections on the two anatomical sides rather than sharing one mutable setting.
 * @evidence {@link Cheeks.IPortraitCheekShape.medial} Supplies independent medial fullness and centre placement.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.medial} #661b9bc Read its independent projection/lift and offset alongside the malar entry. The offset and lift-only tests exercise this specific envelope; changing it does not rename the fold path or introduce a nasal attachment.
 * @evidence {@link Cheeks.IPortraitCheekShape.buccal} Supplies the lower/lateral support envelope separately from the high cheek.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.buccal} #adda9e3 Followed its own radius/amplitude values through the named field loop. The four-envelope scenario retains one field for each active name, including buccal; the current basic shape still lacks freely authored directional sections.
 * @evidence {@link Cheeks.IPortraitCheekShape.modiolus} Controls the local cheek-side support around the mouth corner.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.modiolus} #b424ecc Compared its independent volume record with the negative fold fields generated later. The local envelope can add support without requiring a groove, but it does not itself define the lip's commissural section.
 * @evidence {@link Cheeks.IPortraitCheekShape.foldWidth} Sets the fold's planar support and sampling density.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.foldWidth} #6ca3e9f Read division of X/Y path increments by this radius, its use as both emitted planar radii and the resulting sample-count admission. The refusal scenario admits 256 samples at width0.625mm and rejects the adjacent narrower0.624mm request.
 * @evidence {@link Cheeks.IPortraitCheekShape.foldDepth} Controls nonnegative groove magnitude before the negative-Z field sign.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.foldDepth} #4b2fb19 Traced zero to the early return and positive values through physical-distance sine-squared fading and normalized quadrature weight. The field emitter receives negative depth, so this control recesses the groove without supplying the raised cheek beside it.
 * @evidence {@link Cheeks.IPortraitCheekShape.foldReach} Sets the fold's depth support and its normalized path metric.
 * @evidenceReview {@link Cheeks.IPortraitCheekShape.foldReach} #58f9f23 Located it in the Z increment normalization and emitted radius.z. It therefore affects both field placement density on a depth-varying path and spatial influence through the head; positive finite admission is independent of foldWidth.
 * @evidence {@link Cheeks.createPortraitCheekLayer} Derives owned cheek and fold fields from live refined skin attachments.
 * @evidenceReview {@link Cheeks.createPortraitCheekLayer} #7f94a2f Read all input/resident checks, mirrored offsets, metric field emission and the two-stage fold path sampling. The volume and offset scenarios prove centre magnitude, neutral support, ownership and live translation; refusals cover degenerate travel, arithmetic overflow and the 256-sample limit. Current restored-face views still have broad cheek/perioral transitions, so this field construction does not accept the likeness.
 *
 * @evidence {@link Nasal.IPortraitNoseSocket} Binds procedural nasal controls and original opening faces to the measured host.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket} #f8ffe94 Read all ten binding members with exterior depth, target collection and opening extraction. Coordinates and influence radii belong to the subject frame; surface vertex IDs and nostril face ordinals have different meanings. The factory copies its arrays before fitting rather than retaining a mutable preset binding.
 * @evidence {@link Nasal.IPortraitNoseSocket.midline} Defines the symmetry datum for basic nasal depth and overall width.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.midline} #8a8de57 Located subtraction of midline in portraitNoseDepth and the midline+(x-midline)*widthScale transform on exterior and rim targets. Changing this datum translates the basis of both operations; it is not an independent left-alar offset.
 * @evidence {@link Nasal.IPortraitNoseSocket.tipY} Locates the basic tip envelope vertically in construction millimetres.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.tipY} #b7b503d Read its subtraction from point Y before normalization by tipRadius[1] and the Gaussian exponential. It moves the influence centre without changing tipProjection's signed amplitude or the supplied host topology.
 * @evidence {@link Nasal.IPortraitNoseSocket.tipRadius} Separates horizontal and vertical spread of the basic tip envelope.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.tipRadius} #1452eca Followed the copied X/Y pair into the two squared normalized distances in portraitNoseDepth. These radii govern decay in the image-facing plane; they do not specify a third depth radius or directly set tip projection.
 * @evidence {@link Nasal.IPortraitNoseSocket.alarOffset} Places the paired basic alar influence centres about the midline.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.alarOffset} #fc03726 Compared abs(x-midline)-alarOffset with the tip's single central term. The absolute value gives paired centres at equal horizontal distances; asymmetric explicit lobules are a separate optional representation.
 * @evidence {@link Nasal.IPortraitNoseSocket.alarY} Positions both basic alar envelopes along the vertical axis.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.alarY} #7b303b1 Read the pointY-alarY term in the alar Gaussian beside the independent tipY term. It relocates where alarProjection acts and does not translate the fitted nostril opening, whose rise control is applied later.
 * @evidence {@link Nasal.IPortraitNoseSocket.alarRadius} Supplies the common planar spread of each basic alar envelope.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.alarRadius} #92d873f Traced this denominator through both the lateral distance from an alar centre and the vertical distance from alarY. The basic envelope therefore uses one spread for both axes; it is not an independently shaped alar cross-section.
 * @evidence {@link Nasal.IPortraitNoseSocket.surface} Selects retained skin identities receiving direct exterior targets.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.surface} #8a5393e Read the loop that inserts width/depth targets into one Map keyed by host vertex. Later fitted-rim targets replace entries at shared rim IDs within the same component. These are vertex identities, not triangles to remove.
 * @evidence {@link Nasal.IPortraitNoseSocket.nostrils} Supplies original host-face populations for the procedural nasal openings.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.nostrils} #89515a5 Followed each copied ordinal list into host.indices slices, boundary extraction and the flattened cutFaces result. Lining is built from the resulting fitted rim. The head validates original cut ordinals and duplicate removal before attachment; the field does not describe a painted footprint.
 * @evidence {@link Nasal.IPortraitNoseSocket.sectionAnchor} Names the retained datum used by optional section or final-body construction.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.sectionAnchor} #56a1828 Checked that a selected section/body requires an integral resident ID with finite XYZ. Pre-fit section evaluation reads its original position, while the final body receives the retained identity for its later surface stage. Without either representation the datum is not required.
 * @evidence {@link Nasal.IPortraitNoseShape} Separates exterior, opening, lining and optional complete-basis controls.
 * @evidenceReview {@link Nasal.IPortraitNoseShape} #e944ff7 Read the full interface and constructor admission before following fit and attach. Opening scales and lining fractions have different domains; section/body/lobule choices have explicit incompatibility checks. The active restored recipe uses the basic component and does not select the rejected source-patch annulus.
 * @evidence {@link Nasal.IPortraitNoseShape.widthScale} Scales exterior and opening targets about the subject midline.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.widthScale} #5c5cd6f Traced its positive finite admission and the same X transform in both target paths. The lining inherits the fitted rim's width rather than applying this multiplier again; local aperture-plane scaling remains a preceding operation.
 * @evidence {@link Nasal.IPortraitNoseShape.lobules} Optionally replaces local nasal body sections with independently bound ellipsoidal detail.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.lobules} #b1fcaea Read the owned binder on support-scaled skin and its use by the common depth evaluator for exterior and rim samples. Empty/omitted populations are neutral; a nonempty population cannot accompany a complete section/body basis. The optional data is absent from the restored active preset.
 * @evidence {@link Nasal.IPortraitNoseShape.tipProjection} Sets signed anterior relief of the basic central tip envelope.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.tipProjection} #acece74 Located multiplication of the tip Gaussian and its addition to alar relief in portraitNoseDepth. The constructor requires finiteness but permits either sign. It is an amplitude, while the socket supplies the centre and planar spreads.
 * @evidence {@link Nasal.IPortraitNoseShape.alarProjection} Sets signed anterior relief of the paired basic alar envelopes.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.alarProjection} #86bfac1 Read multiplication of the abs-midline alar term separately from the tip term. The cutout scenario exercises positive alar relief with negative tip relief and verifies decay at remote points. This scalar alone does not establish round alar tissue.
 * @evidence {@link Nasal.IPortraitNoseShape.nostrilWidthScale} Changes width inside each fitted aperture plane before global nasal scaling.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.nostrilWidthScale} #e05a52f Followed the positive finite value into resizePortraitNostrilRim after ellipse fitting. Overall widthScale is applied afterward in head X, so the local factor is not necessarily the final projected width ratio.
 * @evidence {@link Nasal.IPortraitNoseShape.nostrilHeightScale} Changes the aperture's local height independently of its width.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.nostrilHeightScale} #eea407d Read its separate argument to the same rim-resizing owner and its positive-domain check. The later host-X tilt rotates the already resized opening; reducing this factor does not move the tip influence centre.
 * @evidence {@link Nasal.IPortraitNoseShape.nostrilRise} Adds one vertical translation to each fitted opening.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.nostrilRise} #82b11a6 Located the signed addition in the final rim Y target. The lining subsequently computes its centre from those actual fitted rim positions, carrying the translation without adding rise a second time.
 * @evidence {@link Nasal.IPortraitNoseShape.nostrilTilt} Rotates the opening and cavity travel about the same host-X convention.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.nostrilTilt} #28e98c6 Compared the degree-to-radian conversion in fitting and lining construction. The rim rotates about its depth-adjusted centre, and the cavity offset uses the same Y/Z rotation; positive tilt rotates a forward normal toward negative Y.
 * @evidence {@link Nasal.IPortraitNoseShape.cavityContraction} Sets the retained fraction of the fitted rim at the deep lining ring.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.cavityContraction} #10fe504 Checked strict (0,1) admission and the factor 1-fraction*(1-contraction) applied to rim offsets about their centre. At fraction one the deep ring retains the configured fraction; the floor instead uses centre plus cavity travel.
 * @evidence {@link Nasal.IPortraitNoseShape.rimSupport} Positions an intermediate lining ring before the full cavity travel.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.rimSupport} #5f85335 Read strict (0,1) admission and the two fractions [rimSupport,1] used by appendPortraitNostrils. The intermediate ring applies only its fraction of contraction and rotated offset, retaining support near the shared aperture before the deeper ring.
 * @evidence {@link Nasal.IPortraitNoseShape.rimRoundness} Blends the authored boundary toward the fitted ellipse before resizing and tilt.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.rimRoundness} #22f9253 Followed finite [0,1] admission into fitPortraitNostrilRim on already depth-adjusted points. This controls the opening curve, not the surrounding alar body's roundness; the later transformations still determine its final placement.
 * @evidence {@link Nasal.IPortraitNoseShape.rimSection} Optionally inserts an exterior skin band sharing the fitted lining boundary.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.rimSection} #e9daf13 Read copied section settings, exterior normals computed without the cut faces, band construction and the new inner-loop IDs handed to lining. Omission uses direct skin-to-lining attachment. This route remains unselected in the restored baseline.
 * @evidence {@link Nasal.IPortraitNoseShape.cavityOffset} Supplies relative XYZ travel from the fitted opening to the cavity floor.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.cavityOffset} #552c178 Checked owned length-three finite input, the shared tilt applied to Y/Z, fractional travel at support rings and full travel at the floor centre. The cutout oracle places its translated floor at [10,-12,55]mm; it does not infer a new absolute floor origin.
 * @evidence {@link Nasal.IPortraitNoseShape.blendReach} Controls neighbouring original-skin adaptation around nasal fitting targets.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.blendReach} #79fdf65 Read nonnegative finite admission and the same reach on every collected constraint. Zero affects only the exact fitting pins at that stage; subsequent shared refinement is a different operation and can still affect adjacent samples.
 * @evidence {@link Nasal.IPortraitNoseShape.section} Selects a connected pre-fit depth basis around the socket datum.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.section} #d628b72 Traced creation of the owned section evaluator and its displacement in baseDepth used by both exterior and rim samples. A selected final body or nonidentity depthScale conflicts with this basis, while explicit basic tip/alar amplitudes remain additional signed terms.
 * @evidence {@link Nasal.IPortraitNoseShape.body} Selects optional exterior shaping after shared refinement and surface layers.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.body} #544efb2 Read the deep-copied shape/joinWidth/depthReach record and its handoff to createPortraitNasalBodySurface with the retained anchor, lining group and view ray. It is a later complete-basis alternative, so simultaneous pre-fit section, nonempty lobules or nonidentity depthScale refuse.
 * @evidence {@link Nasal.portraitNoseDepth} Evaluates the basic central-tip and paired-alar relief in the socket frame.
 * @evidenceReview {@link Nasal.portraitNoseDepth} #baff3ae Read both Gaussian expressions and their independent signed amplitudes. Tip spread uses separate X/Y radii; alar spread uses one radius and absolute lateral distance. The result is a Z displacement, not an absolute surface depth or a reconstructed cartilage volume.
 * @evidence {@link Nasal.portraitNostrilContains} Classifies points strictly inside an authored elliptical footprint during binding.
 * @evidenceReview {@link Nasal.portraitNostrilContains} #aeefd6c Checked the normalized squared-distance sum and strict less-than-one boundary convention. The cutout scenario keeps both nasal centres inside while an exact vertical boundary, its outside neighbour and the midline are outside; this helper does not cut geometry itself.
 * @evidence {@link Nasal.portraitCutBoundary} Orders the exposed edges of a selected triangle patch.
 * @evidenceReview {@link Nasal.portraitCutBoundary} #9dbf719 Read undirected incidence counting, retained directed edges, unique outgoing-edge admission and complete-loop traversal. Internal diagonals are excluded; empty, unclosed and disconnected boundary populations refuse. Its ordinals and winding are reused by nasal lining and deferred-region replacement.
 * @evidence {@link Nasal.appendPortraitNostrils} Builds support rings and closed cavity floors from the fitted shared aperture.
 * @evidenceReview {@link Nasal.appendPortraitNostrils} #90ecceb Read the actual-rim centroid, rotated cavity travel, two contracted rings, side quads and final floor fans, all assigned to the supplied region. The two-triangle square test produces four boundary walls without a wall on its internal diagonal and verifies the recessed floor. The restored db7a56b3 views retain both openings without the rejected outer nasal annulus.
 *
 * @evidence {@link Component.IPortraitSkinConstraint} Carries one exact resident skin target and its surrounding adaptation reach.
 * @evidenceReview {@link Component.IPortraitSkinConstraint} #4f67019 Read vertex, XYZ target and reach together in blendPortraitSkin. The fixed map retains requested coordinates while the graph field affects only reachable neighbours; duplicate contradictory targets refuse rather than selecting a component by order.
 * @evidence {@link Component.IPortraitSkinConstraint.vertex} Identifies the existing attachment point rather than appending another seam sample.
 * @evidenceReview {@link Component.IPortraitSkinConstraint.vertex} #f36c397 Checked integral resident-index admission before the fixed target map is updated. The same identity is later retained through subdivision, while inserted vertices receive new indices; negative, fractional and out-of-range IDs are exercised by the attachment scenario.
 * @evidence {@link Component.IPortraitSkinConstraint.target} Supplies absolute construction-space XYZ for the pinned skin sample.
 * @evidenceReview {@link Component.IPortraitSkinConstraint.target} #aa4cac1 Followed length-three finite validation, owned target copying and subtraction of the original point to obtain displacement. The four-corner fan keeps its 4mm lifted corner exact; treating target as a delta would move an already translated attachment twice.
 * @evidence {@link Component.IPortraitSkinConstraint.reach} Limits adaptation by distance travelled along connected skin edges.
 * @evidenceReview {@link Component.IPortraitSkinConstraint.reach} #bd8d49c Read nonnegative finite admission and maximum-remaining-distance propagation. Zero retains the exact pin without freeing neighbours, and the attachment test leaves a nearby disconnected marker unchanged; Euclidean proximity alone does not establish influence.
 * @evidence {@link Component.portraitFacesInsideLoop} Delegates anatomical-loop face selection to the engine's connectivity owner.
 * @evidenceReview {@link Component.portraitFacesInsideLoop} #4b1ed25 Read the complete wrapper: it passes original host indices and the supplied boundary to selectAutoMovieTriangleRegion. No coordinate projection or new face-centroid classifier is introduced, and returned ordinals belong to that original topology.
 * @evidence {@link Replacement.IPortraitRegionReplacement} Describes a reserved group and its later appender against the refined socket.
 * @evidenceReview {@link Replacement.IPortraitRegionReplacement} #1b53951 Compared both members with the two-region replacement and retained-source consumers. The appender receives an owned cage and actual boundary IDs; preserving surviving geometry remains a responsibility of that authored callback, rather than a capability restriction imposed by the mutable cage type.
 * @evidence {@link Replacement.IPortraitRegionReplacement.group} Names the reserved face population inherited through subdivision.
 * @evidenceReview {@link Replacement.IPortraitRegionReplacement.group} #a229933 Traced the group label into selection of current refined faces and one-time removal. Duplicate, negative and fractional labels refuse before appenders run, and an absent label fails boundary extraction; this value is not an original face ordinal.
 * @evidence {@link Replacement.IPortraitRegionReplacement.append} Installs a sampled source after the shared host has refined its socket.
 * @evidenceReview {@link Replacement.IPortraitRegionReplacement.append} #c9ecd98 Read the callback handoff after all replacement boundaries have been resolved. The actual head scenario receives six boundary segments from one subdivided triangular reservation, so it cannot accidentally construct against the original three-edge cage.
 * @evidence {@link Replacement.applyPortraitRegionReplacements} Collects reserved boundaries before mutating an owned replacement mesh.
 * @evidenceReview {@link Replacement.applyPortraitRegionReplacements} #e026805 Read distinct-label validation, complete plans mapping, copied positions, retained-face traversal and ordered append calls. The two-region scenario keeps unrelated skin and refuses a missing second region before either callback executes; empty work returns the input object itself.
 * @evidence {@link FinalSurface.IPortraitFinalSurfaceHost} Exposes the common post-layer geometry seen by final component proposals.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurfaceHost} #07f757b Read its four readonly buffers beside the assembler's deeply frozen snapshot. Providers share one object before any result is applied; the final-surface scenario verifies identity and failed writes to positions, indices, groups and normals.
 * @evidence {@link FinalSurface.IPortraitFinalSurfaceHost.positions} Supplies immutable construction-millimetre coordinates to final shaping.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurfaceHost.positions} #7623632 Checked the outer array and every copied coordinate row are frozen. A later proposal still observes the original first vertex after an earlier provider requests its movement, preventing order-dependent fitting against partially applied positions.
 * @evidence {@link FinalSurface.IPortraitFinalSurfaceHost.indices} Retains shared triangle identities during positional proposals.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurfaceHost.indices} #3f4f549 Followed the copied frozen index buffer into the observer and the unchanged original indices in the returned mesh. This stage can prescribe existing vertex positions but does not accept replacement topology in its proposal type.
 * @evidence {@link FinalSurface.IPortraitFinalSurfaceHost.groups} Preserves per-triangle anatomical/material-region labels for target selection.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurfaceHost.groups} #df64e52 Read frozen label copying and the nasal/eyelid providers' group-based vertex selection. Labels remain triangle-local even when neighbouring regions share a vertex; they do not permit contradictory owners to overwrite each other.
 * @evidence {@link FinalSurface.IPortraitFinalSurfaceHost.normals} Supplies directions computed on the common unmodified proposal basis.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurfaceHost.normals} #ee4186a Traced the single portraitNormals call before provider execution. The buffer is not recomputed after each proposal; the head assembler performs the final common recomputation after positions are accepted and before material extraction.
 * @evidence {@link FinalSurface.IPortraitFinalSurface} Specifies a callback returning resident vertex targets rather than a detached mesh.
 * @evidenceReview {@link FinalSurface.IPortraitFinalSurface} #1ac9fbd Compared its readonly proposal array with output copying and finite XYZ/resident-index admission. Identical shared requests are compatible; different coordinates at one identity refuse even when both individual requests are finite.
 * @evidence {@link FinalSurface.applyPortraitFinalSurfaces} Applies compatible final positions after every provider has observed the same basis.
 * @evidenceReview {@link FinalSurface.applyPortraitFinalSurfaces} #6f359d2 Read immutable snapshot construction, proposal collection, target ownership comparison and final position replacement. The scenario proves permutation equivalence for independent providers, copied returned arrays, empty identity and refusals for conflicting owners, bad IDs and malformed XYZ. It does not certify the anatomical quality of a compatible proposal.
 *
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape} Declares the endpoint, expression, optical and refinement inputs of the optional anatomical study.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape} #a395fa1 Read all ten fields and their consumers in buildAnatomicalStudy. Weight controls act on the resident sparse targets, eye placement normalizes the common skin/anchor frame, and optical radii remain separate from skin refinement. The basic, translated-optics and buffer scenarios exercise this prior; it is not the active restored procedural face.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.youth} Selects the child contribution and complementary young contribution of the recorded prior.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.youth} #9a0d7f3 Followed youth and 1-youth into the child/young target loop for both skin vertices and eye anchors. The basis scenario exercises zero and one and refuses -0.1 and 1.1. No calendar-age conversion is implemented or inferred from this blend.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.smile} Weights the recorded mouth-corner-puller target in the same source frame.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.smile} #635e580 Located the smile target beside its eye-anchor deltas and checked the shared finite [0,1] admission. The basis scenario runs both endpoint values and rejects NaN; changing this value blends the stored deformation rather than invoking a coordinated facial muscle system.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.jawOpen} Weights the stored opening deformation before normalization and neck attachment.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.jawOpen} #60b8754 Read the jawOpen sparse target application and the zero/one basis cases with an out-of-range 1.1 twin. The returned model has skeleton null, so this is a static target contribution rather than a jaw joint angle.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeDistance} Sets the physical eye separation used to normalize the entire prior.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeDistance} #6a786d5 Traced division by the morphed anchors' X separation into the transform of every skin point and both eye centres; neck dimensions also use eyeDistance/64. The 64mm oracle places centres at +/-32mm. Zero separation and a scale exceeding Float32 representation refuse; this control is not an eyes-only translation.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeHeight} Positions the common normalized eye midpoint along head Y.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeHeight} #e77e77a Read target[1] in the shared transform and the corresponding offset in all neck section heights. The basis oracle reads 0.025m at both globe centres, the optical twin changes it to 29mm, and NaN/Float32-overflow placements refuse. The surrounding head moves with this datum.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeDepth} Positions the common normalized eye midpoint along head Z.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeDepth} #0b62bcb Followed target[2] through skin and anchor normalization and the neck centre formula. The independent centre oracle reads 0.037m, the translated optical case uses 34mm, and Infinity refuses. This is global anterior placement of the prior, not globe protrusion relative to its skin.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeRadius} Defines each rigid optical sphere independently of the prior's skin coordinates.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.eyeRadius} #f1736d2 Checked positive radius, 2*radius<eyeDistance and irisRadius<radius before reading spherical vertex construction and radial normals. The radius-sixteen and translated radius-fifteen scenarios retain the analytic directions; equality at radius32 with separation64 refuses. Fitted optical centres move, but the sphere itself is not warped by the skin residual.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.irisRadius} Determines the sampled pigment-cap disk on the study globe.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.irisRadius} #ab83836 Read its positive domain and strict upper bound against eyeRadius, then the radius*v angular samples for the iris-1 cap. Its 0.04mm lift changes axial placement separately from radius. The buffer and optics scenarios inspect this cap; the simplified construction does not establish captured-eye refraction.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.pupilRadius} Controls the separate pupil-cap extent inside the iris.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.pupilRadius} #dba3e1c Compared its strict pupil<iris admission with the separate pupil samples and 0.07mm lift. Zero and equality with the default6.4mm iris refuse. This is an opaque spherical cap, not a modeled internal pupil opening.
 * @evidence {@link ReferenceAnatomy.IAnatomicalStudyShape.subdivisionRounds} Selects common skin and neck tessellation after their shared attachment.
 * @evidenceReview {@link ReferenceAnatomy.IAnatomicalStudyShape.subdivisionRounds} #0e850c6 Traced omission to one round and explicit zero through the joinedFaces Catmull-Clark call. The subdivision owner admits only integers zero through three. This value does not change the separate 48-column optical sampling or authorize a different fitted-source basis.
 * @evidence {@link ReferenceAnatomy.anatomicalStudyShape} Supplies the explicitly unaccepted starting preset for the anatomical-prior path.
 * @evidenceReview {@link ReferenceAnatomy.anatomicalStudyShape} #a2b5fb5 Read youth0.6, smile0.55, jawOpen0.35, the64mm separation, midpoint[0,25,37]mm and radii16/6.4/2.55mm against the source interface and basis/optics scenarios. The preset contains no supplied refinement override; these authored values neither reproduce the current procedural construction nor establish the photographed adolescent's measurements.
 * @evidence {@link ReferenceAnatomy.buildAnatomicalStudy} Builds the resident attributed prior, shared skin/neck surface and separate optical parts.
 * @evidenceReview {@link ReferenceAnatomy.buildAnatomicalStudy} #be8ee8d Read the complete target accumulation, shared normalization, open-crop extraction, face-centre neck support, joined-quad refinement, optional residual and material separation. Basis tests verify finite geometry, midpoint placement and admission failures; optical/buffer tests check the actual delivered directions. The optional fitted alternative remains unaccepted, and source provenance is retained in the prior's README/assets rather than claimed as original sculpting.
 *
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
 * @evidence {@link NasalReference.buildPortraitNasalReference} Reconstructs and admits the exact existing CC0 fitted nasal source before its boundary is consumed.
 * @evidenceReview {@link NasalReference.buildPortraitNasalReference} #ed7d03f Read the original fit's source/target byte checks and the separate fitted-skin digest check. Changing source refinement while retaining the binding refuses. The provider imports committed assets and fit data rather than captures. The b3306ba5 full and close views retain a compact native tip with unresolved alar/underside form; provenance admission is not shape acceptance.
 * @evidence {@link NasalSupport.createPortraitNasalSupport} Resolves nasal projection from one subject-bound facial support plane.
 * @evidenceReview {@link NasalSupport.createPortraitNasalSupport} #ad8584c Read positive ratio admission, exact neutral return, owned datums, normalized plane solution and finite query/displacement refusal. The independent z=y/2 case retains support points and scales a four-millimetre height by one half under translation. This is a projection relationship, not tip curvature or recovered anatomical depth.
 * @evidence {@link Nasal.IPortraitNoseSocket.supportPlane} Supplies the shared nasal root and facial-base reference identities.
 * @evidenceReview {@link Nasal.IPortraitNoseSocket.supportPlane} #772061a Read copied optional IDs and the nonidentity-only resident check before createPortraitNasalSupport. Omitted or unit depth scaling passes no datums and remains neutral; nonidentity scaling requires a usable three-point plane. This binds projection to source skin rather than world Z=0.
 * @evidence {@link Nasal.IPortraitNoseShape.depthScale} Selects the shared nasal projection basis used by exterior and rim fitting.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.depthScale} #7a85507 Traced positive finite admission, the unit/omitted neutral path and refusal to stack a nonidentity scale with a complete section/body basis. The shared support displacement enters the same depth evaluator used for exterior and aperture fitting. The restored preset again uses this procedural basis with its original support layer.
 * @evidence {@link Nasal.IPortraitNoseShape.rimRefinement} Selects the existing shared curve rule for the skin/lining aperture identities.
 * @evidenceReview {@link Nasal.IPortraitNoseShape.rimRefinement} #d415829 Read omitted/surface as ordinary Loop refinement and curve as the actual fitted skin/lining loop returned by attach. The one-dimensional curve rule preserves shared identities while changing their refinement weights. It does not add a detached rim or promise a correct alar body.
 * @evidence {@link RimSection.IPortraitNasalRimSection} Separates exterior tissue width from the fitted aperture and its crest relief.
 * @evidenceReview {@link RimSection.IPortraitNasalRimSection} #9761008 Read positive physical width and signed normal projection in millimetres. These describe the new skin band, while aperture scaling/pose and vestibular depth remain with their existing owners. Omission selects the original direct attachment.
 * @evidence {@link RimSection.createPortraitNasalRimSection} Derives outer and crest rings from the actual aperture's shared normals and existing rim jets.
 * @evidenceReview {@link RimSection.createPortraitNasalRimSection} #50e6e63 Read copied aperture points, caller-supplied sculpted skin normals, engine normalization and outward rim jets. A flat radius-two square yields radius-three attachment; a skin normal [0.6,0,0.8] instead moves the first shoulder to [2.8,0,-0.6]. The opening stays fixed. This distinguishes skin tangents from the aperture-plane frame that produced the rejected double outline; the corrected portrait still requires rendering.
 * @evidence {@link RimSection.appendPortraitNasalRimSection} Connects resident outer skin identities through a new crest to the lining-owned inner loop.
 * @evidenceReview {@link RimSection.appendPortraitNasalRimSection} #4c8f00e Traced both annuli's winding, skin group assignment, copied coordinates and returned inner IDs. The real component uses those IDs for both lining and curve refinement, and the complete small skin/band/lining remains closed before and after subdivision. The first assembled portrait render is still required.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation} Owns one forehead/brow/sulcus section on a subject-bound upper orbit.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation} #adfbb28 Read every station member with the actual skin query and coupled field consumer. Signed projection changes section form, while positive height/descent locates its neighbours; these do not represent measured bone or fat thickness.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation.name} Preserves station identity in the three coupled anatomical targets.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation.name} #342adfe Traced nonempty/unique admission and distinct forehead/brow/sulcus target names. Deterministic ordering belongs to the shared solver rather than the station array's incidental order.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation.anchor} Binds the section to a live retained brow-skin datum.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation.anchor} #2db02e2 Checked nonnegative integral input and resident finite XYZ admission before building the skin sampler. The subject supplies different anchors for each orbit; the generic group contains no subject landmark identities.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation.forehead} Locates and constrains the surface above the brow pad.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation.forehead} #9019c9e Read positive height and signed projection into the actual z query and combined solve. The independent inclined-plane case keeps this target stationary while the adjacent brow moves forward.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation.browProjection} Sets the target anterior movement at the brow's own resident skin section.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation.browProjection} #8cab894 Traced the zero-height target and independent +0.2 mm oracle. This value affects skin consumed by the later eyebrow builder; it is not a hair offset or an independently added kernel amplitude.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportStation.sulcus} Defines the lower side of the upper-orbit support relationship.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportStation.sulcus} #056dfad Read positive descent, negative local Y placement and signed projection with the -0.1 mm inclined-plane oracle. Its depth is queried on real skin rather than guessed from the brow point's Z.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportShape} Groups bounded upper-orbit sections under one interpolation support.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportShape} #ebef7b1 Read copied nested inputs, one-to-32 station admission and the three-target-per-station mapping into the solver's 96-control domain. The section group remains optional in assembly and is not a complete anatomical reconstruction.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportShape.radius} Sets the common millimetre support used by the existing coupled solver.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportShape.radius} #88d01c6 Compared finite positive metric admission with the resulting field radii. It governs interpolation reach rather than the brow-pad's literal tissue thickness; open-lid masking remains in the surface assembler.
 * @evidence {@link OrbitalSupport.IPortraitOrbitalSupportShape.stations} Supplies all section targets including stationary neighbouring witnesses.
 * @evidenceReview {@link OrbitalSupport.IPortraitOrbitalSupportShape.stations} #cb5c0b9 Checked empty/oversized/duplicate refusal, the exact 32-section limit, all-zero identity and ownership under later mutation. A provided empty population refuses rather than silently deleting one side of the support.
 * @evidence {@link OrbitalSupport.createPortraitOrbitalSupport} Builds the actual skin-based upper-orbit field consumed by portraitAssembly.
 * @evidenceReview {@link OrbitalSupport.createPortraitOrbitalSupport} #604ab53 Read full admission, live surface queries, three target roles and the shared coupled solver. The inclined-plane numeric oracle fails when displacement sign is reversed. The first exported comparison changes head skin by at most 0.709414 mm, both nearby lid regions and following brow fibres; lips/dentition remain unchanged. Its first visual assessment remains separate from this numerical observation.
 * @evidence {@link LowerLid.IPortraitLowerLidPoint} Gives a named lower-tissue sample its planar offset and anterior section projection.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint} #2e8e170 Read both millimetre fields through the eye's local outward-normal construction and support-depth bridge. Projection is not muscle thickness or a contact clearance; the two coordinates have separate geometric effects.
 * @evidence {@link LowerLid.IPortraitLowerLidPoint.offset} Places tissue in order from the aperture towards surrounding skin.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint.offset} #d1b5d96 Traced finite positive and strictly increasing admission for all six internal roles. Convex interpolation uses the same weights for each offset; the eye retains its inner aperture and derives the outer skin query from attachment distance.
 * @evidence {@link LowerLid.IPortraitLowerLidPoint.projection} Shapes each tissue sample relative to its common support bridge.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidPoint.projection} #1d544dc Checked signed finite values, independent quarter-interval arithmetic and their replacement blend with basic row depths. A negative subtarsal projection is admitted; it does not move a separately guessed tissue mesh.
 * @evidence {@link LowerLid.IPortraitLowerLidSection} Separates margin, pretarsal body, subtarsal boundary and preseptal transition in one shared section.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection} #1234883 Read all six points and outer attachment beside the explicit eye-row mapping. The ordering validator refuses crossed rows; all points still feed the same shared topology. This defines numerical shape freedom, not an accepted anatomical fit.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.margin} Owns the narrow outer skin margin before pretarsal fullness.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.margin} #18946fc Followed this point to the ridge row while the inner aperture remains its own invariant. Its optional detailed offset/projection does not substitute for the separately drawn wet margin.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.pretarsalCrest} Places the roll's crest independently of its lower shoulder and crease.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.pretarsalCrest} #d3dd668 Traced its mapping to the tarsal sampling row. The asymmetric-profile test changes this projection alone and verifies that higher lateral relief switches head-X side between anatomical eyes.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.pretarsalLower} Determines the roll's lower shoulder before the subtarsal boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.pretarsalLower} #b3f03e4 Read strict placement beyond the crest and before subtarsalInner, then its independent target in the shared skin row. It is not forced to equal the crest projection as in the basic envelope.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.subtarsalInner} Defines the roll-facing side of its lower boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.subtarsalInner} #27f3224 Checked the ordered offset and independent signed depth between pretarsalLower and subtarsalOuter. This local boundary is separate from the medial tear-trough field in orbital support.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.subtarsalOuter} Defines the preseptal-facing side of the subtarsal boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.subtarsalOuter} #697a736 Read its separate interpolation and mapping beyond subtarsalInner. Both sides can describe a recessed transition without turning the whole lower lid into a single inflated band.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.preseptal} Supplies a broader transition outside the pretarsal body and its lower boundary.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.preseptal} #375fa45 Followed its position between subtarsalOuter and the live attachment. It controls the uppermost inserted outer row, while actual host depth supplies the final attachment rather than a copied absolute Z.
 * @evidence {@link LowerLid.IPortraitLowerLidSection.attachment} Selects the section's outer reach on resident supporting skin.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidSection.attachment} #c1aeca2 Traced positive ordering beyond every tissue point, canthal width blending, the fit-stage depth query and the same append-stage section width. A missing host hit refuses; increasing reach is not itself a likeness correction.
 * @evidence {@link LowerLid.IPortraitLowerLidProfile} Carries the complete optional medial-to-lateral section population for one eye.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidProfile} #fad1313 Read the two-to-32 section population, required zero/one endpoints and strict finite progress against the copied resolver. Eye construction chooses the basic path when the optional profile is absent and uses the owned resolver when present; a supplied empty list refuses rather than meaning omission.
 * @evidence {@link LowerLid.IPortraitLowerLidProfile.sections} Specifies longitudinal variation without coupling the two eyes' handedness.
 * @evidenceReview {@link LowerLid.IPortraitLowerLidProfile.sections} #b9bed27 Checked copied nested section data and uniform convex weights over each station interval. Returned samples are independently owned; mutation tests preserve the existing component and mirrored tests fail when right-side progress reversal is removed.
 * @evidence {@link LowerLid.createPortraitLowerLidProfile} Resolves ordered anatomical section witnesses for the actual eye consumer.
 * @evidenceReview {@link LowerLid.createPortraitLowerLidProfile} #7085760 Read every admission branch, interval selection and shared smoothstep weight against the independent quarter-interval oracle: weight5/32 gives offset37/32 and projection-3/8. Returned section objects are owned, and the consumer maps the six roles into shared skin rows. Current db7a56b3 and WebGL close inspection still show broad regular pads, so working numerical control is not acceptance of aegyo-sal form.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidProfile} Selects detailed lower-tissue sections while preserving the basic omission path.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidProfile} #c06c53a Followed optional admission, copied resolution, anatomical progress reversal and replacement blending in the actual fit/append paths. The lower-lid component scenario retains the inner aperture and upper fitting controls while detailed lower rows change. The outer skin support and later optical contact remain separate responsibilities that can affect the resulting section.
 * @evidence {@link Mouth.IPortraitMouthShape.borderRefinement} Selects the outer vermilion's surface or independent closed-curve refinement rule.
 * @evidenceReview {@link Mouth.IPortraitMouthShape.borderRefinement} #d3b0f0f Read the allowed surface/curve values and the attach.curves handoff using the existing outer loop. The lip-border scenarios compare omitted/surface behaviour and shared curve refinement. This changes an outer boundary rule; it does not promise unchanged final inner-rim coordinates after all later refinement rounds or a complete vermilion section.
 * @evidence {@link Mouth.createPortraitMouthComponent} Fits the curved lip bands and declares their shared skin border, oral opening and interior finisher.
 * @evidenceReview {@link Mouth.createPortraitMouthComponent} #bf8cdee Read copied boundaries/crowns, section and band resolvers, numerical admission, connected-band selection, local upper/lower fitting, original oral cuts, material labels and the final-rim finisher. Fourteen current mouth/lip/dental scenarios passed. Current restored-face views retain a connected but synthetic lip band; source correctness and colour ownership do not accept the smile shape.
 * @evidence {@link Mouth.portraitLipTriangles} Selects the connected lip band bounded by the two authored anatomical loops.
 * @evidenceReview {@link Mouth.portraitLipTriangles} #a0ce5d3 Read both anatomical barrier loops, edge incidence, seed selection and connectivity flood. The cutout and lip-border scenarios preserve full band triangles rather than selecting their centroids. A missing seed refuses, while choosing a seed in the intended band remains the subject binding responsibility.
 * @evidence {@link Loop.IControlMesh.positions} Preserves construction-space vertex identities during shared refinement.
 * @evidenceReview {@link Loop.IControlMesh.positions} #c782da5 Read XYZ arrays in the Loop masks and the host's final metric packing. Original indices survive as moved samples, while inserted edge positions are appended once per shared edge.
 * @evidence {@link Loop.IControlMesh.indices} Carries oriented triangles over the common vertex population.
 * @evidenceReview {@link Loop.IControlMesh.indices} #6a94ca6 Followed edge adjacency and four child triples per face. The array is topology, not an anatomical boundary label; the optional curves must name actual resident edges.
 * @evidence {@link Loop.IControlMesh.groups} Retains each triangle's material-region ownership through subdivision.
 * @evidenceReview {@link Loop.IControlMesh.groups} #bcbcae3 Read four copies per parent face and the head's later region extraction. Shared edge vertices are refined once even when adjacent labels differ; colour separation happens only after shared normals.
 * @evidence {@link DirectionalContact.createPortraitDirectionalContact} Resolves a contact target from resident triangles along a declared projection direction.
 * @evidenceReview {@link DirectionalContact.createPortraitDirectionalContact} #5776a66 Read the shared contactFrame/project/advance path and the closure's foremost resident depth query. Independent frontal, diagonal, reversed and Y-normal plane oracles preserve the projected point and exact identity on clear or missed rays; invalid inputs and overflow refuse. The separate surface-target consumer now handles triangle interiors, which this point query alone cannot constrain.
 * @evidence {@link FitBasis.assertPortraitFitBasis} Binds a recorded residual to the exact source-model and target-control bytes consumed by its producer.
 * @evidenceReview {@link FitBasis.assertPortraitFitBasis} #7dcb216 Read both digest comparisons and distinct refusal paths with standard abc/empty SHA-256 vectors. Actual fitted-consumer probes changing eye distance or one target coordinate also refuse. A new digest cannot be substituted for recomputing coefficients against that basis.
 * @evidence {@link Fitted.buildFittedReferencePortrait} Applies the recorded anatomical fit only after checking its captured source and current target dependencies.
 * @evidenceReview {@link Fitted.buildFittedReferencePortrait} #48577c7 Read source-sampling reconstruction, both byte-basis checks, shared-skin fitting, optical centres and added grouped teeth/brows/hair. The refreshed 150-point record is derived from the current captured prior; evaluating its continuous field at another tessellation is distinct from changing the source construction. This does not accept the fitted likeness or its inferred depth.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealBoundary} Selects the closed shell's visible-aperture or full limbal boundary.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealBoundary} #63556d5 Read the shared eyeCornea extent selection: limbus supplies full iris-radius extents, while omission/aperture uses the clipped angular samples. The two-opening scenario preserves full limbal diameter and omitted/aperture equivalence. This choice supplies optical boundary geometry; the separate contact mode makes skin conform to it.
 * @evidence {@link Eyes.IPortraitEyeShape.lidContact} Selects inner optical support and final shared-eyelid contact with the full resident cornea.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidContact} #682d58d Traced cornea/limbus admission, preconstruction inner support, retained sphere-projected outer guide and final complete-triangle contact. The engine supplies shared targets before common normals; the same optical builder supplies the rendered shell. Current directional separation is positive, but the wide lower pad remains an unaccepted anatomical shape.
 * @evidence {@link Eyes.IPortraitEyeShape.lidContactReach} Governs geodesic tissue adaptation around exact optical contact constraints.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidContactReach} #842a388 Read the optional 3 mm default and nonnegative finite admission beside the shared skin adapter. Zero retains the complete face-contact targets with no surrounding spread; it no longer means that only original vertices were checked. The contact scenario distinguishes neighbouring adaptation and an empty contact population without treating either result as likeness acceptance.
 *
 * @evidence {@link Controls.IPortraitSurfaceControl} Describes a named requested movement on the common refined surface.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl} #2d5e07e Read all four fields with the coupled solver and nasal consumer. The displacement is a target right-hand side, while coefficients are solved from the whole population; treating it as an independent bump amplitude would miss neighbouring zero constraints.
 * @evidence {@link Controls.IPortraitSurfaceControl.name} Names each anatomical handle and fixes deterministic elimination order.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.name} #3008690 Traced copied controls through compareCodeUnits sorting and nonempty/duplicate-name refusal. Reversing the two-point input reproduces the same emitted fields without changing an anchor's physical target.
 * @evidence {@link Controls.IPortraitSurfaceControl.anchor} Supplies the retained host vertex from which a control is located.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.anchor} #c9d8e8d Read integer/nonnegative admission and resident finite-datum lookup in fields(host). A changed host relocates the handle; a missing resident point refuses before interpolation rather than defaulting to the origin.
 * @evidence {@link Controls.IPortraitSurfaceControl.offset} Places an intermediate control relative to its live anatomical datum.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.offset} #66e0dfd Compared the copied three-number offset and finite sum with the translated-frame test. The offset locates the kernel centre in millimetres and is not part of its requested movement.
 * @evidence {@link Controls.IPortraitSurfaceControl.displacement} Prescribes the combined XYZ movement at one control position.
 * @evidenceReview {@link Controls.IPortraitSurfaceControl.displacement} #a867909 Followed all three right-hand sides through common elimination and final metre conversion. The independent two-point inverse reproduces a nonzero first target and a zero neighbour; coefficient overflow refuses before any final field is emitted.
 * @evidence {@link Controls.createPortraitControlLayer} Solves coupled anatomical targets into fields consumed by the shared surface assembler.
 * @evidenceReview {@link Controls.createPortraitControlLayer} #3be53ee Read normalized engine probes, pivot selection, singular refusal and the three-axis output against actual assembly tests. A 0.2 mm nasal target reaches its refined control and moves resident lining while the remote chin remains fixed. The engine checks the final field and triangles; neither those checks nor interpolation prove global nonintersection or likeness.
 * @evidence {@link Anatomy.IPortraitNasalDetail} Groups a complete optional nasal control field in place of basic support amplitudes.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail} #d1d7074 Read its radius and control population beside portraitNasalLayerFor. Omission selects the original relief, while a supplied empty population explicitly removes that layer; detail is not silently added on top of the old nasal amplitudes.
 * @evidence {@link Anatomy.IPortraitNasalDetail.radius} Establishes one millimetre support extent for the coupled nasal group.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail.radius} #2c558c3 Traced the value into both normalized matrix distances and every final field radius. The same extent governs exterior and recessed lining; it is an authored influence range rather than a recovered tissue thickness.
 * @evidence {@link Anatomy.IPortraitNasalDetail.controls} Supplies the complete named nasal target population, including stationary anchors.
 * @evidenceReview {@link Anatomy.IPortraitNasalDetail.controls} #05d8c8c Compared active dorsal, tip, columellar and alar-facial handles with the solver's zero constraints. No control is discarded before solving merely because its displacement is zero; only solved zero coefficients produce no field.
 * @evidence {@link Anatomy.portraitNasalLayerFor} Selects exactly one basic or coupled nasal surface authority.
 * @evidenceReview {@link Anatomy.portraitNasalLayerFor} #b95b101 Read both branches and their shared layer identity. Omission matches the original basic relief fields. The active native-patch assembly supplies an explicit empty control population to disable those old nasal supports, retaining one source of nasal form. Other anatomical layers still act on the assembled surface and require separate sensitivity checks.
 * @evidence {@link Anatomy.portraitNasalDetail} Records the rejected coupled nasal fitting hypothesis for explicit replacement experiments.
 * @evidenceReview {@link Anatomy.portraitNasalDetail} #970d91f Read each named datum, zero offset and signed three-axis movement with its frozen 0af74958 configuration. Eleven controls share a 22 mm support. Both image reviewers found a broad flat tip, so the preset is absent from the active assembly and is not an accepted anatomical fit.
 * @evidence {@link LipSection.IPortraitLipBandKnot} Defines one thickness-ratio witness along the curved oral span.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot} #a4f2ada Read at and scale with the scalar/array resolver. Witness order belongs to the supplied profile, and fixed endpoint ratios preserve corner positions rather than introducing a separate mouth frame.
 * @evidence {@link LipSection.IPortraitLipBandKnot.at} Locates a thickness witness from anatomical right to left.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot.at} #28ade80 Traced finite strictly increasing progress with endpoint values -1 and +1. Duplicate or reversed positions refuse, while asymmetric interior positions retain their specified intervals.
 * @evidence {@link LipSection.IPortraitLipBandKnot.scale} Sets a positive local ratio of vertical vermilion thickness.
 * @evidenceReview {@link LipSection.IPortraitLipBandKnot.scale} #d00eda8 Compared positive finite admission with identity endpoints and convex-hull interpolation. Zero cannot be interpreted as omission because it collapses thickness; explicit one is the neutral ratio.
 * @evidence {@link LipSection.createPortraitLipBandSampler} Supplies normalized lip coordinates and their authoritative inner/outer heights together.
 * @evidenceReview {@link LipSection.createPortraitLipBandSampler} #4e5ff66 Read the entire curved-boundary binder after extracting the legacy coordinate wrapper. The mouth uses this same innerY to scale thickness; a raised lower-band point is classified locally rather than by global head height. All bound curve data is copied.
 * @evidence {@link LipSection.createPortraitLipBandScale} Resolves omitted, scalar or ordered optional band profiles for mouth fitting.
 * @evidenceReview {@link LipSection.createPortraitLipBandScale} #2830997 Read two-to-64 knot admission, fixed corners, cubic interval blending and query refusal. Independent scalar and asymmetric-array arithmetic pins interpolation; the annulus consumer test fails when thickness application is disabled and confirms unchanged inner rim and upper band under lower-only detail.
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
 * @evidenceReview {@link Component.IPortraitComponentPlan} #6c1af97 Read its constraints and original cut ordinals with the attach result, including curves, deferred replacements, finalSurface and finish. The head collects fitting plans first, appends shared topology, then runs the later stages on their corresponding refined basis. These are separate lifecycle responsibilities; a valid plan type is not a likeness guarantee.
 * @evidence {@link Component.IPortraitComponentPlan.constraints} Defines the complete exact attachment requests collected before skin blending.
 * @evidenceReview {@link Component.IPortraitComponentPlan.constraints} #dd57864 Followed plans.flatMap into blendPortraitSkin. Each request retains its vertex, target and reach; contradictory exact targets are the blend owner's refusal rather than a last-writer policy.
 * @evidence {@link Component.IPortraitComponentPlan.cutFaces} Identifies original faces replaced by component topology.
 * @evidenceReview {@link Component.IPortraitComponentPlan.cutFaces} #bf95039 Checked integral resident-ordinal and duplicate-cut refusal in buildPortraitHead. The list is not a set of post-subdivision material triangles.
 * @evidence {@link Component.IPortraitComponentPlan.attach} Appends shared geometry and returns the actual final-surface consumers.
 * @evidenceReview {@link Component.IPortraitComponentPlan.attach} #910c169 Traced its cage/adapted/region arguments and all five returned responsibilities. Deferred replacement callbacks receive the post-subdivision socket, final proposals read the immutable post-layer surface, and finish consumes the accepted refined geometry. Current eye, nose and mouth factories honor that shared-attachment protocol.
 * @evidence {@link Eyes.IPortraitEyeSocket} Assigns this subject's anatomical boundary identities to a replaceable eye.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket} #042d18d Read the six members beside loopOf, fitting and brow construction. Both aperture paths share canthi and run in head-X order; the instance's anatomical side is separate from that order.
 * @evidence {@link Eyes.IPortraitEyeSocket.name} Selects anatomical handedness and side-qualified output identities.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.name} #7d1f6a8 Traced the left/right branches for outer-corner progress, medial tissues, lashes and brow bending. Positive head X is anatomical left; image-left is not substituted for that convention.
 * @evidence {@link Eyes.IPortraitEyeSocket.top} Supplies the upper aperture path and identifies which support rows receive a crease.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.top} #22819c6 Read top.includes in lidRows and the upper curve used by iris clipping and lashes. Its endpoint identities also participate in the lower loop, so corner membership does not create a second seam.
 * @evidence {@link Eyes.IPortraitEyeSocket.bottom} Supplies the lower aperture path in the same X direction as the upper path.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.bottom} #fb0a69b Followed the lower-first closed loop and the lower clipping lookup. Reversing this path would change winding and interpolation rather than simply rename an eye.
 * @evidence {@link Eyes.IPortraitEyeSocket.iris} Locates the independent gaze marker projected onto the fitted globe.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.iris} #76d587d Read the marker's exact zero-reach constraint and later sphere-ray intersection. It does not choose the lid-plane normal or a second spherical curvature.
 * @evidence {@link Eyes.IPortraitEyeSocket.browTop} Supplies the upper boundary of this eye's brow distribution.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.browTop} #2a35c47 Followed its retained IDs into buildPortraitEyebrow, where interpolated XY chooses fibre locations and actual final skin supplies contact depth. The boundary's sparse Z values are not used as the contact surface.
 * @evidence {@link Eyes.IPortraitEyeSocket.browBottom} Supplies the lower boundary from which brow fibre spans begin.
 * @evidenceReview {@link Eyes.IPortraitEyeSocket.browBottom} #2fbdd4d Compared its lower spline with the upper spline and the deterministic start/end fractions between them. Identical boundaries remove that cross-brow span, although outwardBend can still create a nonzero strand path. The eye copies this boundary array independently before final-skin sampling.
 * @evidence {@link Eyes.IPortraitEyeShape} Groups aperture, surrounding tissue, optical and sampling inputs for one eye instance.
 * @evidenceReview {@link Eyes.IPortraitEyeShape} #54e02ac Read all declared aperture, basic/detail tissue, optical, pigment, brow, sampling and optional skin-attachment inputs through the complete factory and finish paths. Lower-lid sections replace the basic interior profile where their longitudinal blend is full; optical contact, material colour and host reservation have separate consumers. The shape is an authored approximation with explicit dimensional admission, not a physiological reconstruction from the photograph.
 * @evidence {@link Eyes.IPortraitEyeShape.widthScale} Multiplies the aperture span about its measured horizontal midpoint.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.widthScale} #3969d18 Read middleX+(x-middleX)*widthScale on both rim paths. The gaze marker is handled separately, so this dimension does not automatically scale the pupil or iris radius.
 * @evidence {@link Eyes.IPortraitEyeShape.openingScale} Multiplies aperture height about the extrema-derived vertical midpoint.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.openingScale} #fc8118d Traced the same Y multiplier about middleY on both aperture paths before corner lift and sphere intersection. Zero and negative multipliers refuse at admission. The subsequent sphere and contact stages still determine the final boundary, and this multiplier does not supply lower-tissue thickness.
 * @evidence {@link Eyes.IPortraitEyeShape.outerCornerLift} Adds a signed millimetre lift that increases toward the anatomical outer canthus.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.outerCornerLift} #4f12d9d Compared u for the left eye with 1-u for the right eye. Both paths use the same outer progress, retaining one corner position instead of lifting only the upper boundary.
 * @evidence {@link Eyes.IPortraitEyeShape.socketLift} Translates aperture and gaze together along the recorded view direction.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.socketLift} #fffc0e7 Read the per-axis host.viewRay displacement and outer support's corresponding depth offset. This is a signed construction-distance control, not an increase in eye radius.
 * @evidence {@link Eyes.IPortraitEyeShape.blendReach} Limits the geodesic influence of the fitted outer eyelid on surrounding skin.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.blendReach} #449affd Followed this nonnegative value into each outer-row constraint, beside the gaze marker's separate zero reach. It controls neighbouring adaptation rather than the width of the lid section.
 * @evidence {@link Eyes.IPortraitEyeShape.foldWidth} Sets the upper crease's planar separation from the aperture.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.foldWidth} #3fa513b Read the sinusoid-weighted fold offsets across hood, crease and tarsal rows. The top-membership weight fades at both canthi and supplies no fold on the lower path.
 * @evidence {@link Eyes.IPortraitEyeShape.foldDepth} Recesses the upper crease relative to its ridge and hood.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.foldDepth} #06bc857 Compared the negative depth at both crease rows with the positive fractions used by hood/tarsal rows. Increasing it changes a section relationship, not the aperture's XY contour.
 * @evidence {@link Eyes.IPortraitEyeShape.upperLidVolume} Adds tarsal support above the upper aperture.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.upperLidVolume} #078db24 Located its sole contribution in the tarsal row multiplied by the upper weight. It cannot thicken the lower roll, whose separate lowerVolume term owns that side.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidWidth} Controls the lower tissue transition's outward planar extent.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidWidth} #dfed770 Read its lower-only sine weight and fractional contributions to basic row offsets. Optional detailed sections blend toward their own offsets and attachment width, so this is not an independent override of a fully selected detailed section. Upper rows keep their fold-width path.
 * @evidence {@link Eyes.IPortraitEyeShape.lowerLidVolume} Raises the lower roll independently of its transition width.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lowerLidVolume} #d2324ed Traced the basic roll's lower-only amplitude through the tarsal and shoulder fractions. Detailed role projections replace these depths under the same canthal blend rather than adding a second roll. The current broad pad demonstrates why this scalar and its regular fractions do not by themselves define the desired pretarsal form.
 * @evidence {@link Eyes.IPortraitEyeShape.lidThickness} Supplies the forward depth of the aperture margin and neighbouring lid rows.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.lidThickness} #0ddec62 Compared the inner point's Z increment and basic ridge's additional 0.08 mm with its separate use as final optical clearance in metres. Detailed role depths can replace basic row projections, but the complete contact pass still enforces this separation along the recorded ray. It is not a measured closed eyelid volume.
 * @evidence {@link Eyes.IPortraitEyeShape.surfaceRadius} Selects the sphere fitted to the complete aperture plane.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.surfaceRadius} #5951ffe Read fitPortraitEyeSphere and the same sphere used by sclera/gaze sampling. Admission requires it to span the aperture and to be no smaller than the declared corneal curvature.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealRadius} Sets the anterior optical cap curvature above the fitted globe.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealRadius} #c43aa0b Compared curvature against iris radius and globe radius, then read its sag contribution in buildPortraitCornea. The prescribed 7.8mm is a schematic assumption, not a recovered subject dimension.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealThickness} Separates the optical shell's front and back and sets its material volume thickness.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealThickness} #6bd8e14 Followed the millimetre axial back-surface offset and the side-owned material's division by 1000. Geometry and optical metadata use one input; neither models the cornea's internal layers.
 * @evidence {@link Eyes.IPortraitEyeShape.cornealRimLift} Holds the optical shell above the underlying iris at its unclipped limbus.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.cornealRimLift} #71c6947 Read the strict thickness+0.055 clearance admission and the constant rim offset in the cap surface. Angular clipping does not refit that lift or curvature for each column.
 * @evidence {@link Eyes.IPortraitEyeShape.irisRadius} Defines the pigment and corneal disk before the eyelid clips their visible reach.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.irisRadius} #5a1cb99 Followed it into the pigment disk's angular clipping and the cornea's declared unclipped radius. Aperture mode forwards clipped extents; limbus mode restores full-radius columns. The pupil keeps its own smaller radius, and this input does not independently widen the fitted lid opening.
 * @evidence {@link Eyes.IPortraitEyeShape.pupilRadius} Defines the inner dark disk independently of the iris extent.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.pupilRadius} #f5a2bf6 Read the positive radius and pupil<iris refusal, then its separately clipped disk with the 0.09mm surface offset. This opaque approximation does not model an internal eye cavity.
 * @evidence {@link Eyes.IPortraitEyeShape.tissues} Optionally supplies medial conjunctiva and the narrow lower ocular margin.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.tissues} #ae7fd66 Checked the copied scalar profile and omission/independent-disable branches, then the live lid curves and resident sclera/cornea support in the finisher. Complete emitted-triangle contact now keeps the wet margin outside that support. These narrow conjunctival surfaces do not construct the external lower-lid body selected by lowerLidProfile.
 * @evidence {@link Eyes.IPortraitEyeShape.browFibres} Selects the number of explicit brow strands generated on the final forehead.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.browFibres} #ec1b81a Read the zero-fibre return and the 4096 upper bound in the brow owner. This integer controls a mesh population, not the brow boundary or anatomical eye opening.
 * @evidence {@link Eyes.IPortraitEyeShape.browProfile} Supplies strand dimensions while retaining subject-owned brow boundaries.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.browProfile} #6cf577e Traced the copied supplied/default profile through assertPortraitEyebrowProfile and final-skin contact. Changing fibre clearance or bending cannot substitute for moving the brow's upper/lower sockets.
 * @evidence {@link Eyes.IPortraitEyeShape.upperLashes} Sets the positive integer population of short lashes along the upper rim.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.upperLashes} #1073d9d Read the evenly distributed u values and side-dependent outward curl. The separately built lash-line tube remains present independently of this count.
 * @evidence {@link Eyes.IPortraitEyeShape.sampling} Separates ocular mesh resolution from the eye's anatomical dimensions.
 * @evidenceReview {@link Eyes.IPortraitEyeShape.sampling} #5a9fed3 Followed eyeColumns/eyeRows into sclera sampling and irisColumns/irisRows into pigment and corneal sampling. Integer minima protect their lattices; a denser lattice does not certify likeness.
 *
 * @evidence {@link Geometry.portraitPoint} Supplies the common XYZ value used by the study's construction-space curves and component frames.
 * @evidenceReview {@link Geometry.portraitPoint} #81b044d Read the direct x/y/z object construction: it retains millimetre coordinates without a hidden scale or axis swap, so the later portraitPart conversion remains the unit boundary.
 * @evidence {@link Geometry.portraitMix} Interpolates scalar coordinates and dimensions within the authored surface sections.
 * @evidenceReview {@link Geometry.portraitMix} #7097558 Compared a+(b-a)*t with its callers' local curve progress. It preserves endpoints and permits extrapolation; callers, rather than this scalar helper, own admissible parameter intervals.
 * @evidence {@link Geometry.portraitRayIntersection} Provides a bracketed camera-ray intersection for a caller-owned finite height surface.
 * @evidenceReview {@link Geometry.portraitRayIntersection} #7dc08cf Traced origin+t*direction and the signed height residual through forty bisections. Endpoint finiteness and sign bracketing are enforced; continuity and finiteness of the supplied surface remain caller preconditions, and the helper is not a general visibility query.
 * @evidence {@link Geometry.portraitNormals} Computes the shared skin/lining normal field before material regions are separated.
 * @evidenceReview {@link Geometry.portraitNormals} #917b095 Read the unnormalized cross-product sums and final normalization. A vertex with no nonzero incident area stays zero, which explains the optical pole defect repaired at its spherical owner. The 1a4bb653 experiment also shows that equal shared normals do not establish the desired geometric tangent.
 * @evidence {@link Geometry.portraitRegion} Extracts named material geometry while preserving the common field and original vertex identity.
 * @evidenceReview {@link Geometry.portraitRegion} #4178c44 Followed first-use index remapping and copied position/normal triples. Only referenced vertices enter the child region, and coincident positions are not silently welded; this is the mapping the actual GLB witness audit must respect.
 * @evidence {@link Geometry.portraitPart} Converts completed construction meshes into static metre-space AutoMovie parts.
 * @evidenceReview {@link Geometry.portraitPart} #262ffdc Checked the engine transform's uniform 0.001 scale and null part transform/bone binding. Positions cross from millimetres to metres once while the engine preserves normal direction; the exported capture uses these resident buffers.
 * @evidence {@link Geometry.portraitPatch} Produces the shared rectangular sampling lattice used by authored parametric surfaces.
 * @evidenceReview {@link Geometry.portraitPatch} #e8578a7 Read both triangle triples per cell and their du-cross-dv orientation. Sampling includes both parameter endpoints without pole welding or caps. Its area normals therefore cannot supply a direction at an entirely collapsed pole; spherical owners now provide that derivative explicitly.
 * @evidence {@link Geometry.portraitSpline} Interpolates ordered spatial landmarks for lid, dental and other study curves.
 * @evidenceReview {@link Geometry.portraitSpline} #6e41fe7 Compared the uniform Catmull-Rom polynomial, repeated endpoint neighbours and clamped progress. The parameter is not physical arc length, so dental spacing is delegated to its separate arc-distance sampler.
 * @evidence {@link Geometry.portraitTube} Sweeps the coarse lash/brow strands in their construction frame.
 * @evidenceReview {@link Geometry.portraitTube} #e948aad Traced each shared ring frame from the sampled tangent and fixed Z guide. Zero, nonfinite and Z-parallel tangents refuse; eight-sided radius sections remain open-ended unless their owning surface closes them. The current strands remain coarse context rather than accepted detailed grooming.
 *
 * @evidence {@link Sphere.IPortraitEyeSphere} States the common centre and radius of the fitted optical surface in millimetres.
 * @evidenceReview {@link Sphere.IPortraitEyeSphere} #ef3af5e Read both fields against the fit, intersection and height consumers. Radius is a positive authored curvature control and centre is behind the fitted aperture; neither field claims a physiological measurement of the adolescent source.
 * @evidence {@link Sphere.fitPortraitEyeSphere} Fits the globe from the lid plane independently of the gaze marker.
 * @evidenceReview {@link Sphere.fitPortraitEyeSphere} #5a09a94 Followed the canthal chord, mean lid separation, camera-facing normal and mean rim residual. The unit-circle/radius-two oracle gives centre Z=-sqrt(3). Literal review exposed overflow in a finite radius's square; the added refusal now rejects radius 1e200 while the 1e154 positive control remains finite. This preserves ordinary fitting without returning a nonfinite centre to optical consumers.
 * @evidence {@link Sphere.portraitEyeSphereIntersection} Places gaze/lid samples on the fitted globe along the supplied viewing ray.
 * @evidenceReview {@link Sphere.portraitEyeSphereIntersection} #6e879fb Read the normalized-ray quadratic and camera-facing root. The slanted radius-two oracle retains collinearity, while a missed sphere or zero ray refuses. This preserves projection only for the declared viewing direction.
 * @evidence {@link Sphere.portraitEyeSphereHeight} Supplies the anterior spherical height shared by sclera and pigment surfaces.
 * @evidenceReview {@link Sphere.portraitEyeSphereHeight} #e553bae Compared radius squared minus transverse squared distance with the positive square root. Tangency is finite, samples outside the disk refuse, and the same radius gives equal horizontal/vertical curvature.
 *
 * @evidence {@link Buffers.placePortraitMesh} Protects each part's actual placement before its final precision conversion.
 * @evidenceReview {@link Buffers.placePortraitMesh} #eb3a18c Read the translation-free (0,b-a,c-a) reference transformed by the same engine operation. Redundancy is classified after linear scale, so an enlarged tiny source face cannot borrow a pole exemption when a large translation erases it; supported rotations and baked mirrors retain their intended winding.
 * @evidence {@link Buffers.portraitMeshBuffers} Materializes and validates the actual Float32/Uint32 geometry delivered to glTF.
 * @evidenceReview {@link Buffers.portraitMeshBuffers} #4889f21 Traced aligned finite attributes, exact redundant triangle ordinals, nonredundant face orientation and the unit-NORMAL check with Float32 roundoff. Independent collapse/inversion, swapped-ordinal and zero-normal cases refuse; the current a34f1fe4 GLB was read through every NORMAL accessor, with 217380 vectors and maximum unit-length error 4.84405e-8.
 * @evidence {@link Gltf.portraitGltfExtensions} Declares the optical extension classes registered on this study's GLTF readers and writers.
 * @evidenceReview {@link Gltf.portraitGltfExtensions} #6fffc2a Compared the four registered classes with the exporter: clearcoat, IOR, transmission and volume are preserved by the actual SDK round trip. An unregistered reader/writer would be a different delivery path and is not covered by the captures.
 * @evidence {@link Gltf.portraitDocument} Converts the complete static study into resident GLTF material groups and attributes.
 * @evidenceReview {@link Gltf.portraitDocument} #c85ae5e Read part placement, material grouping, actual buffer conversion, final topology and optical-closure checks, plus rig/texture/bone-binding refusal. Current binary inspection reads 29 material meshes and all their NORMAL accessors. The prior normal-pole repair is also exercised separately through its real buffer and optical binary consumers; material grouping does not establish anatomical completeness.
 *
 * @evidence {@link Loop.IControlMesh} Carries the shared triangular control positions, connectivity and one material label per face.
 * @evidenceReview {@link Loop.IControlMesh} #46c909f Read all three fields against the head and Loop consumers. Vertex identities support retained anatomical bindings, while groups belong to triangles and inherit to children; the type does not itself validate a manifold or choose a coordinate conversion.
 * @evidence {@link Loop.subdivideControlMesh} Refines the connected triangular cage before its shared normals and interiors are finalized.
 * @evidenceReview {@link Loop.subdivideControlMesh} #7f9ca81 Read every Loop mask and curve-admission branch, the cached triangle-edge identities, four child triples and inherited face labels, and the interleaved curve identities used by the next round. The retained-source test proves discarded placeholder heights cannot alter surviving skin when its shared curve is declared. This is a refinement rule, not a guarantee of smooth curvature between arbitrary component surfaces.
 * @evidence {@link Quads.IPortraitQuadMesh} Retains quadrilateral topology for the inactive anatomical prior's common skin/neck refinement.
 * @evidenceReview {@link Quads.IPortraitQuadMesh} #05ce667 Read positions, four-corner faces and face labels as one connected cage in caller units. The separate quad representation preserves the face-centre refinement rule rather than treating the triangulated prior as a Loop cage.
 * @evidence {@link Quads.subdividePortraitQuads} Applies shared Catmull-Clark refinement to the anatomical skin and attached neck.
 * @evidenceReview {@link Quads.subdividePortraitQuads} #879f3b2 Compared face centres, original edge-midpoint averages and boundary rules with the independent quad scenarios. Per-axis normalization protects finite large coordinates, while malformed quads, inconsistent manifold winding and invalid boundary valence refuse. These rules alone do not repair the stepped neck seen in the unfitted prior.
 * @evidence {@link Topology.assertPortraitSkinTopology} Audits the declared openings and stitches of the complete control cage before refinement.
 * @evidenceReview {@link Topology.assertPortraitSkinTopology} #dcbad64 Read the exact expected-edge set, duplicate opening refusal and two opposite incident directions for internal edges. Missing or undeclared openings fail independently of vertex position, so this verifies connectivity rather than anatomical shape or global self-intersection.
 * @evidence {@link Blend.blendPortraitSkin} Adapts neighbouring skin to exact component attachments on one unchanged host.
 * @evidenceReview {@link Blend.blendPortraitSkin} #2511488 Followed multi-source remaining-distance propagation and stable positive-weight displacement sweeps. Hard constraints stay exact and contradictory shared targets refuse. The 1a4bb653 collar falsifier confirms that a position-correct Laplace join can still have an unacceptable tangent and volume.
 * @evidence {@link Relief.IPortraitReliefRegion} Separates each support's live vertex binding and offset from its metric support radii and signed displacement.
 * @evidenceReview {@link Relief.IPortraitReliefRegion} #9908253 Read the named anchor, XYZ offset, three positive radii and displacement fields against the layer adapter. All use head-space millimetres; the anchor follows replacement, while these envelopes remain visible-surface controls rather than reconstructed internal tissue.
 * @evidence {@link Relief.createPortraitReliefLayer} Converts owned anatomical support settings into engine deformation fields on the live skin.
 * @evidenceReview {@link Relief.createPortraitReliefLayer} #6a87ee4 Traced copied regions, unique names, resident-anchor checks and the millimetre-to-metre conversion of centre/radius/displacement. Zero displacement emits no field and stretch stays zero; the final surface assembler supplies aperture protection and common normals.
 *
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
 *
 * @evidence {@link Surface.IPortraitSurfaceHost} Gives anatomical layers the shared post-subdivision coordinates, topology and normal field.
 * @evidenceReview {@link Surface.IPortraitSurfaceHost} #423655e Read the readonly millimetre position arrays, triangle identities and dimensionless flat normals against the layer consumers. This is a declared read-only view, not an assertion that an arbitrary callback is physically incapable of mutation.
 * @evidence {@link Surface.IPortraitSurfaceLayer} Separates a surface layer's identity from its derivation of metric engine fields on live attachments.
 * @evidenceReview {@link Surface.IPortraitSurfaceLayer} #515fe1f Compared the stable id and fields(host) callback with relief and cheek factories. They emit metre-valued deformation fields while host positions remain millimetres; the layer neither owns a detached shell nor performs material separation.
 * @evidence {@link Surface.applyPortraitSurfaceLayers} Applies the composed surface displacement with open-rim protection before common normals and material extraction.
 * @evidenceReview {@link Surface.applyPortraitSurfaceLayers} #e4e7aab Read stable ID ordering, complete-skin edge distances, area-weighted distance gradients and the quintic mask derivative passed into the engine Jacobian. The folded-mask negative twins distinguish this final differential from the unfaded field. Open rims and isolated gaze markers remain fixed; sampled checks do not establish global self-intersection freedom.
 * @evidence {@link SurfaceFit.IPortraitSurfaceFit} Describes the numerical thin-plate residual and optional gaze/ray data consumed by the inactive fitted foundation.
 * @evidenceReview {@link SurfaceFit.IPortraitSurfaceFit} #2143f50 Read normalized centres, two-coordinate weights, four affine rows, positive scale and optional optical inputs. This numerical field type does not bind a particular model. The recorded subject recipe now supplies that separate relationship through source-model and target-control byte checks before evaluating its preset.
 * @evidence {@link SurfaceFit.createPortraitSurfaceFitter} Evaluates the inactive foundation's recorded X/Y residual while retaining prior depth.
 * @evidenceReview {@link SurfaceFit.createPortraitSurfaceFitter} #098dcac Compared the copied coefficients and phi(r)=r squared log(r) kernel with its zero-distance and affine paths. Output Z stays input Z and nonfinite output refuses. The evaluator remains basis-agnostic; buildFittedReferencePortrait checks the current source and target identities before supplying its recorded coefficients, and that recipe's stale record was recomputed from a fresh observation.
 *
 * @evidence {@link Cornea.IPortraitCornea} Defines the closed optical shell's aperture, curvature, axial thickness and live globe support.
 * @evidenceReview {@link Cornea.IPortraitCornea} #c5a8df5 Read every field in the millimetre frame: unclipped radius bounds the angular extents, curvature exceeds that radius, globeRadius bounds curvature, and rimLift clears thickness. The surface callback supplies fitted depth; these controls are a rendering model, not measured physiology.
 * @evidence {@link Cornea.buildPortraitCornea} Constructs the joined anterior/posterior shell delivered with optical volume materials.
 * @evidenceReview {@link Cornea.buildPortraitCornea} #ae6b51a Traced corneal sag minus globe sag, one axial vertex per pole, reversed back winding and shared outer-ring closure. Clipping changes radial reach without refitting curvature per column. The actual export's volume topology gate checks closure; opaque clay display does not judge refraction.
 * @evidence {@link Crown.IPortraitDentalCrown} Separates enamel width, height, half-depth, cervical narrowing and cutting-edge rise from arch placement.
 * @evidenceReview {@link Crown.IPortraitDentalCrown} #8e72229 Read the local gingival +Y/anterior +Z frame, five numeric dimensions and optional paired side contours. Cervical width is a ratio and edge rise a millimetre length; neither places the crown on the arch. Side detail inherits omitted values independently, while row contact now measures the rotated result rather than trusting nominal width alone.
 * @evidence {@link Crown.assertPortraitDentalCrown} Admits usable enamel profiles before their width influences arch clearance.
 * @evidenceReview {@link Crown.assertPortraitDentalCrown} #ae0633f Compared finite positive dimensions, base cervical ratio and half-height rise bounds with the separate admission of both resolved side contours. The tests place each invalid contact fraction, ratio and rise on either anatomical side and retain explicit zero rise. This profile gate does not measure clearance after a row rotates the crown.
 * @evidence {@link Crown.buildPortraitDentalCrown} Builds each closed local crown before the row arranges it along one arch.
 * @evidenceReview {@link Crown.buildPortraitDentalCrown} #e1803ee Read rounded angular coordinates, height-dependent breadth/thickness, explicit contact-level insertion, mesial direction and both shared end caps. Independent bounds, asymmetric cervical/edge values and closed-topology checks pass. The local width is retained, while proximal separation belongs to the row; current 49c90e9d crowns still have simplified box-like sections.
 * @evidence {@link DentalArc.IPortraitDentalArc} Exposes physical horizontal arc distance and tangent to the dental-row arrangement.
 * @evidenceReview {@link DentalArc.IPortraitDentalArc} #bf977bd Read length, central distance and the sample result in the same millimetre frame. Position and horizontal unit tangent are returned together; the guide's inferred posterior continuation is not a source-image measurement.
 * @evidence {@link DentalArc.createPortraitDentalArc} Samples the supplied dental guide by cumulative XZ distance rather than projected width or spline progress.
 * @evidenceReview {@link DentalArc.createPortraitDentalArc} #aac4d50 Traced the 257 core samples, cubic posterior continuations and positive-distance binary lookup. The active row supplies a planar elliptical guide, so this legacy oral-guide capability does not independently resample tooth heights from lip landmarks. Out-of-range distance and zero horizontal advance refuse.
 * @evidence {@link Dental.IPortraitDentalRow} Supplies one local arch and its ordered crown profiles to the grouped dentition builder.
 * @evidenceReview {@link Dental.IPortraitDentalRow} #bfb2647 Compared halfWidth/depth with the nominal ellipse, gap with arc-distance centre placement and optional contactGap with actual rotated-mesh separation. Crown profiles remain independently shaped data in right-to-left order. Contact can shift centres away from the guide without changing crown Y/Z or orientation; omission preserves nominal placement.
 * @evidence {@link Dental.IPortraitDentalAttachment} Defines the complete row's oral datum, orientation guides and metric offsets.
 * @evidenceReview {@link Dental.IPortraitDentalAttachment} #1c94f92 Read both corner points, upper-lip centre, up guide, lift and recess against rigid attachment. The corner chord supplies X, orthogonalized up supplies Y, and their cross supplies anterior Z; lengths remain millimetres and no per-tooth transform is introduced.
 * @evidence {@link Dental.attachPortraitDentalRow} Places every crown vertex and normal through one orthonormal oral frame.
 * @evidenceReview {@link Dental.attachPortraitDentalRow} #b4e8143 Traced copied mesh data, degenerate-chord/up refusal and the same frame multiplication for positions and normals. The rigid-group/translation scenarios preserve pairwise tooth arrangement; the visible rectangular crowns remain a shape problem outside this placement operation.
 *
 * @evidence {@link LipSection.IPortraitLipSection} Gives upper body/tubercle and lower body/pads independent signed relief controls.
 * @evidenceReview {@link LipSection.IPortraitLipSection} #ec42600 Read millimetre projections separately from half-width fractions for tubercle width, pad width and offset. Zero projections retain the prior band, so a small measured final effect does not make these controls inactive.
 * @evidence {@link LipSection.IPortraitLipCoordinate} Locates a sample inside one curved vermilion band without subject-specific vertex identities.
 * @evidenceReview {@link LipSection.IPortraitLipCoordinate} #0f58804 Compared upper/lower classification, signed lateral progress and cutaneous-to-aperture across progress with the coordinate binder. These are normalized band coordinates, not head-Y labels or a new dental frame.
 * @evidence {@link LipSection.createPortraitLipSection} Evaluates owned vermilion relief with exactly zero contribution at both band edges and corners.
 * @evidenceReview {@link LipSection.createPortraitLipSection} #aa7c7e8 Read the quartic lateral fade, sine-squared transverse envelope and distinct upper-central/lower-paired Gaussian terms. The independent unit envelope gives 0.28125 at lateral 0.5/across 0.25; boundaries return literal zero and overflow refuses. This scalar function supplies no vertex pinning after the caller's later refinement, and the final lip form remains unaccepted.
 * @evidence {@link LipSection.createPortraitLipCoordinates} Binds outer and inner lip curves to the section's normalized coordinates.
 * @evidenceReview {@link LipSection.createPortraitLipCoordinates} #52d5c3a Traced the two extreme-X outer paths, strict forward ordering, shared inner corners and local upper/lower midpoint classification. Normalized interpolation prevents large-coordinate subtraction overflow; the raised lower-lip test guards against replacing this curved frame with a global Y threshold.
 * @evidence {@link Nostril.resizePortraitNostrilRim} Changes aperture dimensions inside its fitted plane without independently flattening the rim.
 * @evidenceReview {@link Nostril.resizePortraitNostrilRim} #df4cbc8 Read projected head-X width, the exact-X-normal head-Y guide, perpendicular height and retained normal residual. Unit scales copy all points exactly. The component applies overall nasal width and tilt later, so these local factors do not guarantee the same final footprint after a body-depth change.
 * @evidence {@link Nostril.fitPortraitNostrilRim} Regularizes an authored nasal cut boundary while preserving cyclic vertex ownership and centroid.
 * @evidenceReview {@link Nostril.fitPortraitNostrilRim} #2d0ae67 Traced normalized fitting coordinates, area normal, principal ellipse axes, perimeter phase and recentering. Zero amount preserves input exactly; a nonzero fit changes the sampled shape in its own plane. The cut points remain authored bindings rather than a measured physical nostril outline.
 *
 * @evidence {@link Head.buildPortraitHead} Assembles component cuts, shared skin, optional anatomical curves and final-surface proposals before material separation and attached interiors.
 * @evidenceReview {@link Head.buildPortraitHead} #ef3bcc9 Read the complete fit/blend/cut/attach sequence, region validation, cranium and neck closure, optional curve subdivision, post-layer region replacement, final proposals and material/interior extraction. The deferred-head test proves a six-edge refined socket; the restored procedural configuration reproduces the historical model exactly when given the historical eye settings. Current db7a56b3 full views remove the introduced nasal cracks without accepting likeness.
 * @evidence {@link Dental.buildPortraitDentalRow} Composes the owned crowns on a nominal arch and resolves optional proximal contact before merging the group.
 * @evidenceReview {@link Dental.buildPortraitDentalRow} #37c03d2 Read the copied row, profile admission, metric guide, centre-to-midline mesial choice, shared tangent rotation and optional engine sequence constraints. The metre conversion returns one uniform X shift to each original millimetre crown, retaining exact Y/Z and normals. The actual ten-crown group has positive inspected proximal separation, while the full/profile frames still show simplified enamel form.
 * @evidence {@link Attachment.createPortraitDentalComponent} Attaches the complete dental row to live refined oral anchors without cutting or deforming skin.
 * @evidenceReview {@link Attachment.createPortraitDentalComponent} #af5fc6b Read copied socket/placement, immediate row construction, resident-ID admission and the deferred rigid attachment. Its plan supplies no skin constraints, cuts or openings. The translated-refined-host scenario moves the entire metric group by [0.005,0.008,0.01] m after caller mutation, proving final anchors and owned factory inputs; lip/cavity contact is a separate assembled relation.
 * @evidence {@link NasalLobule.IPortraitNasalLobule} Declares a resident datum, apex offset, three physical radii and normalized inner section extent for each local nasal body.
 * @evidenceReview {@link NasalLobule.IPortraitNasalLobule} #8de79e8 Read the head XYZ/millimetre frame, physical half-extents, core [0,1) domain and optional dz/dx,dz/dy tangent. Separate array members allow asymmetric alae; the section pole is not necessarily the maximum head-Z point when its tangent is inclined. None of these inputs is asserted as a measured cartilage value.
 * @evidence {@link NasalLobule.createPortraitNasalLobules} Binds copied local ellipsoid sections to support-scaled skin before exterior and rim fitting.
 * @evidenceReview {@link NasalLobule.createPortraitNasalLobules} #75a681c Traced the anterior square-root section, affine tangent, cubic identity annulus, normalized overlap and owned datums. The radius-five/radius-three test yields depth four; a half X slope adds 1.5 mm there. The actual component's aperture and lining share the result. The zero-slope be197532 preset was visually rejected for sharp flared alae, so calculation correctness is kept separate from the next inclined preset's pending render.
 * @evidence {@link Nasal.createPortraitNoseComponent} Fits procedural exterior and shared nasal openings before constructing their lining.
 * @evidenceReview {@link Nasal.createPortraitNoseComponent} #cc36c01 Read copied bindings/settings, domain and alternative-basis admission, the common exterior/rim depth evaluator, fitted-centre tilt, optional skin band and shared lining/curve handoff. Restoring this component with its original support field reproduces historical model5c92f75c exactly under historical eye settings; current db7a56b3 full views remove the introduced source-patch cracks. Remaining tip/alar form is unaccepted.
 * @evidence {@link Ocular.createPortraitOcularTissues} Builds owned medial conjunctiva and wet lower-margin profiles against supplied live ocular support.
 * @evidenceReview {@link Ocular.createPortraitOcularTissues} #4f9129f Read the complete factory, interval/sample admission, mirrored medial section, separate mound/ridge terms and clipped lower strip. Shape ownership, mirrored and translated frames, independent disabling and invalid dimensions/samples are covered by the tissue scenarios. The assembled eye additionally fits these meshes against its resident optical shell; the factory alone neither solves full triangle contact nor accepts the still-synthetic lower-lid form.
 * @evidence {@link Eyes.buildPortraitEye} Builds resident ocular surfaces, pigment, lashes and brows from the final shared lid boundary.
 * @evidenceReview {@link Eyes.buildPortraitEye} #217e9b3 Read every final-boundary lookup, lid interpolation, spherical height/normal, gaze intersection, angular clipping and material-region branch. Wet tissues consume the actual optical support and complete face targets; lashes use the final upper curve and brows query final skin. Current 49c90e9d full views and corrected web closes retain positive inspected contact, while the regular lower pad and simplified optical appearance remain unaccepted.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  sourceCommit: "ac1145b0",
  gltfSha256:
    "49c90e9d61b6e0ec3004630d86cace7eebe096ca7228466cb28f9b7ffb5198cb",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
