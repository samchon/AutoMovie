import type * as Human from "@automovie/human";

/**
 * External nasal body, aperture sections and shared nasal attachment.
 * The frozen study root retains this domain through the native evidence graph.
 * Existing source inspections and historical capture limitations are preserved
 * verbatim. This carrier neither changes geometry nor accepts current likeness;
 * artifact observations and identities remain in review.md and the root record.
 *
 * @evidence {@link Human.IPortraitNasalEnvelopeSection} Inspected the five fields and constructor admission: phase is original edge-ordinal progress, width/crest are millimetres, crestPosition is interior to the width, and roll is a signed section-plane angle. This is an authored surface section, not a measured cartilage cross-section.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection} #a084689 Inspected the five fields and constructor admission: phase is original edge-ordinal progress, width/crest are millimetres, crestPosition is interior to the width, and roll is a signed section-plane angle. This is an authored surface section, not a measured cartilage cross-section.
 * @evidence {@link Human.IPortraitNasalEnvelopeSection.at} Inspected zero-origin strictly increasing unit phases, cyclic wrap and original/refined seed ordering. This parameter is not physical arc length.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection.at} #24d3d45 Inspected zero-origin strictly increasing unit phases, cyclic wrap and original/refined seed ordering. This parameter is not physical arc length.
 * @evidence {@link Human.IPortraitNasalEnvelopeSection.width} Inspected finite positive admission, non-overshooting station interpolation and the actual outward attachment displacement. A too-small representable displacement refuses.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection.width} #79c800e Inspected finite positive admission, non-overshooting station interpolation and the actual outward attachment displacement. A too-small representable displacement refuses.
 * @evidence {@link Human.IPortraitNasalEnvelopeSection.crest} Inspected signed finite relief along the aperture section normal and the shared Hermite crest jet. Zero and negative values remain authored geometric choices.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection.crest} #03d72d3 Inspected signed finite relief along the aperture section normal and the shared Hermite crest jet. Zero and negative values remain authored geometric choices.
 * @evidence {@link Human.IPortraitNasalEnvelopeSection.crestPosition} Inspected strict zero/one boundaries and its split of the physical width between the two exterior Hermite intervals.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection.crestPosition} #83250d2 Inspected strict zero/one boundaries and its split of the physical width between the two exterior Hermite intervals.
 * @evidence {@link Human.IPortraitNasalEnvelopeSection.roll} Inspected finite signed degrees, full-turn reduction and the orthonormal cavity-axis aperture frame. Exterior skin normals own attachment, not the rolled rim; the exterior end and vestibular beginning use the same reversed jet.
 * @evidenceReview {@link Human.IPortraitNasalEnvelopeSection.roll} #0aa23e1 Inspected finite signed degrees, full-turn reduction and the orthonormal cavity-axis aperture frame. Exterior skin normals own attachment, not the rolled rim; the exterior end and vestibular beginning use the same reversed jet.
 * @evidence {@link Human.IPortraitNasalEnvelope} Inspected the complete cyclic profile, separate tessellation control, positive bounded interpolation and array ownership. A profile adds expression space without accepting likeness or certifying tissue clearance.
 * @evidenceReview {@link Human.IPortraitNasalEnvelope} #aa8d844 Inspected the complete cyclic profile, separate tessellation control, positive bounded interpolation and array ownership. A profile adds expression space without accepting likeness or certifying tissue clearance.
 * @evidence {@link Human.IPortraitNasalEnvelope.sections} Inspected copied nonempty ordered stations, single-station uniform behavior, periodic last-to-first interpolation and complete-array document replacement.
 * @evidenceReview {@link Human.IPortraitNasalEnvelope.sections} #b1e2d44 Inspected copied nonempty ordered stations, single-station uniform behavior, periodic last-to-first interpolation and complete-array document replacement.
 * @evidence {@link Human.IPortraitNasalEnvelope.segments} Inspected integer 2..64 admission and actual exterior/vestibular row sampling. The limit is a tessellation budget, not an anatomical range.
 * @evidenceReview {@link Human.IPortraitNasalEnvelope.segments} #12d69b2 Inspected integer 2..64 admission and actual exterior/vestibular row sampling. The limit is a tessellation budget, not an anatomical range.
 * @evidence {@link Human.createPortraitNasalEnvelope} Read input ownership and refusals, periodic rim interpolation, original/refined boundary lineage, actual shoulder normals, independent cavity-axis rim frame, shared exterior/vestibular jets and connected rings/floor. The same appender supports the host and replaces its reserved region after subdivision. Hand-known coordinates survive zero/one/two refinement rounds. The fan proxy crossed both rims in the source probe; full-section support removed those measured crossings. This inspection is not whole-source review or visual acceptance.
 * @evidenceReview {@link Human.createPortraitNasalEnvelope} #a2fabeb Read input ownership and refusals, periodic rim interpolation, original/refined boundary lineage, actual shoulder normals, independent cavity-axis rim frame, shared exterior/vestibular jets and connected rings/floor. The same appender supports the host and replaces its reserved region after subdivision. Hand-known coordinates survive zero/one/two refinement rounds. The fan proxy crossed both rims in the source probe; full-section support removed those measured crossings. This inspection is not whole-source review or visual acceptance.
 * @evidence {@link Human.IPortraitNasalJet} Groups one sampled nasal-section point and its derivative.
 * @evidenceReview {@link Human.IPortraitNasalJet} #c776965 Read the point and derivative pair beside nasal-section sampling. The jet is a local parametric witness and does not independently place the finished nose.
 * @evidence {@link Human.IPortraitNasalJet.point} Supplies one finite nasal-section point in the construction frame.
 * @evidenceReview {@link Human.IPortraitNasalJet.point} #30d94d6 Read point into the section sampler's returned XYZ datum and finite coordinate guard.
 * @evidence {@link Human.IPortraitNasalJet.derivative} Supplies the local tangent used by nasal aperture fitting.
 * @evidenceReview {@link Human.IPortraitNasalJet.derivative} #e923e9c Read derivative beside the section's transverse/vertical parameter directions; it is a local frame witness rather than a global normal.
 * @evidence {@link Human.IPortraitNasalRimJet} Groups one nasal rim point with its tangent and transverse directions.
 * @evidenceReview {@link Human.IPortraitNasalRimJet} #5febf4d Read the three rim-vector fields beside rim-section fitting. Their shared local frame preserves aperture ownership and does not create an additional detached rim.
 * @evidence {@link Human.IPortraitNasalRimJet.point} Supplies the rim point retained by the aperture boundary.
 * @evidenceReview {@link Human.IPortraitNasalRimJet.point} #42602aa Read point beside the shared rim boundary and its finite XYZ admission.
 * @evidence {@link Human.IPortraitNasalRimJet.tangent} Supplies the longitudinal direction along the nasal rim.
 * @evidenceReview {@link Human.IPortraitNasalRimJet.tangent} #e57983f Traced tangent into the rim annulus orientation and its local normalization.
 * @evidence {@link Human.IPortraitNasalRimJet.transverse} Supplies the transverse direction across the nasal rim section.
 * @evidenceReview {@link Human.IPortraitNasalRimJet.transverse} #a57f5eb Read transverse beside tangent to preserve the aperture-plane frame and its signed normal relationship.
 * @evidence {@link Human.IPortraitNasalApertureFrame} Groups the origin and inward axis of one fitted nasal aperture plane.
 * @evidenceReview {@link Human.IPortraitNasalApertureFrame} #308170b Read copied origin/inward values beside aperture sizing and tilt. The frame is local to the authored rim and does not replace the nose's shared skin support.
 * @evidence {@link Human.IPortraitNasalApertureFrame.origin} Locates the fitted aperture plane in the construction frame.
 * @evidenceReview {@link Human.IPortraitNasalApertureFrame.origin} #9565747 Read origin beside centroid-preserving aperture resizing and finite point checks.
 * @evidence {@link Human.IPortraitNasalApertureFrame.inward} Selects the aperture plane's inward direction.
 * @evidenceReview {@link Human.IPortraitNasalApertureFrame.inward} #9297734 Traced inward into plane-normal orientation and the signed rim/cavity relationship; it is not an independent nose projection amount.
 * @evidence {@link Human.IPortraitNasalBodyStation} Defines one ordered lower-nasal station and its midline, shoulder and alar extents.
 * @evidenceReview {@link Human.IPortraitNasalBodyStation} #d614402 Read the four station fields beside the C1 longitudinal interpolator; endpoint extents and ordering remain explicit profile invariants.
 * @evidence {@link Human.IPortraitNasalBodyStation.height} Locates one lower-nasal station along head Y.
 * @evidenceReview {@link Human.IPortraitNasalBodyStation.height} #b79e800 Read increasing height into station spans and endpoint sampling.
 * @evidence {@link Human.IPortraitNasalBodyStation.centre} Sets the midline forward extent at one station.
 * @evidenceReview {@link Human.IPortraitNasalBodyStation.centre} #66bedc7 Traced centre into the midline transverse section and its zero-end admission.
 * @evidence {@link Human.IPortraitNasalBodyStation.shoulder} Sets paired lower-tip shoulder extent at one station.
 * @evidenceReview {@link Human.IPortraitNasalBodyStation.shoulder} #af540a8 Read shoulder into the paired transverse supports beside the station interpolator.
 * @evidence {@link Human.IPortraitNasalBodyStation.ala} Sets paired alar-body extent at one station.
 * @evidenceReview {@link Human.IPortraitNasalBodyStation.ala} #db3554e Read ala into the paired alar supports and peak-phase calculation.
 * @evidence {@link Human.IPortraitNasalBodyShape} Groups the ordered lower-nasal stations and independent midline, shoulder, alar and crease controls.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape} #b8092fb Read copied stations and all transverse controls beside the connected lower-nose evaluator. The profile owns one shared surface field and leaves aperture pose to its separate owner.
 * @evidence {@link Human.IPortraitNasalBodyShape.stations} Supplies ordered longitudinal samples whose endpoint extents join the surrounding surface.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.stations} #ef04243 Traced ordered station admission, zero endpoint extents and harmonic-mean slope construction through the body evaluator.
 * @evidence {@link Human.IPortraitNasalBodyShape.centreWidth} Sets the midline transverse half-width.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.centreWidth} #04d83a2 Read centreWidth into the midline envelope and positive-width admission.
 * @evidence {@link Human.IPortraitNasalBodyShape.shoulderOffset} Sets paired shoulder distance from the midline.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.shoulderOffset} #73a4735 Read shoulderOffset into the paired shoulder envelopes and nonnegative admission.
 * @evidence {@link Human.IPortraitNasalBodyShape.shoulderWidth} Sets each shoulder transverse half-width.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.shoulderWidth} #9ea34ff Read shoulderWidth into the shoulder envelopes beside positive-width checks.
 * @evidence {@link Human.IPortraitNasalBodyShape.alarOffset} Sets paired alar distance from the midline.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.alarOffset} #9f8125e Traced alarOffset into the paired alar transverse supports.
 * @evidence {@link Human.IPortraitNasalBodyShape.alarWidth} Sets each alar transverse half-width.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.alarWidth} #ec97130 Read alarWidth beside the positive transverse-domain admission.
 * @evidence {@link Human.IPortraitNasalBodyShape.fullness} Adds independent right/left alar forward extent at the profile peak.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.fullness} #90cee34 Read the two side-qualified fullness values through alar phase; zero peak disables this optional term.
 * @evidence {@link Human.IPortraitNasalBodyShape.spread} Adds independent right/left lateral support at the alar peak.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.spread} #a961178 Traced signed side spread through the lateral output and preserved anatomical handedness.
 * @evidence {@link Human.IPortraitNasalBodyShape.creaseOffset} Sets lateral distance from each alar centre to its facial crease.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.creaseOffset} #059f25b Read creaseOffset into the paired crease envelopes beside nonnegative admission.
 * @evidence {@link Human.IPortraitNasalBodyShape.creaseWidth} Sets each alar-facial crease half-width.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.creaseWidth} #2704044 Read creaseWidth into crease recession support beside positive-width checks.
 * @evidence {@link Human.IPortraitNasalBodyShape.crease} Adds independent right/left crease recession at the alar peak.
 * @evidenceReview {@link Human.IPortraitNasalBodyShape.crease} #83e7b6e Traced signed right/left crease values into the forward field and the absent-alar refusal.
 * @evidence {@link Human.createPortraitNasalBody} Builds the connected lower-nasal surface field from ordered stations and transverse controls.
 * @evidenceReview {@link Human.createPortraitNasalBody} #caeff2b Read copied array inputs, station slope limiting, endpoint joins, transverse envelopes and finite output checks. Midline, shoulder, alar and crease controls share one field rather than overlapping detached shells.
 * @evidence {@link Human.portraitNasalViewRay} Derives the image-depth ray from the captured horizontal and vertical camera rows.
 * @evidenceReview {@link Human.portraitNasalViewRay} #e91e045 Read finite three-component admission, normalized cross product and independent-axis refusal. The ray preserves image-plane coordinates for nasal depth controls and does not itself alter geometry.
 * @evidence {@link Human.IPortraitNasalSectionStation} Defines one transverse depth-control row of the optional nasal loft.
 * @evidenceReview {@link Human.IPortraitNasalSectionStation} #e2d459b Read station height and ordered depth poles beside the cubic loft's axis mapping. The row supplies authored controls rather than sampled source vertices.
 * @evidence {@link Human.IPortraitNasalSectionStation.height} Locates a nasal loft row along local head Y.
 * @evidenceReview {@link Human.IPortraitNasalSectionStation.height} #beb4849 Read increasing heights into the open-uniform station axis and its finite spacing checks.
 * @evidence {@link Human.IPortraitNasalSectionStation.depths} Supplies the ordered local head-Z poles for one station.
 * @evidenceReview {@link Human.IPortraitNasalSectionStation.depths} #63262ba Traced depth poles into the tensor-product control grid and depth-hull interpolation.
 * @evidence {@link Human.IPortraitNasalSection} Groups transverse poles, station rows and bounded identity-transition controls.
 * @evidenceReview {@link Human.IPortraitNasalSection} #285c27c Read copied axes, station rows, join width and influence beside the loft evaluator. The optional field is a single connected depth authority and leaves aperture pose to its separate owner.
 * @evidence {@link Human.IPortraitNasalSection.transverse} Supplies the strictly increasing local-X control positions.
 * @evidenceReview {@link Human.IPortraitNasalSection.transverse} #8ef8a98 Read transverse poles into the normalized inversion and four-to-64 control bound.
 * @evidence {@link Human.IPortraitNasalSection.stations} Supplies strictly increasing local-Y control rows.
 * @evidenceReview {@link Human.IPortraitNasalSection.stations} #2e231a7 Read station rows into the tensor-product grid and matching depth-array admission.
 * @evidence {@link Human.IPortraitNasalSection.joinWidth} Sets the positive identity-transition width at the domain edges.
 * @evidenceReview {@link Human.IPortraitNasalSection.joinWidth} #d0a3e18 Traced joinWidth into the half-span bound and quintic edge transition.
 * @evidence {@link Human.IPortraitNasalSection.influence} Sets the bounded blend from host depth to the local loft.
 * @evidenceReview {@link Human.IPortraitNasalSection.influence} #1b124cc Read influence into the [0,1] blend, where zero preserves host identity.
 * @evidence {@link Human.createPortraitNasalSection} Evaluates the optional continuous nasal depth loft against a translated host datum.
 * @evidenceReview {@link Human.createPortraitNasalSection} #e2fe69c Read copied inputs, open-uniform cubic evaluation, physical-coordinate inversion, edge transition and finite output/refusal paths. The loft's bounded scalar depth does not assert post-subdivision likeness or global intersection safety.
 * @evidence {@link Human.samplePortraitNasalSection} Interpolates one nasal section jet while retaining its point and derivative.
 * @evidenceReview {@link Human.samplePortraitNasalSection} #c38fee2 Read signed span interpolation, endpoint derivative scaling and finite output guards beside aperture consumers. The helper is a local section operation and does not choose the finished nose depth.
 * @evidence {@link Human.portraitNasalJetCorrection} Extends a nasal boundary jet toward an unchanged far end.
 * @evidenceReview {@link Human.portraitNasalJetCorrection} #ec044ca Read signed-distance orientation, derivative reversal and clamped section progress beside nasal entry construction. The correction preserves one local jet and does not refit the outer aperture.
 * @evidence {@link Human.portraitNasalRimJets} Derives tangent/transverse rim jets from the shared aperture points, normals and exterior samples.
 * @evidenceReview {@link Human.portraitNasalRimJets} #f0861d7 Read cyclic tangent, normalized common normal, exterior-side sign agreement and degenerate refusal. The result fixes a local rim frame for lining and does not add a separate rim shell.
 * @evidence {@link Human.samplePortraitNasalEntry} Samples the connected vestibular meridian from a shared rim jet and aperture frame.
 * @evidenceReview {@link Human.samplePortraitNasalEntry} #f8e842b Read finite jet/frame admission, contracted middle section and common floor pole construction. This is an authored lining approximation and not an airway or likeness model.
 * @evidence {@link Human.createPortraitNasalBodySurface} Adapts a lower-nasal body field to the shared skin surface and its recorded view ray.
 * @evidenceReview {@link Human.createPortraitNasalBodySurface} #4c68f39 Read all three final-shape branches, the mixed-alternative refusal and the shared lining-edge distance calculation. Local ellipsoid targets bind copied pre-fit datums and use head Z with a half-reach plateau; complete body/loft alternatives retain their earlier support. The rim fade and lining exclusion remain prior constraints, not a repair of an incorrect aperture. Hand sphere and half-weight scenarios inspect the new branch; this source review is not a likeness acceptance.
 * @evidence {@link Human.IPortraitNoseSocket} Binds procedural nasal controls and original opening faces to the measured host.
 * @evidenceReview {@link Human.IPortraitNoseSocket} #f8ffe94 Read all ten binding members with exterior depth, target collection and opening extraction. Coordinates and influence radii belong to the subject frame; surface vertex IDs and nostril face ordinals have different meanings. The factory copies its arrays before fitting rather than retaining a mutable preset binding.
 * @evidence {@link Human.IPortraitNoseSocket.midline} Defines the symmetry datum for basic nasal depth and overall width.
 * @evidenceReview {@link Human.IPortraitNoseSocket.midline} #8a8de57 Located subtraction of midline in portraitNoseDepth and the midline+(x-midline)*widthScale transform on exterior and rim targets. Changing this datum translates the basis of both operations; it is not an independent left-alar offset.
 * @evidence {@link Human.IPortraitNoseSocket.tipY} Locates the basic tip envelope vertically in construction millimetres.
 * @evidenceReview {@link Human.IPortraitNoseSocket.tipY} #b7b503d Read its subtraction from point Y before normalization by tipRadius[1] and the Gaussian exponential. It moves the influence centre without changing tipProjection's signed amplitude or the supplied host topology.
 * @evidence {@link Human.IPortraitNoseSocket.tipRadius} Separates horizontal and vertical spread of the basic tip envelope.
 * @evidenceReview {@link Human.IPortraitNoseSocket.tipRadius} #1452eca Followed the copied X/Y pair into the two squared normalized distances in portraitNoseDepth. These radii govern decay in the image-facing plane; they do not specify a third depth radius or directly set tip projection.
 * @evidence {@link Human.IPortraitNoseSocket.alarOffset} Places the paired basic alar influence centres about the midline.
 * @evidenceReview {@link Human.IPortraitNoseSocket.alarOffset} #fc03726 Compared abs(x-midline)-alarOffset with the tip's single central term. The absolute value gives paired centres at equal horizontal distances; asymmetric explicit lobules are a separate optional representation.
 * @evidence {@link Human.IPortraitNoseSocket.alarY} Positions both basic alar envelopes along the vertical axis.
 * @evidenceReview {@link Human.IPortraitNoseSocket.alarY} #7b303b1 Read the pointY-alarY term in the alar Gaussian beside the independent tipY term. It relocates where alarProjection acts and does not translate the fitted nostril opening, whose rise control is applied later.
 * @evidence {@link Human.IPortraitNoseSocket.alarRadius} Supplies the common planar spread of each basic alar envelope.
 * @evidenceReview {@link Human.IPortraitNoseSocket.alarRadius} #92d873f Traced this denominator through both the lateral distance from an alar centre and the vertical distance from alarY. The basic envelope therefore uses one spread for both axes; it is not an independently shaped alar cross-section.
 * @evidence {@link Human.IPortraitNoseSocket.surface} Selects retained skin identities receiving direct exterior targets.
 * @evidenceReview {@link Human.IPortraitNoseSocket.surface} #8a5393e Read the loop that inserts width/depth targets into one Map keyed by host vertex. Later fitted-rim targets replace entries at shared rim IDs within the same component. These are vertex identities, not triangles to remove.
 * @evidence {@link Human.IPortraitNoseSocket.nostrils} Supplies original host-face populations for the procedural nasal openings.
 * @evidenceReview {@link Human.IPortraitNoseSocket.nostrils} #89515a5 Followed each copied ordinal list into host.indices slices, boundary extraction and the flattened cutFaces result. Lining is built from the resulting fitted rim. The head validates original cut ordinals and duplicate removal before attachment; the field does not describe a painted footprint.
 * @evidence {@link Human.IPortraitNoseSocket.sectionAnchor} Names the retained datum used by optional section or final-body construction.
 * @evidenceReview {@link Human.IPortraitNoseSocket.sectionAnchor} #56a1828 Checked that a selected section/body requires an integral resident ID with finite XYZ. Pre-fit section evaluation reads its original position, while the final body receives the retained identity for its later surface stage. Without either representation the datum is not required.
 * @evidence {@link Human.IPortraitNoseShape} Separates exterior, opening, lining and optional complete-basis controls.
 * @evidenceReview {@link Human.IPortraitNoseShape} #ca3e376 Read the complete nasal shape contract, including independent post-refinement envelopes per socket opening. Empty/omitted arrays retain legacy construction; a selected envelope replaces legacy rim and final-body authorities. Local final-lobule and depth-scale admission remain unchanged. Capability is separate from photographic acceptance.
 * @evidence {@link Human.IPortraitNoseShape.widthScale} Scales exterior and opening targets about the subject midline.
 * @evidenceReview {@link Human.IPortraitNoseShape.widthScale} #5c5cd6f Traced its positive finite admission and the same X transform in both target paths. The lining inherits the fitted rim's width rather than applying this multiplier again; local aperture-plane scaling remains a preceding operation.
 * @evidence {@link Human.IPortraitNoseShape.lobules} Optionally replaces local nasal body sections with independently bound ellipsoidal detail.
 * @evidenceReview {@link Human.IPortraitNoseShape.lobules} #b1fcaea Read the owned binder on support-scaled skin and its use by the common depth evaluator for exterior and rim samples. Empty/omitted populations are neutral; a nonempty population cannot accompany a complete section/body basis. The optional data is absent from the restored active preset.
 * @evidence {@link Human.IPortraitNoseShape.tipProjection} Sets signed anterior relief of the basic central tip envelope.
 * @evidenceReview {@link Human.IPortraitNoseShape.tipProjection} #acece74 Located multiplication of the tip Gaussian and its addition to alar relief in portraitNoseDepth. The constructor requires finiteness but permits either sign. It is an amplitude, while the socket supplies the centre and planar spreads.
 * @evidence {@link Human.IPortraitNoseShape.alarProjection} Sets signed anterior relief of the paired basic alar envelopes.
 * @evidenceReview {@link Human.IPortraitNoseShape.alarProjection} #86bfac1 Read multiplication of the abs-midline alar term separately from the tip term. The cutout scenario exercises positive alar relief with negative tip relief and verifies decay at remote points. This scalar alone does not establish round alar tissue.
 * @evidence {@link Human.IPortraitNoseShape.nostrilWidthScale} Changes width inside each fitted aperture plane before global nasal scaling.
 * @evidenceReview {@link Human.IPortraitNoseShape.nostrilWidthScale} #e05a52f Followed the positive finite value into resizePortraitNostrilRim after ellipse fitting. Overall widthScale is applied afterward in head X, so the local factor is not necessarily the final projected width ratio.
 * @evidence {@link Human.IPortraitNoseShape.nostrilHeightScale} Changes the aperture's local height independently of its width.
 * @evidenceReview {@link Human.IPortraitNoseShape.nostrilHeightScale} #eea407d Read its separate argument to the same rim-resizing owner and its positive-domain check. The later host-X tilt rotates the already resized opening; reducing this factor does not move the tip influence centre.
 * @evidence {@link Human.IPortraitNoseShape.nostrilRise} Adds one vertical translation to each fitted opening.
 * @evidenceReview {@link Human.IPortraitNoseShape.nostrilRise} #82b11a6 Located the signed addition in the final rim Y target. The lining subsequently computes its centre from those actual fitted rim positions, carrying the translation without adding rise a second time.
 * @evidence {@link Human.IPortraitNoseShape.nostrilTilt} Rotates the opening and cavity travel about the same host-X convention.
 * @evidenceReview {@link Human.IPortraitNoseShape.nostrilTilt} #28e98c6 Compared the degree-to-radian conversion in fitting and lining construction. The rim rotates about its depth-adjusted centre, and the cavity offset uses the same Y/Z rotation; positive tilt rotates a forward normal toward negative Y.
 * @evidence {@link Human.IPortraitNoseShape.cavityContraction} Sets the retained fraction of the fitted rim at the deep lining ring.
 * @evidenceReview {@link Human.IPortraitNoseShape.cavityContraction} #10fe504 Checked strict (0,1) admission and the factor 1-fraction*(1-contraction) applied to rim offsets about their centre. At fraction one the deep ring retains the configured fraction; the floor instead uses centre plus cavity travel.
 * @evidence {@link Human.IPortraitNoseShape.rimSupport} Positions an intermediate lining ring before the full cavity travel.
 * @evidenceReview {@link Human.IPortraitNoseShape.rimSupport} #5f85335 Read strict (0,1) admission and the two fractions [rimSupport,1] used by appendPortraitNostrils. The intermediate ring applies only its fraction of contraction and rotated offset, retaining support near the shared aperture before the deeper ring.
 * @evidence {@link Human.IPortraitNoseShape.rimRoundness} Blends the authored boundary toward the fitted ellipse before resizing and tilt.
 * @evidenceReview {@link Human.IPortraitNoseShape.rimRoundness} #22f9253 Followed finite [0,1] admission into fitPortraitNostrilRim on already depth-adjusted points. This controls the opening curve, not the surrounding alar body's roundness; the later transformations still determine its final placement.
 * @evidence {@link Human.IPortraitNoseShape.rimSection} Optionally inserts an exterior skin band sharing the fitted lining boundary.
 * @evidenceReview {@link Human.IPortraitNoseShape.rimSection} #e9daf13 Read copied section settings, exterior normals computed without the cut faces, band construction and the new inner-loop IDs handed to lining. Omission uses direct skin-to-lining attachment. This route remains unselected in the restored baseline.
 * @evidence {@link Human.IPortraitNoseShape.cavityOffset} Supplies relative XYZ travel from the fitted opening to the cavity floor.
 * @evidenceReview {@link Human.IPortraitNoseShape.cavityOffset} #552c178 Checked owned length-three finite input, the shared tilt applied to Y/Z, fractional travel at support rings and full travel at the floor centre. The cutout oracle places its translated floor at [10,-12,55]mm; it does not infer a new absolute floor origin.
 * @evidence {@link Human.IPortraitNoseShape.blendReach} Controls neighbouring original-skin adaptation around nasal fitting targets.
 * @evidenceReview {@link Human.IPortraitNoseShape.blendReach} #79fdf65 Read nonnegative finite admission and the same reach on every collected constraint. Zero affects only the exact fitting pins at that stage; subsequent shared refinement is a different operation and can still affect adjacent samples.
 * @evidence {@link Human.IPortraitNoseShape.section} Selects a connected pre-fit depth basis around the socket datum.
 * @evidenceReview {@link Human.IPortraitNoseShape.section} #d628b72 Traced creation of the owned section evaluator and its displacement in baseDepth used by both exterior and rim samples. A selected final body or nonidentity depthScale conflicts with this basis, while explicit basic tip/alar amplitudes remain additional signed terms.
 * @evidence {@link Human.IPortraitNoseShape.body} Selects optional exterior shaping after shared refinement and surface layers.
 * @evidenceReview {@link Human.IPortraitNoseShape.body} #63b06e4 Read copied shape ownership and the final-hook handoff of sculpted source datums. Additive and loft bases still refuse nonidentity depthScale; local final lobules retain that scale while refusing pre-fit lobules or a complete section. Their depth plateau, rim precedence and empty-array identity are explicit. No current portrait is accepted by selecting this field.
 * @evidence {@link Human.portraitNoseDepth} Evaluates the basic central-tip and paired-alar relief in the socket frame.
 * @evidenceReview {@link Human.portraitNoseDepth} #baff3ae Read both Gaussian expressions and their independent signed amplitudes. Tip spread uses separate X/Y radii; alar spread uses one radius and absolute lateral distance. The result is a Z displacement, not an absolute surface depth or a reconstructed cartilage volume.
 * @evidence {@link Human.portraitNostrilContains} Classifies points strictly inside an authored elliptical footprint during binding.
 * @evidenceReview {@link Human.portraitNostrilContains} #aeefd6c Checked the normalized squared-distance sum and strict less-than-one boundary convention. The cutout scenario keeps both nasal centres inside while an exact vertical boundary, its outside neighbour and the midline are outside; this helper does not cut geometry itself.
 * @evidence {@link Human.appendPortraitNostrils} Builds support rings and closed cavity floors from the fitted shared aperture.
 * @evidenceReview {@link Human.appendPortraitNostrils} #2a6c7ca Read the complete legacy lining builder and extracted cavityOffset calculation. The same arithmetic rotates the original XYZ offset once; centroid, contracted rings, oriented quads and floor fan remain unchanged. New envelopes share the offset helper but construct their lining through shared jets.
 * @evidence {@link Human.createPortraitNasalSupport} Resolves nasal projection from one subject-bound facial support plane.
 * @evidenceReview {@link Human.createPortraitNasalSupport} #ad8584c Read positive ratio admission, exact neutral return, owned datums, normalized plane solution and finite query/displacement refusal. The independent z=y/2 case retains support points and scales a four-millimetre height by one half under translation. This is a projection relationship, not tip curvature or recovered anatomical depth.
 * @evidence {@link Human.IPortraitNoseSocket.supportPlane} Supplies the shared nasal root and facial-base reference identities.
 * @evidenceReview {@link Human.IPortraitNoseSocket.supportPlane} #772061a Read copied optional IDs and the nonidentity-only resident check before createPortraitNasalSupport. Omitted or unit depth scaling passes no datums and remains neutral; nonidentity scaling requires a usable three-point plane. This binds projection to source skin rather than world Z=0.
 * @evidence {@link Human.IPortraitNoseShape.depthScale} Selects the shared nasal projection basis used by exterior and rim fitting.
 * @evidenceReview {@link Human.IPortraitNoseShape.depthScale} #7a85507 Traced positive finite admission, the unit/omitted neutral path and refusal to stack a nonidentity scale with a complete section/body basis. The shared support displacement enters the same depth evaluator used for exterior and aperture fitting. The restored preset again uses this procedural basis with its original support layer.
 * @evidence {@link Human.IPortraitNoseShape.rimRefinement} Selects the existing shared curve rule for the skin/lining aperture identities.
 * @evidenceReview {@link Human.IPortraitNoseShape.rimRefinement} #d415829 Read omitted/surface as ordinary Loop refinement and curve as the actual fitted skin/lining loop returned by attach. The one-dimensional curve rule preserves shared identities while changing their refinement weights. It does not add a detached rim or promise a correct alar body.
 * @evidence {@link Human.IPortraitNasalRimSection} Separates exterior tissue width from the fitted aperture and its crest relief.
 * @evidenceReview {@link Human.IPortraitNasalRimSection} #9761008 Read positive physical width and signed normal projection in millimetres. These describe the new skin band, while aperture scaling/pose and vestibular depth remain with their existing owners. Omission selects the original direct attachment.
 * @evidence {@link Human.createPortraitNasalRimSection} Derives outer and crest rings from the actual aperture's shared normals and existing rim jets.
 * @evidenceReview {@link Human.createPortraitNasalRimSection} #50e6e63 Read copied aperture and sculpted-skin normals, normalized outward rim jets and the distinct outer/crest offsets. The inclined-normal oracle moves [2,0,0] to [2.8,0,-0.6] without moving the opening. The operation does not use an aperture-plane normal as a substitute for skin tangent.
 * @evidence {@link Human.appendPortraitNasalRimSection} Connects resident outer skin identities through a new crest to the lining-owned inner loop.
 * @evidenceReview {@link Human.appendPortraitNasalRimSection} #4c8f00e Read both annuli, skin labels, copied coordinates and returned inner IDs. The nose shares those IDs with vestibular lining and subdivision, preserving one attachment boundary. Whether an optional wide band resembles a particular photographed ala remains an image judgement.
 * @evidence {@link Human.resizePortraitNostrilRim} Changes aperture dimensions inside its fitted plane without independently flattening the rim.
 * @evidenceReview {@link Human.resizePortraitNostrilRim} #df4cbc8 Read projected head-X width, the exact-X-normal head-Y guide, perpendicular height and retained normal residual. Unit scales copy all points exactly. The component applies overall nasal width and tilt later, so these local factors do not guarantee the same final footprint after a body-depth change.
 * @evidence {@link Human.fitPortraitNostrilRim} Regularizes an authored nasal cut boundary while preserving cyclic vertex ownership and centroid.
 * @evidenceReview {@link Human.fitPortraitNostrilRim} #2d0ae67 Traced normalized fitting coordinates, area normal, principal ellipse axes, perimeter phase and recentering. Zero amount preserves input exactly; a nonzero fit changes the sampled shape in its own plane. The cut points remain authored bindings rather than a measured physical nostril outline.
 * @evidence {@link Human.IPortraitNasalLobule} Declares a resident datum, apex offset, three physical radii and normalized inner section extent for each local nasal body.
 * @evidenceReview {@link Human.IPortraitNasalLobule} #8de79e8 Read the head XYZ/millimetre frame, physical half-extents, core [0,1) domain and optional dz/dx,dz/dy tangent. Separate array members allow asymmetric alae; the section pole is not necessarily the maximum head-Z point when its tangent is inclined. None of these inputs is asserted as a measured cartilage value.
 * @evidence {@link Human.createPortraitNasalLobules} Binds copied local ellipsoid sections to support-scaled skin before exterior and rim fitting.
 * @evidenceReview {@link Human.createPortraitNasalLobules} #75a681c Read owned resident datums, support-relative anterior ellipsoid section, optional affine tangent, cubic identity annulus and normalized overlap. The numerical radius and inclined-plane oracles cover the local evaluator; the shared nose carries its result to rim and lining. A valid field is not photographic tip/alar acceptance.
 * @evidence {@link Human.createPortraitNoseComponent} Fits procedural exterior and shared nasal openings before constructing their lining.
 * @evidenceReview {@link Human.createPortraitNoseComponent} #f4c8f8e Read the entire factory and fitting/attachment closures: copied profiles, alternative refusals, shared depth and aperture fitting, legacy attachment and final body dispatch. Selected envelopes receive the fitted rim and original normals, reserve their complete section before subdivision and replace it afterward. Omission retains the original computation; this does not accept the demonstration render.
 */
export const portraitNasalReview = { scope: "nasal construction inspection" };
