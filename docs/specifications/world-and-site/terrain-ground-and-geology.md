# 지형, 지반과 지질

## 지형과 지반의 해석 상태 {#world-site-terrain-ground-state}

<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-landforms Defines terrain as authored spatial evidence rather than a preset landscape. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-geology-ground Keeps surface and subsurface facts related but distinct. -->

시스템은 지표면 relief, 인공 지형 변경, 다층 지표, 지질 단위, 토양 profile과 ground cover를 stable spatial feature로 해석한다. 특정 지형 유형, 토양 분류나 지질 시대를 내장하지 않고 사용자가 제공한 명칭과 속성을 보존하며, 보이는 표면과 해석된 지하 체적을 같은 것으로 간주하지 않는다.

### 표고, 경사와 표면 입력 {#world-site-elevation-slope-surface-input}

<!-- @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Requires elevation, slope and aspect from one declared reference. -->
<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-surface-volume Separates surface representations from volumetric terrain. -->

지형 입력은 점·등고선·TIN·격자·규칙 기반 높이 중 지원된 표면 표현, footprint, 수직 기준, 해상도와 표본 순서를 명시한다. 출력 표고, 경사와 향은 같은 표면과 좌표 기준에서 결정론적으로 파생되고 derivation revision을 기록한다. 체적 표현은 닫힌 boundary, 내부 void, 접하는 표면과 source 관계를 가지며, 동굴, 절벽의 겹침, overhang처럼 한 평면 위치에 여러 높이가 필요한 지형을 단일값 heightfield로 납작하게 만들지 않는다.

### 지형 변경과 다층 접촉 {#world-site-terrain-modification-contact}

<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-modification Requires cuts, fills, grading and excavations to remain traceable changes. -->
<!-- @evidence requirements/map/terrain-and-landforms.md#map-multilevel-terrain Preserves bridges, terraces and overlapping ground levels as distinct surfaces. -->
<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-contact-boundary Requires measurable contact with buildings, water and networks. -->

절토, 성토, 평탄화, 제방, 굴착과 복구는 기존 지형을 덮어쓰는 값이 아니라 적용 범위, 순서, 재료 이동과 phase를 가진 변경이다. 겹치는 표면은 level identity와 위·아래 관계를 가지며, 건물 기초, 도로, 교량, 터널, 물 경계와의 접촉은 허용 간극·관입·중첩 기준으로 검증한다. 지원된 표현으로 접촉을 판정할 수 없으면 충돌 없음으로 간주하지 않고 미검증 관계로 출력한다.

### 해상도, 불확실성과 결손 {#world-site-terrain-resolution-gap}

<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-resolution-uncertainty Requires source resolution and uncertainty to survive derivation. -->
<!-- @evidence requirements/map/terrain-and-landforms.md#map-terrain-gap Requires gaps and unsupported terrain forms to stay explicit. -->

각 표면은 원본 표본 간격, 보간 규칙, 수평·수직 불확실성, nodata 영역과 유효 축척을 보존한다. 재표본화는 원본보다 높은 정확도를 생성하지 않으며, 빈 영역, self-intersection, 퇴화 polygon, 비유한 높이, 서로 모순된 중첩은 feature별 실패로 반환한다. 사용자가 시각적 메움을 선택한 경우에도 그 geometry는 측량·수문·접촉 검증의 근거가 되지 않는다.

### 지질 단위와 토양 profile {#world-site-geology-soil-profile}

<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-geology-units-ground-zones Requires named geological units and spatial ground zones. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-soil-profile-properties Requires ordered soil horizons with measured or declared properties. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-strata-exposure Requires exposures to relate surface observations to subsurface units. -->

지질 상태는 구역 또는 체적으로 경계 지어진 단위와 출처, 해석 신뢰도, 서로의 접촉 관계를 가진다. 토양 profile은 지표 기준 깊이 구간이 순서대로 겹치지 않게 배치되고, 각 층의 사용자 정의 분류와 물성, 표본 방법과 단위를 보존한다. 노두, 절개면과 시추는 관찰 위치와 지질 단위의 관계를 제공하지만, 관찰 사이의 미지 영역을 자동으로 확정된 체적으로 채우지 않는다.

### 지표 피복과 지하 관계 {#world-site-ground-cover-subsurface-relation}

<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-ground-cover Requires cover state to remain distinct from the supporting soil or rock. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-surface-subsurface-relation Requires explicit relations between visible cover, terrain and strata. -->

암반, 토양, 포장, 모래, 잔해와 사용자 정의 ground cover는 두께, 범위, 투과·마찰·반사·변형·흔적 수용 등 선언된 속성과 아래 지반 feature 참조를 가진다. 지표 피복이 바뀌어도 지질 단위가 자동으로 바뀌지 않으며, 절토나 침식으로 지층이 노출될 때는 변화 관계가 명시되어야 한다. 겹치는 피복, 음수 두께, 참조되지 않는 지반과 불명확한 우선순위는 해석 실패다.

### 지반 상태, 수량과 분석 한계 {#world-site-ground-state-quantity-limit}

<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-ground-temporal-state Requires moisture, freeze, erosion and disturbance to be time-scoped state. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-ground-quantity Requires quantities to cite geometry, phase and confidence. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-ground-analysis-bound Prevents visual proxies from claiming professional geological analysis. -->

포화, 동결, 침식, 다짐, 오염과 교란은 시간 또는 phase에 묶인 상태이며 정적 재료 identity와 분리한다. 면적, 절·성토량, 피복량과 지층 체적은 사용한 geometry, 계산 방법, 포함 범위, 단위, 오차와 revision을 출력하고 입력이 바뀌면 stale이 된다. 시스템이 수행하지 않은 지반 안정, 지지력, 오염 확산이나 전문 지질 해석은 시각적 개연성만으로 통과시키지 않고 지원되지 않은 분석으로 표시한다.
