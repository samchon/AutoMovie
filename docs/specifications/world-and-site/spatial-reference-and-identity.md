# 공간 기준과 identity

## 공간 기준 상태 {#world-site-spatial-reference-state}

### 좌표축과 단위 입력 {#world-site-coordinate-axis-unit-input}

<!-- @evidence requirements/map/scope-and-coordinates.md#map-spatial-source-of-truth Establishes the resolved spatial record as the sole source used downstream. -->
<!-- @evidence requirements/map/scope-and-coordinates.md#map-spatial-feature-identity Carries stable feature identity and lineage across revisions. -->

시스템은 하나의 세계·사이트 정본 안에 자료 원본 identity, 안정된 feature identity, 제작 좌표계, 원본별 좌표 기준, 단위, 변환 계보, 공간 범위와 revision을 보관한다. 모든 geometry, 네트워크, 구역, 환경 상태와 파생 산출물은 이 정본의 feature와 revision을 참조하며, 화면상 이름이나 배열 순서를 identity로 대신하지 않는다.

<!-- @evidence requirements/map/scope-and-coordinates.md#map-coordinate-unit Requires explicit axes, handedness, vertical direction and units. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-units-coordinate-frame Keeps production scale and coordinate interpretation explicit. -->

입력은 축 순서, handedness, 수직축과 위쪽 방향, 수평·수직 거리 단위, 각도 단위, 원점 해석과 북쪽 방향을 명시한다. 해석에 필요한 항목이 없고 출처만으로 유일하게 결정할 수 없으면 시스템은 좌표를 추측하지 않고 미해결 입력으로 보류하며, 사용자가 선택한 해석을 새로운 provenance가 있는 결정으로 기록한다.

### Deterministic coordinate magnitude admission {#world-site-coordinate-magnitude-admission}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-coordinate-magnitude-bound deterministic runtime의 coordinate magnitude bound와 초과 거절을 요구한다. -->

Coordinate admission은 normalized local·world position, extent와 derived endpoint가 finite이고 declared inclusive magnitude bound 안에 있는지 확인한다. 초과한 coordinate는 clamp, wrap 또는 silent origin shift로 통과시키지 않고 exact field, observed magnitude와 supported bound를 진단한다. 이 수치 gate는 CRS, datum 또는 source transform authority를 대신 판정하지 않는다.

### CRS, datum과 epoch {#world-site-crs-datum-epoch}

<!-- @evidence requirements/map/scope-and-coordinates.md#map-coordinate-reference-system Requires named projected, geographic or local coordinate interpretation. -->
<!-- @evidence requirements/map/scope-and-coordinates.md#map-horizontal-vertical-temporal-reference Separates horizontal datum, vertical datum and coordinate epoch. -->

공간 기준은 지리 좌표, 투영 좌표 또는 로컬 공학 좌표 여부와 그 정의를 보존하고, 수평 datum, 수직 datum, geoid 또는 기준면, 좌표 epoch를 서로 독립된 필드로 취급한다. epoch나 datum이 다른 자료는 같아 보이는 숫자만으로 합치지 않으며, 변환이 지원되지 않으면 원본을 보존한 채 정본 결합을 거부하거나 명시된 낮은 신뢰도의 시각 참고로만 유지한다.

### 변환 계보와 정밀도 {#world-site-transform-lineage-precision}

<!-- @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Requires ordered transforms with accuracy and large-world safeguards. -->
<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain Keeps building placement on the same transform chain. -->
<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-large-world-precision Prevents distant site placement from losing required precision. -->

각 원본에서 제작 좌표까지의 출력은 적용 순서가 고정된 변환 단계, 파라미터, 사용한 기준 정의와 버전, 예상 수평·수직 오차, 축척 왜곡과 유효 영역을 포함한다. 큰 좌표로 수치 정밀도가 허용 오차를 넘는 경우에는 로컬 원점 또는 tile-local frame을 사용하되 원래 좌표로의 가역 관계를 유지하며, 반올림이나 축 이동을 암묵적으로 적용하지 않는다.

### 범위, 축척과 제어점 {#world-site-extent-scale-control}

<!-- @evidence requirements/map/scope-and-coordinates.md#map-extent-boundary Requires explicit inclusions, exclusions and open boundaries. -->
<!-- @evidence requirements/map/scope-and-coordinates.md#map-scale-levels Requires named spatial scales without silently changing meaning. -->
<!-- @evidence requirements/map/scope-and-coordinates.md#map-coordinate-control-points Requires independent control observations and residuals. -->

정본은 전체 extent, 포함·제외 영역, 열린 경계, 요구 축척과 허용 오차를 선언한다. 제어점은 원본 좌표, 목표 좌표, 차원, 출처와 허용 잔차를 가지며 변환 산출물은 점별 잔차와 종합 오차를 출력한다. 요구 축척에서 필요한 정밀도나 coverage가 충족되지 않으면 시스템은 확대된 모양을 새 정확도로 주장하지 않고 부족 범위를 진단한다.

### 호스트 배치와 경계 실패 {#world-site-host-placement-failure}

<!-- @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Requires an auditable world-to-host placement instead of copied coordinates. -->
<!-- @evidence requirements/building-exterior/site-placement-and-orientation.md#building-site-map-seams Keeps site and building seams measurable. -->

호스트 장면으로의 배치는 translation, rotation, scale과 기준 feature를 가진 명시적 관계이며, 모든 하위 자료는 이를 공유한다. 서로 다른 feature가 같은 stable id를 사용하거나, 변환이 비가역적이거나, 제어 잔차가 허용치를 넘거나, datum·epoch가 미해결인 상태에서 정본 결합이 요청되면 해당 결합과 파생 출력을 거부하고 원본별 상태, 실패 경로와 필요한 결정을 반환한다.
