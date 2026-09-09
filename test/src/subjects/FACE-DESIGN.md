# Anatomical face construction

This design governs the direct studies and the later extraction of their demonstrated construction rules into `@automovie/human`. The current portrait remains unfinished. A valid mesh, an optional field or a reviewed formula does not establish a faithful likeness. The active source and its current capture, rather than this design, determine which capabilities have actually been demonstrated.

The [anatomical form and control inventory](FACE-ANATOMY.md) distinguishes the current active implementation, fixed internal form, insufficient detail, absent owners and required connections across the whole face. Read it before treating an existing component name or scalar as evidence that a visible anatomical requirement is expressible.

## Basic construction and optional detail {#basic-and-detail}

A component has a complete basic construction. Omitted detail invokes that construction; it does not produce an empty component or require an author to enumerate every anatomical constant. Detail is optional at the smallest independently meaningful owner. One eye can use its basic section while the other supplies a detailed lid, and a custom nose must not force custom ears or teeth.

The value shape follows the represented fact. A scalar can specify a distance or angle, a number array can supply profile samples, an object can collect a section's coupled dimensions, and an object array can describe unequal teeth or ordered surface sections. There is no universal scalar-slider representation and no blanket recursive merge. Each owner defines whether a supplied array replaces the complete ordered population or supplies explicitly identified members. Positional zipping and silent truncation are not resolution rules.

`undefined` invokes the declared default. Explicit zero, an empty array, an empty object and explicit absence of a component are separate states whose meaning belongs to that component. Zero displacement is neutral; zero RGB is black. Empty crowns can deliberately omit the dental population, while an empty mandatory closed boundary is invalid. A field's optionality never exempts a provided value from validation.

Detail has two distinct geometric meanings. A refinement adds a declared local displacement to a sound base. A replacement supplies the complete local curve, section or surface for the named owner. The type and its JSDoc identify which operation occurs. A complete replacement does not run a second competing shape basis underneath it. The nasal factory already refuses simultaneous pre-fit and final section bases; the same responsibility applies to every future alternative.

## Anatomical owners and groups {#anatomical-owners}

A component owns form; a group owns the arrangement and interfaces of its members. These responsibilities do not prescribe one visible mesh per anatomical name. Cheek support can be a named region on shared skin. An eyeball and a moving lid have distinct surfaces and a contact relationship. A tooth remains individually addressable inside a group-owned arch even if delivery combines its buffers with other enamel.

| Group | Form owners | Group-owned relationships |
| --- | --- | --- |
| Head | Cranium, forehead/temporal envelope, jaw/chin surface, neck connection | Common head frame, cranial extent, mandibular and neck attachment references |
| Each orbit | Globe, cornea, iris/pupil, upper/lower lid sections, medial tissues, brow/lashes | Aperture, canthi, gaze, optical placement, surrounding-skin join |
| Nose | Dorsum, tip shoulders/domes, alar bodies, columella, aperture rims, vestibular lining | Nasal frame, shared section boundaries, aperture pose, outer facial attachment |
| Oral/perioral | Upper/lower vermilion, philtral region, commissures, oral cavity, dental groups | Curved mouth frame, opening, lip-to-skin joins, lip/cheek junction and dental attachment |
| Each dental arch | Individual crowns, visible gingival or other oral tissue where required | Arch curve, common gingival reference, spacing/contact and one placement in the mouth |
| Each cheek | Malar, medial and buccal support; lower orbital and nasolabial transitions | Relative support volumes and their connection to the orbit, nose, mouth corner and jaw |
| Each ear | Helix, antihelix, concha, tragus/antitragus region, lobule and root | Pinna frame, attachment, orientation and exposed silhouette |
| Hair/brow context | Scalp envelope, coarse hair masses and brow strands | Host-surface attachment, coverage and collisions with the ears and face |

The required rendered effect determines whether a missing responsibility needs another component, another subpart, a new parameter or a different representation. Naming every anatomical structure is not completion. Internal anatomy becomes explicit when its external form, attachment, articulation or visible interior requires it. Detailed scalp hair remains a later roadmap phase; the present hair must still form coherent context and preserve the required exposed ear.

## Frames, units and derivation {#frames-and-derivation}

Construction uses millimetres, +Y up, +Z anterior and +X anatomical left. `portraitPart` remains the single millimetre-to-metre conversion for delivered AutoMovie geometry. A component's local origin and axes derive from its group references. Subject-specific landmark IDs belong to socket data, never to a general component implementation.

