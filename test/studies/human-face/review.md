# Human face study observations

Current working documents now include numerical surface hair for all nineteen subjects and explicit resting-skin profiles for Alan Rickman, Maggie Smith, Michael Gambon and Miriam Margolyes. The source basis and reference records are retained. The first subject's time-capped facial parameters are unchanged. The artifact hashes and dated face-only observations below are historical, not identities or acceptance records for these new working documents. Current replay, hair and skin render verification must be recorded separately before this revision is shipped. All nineteen likenesses remain unaccepted.

All nineteen subject documents are numerical studies, not accepted photographic likenesses. The first subject's fitting effort stopped after approximately 57 minutes within the user's one-hour upper bound. The remaining eighteen were each adjusted through the actual face editor and saved as JSON, GLB and glTF. The files in this directory retain their numerical construction and performance inputs. No original photograph, detector or fitting runtime is required to construct these documents.

The per-person `Replay document bytes` below identify the original saved artifacts used for the recorded captures, not the current repository file bytes. Repository formatting added one final LF to all nineteen JSON files; the first subject also retains empty `controls`, `detail` and left/right `asymmetry` objects that do not alter its resolved recipe. On 2026-09-13, all nineteen current documents were built and exported twice under Node 22.23.2. Each pair reproduced the same model JSON and GLB bytes, and all model JSON digests matched the historical artifacts below. Independently decoded historical/current GLBs had exact positions, indices, UVs, materials and metadata; sixteen GLBs were byte-identical, while Alan, Michael and Park each differed in one same-sign Float32 normal component by one ULP. The first subject's frozen model and GLB remained byte-identical. This replay observation does not accept likeness or replace the capture-specific records.

[Input inventory](inputs.md) records all 85 retained originals, their pinned source URLs, hashes, dimensions, selections and quality limitations. The subjects are examples in `test`, not built-in people in the human package. They do not constitute a generated film: production storytelling, shots, delivery and release layers are not applicable to this static face-editor study. Generated-project API reachability and instruction synchronization are verified separately.

The recorded rendering path reads each actual exported GLB with Blender 5.2 Cycles on CPU. The editor uses Three.js on AMD Radeon 8060S through ANGLE/D3D11. These renderers have different lighting responses. Calibration, front, anatomical left/right obliques, left/right profiles, back, reference pose and clay were all opened directly by the main agent on 2026-09-12. A completed image inventory is not a source-code Self-Review, a collision certificate or a likeness acceptance.

For the eighteen editor saves, two independent Node 22.15.0 builds produced identical model JSON and GLB bytes within that runtime; reloading the browser's downloaded glTF/resources reproduces its saved GLB. Browser-versus-Node positions, indices, materials and glTF metadata are exact. Park, Alan and Michael each differ in one Float32 normal value by one ULP; the other fifteen saved GLBs are byte-identical across these runtimes. Different V8 numerical evaluation is a hypothesis, not a traced cause. Captures use the browser artifact, never a substituted Node reconstruction. The first subject's human observed-pose capture uses its separately identified Node-built artifact.

Construction, document replay and glTF admission passed for the artifacts named below; capture completeness and direct image review are recorded per artifact. Likeness remains unaccepted for every subject. Source review, canonical suite, packed consumer checks and CI are still pending at this record's initial publication and must not be inferred from these image observations.

## Oral joint-space experiment, 2026-09-16 {#oral-joint-space-2026-09-16}

The continuing #2498 investigation retains the tooth-fit candidates against their original source basis and examines the connected interior as one shared problem. This checkpoint uses source `f04544a4`, the same selected photographs, calibrated AMD Radeon 8060S rendering, observed/oral-gaze states, and unchanged exterior parts and materials. It preserves every failed cavity, unfinished solver and unfavorable measurement. These cavity meshes are cached-model experiments; the accompanying parent face documents do not reproduce their replacement interior through `buildHumanFace` yet.

The actual source-built joint tooth placement removes upper-enamel versus head/lip intersections in all four people across observed, neutral and oral-gaze states. In the preceding unconstrained fit, Alan had 28/32/58 and Oh 105/106/73 intersecting triangle pairs respectively; both now have 0/0/0. The upper arch stays exact across states, and non-dental parts remain unchanged. Alan's additional posterior movement is 1.28357515534418 mm and Oh's is 1.449994597102961 mm, with coupled lift preserving the recorded photograph's vertical projection. Horizontal projection changes by -0.5708 mm and +0.2065 mm respectively. Pair counts are intersection witnesses, not penetrated area or anatomical severity.

The first independent upper-vault/lower-floor enclosure removed many enamel intersections but protruded through the commissures. Full projected triangle constraints against enamel and exterior skin removed those protrusions for Yoo and Maggie. A subsequent exact-rational audit identified seven Yoo lip crossings introduced by Float32 XY rounding. Rebuilding the complete constraint domain on actual Float32 XY and obstacle coordinates removed all seven. This separates source shape, exported representation and render observations rather than compensating with a manually increased tolerance.

The next comparison retains the conservative numerical error constant but assigns uncertainty only to newly rounded free Z coordinates. Fixed exported rim coordinates incur no new error. An explicit coordinate envelope bounds the ULP calculation in both the solve and export. The coarse space becomes feasible for Yoo, Maggie and Oh, while Alan retains a 0.003196586-mm minimum uniform constraint slack. One centroid per vestibular triangle supplies local depth freedom without changing original vertices or edges. Under the same ownership rule, all four enriched problems are feasible with all-row residuals around 1e-13 mm. This is geometry feasibility, not a biomechanical tissue model or a measured palate.

Six coarse and eight enriched GLBs passed actual export. All fourteen have zero cavity/enamel and cavity/head intersections; exact-rational classification confines all cavity/lip contacts to the copied shared seam. Their topology is an opposed manifold disk with Euler characteristic one, and both source-double and Float32 rim coordinates are exact. The main agent directly inspected all 126 new GPU views, including both obliques, both profiles, back, clay and registered reference views. The black commissural wings remain removed. The open interior still looks empty and simplified, with a flat-looking floor and no lower enamel or tongue in this cohort. Existing lid, nasal, age, hair and cervical defects remain.

The same manually read photograph columns give the following incisal-edge mean absolute errors. Measurements use 0.25-pixel sampling of final Float32 geometric visibility, with no alpha-indeterminate rays. They do not measure shaded brightness, unseen anatomy, held-out fitting accuracy or whole-face likeness. Alan's enriched interior exposes the incisal contour that the legacy backdrop obscured; the earlier joint-placement/legacy-interior combination measured 3.50 px and the unrestricted fit measured 2.8125 px.

| Person | Original error (px) | Enriched candidate error (px) | Manual source-reading uncertainty (px) |
| --- | ---: | ---: | ---: |
| Yoo Seung-ho | 0.95 | 0.70 | 1.2 |
| Alan Rickman | 8.125 | 1.65 | 2.0 |
| Maggie Smith | 3.10 | 0.4833 | 1.0 |
| Oh Seung-yoon | 1.8667 | 0.4167 | 1.0 |

Independent self-contact checks expose an unresolved defect despite those improvements. Coarse observed outputs have no self-crossings, but open Yoo/Maggie/Oh have 160/225/160 crossing pairs. Enriched observed Yoo/Alan/Maggie/Oh have 0/36/2/11 and open outputs have 265/184/415/328. Every final witness is already a crossing in source doubles. Some Maggie/Oh open-state pairs also cross in the original unoptimized vault. Same-column ring order is therefore insufficient, and the initial vestibule itself has an embedding defect. Five Maggie open-state pairs within the same vestibular band have exact affine depth gaps of both signs, approximately -0.00268 to +0.23678 mm. Preserving their original order is not a valid repair premise. The investigation is tracing attachment correspondence and the full surface representation before another solve.

