# 바닥, 천장과 Surface Assembly

## Contract units {#spec-surface-assemblies-contract-units}

### Surface assembly와 region composition {#interior-space-surface-assembly-region}

<!-- @evidence requirements/interior/surface-assemblies.md#interior-surface-assemblies Requires layered assemblies rather than a single color record. -->
<!-- @evidence requirements/interior/surface-assemblies.md#interior-surface-substance-product Requires substance, product, visual surface, and construction roles to remain distinct. -->
<!-- @evidence requirements/interior/surface-assemblies.md#interior-surface-regions-layers Requires per-face regions and ordered layers. -->
<!-- @evidence requirements/interior/surface-assemblies.md#interior-hidden-layers-cut-faces Requires hidden layers and exposed cuts to remain honest. -->
<!-- @evidence requirements/interior/surface-assemblies.md#interior-surface-region-composition Requires deterministic overlap and priority rules. -->
<!-- @evidence requirements/interior/surface-assemblies.md#interior-assembly-conflicts Requires invalid stacks and ownership conflicts to fail. -->
<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-layers Requires linked interior finishes to compose with the exterior-to-interior envelope stack. -->

Surface assembly 입력은 host identity와 face side, bounded region, substrate부터 finish까지의 ordered layers, 각 layer의 role·kind·thickness·substance·product·visual surface, direction·offset·termination과 opening wrap을 가져야 한다. Geometry, 물질의 측정 특성, 상용 product claim과 보이는 PBR 표면은 별도 identity로 유지하고 같은 finish가 여러 substance를 나타내거나 같은 substance가 여러 finish를 가질 수 있게 한다. Region overlap은 명시적 priority, clipping 또는 transition으로만 해소하고 resolved face, cut face, total thickness, exposed·concealed end와 quantity basis를 출력한다. 음수 두께, 묻힌 finish, concealed end의 finish, exposed end의 누락, 불가능한 wrap, 동일 side 이중 ownership과 exterior envelope total과의 불일치는 current assembly를 거부하며 unknown hidden layer를 임의 완성하지 않는다.

### Floor와 raised-floor 계약 {#interior-space-floor-raised-floor-contract}

<!-- @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-assemblies Requires structural slab, build-up, raised floor, and finish to remain distinct. -->
<!-- @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-finish-regions Requires different finishes by level, room, and bounded zone. -->
<!-- @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-openings-edges Requires voids, edges, ramps, and thresholds in the floor topology. -->
<!-- @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-contact-scope Requires walkable and contact support to be declared, not inferred from appearance. -->

각 level·space·zone의 floor는 slab 또는 support host, structural elevation, finish elevation, slope field, raised-floor cavity, build-up, bounded finish regions, opening·shaft·edge·threshold와 walkable·contact scope를 독립 입력으로 가져야 한다. 동일 층에서도 room별 stone, tile, board, carpet와 exposed slab을 섞을 수 있고 split level과 local slope는 하나의 평면으로 평탄화하지 않는다. 파생 출력은 finished support surface, edge·void topology, contact height, assembly depth와 floor quantity를 하나의 resolved state에서 제공한다. Unsupported edge, 열린 void 위 support, slope discontinuity, floor-to-floor interval 침범, 잘못된 walkable claim과 서로 겹친 finish ownership은 실패이며 surface-only legacy 자료는 structural assembly가 unknown임을 유지한다.

### Ceiling과 overhead zone 계약 {#interior-space-ceiling-overhead-contract}

<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-ceiling-per-space Requires independently authored ceilings per level, space, and zone. -->
<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-ceiling-structure-distinction Requires the ceiling finish, support, slab, and roof underside to remain distinct. -->
<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-overhead-plenum-services Requires plenums and services to consume real depth. -->
<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-ceiling-pattern-openings Requires patterns to coordinate with fixtures, access panels, and openings. -->
<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-ceiling-clear-height Requires clear height to be derived from the lowest applicable obstruction. -->
<!-- @evidence requirements/interior/ceilings-and-overhead-zones.md#interior-ceiling-support-removal-quantity Requires support, removal state, and quantities to stay linked. -->

각 level·space·zone의 ceiling은 독립 height 또는 surface, slope·vault·coffer geometry, finish assembly, suspension·support, plenum extent, beam·duct·pipe·cable·luminaire·sprinkler·diffuser·sensor와 access opening을 입력으로 받는다. 동일 floor 안에서 room마다 서로 다른 ceiling system을 허용하고 structural slab·roof underside와 finish plane을 같은 면으로 합치지 않는다. Resolved 결과는 lowest obstruction을 반영한 clear height, fixture cut·pattern coordination, support relation, visible·removed·temporary state와 component quantity를 제공한다. Unsupported tile, hanging element, plenum collision, service penetration 누락, access blocked와 level interval 초과는 failure이며 ceiling이 제거된 phase에서 이전 finish·수량·clear-height 결과는 stale이다.

### Joint, edge와 grain continuity {#interior-space-joint-edge-grain-continuity}

<!-- @evidence requirements/interior/joints-edges-and-transitions.md#interior-joints-edges-transitions Requires joints and transitions to be physical authored relations. -->
<!-- @evidence requirements/interior/joints-edges-and-transitions.md#interior-edge-treatment Requires exposed edges to carry a treatment or explicit raw state. -->
<!-- @evidence requirements/interior/joints-edges-and-transitions.md#interior-material-transitions Requires transition geometry between differing regions. -->
<!-- @evidence requirements/interior/joints-edges-and-transitions.md#interior-joint-repetition-exception Requires repeat rules and local exceptions. -->
<!-- @evidence requirements/interior/joints-edges-and-transitions.md#interior-joint-validation Requires gap, overlap, and impossible treatment diagnostics. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-grain-seam-continuity Requires grain and seam orientation to survive composition. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-grain-bookmatch Requires explicit bookmatch and sequence relationships. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-seam-sheet-layout Requires sheet layout, seam, and offcut accounting. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-grain-corner-continuity Requires continuity decisions across corners and adjacent faces. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-grain-continuity-evidence Requires measurable continuity evidence. -->

Joint·edge 입력은 만나는 region과 layer, nominal width·depth, filler·trim·seal·raw treatment, repetition rule와 occurrence exception을 가지며, sheet·veneer·board는 source orientation, cut layout, sequence, bookmatch와 corner continuation을 추가로 가진다. 시스템은 resolved seam path, measured gap, transition piece, exposed edge, grain angle residual, sheet consumption과 offcut을 identity별로 파생해야 한다. 서로 다른 face와 group을 통과하는 연속성은 명시된 shared source와 transform에서만 성립하며 보기 비슷하다는 이유로 추정하지 않는다. Gap·overlap, 누락 edge treatment, 뒤집힌 bookmatch, tolerance 밖 grain break와 closure 없는 corner는 failure이고, 단순 texture orientation만 있는 이전 자료는 physical seam evidence로 승격하지 않는다.