A group resolves its arrangement once from the common basis. Every dependent surface, material volume and attachment consumes that result. A larger globe must move the lid's declared contact calculation; a different crown must participate in the same arch arrangement; a new ear must attach to the current host. An accessory does not independently estimate a point that the host already computes.

Input data is owned at component construction or explicitly evaluated against an immutable current host. A later caller mutation cannot alter an already constructed instance. Components fitting in one stage read the same unchanged host; reordering independent components cannot change their geometry. Conflicting ownership of a shared vertex or boundary is refused rather than resolved by call order.

The measured subject distinguishes observed image coordinates from inferred depth, pose and hidden anatomy. A library default is an authored construction choice, not a universal human measurement. Residuals, fitted presets and adopted mesh data retain the exact basis against which they were defined. Changing that basis requires regeneration of every dependent fit.

## Curves, sections and complete surface replacement {#surface-representation}

The reference-patch joining annulus needs its own surface calculation. Projecting its final vertices independently onto the donor depth sheet was rejected because it created deep outer grooves and inner notches. The replacement calculation minimizes a cotangent squared-Laplacian energy inside the joining region while keeping its shared boundaries, adjacent host and native donor core fixed. Unknowns travel only along the declared view ray. Boundary-adjacent energy rows retain the influence of the fixed neighbouring surfaces; the solver must report nonconvergence instead of silently publishing a partial result. This is a discrete fairing construction, not a guarantee of exact tangent continuity or anatomical likeness. The complete colour/clay view set must judge both seams after every change.

The default may use a compact control cage or named support fields. Detailed shape must be able to state section position, curvature, volume, boundary and connection directly. An arbitrary collection of inflation coefficients is insufficient when the desired contour cannot be expressed by their combined support.

The existing nasal section primitives provide physical position/derivative jets and cubic interpolation. A detail representation can supply ordered sections or a control net in the component frame. The owner declares its parameter domain, units, interpolation, endpoint conditions and which rows or boundaries have a shared authority. A tangent vector is not interchangeable with a unit normal, and equal shading normals do not establish the required surface section.

A complete detailed component uses the existing fit/cut/attach protocol to replace its owned region when needed. It is not restricted to editing Z on the old skin. Its outer boundary is anatomical and group-owned. A rectangular fade can be useful for a bounded deformation, but it is not a substitute for the perimeter and transition of a whole nose, lip or ear.

An optional coupled control field can retain sound topology while replacing one region's independent support amplitudes. Each anatomical control specifies the total XYZ movement at its position. A shared interpolation solve includes the neighbouring controls, including explicit zero anchors, before it emits the engine's existing compact fields. `portraitControlLayer.ts` obtains its matrix values from that same engine evaluator and retains the engine's differential and emitted-triangle checks. This is a volume deformation of existing skin and lining, not new topology or a claim to have reconstructed cartilage. Close or singular control populations are refused; open-rim protection remains owned by the surface assembler.

The assembler distinguishes continuity obligations. Homogeneous visible skin requires a coherent geometric transition. Separate surfaces such as teeth/lips and globe/lids require correct contact, overlap or clearance; welding them into one mesh would erase the physical interface. The component design specifies which condition applies and supplies the numerical and rendered observations that could falsify it.

## Nasal construction {#nasal-construction}

Optional `nose.depthScale` scales signed anterior height from a common skin-support plane through the nasal root and two facial-base datums. Those subject-owned identities live in `noseSocket.supportPlane`. The same calculation precedes both exterior fitting and nostril-rim fitting, so aperture and lining respond to the changed projection basis. Omission or one preserves the basic geometry; another section/body replacement cannot be selected simultaneously with nonidentity depth scaling. This controls projection, not tip/alar curvature, and a smaller depth alone does not complete the nose's rounded form.

Detailed nasal form owns the outer nose, nostril rim and vestibular transition together. The dorsum, paired tip and alar sections, columella and nasal sill have distinct geometric controls, but adjacent sections share their position and derivative data. The surrounding face connects through the group's outer perimeter. A preserved old aperture is not automatically the correct boundary for every new outer shape.

Aperture width, height, position and orientation are explicit group facts. Changing an exterior volume does not silently refit their plane. When the authored nose changes both exterior and aperture, the group resolves both from the selected input and rebuilds their common joins. The vestibular meridian starts at the same rim jet consumed by the exterior; it does not independently reconstruct the rim from a centroid and guessed offset.

