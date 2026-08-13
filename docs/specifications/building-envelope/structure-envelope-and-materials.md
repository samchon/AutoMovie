# 구조, 외피와 재료 Assembly {#building-envelope-structure-material-specification}

## 구조와 외피 Graph {#building-envelope-structure-envelope-graph}

### 구조 입력과 지지 출력 {#building-envelope-structural-support-input-output}

<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-structure-envelope 구조적 지지와 비구조 외피, face·edge·junction 및 interior 연계를 분리된 관계 graph로 규정한다. -->

구조 graph는 foundation, wall, column, beam, slab, truss와 project-defined member 사이의 support relation을 소유하고, envelope graph는 내부와 외부 또는 서로 다른 환경 zone을 나누는 face, edge, corner, opening과 junction을 소유한다. 한 visible element가 두 역할을 수행할 수 있으나 역할과 검증 결과는 구분한다.

<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support element의 지지 대상, bearing relation과 미검증 구조 성능을 구분한다. -->

입력은 member identity, geometry 또는 bounds, structural role, support·supported relation, attachment, phase와 known load fact를 제공한다. 저작 가능한 배치 검사는 subject를 element 또는 compact population identity로, support를 element·population 또는 named surface identity로 지정하고 `bearing`과 `suspended`를 구분한다. `bearing` 검사는 subject의 world bounds와 support face가 평면에서 만나는 표본을 양쪽 footprint에서 취해 underside gap을 계산하며, 선언한 tolerance 안은 `resting`, 양수는 `floating`, 음수는 `sunk`, 표본이 하나도 겹치지 않으면 `not-over-support`로 답한다. `suspended`는 subject와 support가 모두 해석될 때만 의도된 비접촉으로 답하고, 해석할 수 없는 identity나 bounds는 `unresolved`로 남긴다. Named-neighbour 검사는 같은 world bounds에서 양의 부피가 겹치는지 답하되 면 접촉은 overlap으로 세지 않고, compact population은 member를 전개하지 않은 conservative population bounds라는 basis를 결과에 보존한다. 모든 배치 결과는 그 수치를 얻은 basis를 함께 제공한다. Element geometry, conservative population bounds, authored surface height rule을 구분하며, 기록이 vertex를 담지 않는 element는 기록이 진술하는 world origin 한 점으로 해석하고 extent를 재지 않았다는 basis를 명시한다. Basis 없는 수치는 측정 근거를 감춘 결과로 취급한다.

출력은 프로젝트 소스가 선언한 relation별 배치 결과와 unresolved relation을 제공한다. 질의는 geometry 또는 axis-aligned bounds에 대한 시각적 broad-phase이며 자동으로 구조 graph, load path 또는 defect를 발명하지 않는다. 실제 capacity, code compliance와 안전성은 별도 검증이 없으면 `unknown`으로 남는다.

### 외피 연속성과 Side 불변식 {#building-envelope-envelope-continuity-invariant}

<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-envelope-continuity 외피 face, edge, corner와 penetration에서 gap, overlap 및 inside·outside 뒤바뀜을 금지한다. -->

Envelope region은 inside, outside, return, top, bottom과 cut face를 구분하고 인접 region과 closure 관계를 가져야 한다. 의도되지 않은 gap, overlap, zero thickness, inverted face, dangling edge와 같은 boundary의 중복 소유는 geometry finding이며 시각적으로 가려져도 통과하지 않는다.

### Interior 구조 공유와 호환성 {#building-envelope-structure-interior-compatibility}

<!-- @evidence requirements/building-exterior/structure-and-envelope.md#building-structure-interior-coordination interior의 wall, core, shaft, slab와 외부 구조가 shared identity 및 revision에 답하게 한다. -->

Linked interior는 structural member, core, shaft, slab와 load-bearing boundary를 같은 identity로 참조하고 finish나 room-side lining만 별도 소유한다. Exterior-only set은 구조 역할을 생략하거나 visual support로 선언할 수 있지만 그 결과를 검증된 구조체로 표시할 수 없다.

## 외피 재료 Assembly {#building-envelope-material-assembly-state}

### 표면과 Layer 입력 {#building-envelope-material-layer-input}

<!-- @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-materials-assemblies 열린 재료 범위, 표면 속성, layer 순서, joint와 수량 표현을 외피 assembly 상태로 정의한다. -->

Surface appearance, physical substance와 ordered build-up은 별도 identity를 가진다. Assembly는 host face, 진행 axis와 sense, offset, layer role, solid·cavity·membrane 성격, thickness, exposed·concealed end와 opening wrap 규칙을 제공하며 특정 시대의 재료 catalogue를 전제하지 않는다.

<!-- @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-surface-properties 색, 거칠기, 광학 속성과 물성의 측정 여부를 분리한다. -->

입력은 project-owned surface property, texture coordinate와 실제 축척, substance fact 또는 null, ordered layer와 phase state를 제공한다. 외부와 내부 face가 다른 finish를 가질 수 있으나 total thickness, host datum과 opening reveal은 하나의 build-up에서 파생되어야 한다.

### Joint, 배수와 개구부 Wrap {#building-envelope-material-joint-opening-wrap}

<!-- @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-joints-drainage layer junction, flashing, seal, joint와 물 흐름의 연속성을 검증 가능하게 한다. -->

Layer junction은 compatible role, termination, movement joint, seal과 drainage path를 명시한다. Opening을 감싸는 layer는 reveal 깊이와 clear profile을 같은 기하에서 변경하며 이미 종료된 layer 뒤에서 다시 감쌀 수 없다.

### Assembly 실패와 수량 호환성 {#building-envelope-material-assembly-failures}

<!-- @evidence requirements/building-exterior/materials-and-assemblies.md#building-exterior-assembly-quantity-representation 외피 assembly 수량의 근거와 표현 tier 한계를 함께 보고한다. -->

비양수 thickness, 묻힌 finish, 노출 end의 finish 누락, concealed end의 불필요 finish, 역할 충돌, 끊긴 membrane과 계산 불가능한 curved 또는 unresolved region은 affected layer를 가진 finding이 된다. 수량은 surface area, layer volume, joint length, opening deduction와 waste basis를 구분하고 representation이 faceted이면 그 근사 상태를 보존한다.
