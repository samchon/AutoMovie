# Interior 연결과 양방향 일관성 {#building-envelope-linked-interior-specification}

## 연결 State와 공유 Identity {#building-envelope-linked-interior-state}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-linked-interior interior가 존재할 때 건물 외피와 내부의 공유 identity, 권위와 revision을 명시한다. -->

건물은 `exterior-only` 또는 `linked-interior` 상태 중 하나를 가지며 linked 상태는 exterior revision, interior revision, shared-fact set, authority rule과 coordination receipt를 결속한다. 공유 사실은 양쪽이 같은 identity를 참조하고 한 시점의 resolved value를 읽어야 하며 이름이나 좌표 유사성으로 묶지 않는다.

### Link 입력과 Coordination 출력 {#building-envelope-linked-interior-input-output}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation massing, 면적, 층, 외피, 개구부, 구조, 설비와 좌표를 한 coordination 실행에서 비교한다. -->

입력은 building identity, 양쪽 source revision, shared identity mapping, authority와 tolerance, selected phase·alternative·time을 제공한다. 출력은 항목별 resolved value와 source, agreement status, measured delta, affected identities, stale dependencies, failure code와 correction owner다.

### 양방향 의존성 불변식 {#building-envelope-bidirectional-dependency-invariant}

<!-- @evidence requirements/building-exterior/massing-area-and-height.md#building-massing-interior-area-coordination exterior gross·footprint와 interior net·usable area가 같은 boundary 및 exclusion에 답하게 한다. -->

Exterior가 shared fact를 바꾸면 interior와 그 산출물이 stale가 되고 interior가 shared fact 변경을 제안하면 exterior mass·envelope와 그 산출물이 stale가 된다. 권위 없는 쪽의 변경은 정본을 덮어쓰지 않고 proposal 또는 conflict로 남으며 양쪽 재해결과 검증 전에는 어느 결과도 coordinated-current가 아니다.

## 공유 사실 실패 Matrix {#building-envelope-linked-interior-failure-matrix}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation 외피와 내부가 공유하는 여덟 사실군의 비교, stale 전파와 실패 결과를 고정한다. -->

| 공유 사실 | Authority와 비교 기준 | Exterior 변경 시 stale | Interior 변경 시 stale | 실패 결과 |
| --- | --- | --- | --- | --- |
| Massing | Building outer mass와 void identity | Interior extent, room containment, net area | Exterior mass proposal, facade·roof, site seam | `massing-conflict` |
| Area | Footprint·gross basis와 shared boundary, interior net exclusion | Interior area, schedule, quantity | Exterior area, quantity, drawing | `area-basis-conflict` |
| Storey·height | Shared level identity, base elevation, floor-to-floor height | Interior floor, ceiling, clear height, vertical route | Exterior slab, facade bay, roof, connector | `level-height-conflict` |
| Envelope | Shared boundary identity, datum, thickness와 side | Interior lining, room boundary, finish | Exterior face, corner, material assembly | `envelope-conflict` |
| Opening | Shared opening identity, host, profile, depth와 state | Interior trim, clearance, light·route relation | Exterior cut, frame, flashing, facade pattern | `opening-conflict` |
| Structure | Shared member, core, shaft, slab identity와 support relation | Interior host, penetration, ceiling·floor zone | Exterior support, mass, attachment | `structure-conflict` |
| Service | Shared port, medium, unit, direction와 penetration | Interior network, terminal, capacity result | Exterior equipment, route, seal, map port | `service-interface-conflict` |
| Coordinate | Frame identity, transform chain, control point와 tolerance | 모든 interior placement와 capture | 모든 exterior·site placement와 capture | `coordinate-conflict` |

### Matrix 판정 규칙 {#building-envelope-linked-interior-matrix-rules}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-validation-outcomes passed, failed, unknown, unsupported와 stale를 항목별로 구분하여 전체 성공을 과장하지 않는다. -->

각 행은 `passed`, `failed`, `unknown`, `unsupported`, `not-run` 또는 `stale` 중 하나이며 한 행의 통과가 다른 행을 대신하지 않는다. Required 행이 failed 또는 stale이면 coordinated delivery를 거부하고 unknown·unsupported·not-run이면 usable subset과 제한을 분리해 보고한다.

### Conflict, 복구와 Compatibility {#building-envelope-linked-interior-recovery-compatibility}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-independent-scope interior가 없거나 부분적으로만 연결된 건물의 검증 가능 범위를 분리한다. -->

복구는 authority 결정, shared mapping 또는 source 수정, 양쪽 resolve, dependent regeneration과 fresh validation 순서로 진행하며 이전 receipt를 삭제하지 않는다. Exterior-only 기록은 link field가 없어도 유효하고 partial link는 연결된 사실만 matrix에 참여하지만 누락 사실을 agreement로 표시하지 않는다.