The current optional final grid is a mathematical capability with an unaccepted portrait fit. Its rejected capture showed a rectangular surrounding transition and a doubled underside despite valid topology. The next complete nasal construction therefore addresses the outer perimeter, section field and vestibular connection as one relationship. Increasing grid resolution or changing coefficients alone does not discharge that requirement.

## Ocular construction {#ocular-construction}

`orbitalSupport.ts` gives each upper orbit independent forehead, brow-pad and superior-sulcus section witnesses. Every sample queries the actual shared skin before the coupled control solver prescribes its signed anterior movement. A zero forehead target constrains the neighbouring pad, rather than adding another independent bump. The existing surface assembler protects open eyelid margins, and brow fibres query the resulting final skin. Omission of this layer preserves the earlier measured support. This is a regional form-control representation, not a reconstructed bone/fat volume; longitudinal curvature between sparse witnesses and their skin transitions still require full and close renders.

Each eye separates aperture/canthi, lid section, underlying globe, corneal optics, iris/pupil and medial tissue. Width and opening height do not stand in for lid thickness, fold shape, hood, lower roll or orbital-to-cheek support. Optional detail can provide separate upper/lower sections and independent left/right inputs while retaining one group frame and gaze relationship.

The current eye factory already owns its corneal material and optional pigment profile. Pigment uses linear RGB endpoints, and its presence changes material binding without changing geometry. Corneal curvature, shell thickness, index of refraction and apparent iris position remain coupled physical/presentation questions. A dark iris or an enlarged eye does not establish a faithful lid contour.

The final skin boundary and the curves used by ocular interiors must be compared numerically and in a close render. Resampling a few retained witnesses is an approximation whose error must be measured before it is treated as the actual full boundary. Partial embedding of a lash tube is not automatically a defect; the required visible edge and its host contact determine the criterion.

Optional `lowerLidProfile` supplies ordered medial-to-lateral witnesses of complete lower-tissue sections. Each section locates the margin, pretarsal crest and lower shoulder, subtarsal inner/outer boundary, preseptal sample and live skin attachment. Offsets are positive ordered millimetre distances along the local outward aperture normal; projections are signed millimetres relative to the shared globe-to-skin bridge. Cubic smoothstep interpolates all section dimensions with the same weights. The eye uses a sine canthal fade to blend these target sections into the basic endpoint construction, then shares and refines the resulting skin. It does not add the new section's projection to the old lower-roll amplitude. Omission reproduces the complete prior geometry exactly. This representation is implemented; the first portrait section values remain an unaccepted rendering hypothesis.

The optional `cornealBoundary: "limbus"` retains a complete circular shell; `lidContact: "cornea"` additionally projects the actual shared refined eyelid region against that same resident optical mesh. Both drawing and contact call the same corneal builder. Contact uses the recorded view direction, keeps projection coordinates fixed and uses `lidThickness` as the metric clearance. The exact contact constraints enter the common geodesic skin adapter, with optional `lidContactReach` defaulting to 3 mm; explicit zero retains the pointwise-contact falsifier. The eyelid group retains shared vertices and skin material. Omitted contact or explicit `globe` keeps the basic rows. This is a directional sampled contact operation, not a global collision proof or a guarantee that the new tissue section is anatomically correct; both complete and close captures remain required.

Corneal contact also supplies the inner tissue basis before the lid sections are constructed. The same optical builder places that support on the resident cornea with zero additional clearance; the rows then supply their own thickness and bridge to actual outer skin. This gives the tissue section the boundary it must connect to, instead of constructing against the lower globe and relying on a later local projection to create a new raised patch. The final shared-skin check remains for residual penetration after subdivision and surface layers. The first contact-basis result still requires complete visual comparison.

The outer skin seam retains the sphere-projected aperture's gaze-independent planar frame. Inner contact can move along a slanted view ray; that XY difference fades to zero towards the outer seam using the section's existing bridge weight. The section therefore joins the real inner contact without allowing a gaze edit to drag its outer skin attachment. The component-parameter scenario retains this independent-seam oracle.

## Oral construction and dentition {#oral-construction}

Upper and lower lips use a curved smile frame. Independent section controls may define upper body, central tubercle, lower body/pads and cutaneous/vermilion/mucosal transitions. The outer skin border, oral aperture and commissures have explicit owners. Detail between fixed borders cannot correct a wrong border, and a border change must rebuild the surrounding skin and interior attachment.

