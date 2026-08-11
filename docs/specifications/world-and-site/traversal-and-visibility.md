# 이동과 가시성

## 이동·가시성 질의 경계 {#world-site-traversal-visibility-boundary}

### 이동 가능 표면 입력 {#world-site-traversable-surface-input}

<!-- @evidence requirements/map/movement-and-visibility.md#map-movement-visibility Defines traversal and visibility as reproducible queries over canonical state. -->

시스템은 한 시각과 representation level의 canonical geometry, network, surface, 차폐체와 환경 상태를 입력으로 받아 이동 가능성, route와 가시성을 질의한다. 출력은 사용한 traveler·observer, 시작과 목표, 시간, tolerance, source revision과 지원 수준을 포함하고, 보이는 화면이나 직관을 검증 결과로 대신하지 않는다.

<!-- @evidence requirements/map/movement-and-visibility.md#map-traversable-surfaces Requires surfaces to state whether and for whom they are traversable. -->

traversable surface는 stable identity, footprint, 높이 또는 3차원 경로, 경사·폭·headroom, 표면 상태, 허용 traveler class와 연결 node를 가진다. 같은 plan 위치에 여러 level이 있으면 별도 surface와 connector로 유지하며 topmost surface만으로 아래 level을 지우지 않는다. 퇴화 footprint, 미지 높이와 level 관계가 없는 중첩은 이동 graph에 포함하지 않는다.

### traveler 제약과 비용 {#world-site-traveler-constraint-cost}

<!-- @evidence requirements/map/movement-and-visibility.md#map-traveler-cost-constraints Requires explicit envelope, ability, prohibition and cost rules. -->

traveler는 폭·높이·회전·하중 envelope, 허용 경사·단차·수심, 이동 방식, 접근 권한과 사용자 정의 비용을 가진다. 비용은 거리, 시간, 경사, surface, 위험과 상태의 선언된 조합이며 단위와 우선순위를 보존한다. 필요한 traveler 속성이 없으면 일반적인 사람이나 차량을 임의 선택하지 않고 해당 제약 판정을 보류한다.

### route 연결성과 시간 상태 {#world-site-route-connectivity-time-state}

<!-- @evidence requirements/map/movement-and-visibility.md#map-route-connectivity Requires routes to follow explicit graph connections and level transitions. -->
<!-- @evidence requirements/map/movement-and-visibility.md#map-temporal-route-state Requires closures, hazards and access schedules to affect route results. -->

route는 허용 node·edge·surface·connector만 통과하며 level 전이와 방향 규칙을 지킨다. 같은 비용에서는 stable identity와 선언 순서로 결과를 결정해 재실행 순서를 고정한다. 폐쇄, 행사, 침수, 결빙, 고장과 공사 상태는 질의 시각에 맞춰 graph와 비용에 적용되고, 다른 시각의 route cache는 current로 재사용하지 않는다.

### sightline과 차폐 {#world-site-sightline-occlusion}

<!-- @evidence requirements/map/movement-and-visibility.md#map-sightline-occlusion Requires sightlines to cite observer, target, occluders and tolerance. -->

sightline 입력은 observer와 target 위치 또는 feature, 눈높이·target extent, 최대 거리, 사용할 차폐 geometry와 투명·비차폐 규칙을 명시한다. 출력은 clear, blocked 또는 unsupported verdict와 첫 차폐 feature, 교차 위치, 거리와 오차를 포함한다. LOD에서 사라진 geometry나 미해결 외부 자산을 투명한 것으로 간주하지 않는다.

### viewshed와 가시 거리 {#world-site-viewshed-visibility-range}

<!-- @evidence requirements/map/movement-and-visibility.md#map-viewshed-visibility-range Requires viewshed extent, sampling, terrain and atmosphere to be declared. -->

viewshed는 observer, 수평·수직 시야 범위, 표본 해상도, 최대 거리, 지형·구조물 차폐 revision과 선택된 대기 가시 거리 상태를 가진다. 산출물은 visible·occluded·unknown 영역과 표본 오차를 구분하고 입력 extent 밖을 보이지 않음으로 채우지 않는다. 전 지구 곡률이나 굴절을 지원하지 않는 계산은 적용 거리와 한계를 명시한다.

### route와 가시성 결합 {#world-site-route-visibility-composition}

<!-- @evidence requirements/map/movement-and-visibility.md#map-route-visibility Requires route segments to evaluate visibility-dependent intent consistently. -->

landmark 노출, 감시 회피, 경관 corridor와 같이 가시성이 route 조건인 질의는 각 route 구간의 표본 위치·시각과 동일한 visibility contract를 사용한다. 통과 결과는 route 비용과 가시 verdict의 기여를 분리해 출력하고, 낮은 LOD의 occlusion 누락으로 더 좋은 route를 선택하지 않는다. 요구 fidelity를 충족하지 못하면 후보 순위 대신 unsupported 결과를 반환한다.

### 검증 수준과 실패 {#world-site-navigation-validation-level}

<!-- @evidence requirements/map/movement-and-visibility.md#map-navigation-validation-level Requires topology, geometric clearance and operational validity to remain distinct. -->

이동 검증은 topology 연결, geometry clearance, surface 적합성, 시간별 운영 상태와 전문 안전 판정을 구분한다. 시스템은 실제로 확인한 수준과 미확인 항목을 함께 출력하며, 연결된 선을 안전한 route로, clear sightline을 관찰 가능한 최종 shot으로 과장하지 않는다. 누락 geometry, stale 상태, 예산 초과 또는 지원되지 않은 분석은 영향받은 질의를 명시적으로 실패시킨다.
