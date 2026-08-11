# 공간, Level과 Zone Topology

## 공간 hierarchy와 zone overlay {#interior-space-hierarchy-zone-overlay}

<!-- @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-spatial-hierarchy Requires nested logical space identity independent of visible geometry. -->
<!-- @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-physical-logical-zones Requires physical partitions and analytical zones to remain distinct. -->
<!-- @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-multilevel-spaces Requires atria, mezzanines, and other multilevel regions without forced flattening. -->
<!-- @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-boundaries Requires explicit boundary ownership and adjacency. -->
<!-- @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-graph-validation Requires topology failures to be addressable. -->

입력은 building root 아래의 stable space identity, parent relation, exact 또는 declared-faceted volume, physical boundary relation과 비계층 zone membership을 분리해야 한다. Storey, room, suite, corridor, stair void, atrium, mezzanine, shaft와 activity·acoustic·lighting·wet zone은 같은 이름을 공유할 수 있어도 서로 다른 관계로 보존하며, 하나의 zone은 여러 공간을 가로지를 수 있고 한 공간은 여러 zone에 참여할 수 있다. 공간 volume은 하나의 권위 있는 표현만 가지며 overlap·gap·cycle·고아 root·상반된 ownership·열린 shell은 실패다. 출력은 containment, adjacency, boundary와 connector를 identity 기반 graph로 제공하고 입력 순서와 무관한 canonical ordering을 유지해야 하며, 과거의 단순 room tree는 명시적 semantic container로 읽되 추정 zone을 만들지 않는다.

## Level, storey와 외관 높이 제약 {#interior-space-level-storey-height-constraints}

<!-- @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Requires floors to state level, finish, and slope separately. -->
<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-massing-interior-area-coordination Requires interior area and containment to derive from shared construction. -->
<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-storey-interior-level-sharing Requires an explicit exterior-storey to interior-level relationship. -->
<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-slab-clear-height Requires slab, raised floor, ceiling, and clear height to fit one interval. -->
<!-- @evidence requirements/building-exterior/storeys-levels-and-heights.md#building-level-refusal Requires impossible vertical configurations to fail. -->

각 level은 shared datum, base·structural·finished·top elevation, horizontal extent와 선택적 storey classification을 입력으로 받으며, split level, basement, attic, mezzanine, double-height zone과 sloped floor를 균일 층 반복으로 평탄화해서는 안 된다. 연결된 건물에서는 exterior storey와 interior level의 대응이 필수이고 finished floor, raised-floor depth, slab, beam·service zone, ceiling assembly와 clear height 합이 해당 floor-to-floor interval 안에서 성립해야 한다. 출력은 level별 공간·surface·opening·route·service 귀속과 gross/net area basis를 제공하며, inverted elevation, overlapping slab, unaccounted depth, exterior footprint 밖 volume과 impossible clear height는 current 상태를 만들지 못한다. 이전 revision의 level mapping을 읽을 때 identity가 유지되면 호환하되 datum 의미가 달라졌다면 migration과 전량 재검증이 필요하다.

## 점유, activity와 가시성 상태 {#interior-space-occupancy-activity-visibility}

<!-- @evidence requirements/interior/spaces-and-occupancy.md#interior-space-use-occupancy Requires authored use and occupancy rather than inferred labels. -->
<!-- @evidence requirements/interior/spaces-and-occupancy.md#interior-occupancy-capacity Requires capacity facts to state their basis and limits. -->
<!-- @evidence requirements/interior/spaces-and-occupancy.md#interior-activity-zones Requires overlapping activity zones with distinct constraints. -->
<!-- @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Requires visibility optimization to preserve semantic targets. -->
<!-- @evidence requirements/interior/spaces-and-occupancy.md#interior-space-use-state Requires space use and availability to vary by named state. -->

공간 사용, occupant class, authored capacity, activity zone, access·reservation·closure state와 story relevance는 geometry에서 추측하지 않는 입력이다. Capacity는 면적, 좌석, 장비 또는 사용자가 선언한 다른 basis와 단위·exclusion·jurisdiction profile을 함께 가져야 하며 전문 법규 적합성으로 자동 승격되지 않는다. Phase나 shot state가 바뀌면 공간의 active use, traversability, occupancy와 privacy·visibility 관계도 같은 clock 또는 named state에서 해석되어야 한다. Culling과 LOD는 보이지 않는 공간을 줄일 수 있지만 identity, connector, light·sound·service consequence, quantity와 review target은 제거하지 않아야 하며, 근거 없는 occupancy 추정이나 closed space에 대한 placement는 failure다.