The implemented optional `mouth.band.upper` and `mouth.band.lower` refine vertical vermilion thickness about the locally sampled inner boundary. Omission is identity; a scalar sets a central positive ratio, and an ordered knot array supplies a nonuniform ratio profile. Both retain ratio one at the corners. This changes the outer skin junction without conflating band thickness with opening scale or forward section relief. Host adaptation and final attachment still run after fitting, so final aperture and dental geometry must be checked as well as the control positions.

The mouth corner is a shared lip/cheek junction. Its relief is reviewed with the surfaces on both sides, the nasolabial transition and the oral opening. Adding a dark crease cannot replace the raised cheek and lower perioral surface that give the crease meaning.

Optional `mouth.borderRefinement: "curve"` makes the closed cutaneous-vermilion border own its one-dimensional subdivision, with the cubic 3/4, 1/8, 1/8 vertex rule and edge midpoints. The surrounding skin and lip faces share those vertices; final normals still use the whole connected surface. Omission or `surface` retains ordinary Loop weights. This separates the anatomical border from irregular opposite triangle vertices, but it can change the adjacent surface section and must be judged in clay as well as colour. It does not independently repaint, project or overlay the lip.

Individual crowns may differ in mesial/distal contour, incisal/cusp form, cervical section and labial/lingual surface. The arch owns their arrangement. A richer crown representation preserves the group's placement and recalculates any affected spacing/contact through that common arrangement. Gingiva, mucosa, lower teeth or tongue are added where the actual visible target or behavior requires them. They are not generic filler for unexplained dark gaps.

## Defaults, detail and later semantic controls {#control-resolution}

Resolution proceeds from declared defaults to the component's supplied detailed values, then to the group arrangement and assembled geometry. The result can explain which values were inherited and which were authored. Updating a default cannot silently overwrite an explicit detail value. Changing a group frame carries local detail through its documented coordinates instead of discarding it.

Array population changes preserve stable member identities where those members survive. Different counts, asymmetric parts and entirely different local topology are valid only when the required group interfaces remain resolvable. A missing required interface produces a specific diagnostic naming the owner and relationship.

High-level requests such as age and intuitive face-shape labels remain deferred until after the body and detailed hair phases. They will compose the detailed controls rather than replace them. The present basic-versus-detailed distinction does not advance that semantic layer prematurely.

## Evidence and verification {#evidence-and-verification}

Each retained design decision has an owning source contract or committed design address. JSDoc explains anatomical responsibility, frame, units, neutral/default meaning, signs, domain, formula, input ownership, joins, invariants and downstream effects. Current design intent remains in source; chronological experiments remain in Git, PR reviews and local capture records.

Pure tests use independent numerical oracles and finish within 500ms. The case matrix includes omitted/default detail, explicit neutral values, asymmetric inputs, array population changes, owned inputs, group-frame changes, boundary agreement, negative twins, invalid domains and unchanged unrelated regions. A type accepting a field is not proof that the final model responds to it. Sensitivity is measured after refinement, attachment and export.

Every visual iteration freezes its source, actual model/GLTF and capture profile. The fixed preview contains the complete fourteen-frame set and comparison sheets; close component views supplement the assembled head. The reviewer observes images independently, and the main modeler verifies causes against source and geometry. A new parameter, passing test, fresh fingerprint or green CI cannot accept an unresolved visible defect.

The current custom construction graph remains strict for structural/source relationships and permits only the designated rendered-freshness warnings. Its unfinished source-review population must be completed honestly. The repository requirement/specification/source triangle and a generated production's graph remain distinct contracts.

## Extraction into human {#human-extraction}

The direct study PR precedes the `human` package PR. The new package receives demonstrated reusable types, resolution rules, component builders and group calculations. Subject observations, fitted values and provenance remain in their authored study owner. Existing `face` remains dormant until its authorized retirement in the extraction phase.

The extraction PR changes `test` to consume the actual `human` package. It freezes the pre-extraction input, resolved parameters, model buffers, GLTF delivery and capture profile, then reproduces them through the new package path. IDs, ordering, units, materials and derived bindings are part of that equivalence. It republishes the complete render set at `.shots/face-experiment/preview`. A file move or passing unit suite alone does not complete extraction.

## Research basis and limits {#research-basis}

