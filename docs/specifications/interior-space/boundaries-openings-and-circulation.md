# 경계, 개구부와 Circulation

## Contract units {#spec-boundaries-openings-and-circulation-contract-units}

### Wall, partition과 양면 경계 {#interior-space-wall-partition-boundary}

<!-- @evidence requirements/interior/walls-partitions-and-linings.md#interior-walls-partitions-linings Requires walls, partitions, and linings to remain distinct authored roles. -->
<!-- @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-two-sided-ownership Requires both sides to share one construction while carrying independent finishes. -->
<!-- @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-partial-freeform Requires partial-height, sloped, curved, and free-form wall regions. -->
<!-- @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-intersections Requires deterministic corner and intersection resolution. -->
<!-- @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation Requires gaps, overlaps, and contradictory side ownership to fail. -->

물리 경계 입력은 stable identity, 분리하는 한두 공간, host face 또는 volume, 구조·비구조 역할, 전체 두께, interior side와 exterior side, partial extent와 junction priority를 가져야 한다. 같은 wall construction의 양면은 서로 다른 lining·finish·wear를 가질 수 있지만 두 개의 겹친 wall로 복제하지 않으며, half-height partition, screen, curved·sloped·faceted wall과 open edge는 정확도 상태와 의도된 범위를 선언한다. Corner, T·X junction, reveal과 termination은 canonical rule과 허용오차로 풀고 resulting faces와 cut edges를 출력한다. 비의도 gap, self-intersection, overlap, inverted side, 음수 usable depth와 해소되지 않은 junction은 failure이며 기존 단면을 읽을 때 total thickness와 side meaning이 유지되지 않으면 migration이 필요하다.

### Host opening과 가동 상태 {#interior-space-host-opening-operation}

<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-doors-windows-openings Requires doors, windows, and open cuts to penetrate a real host. -->
<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-components Requires frames, fills, trim, seals, and hardware at declared detail. -->
<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state Requires named operations and their clearance consequences. -->
<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-exterior-alignment Requires linked exterior and interior apertures to remain one cut. -->
<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-validation Requires host fit, overlap, and state checks. -->
<!-- @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency Requires both sides of an envelope opening to share host, aperture, depth, and state. -->

Opening 입력은 identity, host boundary, boundary-local profile, depth, clear aperture, fill, frame·trim·hardware와 named operation state를 분리한다. Swing, slide, fold, lift와 removal은 panel별 축·pivot·travel limit, current value와 swept volume으로 해석하고 access, view, light, sound, weather, drainage와 nearby furnishing clearance에 같은 상태를 적용해야 한다. Exterior-linked opening은 양쪽이 같은 cut, transform, clear aperture, frame depth와 operation state를 읽되 sill·flashing과 interior trim은 독립 region으로 상세화할 수 있다. Host 없는 profile, host 밖 cut, 겹친 cut, fill보다 작은 구멍, limit 밖 state, 막힌 필수 route와 내외부 불일치는 실패하며 shape가 없는 legacy opening은 relational-only 상태로 보존하고 측정값을 추정하지 않는다.

### Connector와 route topology {#interior-space-connector-route-topology}

<!-- @evidence requirements/interior/connections-and-circulation.md#interior-connections-circulation Requires explicit connections rather than inferred adjacency. -->
<!-- @evidence requirements/interior/connections-and-circulation.md#interior-horizontal-vertical-routes Requires horizontal and vertical route geometry. -->
<!-- @evidence requirements/interior/connections-and-circulation.md#interior-access-state Requires route availability to follow named operating states. -->
<!-- @evidence requirements/interior/connections-and-circulation.md#interior-circulation-transitions Requires thresholds, slopes, steps, and headroom to be measurable. -->
<!-- @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal Requires disconnected or physically impossible routes to fail. -->

Connector는 passage, corridor, stair, ramp, lift, escalator, ladder, bridge나 사용자 정의 역할과 함께 정확한 endpoint space, 경유 frame, 3D route, section, slope·riser·tread·landing, headroom, threshold와 operation state를 입력으로 받아야 한다. 단순히 두 volume이 닿거나 문이 보인다는 사실은 traversable 연결이 아니며 logical adjacency와 physical passage를 분리한다. 출력은 authored route graph, 현재 접근 가능 edge와 measured transition을 canonical하게 제공하되 자동 pathfinding, 피난 성능이나 법규 적합성을 실행하지 않았다면 주장하지 않는다. Missing endpoint, 다른 building unit에 잘못 귀속된 root, zero section, route-host 충돌, state가 닫은 필수 연결과 허용오차 밖 slope·headroom은 addressable failure가 되고, 과거 endpoint-only connector는 geometry-not-authored 상태로 유지한다.