Primary anatomical references distinguish fixed palate/maxillary supports from mandibular and lingual supports. [ArtiSynth skinning](https://www.artisynth.org/manuals/topic/org.artisynth.doc/html/modelguide/Ch11.html?cp=1_11) connects an airway boundary to those masters, but its [limitations](https://www.artisynth.org/manuals/topic/org.artisynth.doc/html/modelguide/Ch11.S5.html) explicitly include folding and self-intersection; attachment weights alone are not a nonintersection guarantee. [Hewer et al.](https://arxiv.org/pdf/1602.07679) constrain an MRI-derived palate shape space using anatomical landmarks. These sources guide ownership and shape constraints, not hidden dimensions recovered from the study photographs. [ECMAScript Math.fround](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-math.fround) and the [glTF accessor specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types) establish the numerical transport basis.

All artifacts remain under `.shots/human-2469/investigation-2498/`: `oral-joint-placement`, `oral-owned-{coarse,enriched}-constrained-l1`, their `*-contacts` and `*-self-contact` directories, `oral-owned-self-contact-stages.json`, `oral-self-order/exact-ambiguities.json`, and `oral-owned-direct-review.json`. The last receipt binds every directly read image hash and the independent measurements. The partial clearance and visibility improvements remain preserved for product integration. Self-embedding, anatomical contents, replayable expression behavior and whole-face likeness are still active work; this checkpoint is not the final whole-PR Self-Review or acceptance.

## generated-black-boy-01 {#generated-black-boy-01}

[Replay document](generated-black-boy-01.json) · [Original selection and quality](inputs.md#input-generated-black-boy-01). Selected original: `generated-black-boy-01_age-15_front-smile.png`.

2026-09-15 dental update: adjust four individual upper-crown heights and the two central crowns’ proximal incisal contours, and author a separate lower row through the existing mandibular component. The previous numerical basis, reference, expression, appearance, hair and every non-dental part are retained. Two whole source builds reproduce identical models and 7,630,744-byte GLBs. The cached component contrast differs from canonical model JSON only in part insertion order; its GLB is byte-identical.

The main agent directly inspected all ten observed-pose views below and three angles each for neutral, lip-only and 10-degree jaw states on AMD Radeon 8060S/ANGLE. Central incisal exposure and the previously absent lower-tooth strip are closer to the source. Flat-looking enamel, dark cervical gaps without gingiva, lateral crown contours and the existing orbital, nasal, skin and hair discrepancies remain. This is a partial dental improvement, not accepted likeness.

Neutral anterior-enclosure sampling finds no uncovered or protruding tooth points among 65,416 vertices, triangle centres and edge midpoints. Opposing-arch depth-envelope samples find no overlap in observed, neutral, lip-only or 10-degree jaw states. The upper row stays fixed; lower enamel remains fixed under lip-only movement and follows the authored hinge under jaw rotation. These finite samples are not complete triangle intersection or physiological occlusion certificates.

Before the reference-continuation change, a 25-degree jaw with lipPart 12 failed cervical construction in both the preceding public document and the dental revision. The isolated facial-performance collar reached Y=-113.820 mm while the upper cervical section remained at Y=-107 mm. This was a shared assembly failure rather than a dental regression.

The subsequent 2026-09-15 source update constructs cranial and cervical continuation in the reference frame, then poses only its appended vertices. The observed artifact remains exact and its authored neck is unchanged. Two source builds each at 12.5 and 25 degrees reproduce exact models and GLBs. The main agent directly inspected all ten GPU views of each state, including both profiles, clay and source-pose framing. The shared lips remain connected; the maximum still has a deep submental fold, an empty-looking oral cavity and simplified enamel. These are construction and continuity observations, not physiological or likeness acceptance.

The 12.5-degree GLB has 7,630,744 bytes and SHA-256 `0f9a3b3b53d8bd6d0cad9aa88239477bacbbdc78f9deccecfe251ec0e7681684`; the 25-degree GLB has 7,630,740 bytes and SHA-256 `ca8d0f8ff7c87dab2b0cf8d2f21cf5e2809758966a4bcdc3c4c1fa965d4b60bf`. Their capture directories are `.shots/human-2469/subject-jaw-continuation-{half,maximum}/generated-black-boy-01`. The actual editor's calibrated GPU check verifies midpoint/endpoint edits, 25.1-degree refusal with document retention, exact undo/redo and JSON save, and a downloaded maximum GLB identical to that source artifact. Ten related native unit scenarios pass; this is not the whole change's Self-Review or CI gate.

Current dental-update artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Numerical document bytes | `1cdacc384277be529691a14564bbf97185ed29b1aec3e35c856029bc4c915486` |
| Node model JSON | `283a8c93dc1660c421d19b4c97dae82db4a76ef2e0fc6c75d4e582eb0068ddda` |
| Rendered GLB | `20244813a33045ba9ed68da0f61b6cd435826bdb9cdc300e4108f5a9289650a1` |

Local current capture directory: `.shots/human-2469/subject-dental-display-incisal-source/generated-black-boy-01`. Likeness remains **unaccepted**.

| Current inspected view | File SHA-256 |
| --- | --- |
| front | `f1e5f1330ffbe5c23e017f58668c02f5b8adf60daafce1295f189b9db320eef0` |
| left-oblique | `bfdcfe56fe1e9128d4e7e13b619cea0f8db06a4f85cd41ac927dc9192843a43a` |
| right-oblique | `7f92a788770cade71110d6f0e5f851730bf5b5979722c98d5d2b82a7e6b5a0ed` |
| left-profile | `7d6ec3b501444cea321e2a7b7739857e6354e8bab8d86fe1d082069e73b638e7` |
| right-profile | `89035ccd95ea3289b26cb354219c473afbe79bb440553ad71709731cf2617c6f` |
| back | `e2322d952a61781645e74dc304f362878a2d86fff4713201f8fc404dce978f49` |
| clay | `40d9af016e23aa6ee993f57ad014557200fba885efa6a22986bda424e3849180` |
| clay-oblique | `a4d621cb2fbd035c4e000ef0a2a4510b7c472a48026293893c928929eab2e0e1` |
| reference-close | `0a317b80e73ad8ab53037d44e6e5c242f3ce105a49dafb30d3ce4c743fb9320e` |
| reference | `de6cdf1aed9edfca1ae79e1a1c287576f4084f22a94c145a2ab21487c19e1069` |

The following hair-only and original face-only records are historical.

Direct source/render comparison: excessive white-eye exposure, heavy regular brows and overly even visible tooth row. Preserve observed facial proportions; reduce identity lid opening and brow fibre mass, move lateral crowns posteriorly and lift the fixed upper row.

Front and reference show a broad smiling mouth, individually constructed upper crowns and dark iris pigmentation. Both obliques and clay still expose regular lower-lid shelves and a simplified angular alar/columellar transition. Both profiles and back show the shared inferred cranial and neck form, including posterior lobulation. The final exported face was inspected after the editor shadow-bias correction; absence of the prior WebGL shadow acne does not make the anatomy or likeness accepted.

2026-09-14 hair update: replace the large coiled strips with 1,024 rooted surface patches and a saved curled alpha/normal profile. Seeded tangent directions and centred footprints reduce the large crown gap visible in the preceding uniform-direction trial. Two whole source builds produce identical models and 7,461,304-byte GLBs. Every non-hair part, the facial appearance, expression, basis and reference remain unchanged from the preceding brow-depth5 document. The changed fixture is a partial hair improvement, not a new likeness acceptance.

The main agent directly opened all ten views listed below from the actual exported GLB on AMD Radeon 8060S/ANGLE. Front/reference have a fuller hair envelope but retain an unnaturally sharp fringe; obliques, profiles and back still show broad patches rather than the photographed tight curls. Clay retains the existing orbital, nasal and lip discrepancies. A dark upper-hair occupancy comparison gives IoU 0.838/0.852/0.849 for source brightness thresholds 60/70/80, excluding eyebrows and lower temples. These are occupancy measurements, not overall likeness scores. At 100,352 Float32-equivalent hair vertices and triangle centroids, radial head-clearance samples are outside the skin with a minimum of 0.757 mm. Finite sampling is not a complete triangle collision certificate.

Earlier hair-update artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Numerical document bytes | `e8732d52650bf16e816fbf5a04261e347e4ba8fc2188f00fb636a3ed6358f398` |
| Node model JSON | `19c04ab4664f79bbe03fc6bb9ded39c721d78b2ef7990828016fdc3be6443481` |
| Rendered GLB | `c28a1db999f9902493ca5a693a0ef85bfef88f22e5ac97142e19e4cb34978c96` |

Earlier hair-only capture directory: `.shots/human-2469/subject-hair-curl-direction-source/generated-black-boy-01`. All ten captures are present and directly inspected; likeness remains **unaccepted**.

| Earlier inspected view | File SHA-256 |
| --- | --- |
| back | `e2322d952a61781645e74dc304f362878a2d86fff4713201f8fc404dce978f49` |
| clay-oblique | `d024514135b25e01ae8159013967e41280a3c2106f3c0e7c63704737022424e6` |
| clay | `062159cf0867e59a265db33f88a8e4906e4a0af67c200e715bbc2e319c15d1ed` |
| front | `1cddfdebde5ac5575f040da73badffdfa7f61949e4893bd71ea3c4597b49bc00` |
| left-oblique | `bb808a1a3eff39e091f2ce1db8a5192234b9be74275a369e2c3192b402547258` |
| left-profile | `b99856308ef78540702c0641e9d49a9ee229f1846810d7a820cf254e03f43b2a` |
| reference-close | `04c5a47f75be08cc88669e779c5418f506426a4a898992b564c55d8ad30aa7fb` |
| reference | `63ea1a48be9ab0f39ce450ff82485c8be9a3467410063913042da2194627d486` |
| right-oblique | `10d5a5163af95bbf4e11598e862824065376595c1e120d4feda0ec981d55a9cb` |
| right-profile | `f8aaff7668b02659936711e8df54c7f35af35c7f6b6157bc5a826681528e537a` |

The following artifact identities and nine-view table record the earlier hair-free study.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `ca4a2f3a214df183e9fde84f5f5f001d3fe5f2a20b179afb67ecba4b4359c13e` |
| Replay document bytes | `170a986440641a13eb1e98e3ed2b40f1fd7ac689cf976f9462e00447c92f5e0c` |
| Node model JSON | `eddaeb1e4c7f83989db1d45aaad357acdc76b31cd99b4cd57eec78a81e5f4b2e` |
| Rendered GLB | `e2c587cc046475c0129a2288a1e195be58aa62ec6cf46fb529934af79393cb4f` |
| Capture profile | `0722109824156602ea2ecd56e7c118a7b28bc9aaa853368fcdca983e12e04b80` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-generated-black-boy-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `c348c0bda59e5eb37d57ed234ad727dcf662b07aea6e0dc00ef76e63bb64d58c` |
| front | `984e6dcb9d6a2c3c9151cd14bafd5405f714e75a7c867e8b3a8a444b036aa001` |
| left-oblique | `fb824df38c21099f83251973921044cdf5800450bdcbfae0810a0aea119d0362` |
| right-oblique | `fdb215d05aaedd839967c78815d98eac429340448757c950a62530e3dc769649` |
| left-profile | `d37b26207ca2c960841e16c6adc78920b9ce255bd992323c581cf632963c82da` |
| right-profile | `8d1d133ecc193ead583387d4a87d279bc329f46e030d52cf1125bafd3c5e067f` |
| back | `4020888f1f8debe088ea7ed7d61e53f67ca0e99ea72ee464bfa52487929d3d78` |
| reference | `f974aefba9233be5b2d4628f39dba478a3bee94852cf8347f702a1ab4af21b45` |
| clay | `b39ffbf899b53caaac68855d1f959ee7999a57287987bba42d5a640a410e7fe7` |

## generated-black-girl-01 {#generated-black-girl-01}

[Replay document](generated-black-girl-01.json) · [Original selection and quality](inputs.md#input-generated-black-girl-01). Selected original: `generated-black-girl-01_age-15_front-smile.png`.

2026-09-16 optical partial adoption: the current document sets `sphereFit: observation-ray`, `opticalFrame: radial`, `canthalSupport: tangent` and `surfaceRadius: 12`. All other authored values, source identity and observed expression remain exact. Two independent complete builds reproduce the retained candidate's model and GLB exactly. The spherical radius is an authored approximation at human-eye scale, not person-specific biometry. [Adult CT measurements](https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/) describe varying, unequal axes; [juvenile longitudinal biometry](https://pubmed.ncbi.nlm.nih.gov/23575156/) measures axial growth. Neither establishes a universal 12-mm spherical radius or a radius recoverable from this photograph. The fixed-canthus hull is geometric support, not a measured conjunctival surface.

All nine views in each of observed, bilateral blink and oral-gaze were directly inspected: 27 views for this person, under AMD hardware rendering with an independently specified 10-mm calibration cube (45 expected pixels, 44 measured). The open-eye curvature and glints improve, but the inferior-lid band/shadow remains more pronounced than baseline and the superior orbital hollow is excessive. The smile retains regular crowns and a thick vermilion band. Both profiles retain the angular nose and neck; the rear groom exposes a central separation and small crown gaps. These are unresolved form observations, not changes attributed to the eye controls. In full blink the optical apertures are covered; that sampled closure does not validate natural blink motion. The optical improvement is adopted while the coupled tissue work continues; **whole-face likeness remains unaccepted**.

Current document SHA-256: `648b3eef6daa7b3a641faee821c759224aa5305662f52749ff79fa3aa9dadf86`; model: `708cf683b51486200118b908f2c3c66044edd02159f4c5fd68537604e4c7ad75`; GLB: `54217ed710e7ad001901227f64ea9643ea5b4e5081a12ed94c2a5a762e4d7e91`. Current full-view capture directory: `.shots/human-2469/investigation-2498/optical-adoption-views/generated-black-girl-01`. The close baseline comparisons remain under `ocular-fit/generated-black-girl-01`, and the complete per-state input/model/GLB receipts remain there. The table below identifies the directly inspected observed images. Left/right filenames use camera yaw: negative yaw sees the anatomical right side, positive yaw the anatomical left.

| Current observed view | PNG SHA-256 |
| --- | --- |
| front | `9c751e47ad4407d91f8c846e604d9fce641e3f9e9c4479f1557526c2071eefa8` |
| left-oblique | `a6dcdfafaf04210a20cd0ee412a20e3e0a7d54544c7d10d00e540addf4dd233d` |
| right-oblique | `ccc82ed107ecca01d27972512c20b1d0d84aef6b7b804b4280ae3d24a76acbb8` |
| left-profile | `cdc730010823dee19463d0c15e88c95b502d09ce75a2cf21c84f79bcf4e48766` |
| right-profile | `810181d335ade9eeb86afbe1d6b99cf4bb8cc09bdb17d6ad3cce36a20a9a443d` |
| back | `cb67ea9a2d5ba532ba977d0b93141d271a4a8805c732085b5cb05f9fb5020d55` |
| clay | `e5e9606369a0f09fa36bdb4d432e7811665a5fd3cfb75e80a461f86565eb602c` |
| clay-oblique | `2f1e61485249bc4de16556bc5574cd82d917768be31848b741d38ed9d10c2b59` |
| reference | `311ecca5e3bc902ef83337bacad155cacc525961da150b0d3992194c4ae2075c` |

The following entries preserve preceding revisions and their own artifact identities; their use of “current” refers to those earlier checkpoints.

Direct comparison of all nine initial views with the original: eyelid margins are too widely separated, brow fibres read as a solid ribbon, upper dental exposure is too regular and the tip projects too strongly. Hidden rear shape remains inferred.

The final front/reference retain the selected smile and dark optical palette. Both obliques reveal the simplified lid roll and lip band; the dental row remains too uniform. Both profiles keep the pinnae against the head silhouette, while back and clay reveal the shared inferred posterior head and neck lobes. The source hair is not reproduced by this face-only editor.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `fe80a9623d1f6760110722508b4a37b2c127e79ba3a2b056ee9ac789b7c7242a` |
| Replay document bytes | `3ca274fbbce1d2671d225def14fc006af8100a4ef6c1ebb22941095ad0dfe607` |
| Node model JSON | `601958ea046674a8c5a2e60fecbe0b41e64be2fb23a9fd4da164a38ca905543e` |
| Rendered GLB | `2c04a03aed054c76f70a7b9764d7e039c74334384322807e8a5bb31eaa84b1c3` |
| Capture profile | `07299481a657c15e0ab6b9e479aa2a9c1472d93d65e266d781f741c923e84128` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-generated-black-girl-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `d2abcfa3d644c12180fa9a19cc61cb5acf8f284b9f0adb8558a93837389e5fb8` |
| front | `c6a78c640670830e99ac7e4a15ab19340683381edf9cead7865b8d6d42673b2f` |
| left-oblique | `fe55ec36ef3bf8bcbcb4f7e677c433d3cf5bfa1aebf9714f82414dd5c004fc4a` |
| right-oblique | `beba74aee22798399d3d530020a7a6002c6f3fd2f65ae91e5ff189230b38afc1` |
| left-profile | `02d25cf506f8ccaf6d70dcdf61e9340f7f600475f965a7bc7ab60adfbd27f078` |
| right-profile | `45b2ed645845db4a51601548d51327b96ee059a6c949f1b46f3aae9aedfcc9c5` |
| back | `3b505bf41173e699e9f148bfce6080e128315093958aa4e9959ad6bd12a43c9c` |
| reference | `1b1d697220b853d103e867aca6c7aa1b35d189a29096625dabb0fd6252452a6f` |
| clay | `bd7d83eb2a2e73b0c3957ab5a0241d4b7860140e82b27f83060606f57ee95e07` |

## generated-korean-boy-01 {#generated-korean-boy-01}

[Replay document](generated-korean-boy-01.json) · [Original selection and quality](inputs.md#input-generated-korean-boy-01). Selected original: `generated-korean-boy-01_age-15_front-smile.png`.

2026-09-16 optical partial adoption: the current document sets `sphereFit: observation-ray`, `opticalFrame: radial`, `canthalSupport: tangent` and `surfaceRadius: 12`. All other authored values, source identity and observed expression remain exact. Two independent complete builds reproduce the retained candidate's model and GLB exactly. The spherical radius is an authored approximation at human-eye scale, not person-specific biometry. [Adult CT measurements](https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/) describe varying, unequal axes; [juvenile longitudinal biometry](https://pubmed.ncbi.nlm.nih.gov/23575156/) measures axial growth. Neither establishes a universal 12-mm spherical radius or a radius recoverable from this photograph. The fixed-canthus hull is geometric support, not a measured conjunctival surface.

All nine views in each of observed, bilateral blink and oral-gaze were directly inspected: 27 views for this person, under AMD hardware rendering with an independently specified 10-mm calibration cube (45 expected pixels, 44 measured). The open-eye globes read as curved reflective volumes. The lower-lid band is more apparent than baseline, while the broad upper lid and medial orbital depth remain unlike the reference. Both profiles show the inferred shallow jaw-to-neck transition; rear hair remains a regular cap. Block-like incisors and the lip band persist in observed and open-mouth views. In full blink the optical apertures are covered; that sampled closure does not validate natural blink motion. The optical improvement is adopted while the coupled tissue work continues; **whole-face likeness remains unaccepted**.

Current document SHA-256: `c921c38f6904a38a1bebc35134ee8b0888d72c2b45c6efd8ea7592cc537882c3`; model: `dcac32b998e5f561c72b16e4acdccd5b4090dedd4d0b6f1e7771e9996ff65325`; GLB: `8f218457466b62233442c87926f717139e78673684024c9102f9377c1cfdf347`. Current full-view capture directory: `.shots/human-2469/investigation-2498/optical-adoption-views/generated-korean-boy-01`. The close baseline comparisons remain under `ocular-fit/generated-korean-boy-01`, and the complete per-state input/model/GLB receipts remain there. The table below identifies the directly inspected observed images. Left/right filenames use camera yaw: negative yaw sees the anatomical right side, positive yaw the anatomical left.

| Current observed view | PNG SHA-256 |
| --- | --- |
| front | `b2f75d22b34dac7a2fc36ee5482cc7093e1429f89e3e3f76d4608311169322af` |
| left-oblique | `6c54b4bf64e54880fd0b349d6d4c04f317b10544e1b6473da1458d08b0eddbb3` |
| right-oblique | `a4e2c4c19c37fcfc619708822b05c50970686939115566c98a962c57f61e3823` |
| left-profile | `e32fc94a0c8dd56d83ded7a76c8f383d1371a80f23dafefd82ac8a05815d7018` |
| right-profile | `059bbc945cc6f801df0d69c259ec566a14ecc5baf2396a91cc452d07a4ba1167` |
| back | `921564f1428021d6f9a377d8582734650f2bde87b8a33ad57be93987aead3427` |
| clay | `6fdedd2031053fb637d2b87eb52440d48e7c2a95087fef0963476fbf5f2c67a1` |
| clay-oblique | `c4e79a6687349a58feecb90d4cdb16cfccce91c30d6c5f6f18f63641394844de` |
| reference | `42fc88bde92910b4b666b95498da05031b1c3cfa513a9ec5e00f45ac50b9e5c2` |

The following entries preserve preceding revisions and their own artifact identities; their use of “current” refers to those earlier checkpoints.

The original has less white-eye exposure, lighter tapered brows, a thinner lower vermilion and rounded incisal tips. Adjust those profiles without changing the observation's pose or ethnicity.

The broad smile and upper row are present in front and reference, but the crowns are block-like and regular. Both obliques and clay expose the thin regular inferior-lid roll, strip-like brows and angular columella. Both profiles and back show the inferred cranial/neck continuation rather than measured hidden anatomy. A proposed smaller eye opening was rejected by the orientation guard; the guard was retained and that one fit proposal was withdrawn.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `81cfa3b9d3d7c28b8f4758db11a0546e05852a47fb1c46b84eb1cab28f701331` |
| Replay document bytes | `4f877e7b636a6b403cc8f4fe80830a454cb1e795af7e62d9322ee33def8bf20e` |
| Node model JSON | `b1ba44f4beda319a79ee4f6a70efa3ba98c9cb327b41e670e0d9ed527fa4954f` |
| Rendered GLB | `809e86af871792f633cec7d1cdc5cca67f963d26a565903ab40cb76b63559be8` |
| Capture profile | `61d8b09cf4a2e4fcfe90bda1fbf4e8149114bf67637f335c6e6c082b8dbf64d8` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-generated-korean-boy-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `b468ce6add763677eff1e0561543497efd298f92552db8ac812a26389e519a1e` |
| front | `25c864e8d02db333f0218d012291e7b83642297a1b6368f10b9a2f72a605e069` |
| left-oblique | `40d903071c003cf35fc7265851ecfed615772b841e81b731914d42c490bc9bae` |
| right-oblique | `518d0c953d5088855f660c336e0dacc24525f88fee83e39abe5619510952f573` |
| left-profile | `a33080d7fe4c5adddc4e12209994293d6e9e57a738aa46230f2eb3d96432194b` |
| right-profile | `8604ce26fdd0264a1b9285b1510cea6a8183495f8993ab6f4b64fdf672c6d9a1` |
| back | `a5c81fe4284d0cf24bc8cdb3e029bfb648ada6408b6f4472c0212d3e1b1a4793` |
| reference | `430c3cffd3315740a439df40c08024731726c9a9801c6687134bb3c16af5cd7f` |
| clay | `4cf02d8ab5321103aa2f5b7af1f8ce27003286d8ce35870f5d1dd69e743e5511` |

## generated-korean-girl-01 {#generated-korean-girl-01}

[Replay document](generated-korean-girl-01.json) · [Original selection and quality](inputs.md#input-generated-korean-girl-01). Selected original: `generated-korean-girl-age-16.png`.

Frozen first-hour identity; this human build isolates the face from the earlier hair-context study.

The first-hour fit is frozen, not extended by the package extraction. Front and source-pose views retain the measured smiling arrangement, but the lid bands, angular nostril base, lip contour and regular crowns remain visibly synthetic. Both obliques and profiles show attached ears and a continuous face-to-neck silhouette; that continuity does not validate the inferred posterior anatomy. Back and clay expose the generic cranial/neck continuation. Hair was omitted from this isolated human build; the separate capped legacy study retains its coarse hair. Neutral and wink/open-jaw diagnostics were also directly inspected, but do not certify every expression combination.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `bd15adc1984b16059bbf006e8edf2d0bdf215d504189857996e8b278340e2683` |
| Replay document bytes | `f7ce60b460e305aaca8efd5048ca2097f161d76ef0034465d600b359408076d6` |
| Node model JSON | `9d0c26d85b64727e3d4b96a55a9c01ad5477ccba43e6c787c49a02eff52ebde6` |
| Rendered GLB | `112cc109eb67033bf3be6679b7c7a9070feb93a9f99148dfddac0750d7bab431` |
| Capture profile | `2b5dfd12b6bcae5b99ff1611d09850ab33b8deedeb645c0450569b1b7cdc2b1e` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-first-observed-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `5f43a793192897903610ef207002d975bc7a0e1c262f28ec45e4f34bdce5b1c7` |
| front | `765aece67833b23e6e8640c7581a71df4e755e159ac8b6cca1d6326080e33864` |
| left-oblique | `7f0416f5e68abb4dc3ee75c3fd6e89cd8efb08f6d80247e46630ad9c629a792b` |
| right-oblique | `1a699554d73d62dc188a278f5839cad73a56b281ae487fe641c60c460b580e68` |
| left-profile | `465d7e48864c31c510c2e6e7705b50eca940d36f5daed6c2b52c03735a5c1299` |
| right-profile | `1b5ac4cd816b9ac361fd40c268effecc1ce390e0acfc334e75f0a02229524df3` |
| back | `4858f4c30536df91e12b57c3f6b315dfd3d4214bc64b429351988e14e4a53ed9` |
| reference | `7781700c80fe4d186175ea3b8bccfe003858aa2741ee2734c83eafb158d29559` |
| clay | `b6100406229c1a91136e1937c11d593daccfc4e4d471ff51a518fe421e8fbb57` |

## jang-su-hye {#jang-su-hye}

[Replay document](jang-su-hye.json) · [Original selection and quality](inputs.md#input-jang-su-hye). Selected original: `jang-su-hye_age-approx-31_symposium-portrait.jpeg`.

Reference-view comparison shows an overly thick lower vermilion, broad bright eye aperture and coarse brows. The selected portrait has makeup and limited face pixels; do not convert those lighting limits into guessed skin detail.

Front and reference preserve the closed lip seam without exposed enamel in this pose. Both obliques and clay show flat, simplified nostril form, regular lid bands and insufficiently individualized brow distribution. Both profiles and back retain the inferred skull, pinnae and posterior neck lobes. This adult original was explicitly selected over the small childhood group-frame faces; no claim is made that the adult settings reproduce those other ages.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `f47625be7c4192850cfc7c8825d982a409e3cde667974a50ee15eb5d5d66068d` |
| Replay document bytes | `d33fab2f57c287bbedd8ae88509401b9f76af8f8b6edb7ac4ae7d3f9eb44da68` |
| Node model JSON | `eb0d52a197d5318abeb5dd5f9b0867be041bd6b74d8fe5e5855c1c6d954930bb` |
| Rendered GLB | `20fafe8fd63423ae8c4320d41c031f603cc0b3b4acbc907eb01317e1c9d9793d` |
| Capture profile | `e87670025717eab4c544133d3fd144e8de6ef33735004bbf54ea47591ec2ae4b` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-jang-su-hye`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `8acb97c40727614bc332c2defaa89044a5b187bb1c4e4451660930a10617e69e` |
| front | `2cdb9093d1ff383e4e61c183acb2e43cf97afbe47c8ecb922e9fe136c4fb7e3c` |
| left-oblique | `0eb1669afda50bcb02a1ecd98918c748d70d70774ddfd2f8e88378d0058db639` |
| right-oblique | `04c9850200dc4702c5754c10e9404d5652b090ae778eeae5a2e6541d53aba086` |
| left-profile | `0955d056d366bf28cc6e178f4d3c3c76ab299ec30df395a50807a6bf8d888109` |
| right-profile | `4751ac0414a4d963d2e85b3f51b53686eacd37fe89c5c3ded69b2f7d6b2086f4` |
| back | `b21089390354a812c6ec98654849dd68191454392e161763aa1457d7a90b92a3` |
| reference | `5b700f78ae32a50073a4e2b574e796455af2d81fa9effdd7d14e0d8c3637c8bf` |
| clay | `33d405401a992b5fc297404cd0d772b871186b8cde7531afe28673366f9a290d` |

## kim-min-jung {#kim-min-jung}

[Replay document](kim-min-jung.json) · [Original selection and quality](inputs.md#input-kim-min-jung). Selected original: `kim-min-jung_age-26_strike-love.jpg`.

The photograph's closed smile does not show the tiny white dental strip admitted by the detector-derived aperture. Close the performance seam explicitly, reduce overly bright eye exposure and excessive lower-lip thickness; retain the low-light source qualification.

The closed mouth remains closed in front and reference, but the vermilion band is too heavy. Obliques and clay expose pinched inner under-eye wedges and an angular nasal base. Profiles and back show the shared inferred cranial and neck shape. The event photograph's lighting cannot establish linear skin albedo or hidden depth.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `a2dfa2081c49b8055e5da5d871883bbb0eeb890f34719c8ab6801f564c9799a5` |
| Replay document bytes | `e60f8281b4606ed386ec858621c51c5a77b9968dc04ff5dcabdc3c2131a24083` |
| Node model JSON | `eeb767fb5a4206d632aa73749eef1c02d48f465df777d3427bab9b056f22ce16` |
| Rendered GLB | `12b30046d1072cdc91ef551f5d9c30918556adae37aac5f15f1bb7309a7fa144` |
| Capture profile | `44c61d07a469ccb4737f395a01d8a49923e9b040f3c1351f82bf70eabc61d392` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-kim-min-jung`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `a0d3f8a5fc08a0bc4aa906ac746b55cde2caad062b45326175ce480fb9c7d4e7` |
| front | `adb58e519b70cc50b098d548e4f814816982acfc8651ae210d89ad59c7711151` |
| left-oblique | `494ab9e334899e8903e83b4f61d269e7cca0f0129ae6b7f2d7765eed441e1582` |
| right-oblique | `f6c63cf5a1fd102b6bde5b94ba035b19cdaa10a07cd6785c5564c98ffe39bb75` |
| left-profile | `3fad382cd77b231ad379c9e77a93975be9d6d7977eeaa81695c9ad2f0cccfc8b` |
| right-profile | `c5a52ca519a94d68f541857b8afdaa798d21e13e02fb43e402eb68191b76aced` |
| back | `041d37be5ec7950e6cea3a3a97cbabdb00bda2394f52a651880ff5eea541a3f3` |
| reference | `5ac5b304dd8cad4c6c1b4eb48d76fec54bc99919b247ff07e6c3f43db962cea8` |
| clay | `3662b9c9c2d34e0d16bb3d732480beb90a24363f1d742fba32de327d38c20724` |

## lee-tae-ri {#lee-tae-ri}

[Replay document](lee-tae-ri.json) · [Original selection and quality](inputs.md#input-lee-tae-ri). Selected original: `lee-tae-ri_age-31_handsome-trot.jpg`.

2026-09-15 aperture revision: removing the common `eye.openingScale` override of 0.93 restores the unchanged observation recipe's 1.025. Actual projected lid-boundary height divided by the recorded observation changes from right 0.91410 / left 0.89907 to right 1.00009 / left 0.99133; width ratios are right 0.99318 / left 0.99319. These measurements describe aperture, not likeness or certainty about photograph-derived anatomy. The complete observed model and GLB repeat exactly in two independent source builds; basis, reference, caller and all materials remain exact. The observed GLB is 7,012,312 bytes, SHA-256 `b8bf128dab525481946d8850450b252857db9ba4141457c58b06f04127e2b0a6`.

All thirteen observed views and the fresh baseline reference comparison were directly inspected under the same directional light and camera procedure. Neutral, half-blink and full blink were independently built and captured in thirteen views each; front, right profile and clay oblique were directly inspected for each state. The opening narrows at half-blink and the lids meet at full blink in these views. Neutral clears every expression channel, whereas both blink documents retain the observed closed-smile channels. The thick superior orbital hood, sharp nasal base, uniform skin, simplified lip contour and blunt centre-part hair remain unlike the source. Only the aperture improvement is adopted; likeness remains **unaccepted**. Current capture directory: `.shots/human-2469/subject-eye-observation-opening/lee-tae-ri`.

The rebuilt actual editor selects the current document from nineteen built-in choices. Observed, neutral, half-blink and blink each save exact JSON and export byte-identical GLBs against their independent source builds. Undo restores the observed document even though its lip separation is zero. All four editor fronts were directly inspected out of twenty-four captured views, with AMD 8060S hardware rendering and no page errors. This verifies the authored states and export path, not a natural blink trajectory or full likeness. The local editor record is `.shots/human-2469/eye-opening-built-in-lee-tae-ri/receipt.json`; its inherited prose mentions eighteen captures, while its four state entries and six saved angles per state record twenty-four.

The following face-only observations and artifact identities are historical and do not identify the current hair-bearing aperture revision.

Compared directly with the event photograph: broad white eye exposure and smooth exaggerated lip bands dominate the initial reconstruction. Narrow those anatomical bands, soften fibre mass and retain the observed closed smile.

The explicit chin-frame adjustment reaches the final geometry, and front/reference retain a closed smile. Eye shape, lip contour and cheek support remain generalized. Obliques and clay expose the regular orbital bands; profiles and back retain inferred jaw depth and posterior lobes. A numerical chin displacement is an effective control, not proof that the photographed chin has been recovered.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `a833496a8302bcb15ff9f8b1d44a86c33492a8ac69ea9a12c6f1f26d468b9e1e` |
| Replay document bytes | `62661f5b81e4558e3ce9a3e783b8bd7c89e4b7fa09ebdbc79ac6d738422d7224` |
| Node model JSON | `be99c7b47e34dfa00a458d32c3228a7b8f0ecf55df41723611c55ec35b9fd68d` |
| Rendered GLB | `ddf707d50bc602ee6a8901c34c428574bda5ad4526407c8b492a0c79037284ac` |
| Capture profile | `6b791af8f735f16fee9f969f311221d757318e2cb9435a4d4cec5f3aa42b619a` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-lee-tae-ri`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `1ba2a8fef3e03c51b93645a5d41051263e136d1fe7738df7e63f13850a0b4903` |
| front | `ce09210b581ed6322e9b3c80017cb712a1fa20c0fea49c8d047f225c9cab89c6` |
| left-oblique | `10bcf562f8429f9c15107f42efcf6c67b307e0f21d4542f014c5b5cf909eb4e2` |
| right-oblique | `8ee6ed4097baa16fbcaec60d17832f2b3e1eb8efcb593707cf5ca40266ab9394` |
| left-profile | `2733a755706df23858b2bc7be9ec0001edcd34cfac46f29f6d96bd491e048d5d` |
| right-profile | `ca171690de1daf50d0d47709352b660cba2630f508c906c7782baf81531291bc` |
| back | `37e70f89b7ffeaecce5052f645b8d172bb5b684a86835540b9bfedbd2e523cfe` |
| reference | `ed9f4877f31c884f0119243e0e7a16b7aee64fa7060917e563744ec583602b21` |
| clay | `83986990f20c11104a46a8940dfafd39830219d3b37fe137efd1535b332de39b` |

## oh-seung-yoon {#oh-seung-yoon}

[Replay document](oh-seung-yoon.json) · [Original selection and quality](inputs.md#input-oh-seung-yoon). Selected original: `oh-seung-yoon_age-approx-16_lunar-new-year-interview.jpg`.

2026-09-16 maxillary placement candidate under joint review: a one-millimetre source-builder probe establishes the rigid upper-arch translation and its derivative in the recorded photograph frame. The median signed incisal residual gives one placement candidate. The retained trial document changes only `detail.dentition.placement.lift` from 4.4 to 1.8574765689179449 mm. Crown shape, aperture, material, camera, reference and all other authored values stay exact. Every non-dental model part is unchanged in observed, neutral and oral-gaze states; the upper arch is identical across these three states.

At 3 directly read source-image columns, mean absolute visible-incisal position error changes from 1.8667 to 0.4167 native pixels. Manual photograph-reading uncertainty is 1 pixels and final Float32 triangle sampling uses a 0.25-pixel step. These are fitted-column observations, not held-out anatomical accuracy or a likeness percentage. The readings distinguish visible enamel from total crown height and lip aperture; the [tooth-display study](https://pubmed.ncbi.nlm.nih.gov/20111761/) supplies that observation distinction, not this person's dimensions or a cohort value to impose.

The main agent directly read all nine views of both current and candidate in all three states: 54 images for this person. Hardware rendering used AMD Radeon 8060S with an independently specified 10-mm cube (45 expected pixels, 44 measured). The exposed upper crown band gains height and approaches the photograph. The initial review missed a small new enamel patch at the anatomical right commissure in neutral; the actual editor and reopened front/oblique captures expose it. Dental individuality, absent lower interior, optical aperture, angular nose and hair volume remain unresolved. The fitted-column improvement remains an experiment while the shared oral-space correction continues. **Whole-face likeness and complete oral anatomy remain unaccepted.** Finite visible-surface queries and sampled views do not certify continuous collision freedom.

Subsequent joint-contact audit: actual final Float32 upper-enamel versus head/lips intersects in observed 44 to 105, neutral 0 to 106, oral-gaze 39 to 73 triangle pairs; versus the legacy oral backdrop, observed 674 to 876, neutral 0 to 0, oral-gaze 546 to 560 pairs. These counts are intersection witnesses, not penetrated area or an anatomical severity score. Closed neutral has no oral-backdrop mesh. All four candidates expose the same deficient interior representation; improving a photographed incisal line does not resolve it. The review preserves all candidates and research, and does not claim the oral group is complete. Full interval and endpoint records are retained under `.shots/human-2469/investigation-2498/oral-state-contact` and `oral-cavity-contact`. The 12-state actual editor check reproduces every saved JSON, with four exact undo cycles. Eight GLBs match source bytes exactly; three Alan states and Oh observed each differ only by one Float32 normal component at one ULP, with all other bytes exact.

Retained trial document SHA-256: `96490a365edbaa16202a59525bbb0ec0ff52fc9bfc65734c54b0c50009fa7f07`; model: `0db98ee47a1c634f77d8afac835ba8309606e4a34557648faed30d43375a4e11`; GLB: `f288f860135ef2328cd203241ddd0d5bd4a5b7a812ddcb53fb54137915aab45c`. The retained current, probe and candidate populations are under `.shots/human-2469/investigation-2498/oral-arch-fit/oh-seung-yoon`; all comparison images and assessments are identified by the separate `direct-review.json`. The observed candidate images are:

| Observed view | PNG SHA-256 |
| --- | --- |
| front | `fda6a4426202d1742da3f5e37177c826fae3a10892b7021b6eddf58bc14e5e7e` |
| left-oblique | `2caf19d6cf83d9e42a8d2524eaec172a1534ed9c8aca82702e0533af86f47965` |
| right-oblique | `06c060fd577673ff001fa1f511001f93cea6c814f220fd31cd643ead7625fdd6` |
| left-profile | `020409e45b4291ac34fe199b9e2e2a1b8f3b68f1cd13f983f8f82ea1507c0273` |
| right-profile | `61b161c0f435b92cc9a0790e98ef20ff17046ff9c677f3b488bd83ddb177e383` |
| back | `9b0a7b6a034652cc1f1acbc00b8aa990a7affc1260deb93008d4f9db9c5906a2` |
| bare-clay | `b6761d2b0d453c28b4392c9ac1fe611a673211160293fee9f19897e8cf23cd83` |
| bare-oblique | `0e117a1132dd8a4a1438fa6b36825bb85af629c9f268cf07d528f639f9014f88` |
| reference | `9f3a7cbb017f8acdcd10dd03590239ec1c9a3fe1a441014950353fda9fc9a770` |

The following records retain their preceding revisions and artifact identities.

The small selected original supports a narrower eye aperture and less lower vermilion than the initial render. Reduce brow mass, lower-lid relief and the exaggerated oral band; depth and hidden orbit remain low-confidence because of the fringe and pixel count.

The smiling front/reference contain a wide, regular upper dental row and a broad dark oral gap. Both obliques and clay still show an over-regular inferior-lid shelf, heavy vermilion and simplified angular nasal openings. Profiles and back retain the common inferred skull/neck. An eye-opening reduction was refused by the orientation guard and removed from the proposed fit without weakening admission.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `d93c3883b75951d92268144227bbf75f4cf1b6242393b6530c264eb73168cbde` |
| Replay document bytes | `02dc76312b1aa9897daf36acc6c6a783cdb7a74f72ca32dc69c3f886ca300c8a` |
| Node model JSON | `d85df351171fd2519fb44b5cb6df133f6105cb92e37e526e0ce81012074b009e` |
| Rendered GLB | `a6a50686a29e79b973f642521a1fa29f28a71bffe68dd4561f10900ad6b4d6fa` |
| Capture profile | `c9207e094b53cb4d17f0c2d42524da51972fd28eda56dd748c2bbcd1060278d2` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-oh-seung-yoon`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `20c35300c066d38ffd4ff48e5cd28effb0dc22542c61eb4fb50569b07387a166` |
| front | `796daf2cb21694dc9deabbfa3544713868905e6292ca564a9ab8b33a07d50138` |
| left-oblique | `3d490c0c8d4e2d97d53cce555468b157d8a16ba2fcbc26ccffa6c165ec0bf275` |
| right-oblique | `54ff2e7ffeecb1cd2a34505105f423d9aef2d3437a452cd7a8e76cc6efd93450` |
| left-profile | `6d0e87b31920bd5e2a35349693974ab165bb5aa550d2da0bc2a9fdcebe03446a` |
| right-profile | `59ef72942579bbd53883511da6423b9b873c86451143416777ae2f3484005316` |
| back | `13ae702fe428252678f9a6376a17cd7f5ba74d1e1881fe7e745b9783a71c20b3` |
| reference | `10963212f60e6725039dcb597794feecf96abc6a4df904bd3555eaea69dfd03a` |
| clay | `ee83fedc5b7396c7812c73ffbc08b2a14fd9ba15e522240bb1012b8aaf9f3764` |

## park-eun-bin {#park-eun-bin}

[Replay document](park-eun-bin.json) · [Original selection and quality](inputs.md#input-park-eun-bin). Selected original: `park-eun-bin_age-20_minas-stationery-premiere.jpg`.

The reference has a smaller closed vermilion band, a less protruding lower-lid shelf and softer brows than the reconstruction. Keep the existing measured closed seam and unobserved skull declaration.

Front and reference retain a thin closed lip band with no exposed teeth in this pose. Both obliques and clay reveal overly even lower lids, an outer roll and a simplified narrow tip. Profiles and back show the inferred cranial/neck continuation. The photographed closed-mouth likeness remains unaccepted despite clean numerical replay.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `a9797e47d076de402e10e0b48b3ab9a665b9dd79f3f3dcf8753cafeb63ec02ff` |
| Replay document bytes | `89c150637517e9cbaa22cc90a963ea038b08be301909655dbb759600d65f1320` |
| Node model JSON | `fa6cde38ad5c8584f17981dcaef5002b2db5a65929d2b302b01f1590dad97898` |
| Rendered GLB | `4029665eed7f53c02cac8e2562482e9aebad0199bcda535fdb1701d8afc4e605` |
| Capture profile | `b34f5986ef9f3c4369ef86e16b1ec339d884fced411f53ee1a083a19eff221e8` |
| Node GLB (one normal ULP differs) | `c7e81f3781ab7ae0f97ff6ca04094f54bbe224eb426e74c5658a7890d2683e0e` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-park-eun-bin`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `27bfd8775f7c7be61ab2ead3472a93144ff38b715468b5eff207068cf0cee9e7` |
| front | `776f806fdcf2f5d22bcb60d7803a533055b055bf404e5218d727e6151bf899d5` |
| left-oblique | `666d69d3fba30e509b61cea535b77b03f5e6101ba614d520a62a414763cc641c` |
| right-oblique | `b4ef8b85434bef3115a0ced876ca6a17241f7ce2a26e4ffa2902a023d06f7b63` |
| left-profile | `340c22b6cf325f7dfa3089e3f45073ccdf0e0613a3e2aa8681b67a977686540c` |
| right-profile | `285fd66644fb8be1c01cf718750834faceedd088431dc94e202395de09d8e7f4` |
| back | `18295a12f686ceceb511b90816c99b48c23514a4b15854f8a33be5911e634bf9` |
| reference | `2f786468517225d404bbfbb7f311983491873a93228e4a4b96e57ae9a110a9e5` |
| clay | `46e730238588df25d172216c40b1a73ca346aa12e66878ef5250b6f563d7b3b0` |

## yoo-seung-ho {#yoo-seung-ho}

[Replay document](yoo-seung-ho.json) · [Original selection and quality](inputs.md#input-yoo-seung-ho). Selected original: `yoo-seung-ho_age-22_the-magician.png`.

2026-09-16 maxillary placement candidate under joint review: a one-millimetre source-builder probe establishes the rigid upper-arch translation and its derivative in the recorded photograph frame. The median signed incisal residual gives one placement candidate. The retained trial document changes only `detail.dentition.placement.lift` from 4.1 to 3.169522070272549 mm. Crown shape, aperture, material, camera, reference and all other authored values stay exact. Every non-dental model part is unchanged in observed, neutral and oral-gaze states; the upper arch is identical across these three states.

At 3 directly read source-image columns, mean absolute visible-incisal position error changes from 0.9500 to 0.7000 native pixels. Manual photograph-reading uncertainty is 1.2 pixels and final Float32 triangle sampling uses a 0.25-pixel step. These are fitted-column observations, not held-out anatomical accuracy or a likeness percentage. The readings distinguish visible enamel from total crown height and lip aperture; the [tooth-display study](https://pubmed.ncbi.nlm.nih.gov/20111761/) supplies that observation distinction, not this person's dimensions or a cohort value to impose.

The main agent directly read all nine views of both current and candidate in all three states: 54 images for this person. Hardware rendering used AMD Radeon 8060S with an independently specified 10-mm cube (45 expected pixels, 44 measured). A small increase in visible crown height is closer to the central photographed band; one outer sampled column moves past its former match. The aggregate change is within manual source-reading uncertainty. Neutral appearance is unchanged, and both profiles show no new exposed crossing. Large upper-lid hood, lower-lid shadow, angular nose and empty lower oral interior persist. The fitted-column improvement remains an experiment while the shared oral-space correction continues. **Whole-face likeness and complete oral anatomy remain unaccepted.** Finite visible-surface queries and sampled views do not certify continuous collision freedom.

Subsequent joint-contact audit: actual final Float32 upper-enamel versus head/lips intersects in observed 0 to 0, neutral 0 to 0, oral-gaze 0 to 0 triangle pairs; versus the legacy oral backdrop, observed 1179 to 1275, neutral 0 to 0, oral-gaze 844 to 846 pairs. These counts are intersection witnesses, not penetrated area or an anatomical severity score. Closed neutral has no oral-backdrop mesh. All four candidates expose the same deficient interior representation; improving a photographed incisal line does not resolve it. The review preserves all candidates and research, and does not claim the oral group is complete. Full interval and endpoint records are retained under `.shots/human-2469/investigation-2498/oral-state-contact` and `oral-cavity-contact`. The 12-state actual editor check reproduces every saved JSON, with four exact undo cycles. Eight GLBs match source bytes exactly; three Alan states and Oh observed each differ only by one Float32 normal component at one ULP, with all other bytes exact.

Retained trial document SHA-256: `79ca71ae672baa9432346092fe95709e985f756c857a218b0ae36ec0b646061a`; model: `6ad5f6f1ad862a703c908333f562111bbd97954d53d6ddaf1a66f0574d0e1f03`; GLB: `0294ee577f9449afdd22c33e4657e8d29c2432923d5689d96ffc88dc44491c87`. The retained current, probe and candidate populations are under `.shots/human-2469/investigation-2498/oral-arch-fit/yoo-seung-ho`; all comparison images and assessments are identified by the separate `direct-review.json`. The observed candidate images are:

| Observed view | PNG SHA-256 |
| --- | --- |
| front | `3e764a1538613d0925d898da57c1c3f7b285c4b26979853ace63256dcda502cd` |
| left-oblique | `9ae96950d1178e64e4096170bceee6a5f12b38de327e74ebb650b78ee4c5b2fb` |
| right-oblique | `32e8c070ef7bc6b5a83988d8607591c0dc5a5cdad4ee40c4b3d39a90a22fd581` |
| left-profile | `38fe8d3b555f9c70b8cbc4b3e42cd40a3e340abb9ce017c44cf3ba3c560c5c90` |
| right-profile | `f132ffffebb6b2818a891830bdbdd703c4823c3c0b0426f6c268ace47fb6cb72` |
| back | `082dcbeef1e44f4f799df187e944c6eb27bee13fab85f306a755399003c91686` |
| bare-clay | `b6827fca6abc7e1dcc1a490b5102949b1656244c4aae4c7731601088e5dc01a5` |
| bare-oblique | `9541abe8c8dbab6bf3c623f232c63afc72ff9532b4d11d35df17750a80e62238` |
| reference | `23524a418f88367f1b5fa32f65e5c7afb0423cb710319bb6683eae299a49e918` |

The following records retain their preceding revisions and artifact identities.

2026-09-16 optical partial adoption: the current document sets `sphereFit: observation-ray`, `opticalFrame: radial`, `canthalSupport: tangent` and `surfaceRadius: 12`. All other authored values, source identity and observed expression remain exact. Two independent complete builds reproduce the retained candidate's model and GLB exactly. The spherical radius is an authored approximation at human-eye scale, not person-specific biometry. [Adult CT measurements](https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/) describe varying, unequal axes; [juvenile longitudinal biometry](https://pubmed.ncbi.nlm.nih.gov/23575156/) measures axial growth. Neither establishes a universal 12-mm spherical radius or a radius recoverable from this photograph. The fixed-canthus hull is geometric support, not a measured conjunctival surface.

All nine views in each of observed, bilateral blink and oral-gaze were directly inspected: 27 views for this person, under AMD hardware rendering with an independently specified 10-mm calibration cube (45 expected pixels, 44 measured). The open-eye reflection and rounded globe are clearer than the baseline's flatter optics. Lower-lid protrusion and shadow remain more prominent, and the superior orbital body is excessive. The profiles retain angular nasal, jaw and cervical planes; the rear groom remains a regular cap. The open-mouth diagnostic retains an overly regular upper row and sparse interior. In full blink the optical apertures are covered; that sampled closure does not validate natural blink motion. The optical improvement is adopted while the coupled tissue work continues; **whole-face likeness remains unaccepted**.

Current document SHA-256: `16db8bcb61396716e4a36008469bfd0441df484f93f741b85573d6d05ea732e5`; model: `eaee249193c4bf34d623bec4990ec3143f1f57d4118da09cae370325a78a7942`; GLB: `97cfbbe47f89bb1bc80674d70a98a9ea66d144070c7dc30b8a0b89cb2ca0e97e`. Current full-view capture directory: `.shots/human-2469/investigation-2498/optical-adoption-views/yoo-seung-ho`. The close baseline comparisons remain under `ocular-fit/yoo-seung-ho`, and the complete per-state input/model/GLB receipts remain there. The table below identifies the directly inspected observed images. Left/right filenames use camera yaw: negative yaw sees the anatomical right side, positive yaw the anatomical left.

| Current observed view | PNG SHA-256 |
| --- | --- |
| front | `e1470c2ca81afcab6a8c8ee8033707d2b981164fc09de64fec10ee0323b05324` |
| left-oblique | `b4a17548b6bff6c31cf9f448a19ffb6de2e8fe80d8c5f5ef53555b1f7d3dc6fe` |
| right-oblique | `889b1cf999b1f70b518164434aace26b9dec07eed425fab79f72abf9c76e39a3` |
| left-profile | `bd696f666c4485597bb95a2cf24ab399773a32d7030e447fdb187d6a62554331` |
| right-profile | `5d126daec8ed93aba745d04bd237cc91629d2ccefada73c8f481fa69b6f54c5d` |
| back | `082dcbeef1e44f4f799df187e944c6eb27bee13fab85f306a755399003c91686` |
| clay | `e0cbf36eaa16d264785b0a4862367e43e37d13cbf425253f8a74e9f925182105` |
| clay-oblique | `1a90f6a75bf9f1012b7d1fef2f268ff66472fc7ce16ecb21a76c80881d09bed7` |
| reference | `da8ebafa0c0edc568c427958e2b0f02b8a13b586cbd25c8beb5e78a85c902a6e` |

The following entries preserve preceding revisions and their own artifact identities; their use of “current” refers to those earlier checkpoints.

2026-09-15 fringe revision: the final 96 hair-card guides and their transverse frames now sweep laterally toward hand-observed fringe endpoints. The other 312 cards, every non-hair part, all materials including generated hair textures, identity basis, reference and expression remain exact. Two independent complete source builds and GLB exports are byte-identical. The adopted GLB is 7,217,076 bytes, SHA-256 `d145d95049dd7d4f4f93644aa9ebbce470f831ca40ee754dd9e5ecb9677af7c6`. The other eighteen subject documents remain byte-identical across this adoption.

All thirteen observed views were directly inspected, together with the previous reference comparison, rear view and right profile. The fringe flows sideways instead of ending in vertical spikes, but its uniform clumps, broad crown strips, crown gap and patterned shadows remain artificial. The directional-light view still exposes the unresolved orbital volume, uniform brown skin, simplified nose and mouth. This is a partial hair improvement, not a likeness acceptance. Current capture directory: `.shots/human-2469/subject-fringe-contour-visible/yoo-seung-ho`.

The six hand-observed image columns are a sparse 2D fringe-boundary study, not an anatomical or likeness score. Fitting nominal guide endpoints first left the alpha-tested visible boundary too high. After an 8.5-image-pixel nominal extension, the last-fragment residual is 0.73 to 2.18 pixels in magnitude, but a fractional-pixel translation probe exposes up to 2.10 pixels of sampling sensitivity. A separate lock-body boundary, defined by a four-image-pixel-wide, three-raster-row box at 25 percent occupancy, has residuals of 0.35 to 3.31 pixels and a maximum 0.43-pixel shift error for this candidate. Both measures follow an exact seventeen-raster-row translation exactly. These observed probe results do not establish a universal uncertainty bound; the manual photograph annotation has its own uncertainty. The records retain both measures rather than presenting the unstable fragment residual as subpixel accuracy.

Neutral, half-blink and full blink were independently rebuilt and captured in thirteen views each; front, right profile and clay oblique were directly inspected for each. Their non-hair parts exactly match the corresponding pre-fringe expression, and their hair part exactly matches the observed candidate. The original lip separation remains in the blink documents. The rebuilt actual editor selects the new document from nineteen built-in choices. Observed, neutral, half-blink and blink save exact JSON and export byte-identical GLBs against their independent source builds; undo restores the observed document. Four editor fronts were directly inspected out of twenty-four captured views. AMD 8060S rendering, a measured 16-pixel calibration cube and zero page errors are recorded in `.shots/human-2469/yoo-fringe-built-in/receipt.json`. This verifies these authored states, not natural motion or likeness. The editor paragraph below records the earlier aperture revision.

The following aperture measurements and editor record precede the fringe revision. The eye values remain adopted, but their recorded GLBs do not identify the current groom.

2026-09-15 aperture revision: removing the common `eye.openingScale` override of 0.89 restores the unchanged observation recipe's 1.025. Actual projected lid-boundary height divided by the recorded observation changes from right 0.88727 / left 0.86149 to right 1.00750 / left 0.99810; width ratios are right 0.99199 / left 0.99561. These measurements describe aperture, not likeness or certainty about photograph-derived anatomy. The complete observed model and GLB repeat exactly in two independent source builds; basis, reference, caller and all materials remain exact. The observed GLB is 7,217,076 bytes, SHA-256 `708b2ffd03829ce94fab14ce095869de09267517e8109764b866a7cd8b302eb6`.

All thirteen observed views and the fresh baseline reference comparison were directly inspected under the same directional light and camera procedure. Neutral, half-blink and full blink were independently built and captured in thirteen views each; front, right profile and clay oblique were directly inspected for each state. The opening narrows at half-blink and the lids meet at full blink in these views. Neutral closes the mouth because every expression channel is cleared; the blink documents retain the observed lip separation, so their visible enamel is not a blink-induced mouth change. Heavy orbital and lip bodies, simplified nasal volume, brown uniform skin, regular crowns and the straight striped fringe remain unlike the source. Only the aperture improvement is adopted; likeness remains **unaccepted**. Current capture directory: `.shots/human-2469/subject-eye-observation-opening/yoo-seung-ho`.

The rebuilt actual editor selects the current document from nineteen built-in choices. Observed, neutral, half-blink and blink each save exact JSON and export byte-identical GLBs against their independent source builds. Undo restores the observed document. All four editor fronts were directly inspected out of twenty-four captured views, with AMD 8060S hardware rendering and no page errors. This verifies the authored states and export path, not a natural blink trajectory or full likeness. The local editor record is `.shots/human-2469/eye-opening-built-in-yoo-seung-ho/receipt.json`; its inherited prose mentions eighteen captures, while its four state entries and six saved angles per state record twenty-four.

The following face-only observations and artifact identities are historical and do not identify the current hair-bearing aperture revision.

The source has a narrow partly open mouth with only a small tooth strip; initial replay shows a much larger, uniformly exposed upper row. Reduce current lip separation and reposition the maxillary arch while thinning the vermilion and brow mass.

Front/reference retain slightly parted lips, visible upper enamel and narrowed eyes. Both obliques and clay still show heavy lip and lid bodies, and the profile jaw remains angular. The two profiles and back confirm the actual inferred rear continuation rather than a source-observed shape. The small selected original and fringe limit superior-orbit and fine surface measurements.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `546557eca12ac82a3f52dfd19f2b25ae867bbeb7c4e449bb6c517816785df56f` |
| Replay document bytes | `47ae4be8cc51074cde6fd3b662e846c2d50763b844d8c21fbb805266395ffb2f` |
| Node model JSON | `4c96ef8296ec88e0b9d8330f949bbe7deaf1db40ae6bf73bc0b7ab3164583f95` |
| Rendered GLB | `5cd6e7ed59a8e69178f32c667b70c77267de79ac34da9092f5a7841a545a6f7c` |
| Capture profile | `bd50e2150f50b5520a452555769e11d01b95d82da1ca4d95371f505818788963` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-yoo-seung-ho`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `f454ec35cd7d4ef5c4e9baf59b0b54b9c377cb563f474b56bdb59edbc097cbcb` |
| front | `74204695f87ce574625cff9ca64402db76a49812becbbd2baab0336ed2b30c7d` |
| left-oblique | `a0a47601c91a690b69072826277037d95a87f937ee4c8d6d2a5f609de8427bbb` |
| right-oblique | `65bbd215b0121a37ccaa3f19b4b1468d75deee09207974470b8676de3c8ec1a8` |
| left-profile | `5f7ddc27da898b4b541500d3b73dfec816e882591b9ddfcb8b470c80830a833f` |
| right-profile | `8c45285bf44f190dec70046b802be2f105f12c2c6a3957ed8ff13d0c02962e99` |
| back | `5e83326dd594a7b449939763daa565913780151cd0d43bb759987e352903b8d1` |
| reference | `19e0bb735b2fcda6e3bf817bc61fa03bfbbb04ac8e8ba5e05d9f0b027ccf4b12` |
| clay | `e736e2cb362bbfbf4dd61bdb2debbab48ab57807e8bfb4333da16ea2d0544ea7` |

## alan-rickman {#alan-rickman}

[Replay document](alan-rickman.json) · [Original selection and quality](inputs.md#input-alan-rickman). Selected original: `alan-rickman_age-65_portrait.jpg`.

2026-09-16 maxillary placement candidate under joint review: a one-millimetre source-builder probe establishes the rigid upper-arch translation and its derivative in the recorded photograph frame. The median signed incisal residual gives one placement candidate. The retained trial document changes only `detail.dentition.placement.lift` from 4.1 to 1.9137835445429685 mm. Crown shape, aperture, material, camera, reference and all other authored values stay exact. Every non-dental model part is unchanged in observed, neutral and oral-gaze states; the upper arch is identical across these three states.

At 4 directly read source-image columns, mean absolute visible-incisal position error changes from 8.1250 to 2.8125 native pixels. Manual photograph-reading uncertainty is 2 pixels and final Float32 triangle sampling uses a 0.25-pixel step. These are fitted-column observations, not held-out anatomical accuracy or a likeness percentage. The readings distinguish visible enamel from total crown height and lip aperture; the [tooth-display study](https://pubmed.ncbi.nlm.nih.gov/20111761/) supplies that observation distinction, not this person's dimensions or a cohort value to impose.

The main agent directly read all nine views of both current and candidate in all three states: 54 images for this person. Hardware rendering used AMD Radeon 8060S with an independently specified 10-mm cube (45 expected pixels, 44 measured). The observed smile shows taller upper enamel and a smaller excessive black band, closer to the photograph. The remaining unequal residual and dental gaps require individual crown/arch investigation. The initial visual pass did not identify a crossing, but the subsequent triangle census below refutes a no-intersection interpretation. Nasal planes, lid bulk, thin neck and missing lower interior remain unresolved. The fitted-column improvement remains an experiment while the shared oral-space correction continues. **Whole-face likeness and complete oral anatomy remain unaccepted.** Finite visible-surface queries and sampled views do not certify continuous collision freedom.

Subsequent joint-contact audit: actual final Float32 upper-enamel versus head/lips intersects in observed 0 to 28, neutral 0 to 32, oral-gaze 37 to 58 triangle pairs; versus the legacy oral backdrop, observed 801 to 1589, neutral 0 to 0, oral-gaze 494 to 770 pairs. These counts are intersection witnesses, not penetrated area or an anatomical severity score. Closed neutral has no oral-backdrop mesh. All four candidates expose the same deficient interior representation; improving a photographed incisal line does not resolve it. The review preserves all candidates and research, and does not claim the oral group is complete. Full interval and endpoint records are retained under `.shots/human-2469/investigation-2498/oral-state-contact` and `oral-cavity-contact`. The 12-state actual editor check reproduces every saved JSON, with four exact undo cycles. Eight GLBs match source bytes exactly; three Alan states and Oh observed each differ only by one Float32 normal component at one ULP, with all other bytes exact.

Retained trial document SHA-256: `d71fdb477a7ba5ce52d45a21fbaaaad85eaeab9ff7e5be48df72368bf14d574c`; model: `90dbe1643a81fd01b42abccc91b6aa0ae677c0021c8dac7c2cf15ef9aacd672f`; GLB: `80724b3cbdd005db030734ff4bd5af75dbd37dc389d802038171cbb180efeba7`. The retained current, probe and candidate populations are under `.shots/human-2469/investigation-2498/oral-arch-fit/alan-rickman`; all comparison images and assessments are identified by the separate `direct-review.json`. The observed candidate images are:

| Observed view | PNG SHA-256 |
| --- | --- |
| front | `15d1cfe64df16e34b1a6a64801a33e70e16304fc837faef4be6cc4cce631e6a5` |
| left-oblique | `86ae5cd497e3483efe34f41e1547aec437bf5db6a28bfde376fbcbddf97e49a1` |
| right-oblique | `1794ea210bf5690e192a309a266955ea2ae15e8390b8a7bb1f5ef4dd0d291894` |
| left-profile | `d5fe37786af613bec3f4218de3f54ac4bad3a104676005f9bf11842b279dede7` |
| right-profile | `e3acba74dfb403a8635461c012ff6f49bab171ed532173e6d54983fcf9d1d42a` |
| back | `33a6308fb981cfefc78153cb7443a41a3366f3e8e02ce919666a9a03ee462dc2` |
| bare-clay | `f17e2facba72b10ef0e93f1a26e5db80bf4ffd5dc65af6f79b7e9cc18ff60b7c` |
| bare-oblique | `c5a7e003a7878a53c8f6e8c1dfe295413cdfb27c71b1f06b4396103116a5811c` |
| reference | `9a568c489f1dbe42f79c61eef2ed47d17216dcc18e2fd416e9c00a439677f940` |

The following records retain their preceding revisions and artifact identities.

2026-09-15 aperture revision: the current document removes only the common `eye.openingScale` override of 0.84 and inherits 1.025 from its unchanged observation recipe. Projected actual lid-boundary heights, divided by the independently recorded basis heights, change from right 0.82434 / left 0.80697 to right 1.00290 / left 0.99191. Width ratios remain right 0.98251 / left 1.00400. These are geometric aperture comparisons, not a likeness score or proof that the photograph-derived basis is exact anatomy.

The observed document builds twice to identical complete models and GLBs. Materials, basis, reference and the caller remain exact. Shared attachment reconstruction also changes head and nostril tessellation, so this is not an eye-only mesh delta. Matched lip vertices move by at most 0.000397mm; differently tessellated parts are not assigned a fabricated matched-index displacement. The observed GLB is 8,429,716 bytes, SHA-256 `e6f7f1bd00124a92cc3d334774fcdcee6bff623939de845d2889fa356ece6b30`.

Fresh baseline and candidate captures use the same directional lighting and camera procedure. All thirteen candidate views were directly inspected: front, both obliques, both profiles, back, two close clay views, three full clay views and two registered reference distances. The former aperture is too compressed; removing the override improves its opening while preserving the recorded asymmetry. Neutral and bilateral blink were independently built and captured in thirteen views each; front, right profile and clay oblique were directly inspected for each state. The lips close in neutral and the lids meet in blink in these views. Deep orbital shadows, simplified nasal and oral volume, smooth young-looking tissue, brown uniform skin and striped cap-like hair remain. This is a partial aperture improvement with likeness **unaccepted**, not physiological performance certification. Current local capture directory: `.shots/human-2469/subject-alan-eye-opening/alan-rickman`.

The rebuilt editor loads this exact built-in document and preserves saved JSON, neutral, undo and bilateral blink. Three of its eighteen captures, the front of each state, were directly inspected. Strict browser/Node byte comparison fails: each state differs in one skin NORMAL Float32 component, 0.507296621799469 versus 0.5072966814041138. All other bytes, including positions, indices, UVs, materials and textures, are exact. The observed browser GLB SHA-256 is `8d5dfb3a97deb5ac437a48692c23312df588b1ce976a574e891d9af83f75a930`. Separate audit records retain this mismatch; each saved state was independently rebuilt in the browser and required byte-exact same-runtime repetition. A negative probe refuses a two-step normal change and any one-step position change. This measurement does not identify the originating arithmetic operation or claim exact cross-runtime normals. Local editor record: `.shots/human-2469/alan-opening-built-in/receipt.json`.

Earlier face-only record, retained separately from this aperture revision:

Direct source comparison: the inferred aperture and tooth exposure are too broad, creases too regular and lips too full. Narrow current lid/oral openings, lift the maxillary arch and reduce vermilion bands. Age-related fine folds and far-side skull remain unaccepted, not inferred as measured detail.

The oblique source pose, asymmetric eyelid opening and explicit chin-frame edit are preserved in the recorded build. Front/reference and clay look markedly younger than the source: wrinkles, tissue descent and individualized perioral volume are not recovered. Both obliques and profiles show simplified nasal, lip and jaw form. Back retains the common posterior lobes. One eyebrow's sparse fibres are legible in the close reference view; this is not a mature aged-skin reconstruction.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `6f96dff142f3200a9823391b6301ec2cd32526dec0153d3455c036a1a1ebfa5c` |
| Replay document bytes | `b538e398a8d28849ad93a47408501592eca6f56dd256cb6c6ae3393de87d79a2` |
| Node model JSON | `fdd4ad4a1b97148652400ed1fabfca5c176aef65e3578eefedff425bf4077806` |
| Rendered GLB | `8580b6d0154858b6056da4ff10f7ecbac29e106f7131c0336baf5633c8ee0a20` |
| Capture profile | `93db06ebc0afa9b74939fc02170b12853c05cb4d9e4d9a2807e20b331653a0ad` |
| Node GLB (one normal ULP differs) | `867597706cf8ec70d1eb6f4bd10954ea4eb4bbc328ad06592e4c489f6bed86d8` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-alan-rickman`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `6ce443460900f983d90952b2d7f8e85fb312a599fcff26b64a1e84fe85a7683a` |
| front | `df299dba7c9c9eccb6ec933f64019c4f259a7bdb1dc8691009428539fc0d8635` |
| left-oblique | `ce7a91e176f8b7a98eff60cd1b997412e1308a1c635c0c8aacf93bdffda47e58` |
| right-oblique | `1a1024b8e27db6109f3e4022b0e478f0248ab7c58b28ad6efaeb68cb63b5d221` |
| left-profile | `15a73addbd6d9f2d6edef6211de6f103e0bef41f16241ed55bd73f1095178db9` |
| right-profile | `19cff2f08b71a819aa1afe02e39244cb640cc70a0e745ad3cd36d46c0420e195` |
| back | `8814dd6a62a11b641ca19ef584adaf26454761670f8f12f721008dd5f4a19a91` |
| reference | `46a16249eae4839f7ad0f04306761817a91e9cae9e54f9cf5d8e9c3de5217d7d` |
| clay | `c961bc4d907ca2e7c87d023f9926392603be767a19d91da95b0a34be14b4eec5` |

## daniel-radcliffe {#daniel-radcliffe}

[Replay document](daniel-radcliffe.json) · [Original selection and quality](inputs.md#input-daniel-radcliffe). Selected original: `daniel-radcliffe_age-13_chamber-of-secrets-premiere.jpg`.

The selected large premiere photo visibly includes lower incisors. Add their independently dimensioned mandibular row, retain the broad smile, reduce lower-lid shelf relief and regular brow mass, and narrow the lower vermilion band.

Front/reference show the broad upper row and an explicit lower dentition, but only a thin lower enamel sliver is visible in this pose. The oral gap is broad and dark, and crowns remain regular. Obliques and clay expose simplified angular nasal support and lid/brow bands. Both profiles and back retain inferred cranial/neck form. No obvious interarch protrusion was seen in these recorded views; no global dental collision certificate is implied.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `07fefaaaa62b12cd47ea9b16da23ef7045c1784f6cde2e963118d86b7de0d48f` |
| Replay document bytes | `c5291fd81ffbbf822de555608269abcb6dee1ec423ca5f00449a1e5782a14da7` |
| Node model JSON | `9056a52ae6138735059fdc906e1599e168ce1ee34e302b0f159bbb58f7cc8554` |
| Rendered GLB | `2fe7481b8f9ca448e57206f684f2674b60a10f892112bc367e1975883361a0c6` |
| Capture profile | `b8f8cc4c108b7f3dedb1ea28de2659710c5431f25ed9dc18c591c3742b5a8afa` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-daniel-radcliffe`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `0fcd7109bf101db1f23e24d1dd80eabfb354866c2b772aa8f814d3b85a3263fa` |
| front | `e9aab45811087f200ba33d918210b852ef1a28037855f6bd87cef6e563b9861c` |
| left-oblique | `aa9994b6995dac8d52401a79990682f0eccc91781f5e547131ed565756f2491e` |
| right-oblique | `1081161a5be3f5cde1c0aa421e9157b6a739ad17eee13d65773ce0352028f84c` |
| left-profile | `79ff316b480f627d63e589a77a986c97f1f549d1dcc75b2d8b47ad314c8998c5` |
| right-profile | `b6ce91d6b96421380ae6cc53b0cbb95827c7293e2191cb868141f10aee73d795` |
| back | `63a7a21b2c69de2ef19f3ebc664cddb9e9a145731292c4bf4e81fdf508a6c15f` |
| reference | `bcd23b5099a7503c5fc79fb3f00a7ffab11b52c91eb4857ab73092d423e1f561` |
| clay | `b86fe29780b33cd9066c90589bc6d91af45a6c0e088b5f2277d7b3f9b65233b1` |

## emma-watson {#emma-watson}

[Replay document](emma-watson.json) · [Original selection and quality](inputs.md#input-emma-watson). Selected original: `emma-watson_age-24_british-fashion-awards.jpg`.

The current surface-haired study adopts only a global skin-colour adjustment, from linear RGB `[0.61, 0.37, 0.29]` to `[0.9662499999999999, 0.72625, 0.6162500000000002]`. Camera, geometry, expression, roughness and review lights remain fixed. Cheeks and chin supply the fit; nose and both orbital bands are held out, and the hair-covered forehead is excluded from both groups. The directly inspected source overlay excludes eyes, brows and vermilion from the skin samples. On the 0–255 RGB scale, training-region RMS falls from 61.95 to 32.93 and held-out RMS from 44.19 to 36.90. The held-out score rises slightly during the later training improvements, so neither the numerical fit nor the selected colour is a complete facial reconstruction or a recovered physical albedo.

Two full source builds and exports agree exactly; every part and every non-skin material is unchanged, as are the observation basis and reference. The main agent inspected all thirteen new views, including front, both obliques/profiles, back, five clay frames and both registered distances. The previous dark brown cast is reduced, but pale uniform skin, heavy orbital planes, nasal form, lip volume and ribbon-like hair remain unlike the photograph. The actual AMD capture measures 44 pixels for the 45-pixel reference cube and records both resident texture samplers at 16 with no page errors. This is a partial colour improvement, not accepted likeness. Current capture directory: `.shots/human-2469/subject-skin-fixed-fit/emma-watson`; GLB `82a9a056463c8a87f9d55dc1beb2ead9a3aed3ced79ecbcdedf7a74a2c6f32b7`, 6,327,424 bytes.

The rebuilt editor's built-in Emma selection and its actual JSON/GLB downloads match that current document and independent source exactly. The separate receipt in the capture directory's `editor/` records AMD8060S, 16 expected/observed calibration pixels, nineteen subject options and no page errors. Six editor angles were captured; the main agent read front, left oblique and right profile. The colour survives the wider actual editor framing; those checks do not accept the remaining anatomy, hair or skin variation.

The following paragraphs and table retain the earlier hair-free construction review.

The original closed-mouth makeup portrait has thinner vermilion and less rigid brows than the reconstructed face. Reduce those bands and inferior-lid relief. The sharp inferred under-eye planes remain a defect requiring direct final inspection.

Front/reference keep the mouth closed and the thinner authored vermilion, but the inferior orbital surface has conspicuous triangular planes. Both obliques and clay confirm that these are visible shape defects, not merely makeup colour. Brows and nasal form remain simplified. Profiles and back show the common inferred skull and neck. Makeup and lighting in the selected source are not treated as anatomical measurements.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `64f7bb7d4f390a9246a4b9ffa9b6aa88c7f9f04a96fc484d25eddb3ccc4eab87` |
| Replay document bytes | `42ae404b62888067cdff32de06857de3761df4b8fa20d8fe2274ea07ddfe5a9d` |
| Node model JSON | `940fbcc32de86058f7c99bc855cf66f05c21f67a0006e1bd4c83936488dee446` |
| Rendered GLB | `e87ff5fbfbe32fd38b870e410ae969b6649883368744fadc929cfdcfbe8754b0` |
| Capture profile | `9f092706fcd20f188269a0fa1b92e63f0c1d035d971504e88bad7525289d69f2` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-emma-watson`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `2e841d0fed347d063af4d5b3103c8e03e2f98dbcd3091da650beba024defe805` |
| front | `d4e89187cf46fa6c2f77b760964d9747c7eec59635319add81a2b71af92bdbcb` |
| left-oblique | `e479fae5a716a205d09ccb6eb69505e10c4d05ad6e19494b041ad4a4de71d5aa` |
| right-oblique | `ffa6aa5e483fd1cb19494a3f35d5c94c980221b002e1fb927bbe5d13fc94d968` |
| left-profile | `ad41e937521729204da10f400731b1bd9f1ea94463fd2248f0b17807b3b7bcb0` |
| right-profile | `d90ae1048326ab21d7b37bee78b33d37ee76313b8435903c5b637b35085c6795` |
| back | `dc6194d168006b55518e0a6925218b45fc899d65fb15f8b81e756668f259201f` |
| reference | `beb231b4be1bd8d04a8fb1392ab0571db2d4f93da98af0010143609be58b0c1a` |
| clay | `6bcc9e31abac3dfaaf9eb6849e6cf009ab3156ffad3ec5d4e5165dcd45c9fa58` |

## generated-white-boy-01 {#generated-white-boy-01}

[Replay document](generated-white-boy-01.json) · [Original selection and quality](inputs.md#input-generated-white-boy-01). Selected original: `generated-white-boy-01_age-15_front-smile.png`.

The source iris reads olive/hazel rather than the initial blue-grey palette. The photographed lower vermilion is thinner, the upper row is less uniform and brow fibres have softer edges. Correct the owned pigment and these profiles while retaining measured facial proportions.

Front/reference retain a narrow-eyed smile, a broad upper row and an open dark oral gap. Both obliques and clay show regular block-like crowns, strip-like brows and an angular nasal base. Profiles and back show the shared inferred skull and neck lobes. Lower-lid relief was reduced, but the observed lid shape and smiling tissue remain too generic.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `b6f4b18d0de389e4fa74255576aa30efca080d77d858231120bc3314d85df12c` |
| Replay document bytes | `4fb30920eb203a7cb441458f415f189850052078883b295fb78fc052c110d399` |
| Node model JSON | `b0580e297884e7461266c8ef7fce78db07ef218246d263e6ca5c79bc1d2d6045` |
| Rendered GLB | `edf7de744f278b60c29c88b49e168a379a31f331586069b1d4f1ed66863daedc` |
| Capture profile | `212a1383484c35a635fabd0b2e1f960773575c7d2c6cbb613de054e1a34e8b6c` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-generated-white-boy-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `e096783aeb24a04e974da9a15f080093c3bb76d18b0ea4709990e7ce25a2417b` |
| front | `d08e2b2529a6f8bec63d57f4d27f905765b86c3648a31b4c01617f06f07dbdc2` |
| left-oblique | `224a746ed20abf5b2c7f446be6e42a52909580ef75179b48d7e4d888266a7043` |
| right-oblique | `830c6814604e6f7b6864adeaa4a990a4d7689845a19de18e2f8ff728b6e518eb` |
| left-profile | `af50a6bc6c73cb6b4b11b1e478dadee4f9cfde13b2c2ee6ea33fd1aa17afeee7` |
| right-profile | `c7561eb4d18fd41739a739de5713aa367ced1052810425177f59c5585ea412cc` |
| back | `fdef112e83997fc8245aa0902845e29a7140fb44f77a0436667fe7d3f615300a` |
| reference | `1017f4d6ff514ac8aaa9307c8507cf4d69618c4358fa8b2bf5daffa33650772a` |
| clay | `017d5ae80d7bb267ea18d87703385a9e4c6fdcfad73b8e66923ca385995a1f66` |

## generated-white-girl-01 {#generated-white-girl-01}

[Replay document](generated-white-girl-01.json) · [Original selection and quality](inputs.md#input-generated-white-girl-01). Selected original: `generated-white-girl-01-age-14.png`.

The oblique original has a smaller visible tooth band, softer brows and green-hazel iris pigment. Keep hidden-side and posterior shape marked inferred; refine only the observed facial features.

The oblique reference pose retains lateral gaze and a smile, while the frontal view exposes the inferred opposite-side proportions. Obliques and clay show overly regular crowns, a broad dark oral gap and simple thin lid rolls. Profiles and back show inferred hidden anatomy and the common posterior lobes. The far side is not independently observed in the original.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `58cae33a788066f88a6b5f1a26894569802a22cbf2aff9d2f511c787543ee316` |
| Replay document bytes | `f4e3117d32bcc22cae20d5d12f5e4da05ab5ec1ae4053fb8be13febd9a3898df` |
| Node model JSON | `3cb48555d62d53c9789b23c19b3d9de68f231240d51baee11cf9ecfc9e28b410` |
| Rendered GLB | `ff4b0ffb17966b919eff70ac10041b742a36ba9a72224f6955f8528aad4fb2cc` |
| Capture profile | `a1d16c840a101e17ffe5ac23ded626810decaed2e5e8042077e704c47927a9c6` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-generated-white-girl-01`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `cbdd25d79dda6162b8cf155e7a4a0992151a001c3b8e11c9ac9d688d1fe04d33` |
| front | `6db5132070351cbc811f753b66a0d9abf7f7707aaac170781acc1571b8c051e4` |
| left-oblique | `e882be77a24e0b8a752a691971e5db1f2b4b771e578a3153c51f38f5e1e78e55` |
| right-oblique | `8eea5f7146cc8e760a529905ce014a0ce7e946487b18117f813c3b2bec2b1dc6` |
| left-profile | `b7fc5697cc1bc7188eaa0828134c78ac2cd63b129550b1de636c1fa8799a300b` |
| right-profile | `848ef6804de1387b4d576cfe4214c2eeed88fd3ad6103c4d4dee9ce0e28b356d` |
| back | `867b04ca68b69232c9c348157ec93bffcfdf591b7fdf15e7c756e97a2bcb42a0` |
| reference | `6a0a72d7a2eac7b585ec96fb35c509ee85c1c1b482601a847086bb482d784f18` |
| clay | `de48d5e7d7e20a72199dd3157d6b6734d81c2bbc486b467e25ef986a19842389` |

## maggie-smith {#maggie-smith}

[Replay document](maggie-smith.json) · [Original selection and quality](inputs.md#input-maggie-smith). Selected original: `maggie-smith_age-80_lady-in-the-van-photocall.jpg`.

2026-09-16 maxillary placement candidate under joint review: a one-millimetre source-builder probe establishes the rigid upper-arch translation and its derivative in the recorded photograph frame. The median signed incisal residual gives one placement candidate. The retained trial document changes only `detail.dentition.placement.lift` from 5 to 1.0325601508304607 mm. Crown shape, aperture, material, camera, reference and all other authored values stay exact. Every non-dental model part is unchanged in observed, neutral and oral-gaze states; the upper arch is identical across these three states.

At 3 directly read source-image columns, mean absolute visible-incisal position error changes from 3.1000 to 0.4833 native pixels. Manual photograph-reading uncertainty is 1 pixels and final Float32 triangle sampling uses a 0.25-pixel step. These are fitted-column observations, not held-out anatomical accuracy or a likeness percentage. The readings distinguish visible enamel from total crown height and lip aperture; the [tooth-display study](https://pubmed.ncbi.nlm.nih.gov/20111761/) supplies that observation distinction, not this person's dimensions or a cohort value to impose.

The main agent directly read all nine views of both current and candidate in all three states: 54 images for this person. Hardware rendering used AMD Radeon 8060S with an independently specified 10-mm cube (45 expected pixels, 44 measured). Previously truncated upper crowns now occupy a visibly closer share of the photographed smile. The result improves the front, both obliques and registered reference view. Neutral appearance stays unchanged, and both profiles/open-mouth views reveal no new observed crossing. Missing lower oral anatomy, synthetic aging, lid bulk and hair silhouette remain unresolved. The fitted-column improvement remains an experiment while the shared oral-space correction continues. **Whole-face likeness and complete oral anatomy remain unaccepted.** Finite visible-surface queries and sampled views do not certify continuous collision freedom.

Subsequent joint-contact audit: actual final Float32 upper-enamel versus head/lips intersects in observed 0 to 0, neutral 0 to 0, oral-gaze 0 to 0 triangle pairs; versus the legacy oral backdrop, observed 801 to 1321, neutral 0 to 0, oral-gaze 558 to 958 pairs. These counts are intersection witnesses, not penetrated area or an anatomical severity score. Closed neutral has no oral-backdrop mesh. All four candidates expose the same deficient interior representation; improving a photographed incisal line does not resolve it. The review preserves all candidates and research, and does not claim the oral group is complete. Full interval and endpoint records are retained under `.shots/human-2469/investigation-2498/oral-state-contact` and `oral-cavity-contact`. The 12-state actual editor check reproduces every saved JSON, with four exact undo cycles. Eight GLBs match source bytes exactly; three Alan states and Oh observed each differ only by one Float32 normal component at one ULP, with all other bytes exact.

Retained trial document SHA-256: `cf672a43a4c061baf1142dd3d3d0c8022b14e1ec9199e44018210beb51f38f47`; model: `41a1727ff887a1170e60a964a414eef908cff8f88296560e1e5a388294fc8de9`; GLB: `737f8cc8946ef850c1d03e71c4331cbbb35d09d4f3a75bcedbc7bf3a3d0e5fe7`. The retained current, probe and candidate populations are under `.shots/human-2469/investigation-2498/oral-arch-fit/maggie-smith`; all comparison images and assessments are identified by the separate `direct-review.json`. The observed candidate images are:

| Observed view | PNG SHA-256 |
| --- | --- |
| front | `7e9d93ce62be7d9a272fb97b369f55703207f09184c573f07f3f7d63cd77b3b3` |
| left-oblique | `b2dc67b4002d58a7b344fee37aa3b4fd82ac5f0ee0a2f7eceaa1f7071b9ad420` |
| right-oblique | `e7d442e23520897e872a20f7c7bc6a67caffdde2c8cd6ae6bdfc3cc41e673958` |
| left-profile | `fe157f9e3313fd501dd812c059ed2f4583003d24024541545d2fe7e35751ede4` |
| right-profile | `dd9df8a6c09e2195fa493b4f681f2c5ad22dee69f796dc707e7cb318e032b1c7` |
| back | `8eabc8bd247335b3dea2b8621a03e03a0eb55407fd953c5b8459f1a2b5221af2` |
| bare-clay | `3bc32b6a8b3535270efdcfcce5d0f5776f9778116331889ffbd7be5b3ebeab8d` |
| bare-oblique | `2e3c9078a71bbf4a7005fcbd040c4c15147cf8c589f3def044a8e21fae3c7304` |
| reference | `766695f62698603f25756025445fd59774ab04c4d29a14bf04501cff6cb1c375` |

The following records retain their preceding revisions and artifact identities.

The full-body source provides few face pixels but clearly has thin lips, modest upper enamel exposure and deep orbital creases. Reduce vermilion and arch exposure; preserve the age-fold limitation and unobserved scarf-covered neck rather than claim a recovered surface.

Front/reference retain the selected open smile and lighter sparse brows, but aged tissue, wrinkles and orbital bags are insufficient: the result looks substantially younger. Both obliques and clay show uniform enamel, a regular lip band and simple alar form. Profiles and back show a generic neck and posterior skull; the original scarf prevents cervical observation. The small face within the original full-body photograph limits detail but does not excuse a likeness acceptance.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `e07e4c4d67083255248c126bc765a159192420007da7e5582e23ef65348760d8` |
| Replay document bytes | `bd8713fef322e4f2eba76bcf91708d517c1b18b31f63982a0b242ee52bb4d45a` |
| Node model JSON | `ace964564d50aec551b1a270a4d0a0c059a169e48ca67c30f334ccf030677d06` |
| Rendered GLB | `264303478d3fac739bfcdfe59abb0578a49a9950392e4c5383ec0183ee405894` |
| Capture profile | `e2230b40e737835868132e554d9f824a3ae65f17ba6710cf3f39a5a5f8d9692d` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-maggie-smith`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `abd074cd8e2877e52f2620f6262ec743ed0a4bca134c4fc4227a40ab7a94b8bc` |
| front | `5618f40092ece2a42486beb2e8cca7110d24c3cd597dab0f525c7093aafd6456` |
| left-oblique | `704c7c8459348709df449485d58366b0a2ffa748fd197c35f2489d772c349878` |
| right-oblique | `338d971a5857827a628f7cb5806d1bbf74e70c513aa6de4eeae6249cf53815dc` |
| left-profile | `66dc32637b629519e6cfc4e921158c9433e4726f34b93a4716662c6a2275467e` |
| right-profile | `34037438d8c80d9e29fa9db5b9b3edc1914d023cc3d15c429318e7b650ebf9aa` |
| back | `0f1b3738b692cd88333c9c6a700ffa956ffcc30fb1bde842a24ea73fe4aecb88` |
| reference | `9f6379881dc88585844dc2649ec1c9b31a1c2a5acf2ecb9606ec243a101cb944` |
| clay | `1ffadb0b53ee362e93779e6d97507944f2b48e97b402b9227353d0681919d752` |

## michael-gambon {#michael-gambon}

[Replay document](michael-gambon.json) · [Original selection and quality](inputs.md#input-michael-gambon). Selected original: `michael-gambon_age-72_portrait.jpg`.

The monochrome source does not expose a white upper-tooth strip like the initial replay. Recess and lift maxillary enamel and narrow lip separation. Keep colour explicitly unobserved. The broad lower face and neck are more substantial than the initial generic continuation.

Front/reference retain narrowed eyes, slightly parted lips and the wider jaw-frame adjustment, but the face is much smoother and younger than the monochrome source. Both obliques and clay show simplified orbital and nasolabial relief; the thin visible tooth line remains regular. Profiles and back retain the common inferred rear shape. Skin and iris colours are authored, unobserved values because the source is monochrome.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `e8b37987276f848e75bf1c4367287a16a3e169612354eea993fef8031c9b68ac` |
| Replay document bytes | `30c55ca4ad89dac85756cae8ea85607b9e3c6b613378b0eb657d8779bf7843bd` |
| Node model JSON | `463406ec0a65c0ef4e02a87ca651c11a81252616f6621fdc0146d0a77b1e95a2` |
| Rendered GLB | `8c51a74da73caf0281259415718cea6b74a1f90d54f52cd95c0a0b7a609dbf50` |
| Capture profile | `248980fcf6d29ef23aa63811b926a8c1f6c340e8bfcb9d504c23cffc7beaa88f` |
| Node GLB (one normal ULP differs) | `351405a8418334b8c4ca0a5122c6426df6804e297fca70f6d6f7edcca48df66b` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-michael-gambon`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `1a3e1e950ef79c8ba07c1aac42cca0cf847a9a86f5377c5a313c9277a55a5b98` |
| front | `b3f4f0707a6569616ec8c8ad36345ae90af931fec572538cab2830db98857e89` |
| left-oblique | `94f136f118051a3281f4a5d5a37bbf6ab15d69e89654b987383b4d6842454374` |
| right-oblique | `e4390b931b63c55b332b366cf78969f6a070b7b98b31f0c532321f51456c2553` |
| left-profile | `c1af305638a12ed107bd35434962de5ca2a15f4480bb9da384d5a838f5b41481` |
| right-profile | `67c45c3b6cd994664559d7fe6b097f3aad031543f7e3c6174dfdcec1268a811d` |
| back | `88b43d22b124b7faf66cd6a241ea1397c515786a16d6921e5ca015a5eca838e6` |
| reference | `28c142cdf8bb7a9ad70e5fa81743d2ee6f6ec08f5d59fcefc26ea134dcb23196` |
| clay | `89280c8d0a87eb0b7b0127e2c2350ce779ef50cf0109d1fbaacc9f2dee5f9435` |

## miriam-margolyes {#miriam-margolyes}

[Replay document](miriam-margolyes.json) · [Original selection and quality](inputs.md#input-miriam-margolyes). Selected original: `miriam-margolyes_age-71_portrait.jpg`.

2026-09-16 optical partial adoption: the current document sets `sphereFit: observation-ray`, `opticalFrame: radial`, `canthalSupport: tangent` and `surfaceRadius: 12`. All other authored values, source identity and observed expression remain exact. Two independent complete builds reproduce the retained candidate's model and GLB exactly. The spherical radius is an authored approximation at human-eye scale, not person-specific biometry. [Adult CT measurements](https://pmc.ncbi.nlm.nih.gov/articles/PMC4238270/) describe varying, unequal axes; [juvenile longitudinal biometry](https://pubmed.ncbi.nlm.nih.gov/23575156/) measures axial growth. Neither establishes a universal 12-mm spherical radius or a radius recoverable from this photograph. The fixed-canthus hull is geometric support, not a measured conjunctival surface.

All nine views in each of observed, bilateral blink and oral-gaze were directly inspected: 27 views for this person, under AMD hardware rendering with an independently specified 10-mm calibration cube (45 expected pixels, 44 measured). The visible right optical aperture gains curved reflection and the canthal transition avoids the preceding depth-only trial's deep pit. The asymmetric observed squint remains. Excess superior hood, narrow neck, angular nasal base and insufficient aged tissue persist. Both profiles and back retain the cap-like white groom and patterned shadows. The oral-gaze diagnostic hides the previously visible dental row; this is an unresolved oral-state issue, not evidence of an optical repair. In full blink the optical apertures are covered; that sampled closure does not validate natural blink motion. The optical improvement is adopted while the coupled tissue work continues; **whole-face likeness remains unaccepted**.

Current document SHA-256: `f3d42c6ba126198dbeac8f102cb1d90d014d09c9f402caf7476d1bd5fcc77f3b`; model: `a9b9764ec40d81c3272a9052e68ebe9ef82eb8933332338b135a6262a027b6e1`; GLB: `e9fec4501e2b624febab0fc48ee2a498dd88124482073f00ddfad05b79539eef`. Current full-view capture directory: `.shots/human-2469/investigation-2498/optical-adoption-views/miriam-margolyes`. The close baseline comparisons remain under `ocular-fit/miriam-margolyes`, and the complete per-state input/model/GLB receipts remain there. The table below identifies the directly inspected observed images. Left/right filenames use camera yaw: negative yaw sees the anatomical right side, positive yaw the anatomical left.

| Current observed view | PNG SHA-256 |
| --- | --- |
| front | `5b451d2a9b0fb5a0af5ad63a1462011e2ab48e4ab27f93d9370f9f2ba023236b` |
| left-oblique | `fdd8497022f3093a23142adb2c543d42eb459ae589ad1fc4bfb814f5529e9047` |
| right-oblique | `28896f66731683240be665d0f1fc6c735f327345462b8a53aca386cfea3fe79f` |
| left-profile | `5c7ff88ffdc14a45a6bcf9cd4191df88d232ddfd61884bfa66141e6aa772b005` |
| right-profile | `32485d8c0970ac1cd2309e91fa7143ae538dfa430326fb7c928b9d8db190630a` |
| back | `25623891530bc1ada40207379e0282c4dcfc32f1ee2645da14bf980ded8b492d` |
| clay | `44fb5c1fa7bd2ef003d6b7a91ce34a2cb30dc745360dd9b62f37aaa79feda761` |
| clay-oblique | `77d1b0dc4835d96a4c9242462c9c50802ba965d08bf47918bacdc2331c667acd` |
| reference | `66d3572f733e73a02be39b4145bb6caa29c393ca9a8c3e530c34d1fd2a080b52` |

The following entries preserve preceding revisions and their own artifact identities; their use of “current” refers to those earlier checkpoints.

2026-09-15 layered-hair partial adoption: retain the colour/brow document below and replace only its hair profiles and resident hair finishes with independently authored inner and outer layers (1,024 and 640 cards). Every non-hair part and its material, the source basis/reference, neck and expression remain exact. The other eighteen working documents are byte-identical. Two complete source builds reproduce the same model and 12,007,388-byte GLB. These numerical cards use procedural textures, not pixels from the source photograph.

The main agent directly inspected all thirteen new views: front, both obliques, both profiles, back, close clay, close clay-oblique, full clay, full clay-oblique, full clay-profile and two registered reference distances. Fine white coverage replaces the broad grey coils at both distances, and the side/back no longer read as rows of thick ribbons. The silhouette is still a uniform cap rather than the source's irregular curl masses; the fringe, hairline and strong patterned forehead shadows remain wrong. Facial planes, skin variation, aged tissue, oral contents and cervical proportions are unresolved. This is a partial improvement, not accepted likeness. The AMD GPU capture measures 44 pixels for a 45-pixel calibration span and records all four resident texture samplers at anisotropy 16, with no page errors.

Current layered identities: document `61de229a4f2b347e17e06bd44defaa449a995456f4830fec30ff96e724ff06d2`; model JSON `76691a7a5ad6901b99d6d5899a9fad6b2c43a281c8648391294c5e5eb1f0b3dd`; GLB `011bc040e9fdfd48d97583e4e2992c46132fb2eed6c99e0f2a6a440df68a1da7`. Current capture directory: `.shots/human-2469/subject-hair-layered-current-face/miriam-margolyes`. The gallery selects this revision and its downloadable document matches the tracked study.

The rebuilt editor's new built-in selection, neutral button, undo and bilateral-blink import were verified separately for these layers. All three saved documents and GLBs match independent source output exactly. The AMD GPU receipt at `.shots/human-2469/miriam-layered-built-in/receipt.json` records 16 expected/observed calibration pixels, nineteen subject options and no page errors. Eighteen editor views were captured; the main agent directly read the observed, neutral and blink fronts. The fine white coverage survives the editor's wider framing and mouth/eye closure works, while the cap-like hair, eye folds and synthetic skin persist. Resetting expression channels is not a reconstruction of the person's physiological neutral face.

Earlier colour/brow revision:

2026-09-15 partial colour and superior-orbit update: change only the skin's linear RGB from [0.51, 0.28, 0.215] to [0.64875, 0.2875, 0.2375] and the detailed brow-foundation projection from -1 to -3 mm. Source observations, basis, expression, hair, neck and every other authored material/profile remain unchanged. Two full-source builds reproduce the same model and 12,080,884-byte GLB. This is an authored colour under fixed review lighting, not recovered physical albedo or accepted likeness.

The initial orbital measurement accidentally included the photographed fringe. Reassessment restricts the two orbital regions to the skin between the brow and upper lid and a band below the lower lid, with 104/119 sampled locations. The hair-covered forehead is excluded from the summary. Across six equally weighted skin regions, image RGB RMS decreases from 34.96 to 32.50 after colour alone and 30.67 after the additional brow change; orbital RMS decreases from 38.46 to 34.73 to 29.29. A -5 mm brow trial and nasal-depth reductions did not improve those respective comparisons and were not selected. These fixed-light pixel differences are not identity scores.

The main agent directly inspected all ten current captures: front, both obliques, both profiles, back, clay, clay-oblique, reference-close and reference. Front/reference show warmer skin and less recessed-looking upper-lid illumination. Both obliques and clay still expose an artificial lid shelf, angular nasal base and insufficient aged tissue; the large oral opening still lacks the photographed interior form. Profiles/back retain the inferred narrow submental transition and broad coiled hair strips. Nose and cervical-depth trials remain separate, unadopted studies. Likeness remains **unaccepted**.

Earlier colour/brow identities: model JSON `82a882d024d74439bf70e4785dae1a88e33c5fa0d2b0e7d993ac6e8d112e6e7d`; GLB `d2352e8b987112dc64e1a34b521f2c876bc8d64a5fed2c2adaef25ed7cc81cd5`. The pretty-serialized candidate document has SHA-256 `2365a2f79f285414432935f03857ed341c756b2c40c1491a96c9b36dffd747d9`; the tracked JSON used different whitespace and was checked by parsed document equality. Earlier capture directory: `.shots/human-2469/subject-face-brow3/miriam-margolyes`.

The rebuilt editor's built-in subject selection loads this exact tracked document. Its observed, zero-channel neutral and bilateral-blink JSON/GLB exports match independent source outputs, with exact undo back to the observed document. The actual AMD GPU receipt at `.shots/human-2469/miriam-built-in/receipt.json` records 16 expected/observed calibration pixels and no page errors. Eighteen editor views were captured; the main agent directly read the three front views. Neutral closes the mouth and blink covers the optical apertures, but both retain synthetic lid folds and coiled strips. Channel reset is not an observed physiological neutral reconstruction. The following face-only observations and identities are historical.

The large source shows both dental arches, a broad cervical connection and a deeply expressive tilted face. Add an independent lower arch and widen the neck; keep the established left-cheek safety profile. The unmodeled tongue and detailed age folds remain explicit likeness defects.

Front/reference retain the strongly open smile and asymmetric squint. The explicit lower dentition appears only as small edge slivers; the large empty oral space lacks the photographed tongue and complex inner-mouth form. Both obliques and clay expose angular medial orbital transitions and insufficient aged cheek/perioral tissue. Profiles and back show generic inferred hidden anatomy. The age and expression likeness are unaccepted; the secondary background person was not used as the target.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `7101f8b6fb4745ac3786df89bc6e08fd98cbc3709f2cfdae7af651392ddfa69e` |
| Replay document bytes | `f3cbb77f884c4bcc3bac7c45b819f3b6d15155e345c66ceee140279c77644423` |
| Node model JSON | `6111315fbc76985fd61c33fa24dc487185fb882f3fd868e927af40753e0b8091` |
| Rendered GLB | `fed97550ea37dd6cadb7c9eb04f8aab6d353ac3865515317b2a386bce3e7b956` |
| Capture profile | `7d75e2a638c098c4f2839a3c7d9a82d2ed1c6fdcc0cf5848ff80f28b3f5d7acd` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-miriam-margolyes`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `293895a5b18616d33b2bb1b1ac7c3aabb41081cabe23e42ceb55955a6a6dbf13` |
| front | `c87494bcd2f0e98932ccffc7dc9950355c2699054ca42b135188d9f482776146` |
| left-oblique | `31ad5e1338b6d3de2143f05e4650d0f6f691cf9e55e8e7d0fef3fc190208875d` |
| right-oblique | `24e34bd68f859d1268d827aad0b511ca7ec74b0b54228ce194e95e607b64401c` |
| left-profile | `97099103ec08c18a39c3ef7abfd7c1e3b2590ffeb9a70ffb1b2b9d1799b2b287` |
| right-profile | `83a2bf720676c3c2b53a9309a33d019b18e92569e37f9baedcec91d63a0e1fde` |
| back | `bd2cfa7c9ccf16f4fa73798a9e4f8f9317818ddbdad52d7f5b0b1bee915027ea` |
| reference | `4bef92f5b8df4f69cb3037a340d67ee8eedf3de3ffb5c7e1a4d30f7d21b39871` |
| clay | `c0eb1b0696469ad68c562dfc8bf3ee93f1e6c0c133695ac30d590e58985eec1a` |

## rupert-grint {#rupert-grint}

[Replay document](rupert-grint.json) · [Original selection and quality](inputs.md#input-rupert-grint). Selected original: `rupert-grint_age-14_chamber-of-secrets-premiere.jpg`.

The premiere photograph has light ginger brows and a thin, irregular closed smile. Reduce the initial broad vermilion band and brow fibre mass while retaining eye opening and the observed facial asymmetry; skin freckles remain unsupported.

The front/reference mouth is closed, with a thin constructed vermilion band. Obliques and clay show regular lid shelves, a simplified tip/alar base and weak individualized soft tissue. Profiles and back retain inferred jaw depth and the generic cranial/neck lobes. The source-pose arrangement is present but is not a likeness acceptance.

Artifact identities:

| Artifact | SHA-256 |
| --- | --- |
| Source image | `ef48f1a310bc63f2f19fb04d2407692b07386be85995f7c2fdf3582dbc29ffbe` |
| Replay document bytes | `14e4e851400bd17e09790af87b1580428a8ca2012f4631274453f2c6606e26a5` |
| Node model JSON | `5e06e4cd9e1901ea7ec628117a4716466ff88cac80bf0450867ee6b98a17a747` |
| Rendered GLB | `675febe49bcbb731918dcfac500a0027a9d54495d99d10776a7372620a088d31` |
| Capture profile | `6812dbddf492182b2413250cbe076b875d32fe373bfe000e75ec2abef0c49bc4` |

State: construction admitted; standalone document replay admitted; static glTF admitted; all 9 captures present; all 9 directly inspected; likeness **unaccepted**. Remaining visible defects are the observations above. Local capture directory: `.shots/face-experiment/human-fitted-rupert-grint`.

| Directly inspected view | File SHA-256 |
| --- | --- |
| calibration | `5d3f2dc63ddc3bc9864fcf2983926408ba70900c47abd92cfbf9261993c37d52` |
| front | `671bbe528f72c1ef5b11f510c59bfd3ea58419f28c73c89fe6ab276f426e32ba` |
| left-oblique | `e0b150fa9131383df31a8ecbd1599046a1cb4022e73c73cccb2d0fe3bba2652f` |
| right-oblique | `2558bdc4c0f593232b46c579ebd3696d6b9f296dd4ac99e9178e90ce3ffb96d1` |
| left-profile | `ac1378fe754af3c1eddd4a338cbf0bb28b9645f6d4dbfb3969c2f8a6a103d21e` |
| right-profile | `42721e147585dafc52063fa76568e05dfff6cffabeb24f43213bc56fed926b11` |
| back | `2bee0ffe73603b2c9dc47f0385c2c9e912e3e9fc61fc531ecb4ba3c938906b89` |
| reference | `ac3feaa147cd84013b0539c6ae08c9e0455e268acd51431ccfa940150d8a8b12` |
| clay | `cff167e42fd80ea72cfbccf18e1e20e0d5ea0269cd22efad6f3ad795be7a37a5` |