MPFB2 was inspected at commit `437dd513888a92399d1d3200d2e80859fae55abc`. Its target loader applies sparse offsets to a declared basis, and its face-service attachment transfer derives child offsets from three parent vertices. These are useful ownership examples. Its bundled target population is not our required feature inventory, and its support for custom targets prevents inferring an absolute expressive limit from that inventory alone. Code and asset licenses were read separately; no MPFB program code is adopted here. [Pinned implementation](https://github.com/makehumancommunity/mpfb2/tree/437dd513888a92399d1d3200d2e80859fae55abc)

The FLAME paper's model and coupled-registration sections distinguish identity, expression, pose, shape-dependent joints and refinement beyond the statistical model. They support separating a useful base from additional geometric freedom. Neither pretrained weights nor a fitting result were adopted. Its scan-based methods do not make one photograph sufficient to recover unseen anatomy. [FLAME paper](https://download.is.tue.mpg.de/flame/flame_paper.pdf)

Eye reconstruction research treats sclera, cornea and iris as coupled surfaces with different optical observations. The present schematic spheres and scalar materials remain approximations. [High-Quality Capture of Eyes](https://la.disneyresearch.com/wp-content/uploads/High-Quality-Capture-of-Eyes-Pub-Paper.pdf)

The nasal-profile study distinguishes external contour from underlying cartilage and reports individual soft-tissue variation. The dental anatomy lecture distinguishes crown surfaces, proximal contacts and cervical/incisal contour. They supply anatomical questions and terminology, not measurements of this adolescent subject or authority for our provisional coefficients. [Nasal profile study](https://pubmed.ncbi.nlm.nih.gov/19172735/), [Dental anatomy lecture](https://almaaqal.edu.iq/wp-content/uploads/2021/12/lec.4-permenant-maxillary-central-incisor.pdf)

## Local nasal lobule sections

The optional nasal construction replaces the tip/alar inflation layer with three explicit ellipsoidal anterior sections on shared skin. Each has a retained datum, an XYZ apex offset, transverse/vertical/depth radii, an optional tangent slope and a normalized inner extent. Inside that extent the section prescribes actual depth; its outer annulus joins the existing host smoothly. Overlapping sections use normalized weights and one combined host transition, so neither declaration order nor stacked inflation owns the join. Exterior and aperture samples evaluate the same surface before fitting their shared lining. Global depth scaling remains the support basis. The zero-slope preset produced sharp flared alae and was rejected. The alar tangent must reflect the nasal sidewall; all-forward-facing sections do not describe that relationship. These authored dimensions are fitting hypotheses, and full and close renders determine acceptance.

The nasal aperture has a separate optional `rimRefinement` rule. A fitted ellipse can still acquire concave turns when general subdivision pulls its vertices toward asymmetric exterior and lining triangles. The curve option uses the host's existing shared one-dimensional refinement on those same rim identities; it introduces neither a new overlay nor a hard normal crease. Omission retains the original surface rule. Forming the initial contour and preserving that contour during refinement are separate responsibilities, so the active trial pairs complete ellipse fitting with curve refinement.

The smooth aperture still pinches the adjacent skin. An optional rim section introduces an exterior skin band with physical width and crest projection. The original host cut becomes the band's outer attachment; the fitted aperture is a new inner loop shared with the vestibule. One intermediate crest loop joins them. The group derives outward co-normals from the ordered aperture tangents and the sculpted exterior skin normals, excluding faces that the aperture removes. An aperture-fan normal describes the opening plane and is not this skin tangent. That first frame produced a rejected double outline. The band shares its identities with both surfaces; omission preserves the original attachment exactly. Section dimensions remain authored hypotheses and the assembled colour/clay result remains the acceptance boundary.

## Complete reference patch study

The local nasal fits did not resolve the assembled surface. The study selects the complete nose from the existing attributed and fitted CC0 skin, including its native tip, alae and recessed openings. Subject-owned boundaries identify the source patch and the measured host region. The engine selects both by connectivity, then triangulates their XY annulus using its existing region-with-hole operation. Source boundary points must be strictly inside the actual host projection, with matching patch winding. Returned planar identities address original XYZ vertices; no depth is flattened. The earlier perimeter zipper produced inverted bridge triangles and was rejected. Patch and bridge enter the common mesh before refinement and normals, and the old nasal relief is omitted for this changed basis. Outer-join and multi-angle review remain required; the prior's entire face is not adopted.

The outer host boundary also needs a compatible depth basis. Optional patch attachment projects each boundary control onto the complete reference surface along the unit recorded view ray, retaining its image-plane location. The source must include supporting geometry beyond the selected patch. Existing ray intersection computes targets and the existing skin blender spreads them through connected surrounding skin within the declared reach. The measured nasal boundary needs at most 6.4422 mm travel and shares no fixed eye/mouth control IDs. The trial uses a 40 mm search bracket and 12 mm skin reach. These are construction settings and do not certify a smooth rendered join.
