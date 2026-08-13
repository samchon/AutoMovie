# 주체 표면과 검사

## 주체 검사 시스템 {#review-system-subject-inspection}

### 주체 Record와 구성 {#review-system-subject-record}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-identity 주체를 안정된 identity, revision과 구성 관계를 가진 record로 정밀화한다. -->

주체 record는 주체 kind, 안정된 identity, revision 또는 content identity, 소유 상위 주체와 구성 member set을 가진다. kind는 자산, actor, formation, 공간, element와 part를 구분하고 표시 이름은 identity가 아니다.

구성 관계는 상위 주체를 resolve하지 않고도 member를 직접 열 수 있어야 한다. 공간과 그 공간에 속한 element, 자산과 그것을 이루는 part, 자산과 그 자산을 배치한 element, formation과 그 slot placement, instance set과 그 instance placement는 각각 독립된 record이며 원형 record 하나가 placement record 여럿을 소유한다.

Placement record는 자신이 참조하는 원형 identity를 별도 field로 보존하고 원형 record의 관찰 결과를 자신의 관찰 결과로 복사하지 않는다.

### 판정 대상에서 관찰 단위로의 해석 {#review-system-subject-target-parity}

<!-- @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity 판정 가능한 모든 대상이 관찰 단위로 해석되게 만든다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-subject-surface 주체를 shot과 독립된 acceptance 표면으로 정의한다. -->

Resolver는 acceptance 대상 kind를 시간 축 위의 frame·구간·전체 작품, 전달물 또는 주체 단위 가운데 하나로 해석한다. 어느 단위로도 해석하지 못하면 결과는 `unsupported`이며, 그 대상을 담은 shot이나 frame의 관찰로 대체하지 않는다.

주체 표면은 자신의 target identity, required criteria, viewpoint plan, evidence coverage와 verdict를 가진다. 같은 주체를 담은 frame 표면의 pass는 주체 표면의 입력이 될 수 있으나 그 표면의 verdict를 만들지 않는다.

### 시점 Plan의 소유 {#review-system-subject-viewpoint-plan}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership 검사가 시점을 소유한다는 불변식을 viewpoint plan으로 고정한다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-spatial-view-sampling 형상, 접촉, occlusion과 deformation을 드러내는 각도와 구조 view를 요구한다. -->

주체 검사의 viewpoint plan은 주체 identity, 각 시점의 방향과 거리, projection, 적용 pose와 state, 필요한 render pass와 결정적 시점 선택 규칙을 가진다. Plan은 저작된 camera, shot 경계와 film time을 입력으로 받지 않으며 같은 입력과 plan은 같은 시점 identity와 순서를 만든다.

Frame과 구간 표면은 반대로 저작된 camera state를 그대로 사용하고 자체 시점을 선택하지 않는다. 주체 검사가 만든 관찰은 delivery evidence population에 들어가지 않으며, 주체를 담은 shot frame은 그 주체의 viewpoint plan을 충족한 표본으로 계상되지 않는다.

### 주체 Observation Record {#review-system-subject-observation}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-evidence 주체 관찰의 evidence 구성과 필수 표본 누락 상태를 정의한다. -->

주체 observation record는 관찰한 주체 identity와 revision, viewpoint plan identity, 실제 관찰한 시점 집합, 각 시점의 artifact identity와 digest, 사용한 표현과 state, 그리고 관찰이 파생된 compile 또는 source identity를 가진다.

필수 시점이 없거나 읽을 수 없으면 그 시점이 필요한 criterion은 pass가 될 수 없다. 결과는 원인에 따라 not-run, unsupported, indeterminate 또는 partial이며 관찰된 시점의 좁은 결과를 별도로 보존한다.

### 주체 Freshness {#review-system-subject-freshness}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-evidence 주체 검토가 stale로 전환되는 조건을 freshness key로 고정한다. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange 시간 축 검토와 주체 검토가 서로의 freshness를 회복하지 못하게 한다. -->

주체 검토의 freshness key는 주체 revision, 구성 member closure의 identity, viewpoint plan identity, 적용 criterion revision과 관찰 조건을 포함한다. 이 가운데 하나가 바뀌면 그 주체의 verdict는 stale이다.

Shot render, rendition 교체와 delivery 재생성은 주체 freshness key에 들어가지 않으므로 주체 verdict를 current로 만들지 않는다. 반대로 주체 관찰의 갱신은 frame, 구간과 전체 작품 verdict의 freshness key에 들어가지 않으므로 그 verdict를 current로 만들지 않는다.

### 주체 Coverage 집계 {#review-system-subject-coverage}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-coverage 계획한 개체군과 실제 관찰한 개체군을 분리해 집계한다. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange 시간 축 coverage와 주체 coverage를 합산하지 못하게 한다. -->

주체 coverage는 선언된 개체군 정의, 그 정의가 만든 계획 대상 집합, 실제 관찰한 집합, 미관찰 집합과 표본 선택 규칙을 가진다. 개체군 정의가 없으면 completeness는 계산되지 않고 상태는 indeterminate다.

원형 개체군과 placement 개체군은 서로 다른 coverage 축이며 하나의 비율로 합치지 않는다. 주체 coverage와 frame·구간·전체 작품 coverage도 서로 다른 축이며, 한 축의 완결성 주장이 다른 축의 미관찰 범위를 덮지 않는다.

### 주체 결함의 전파 {#review-system-subject-propagation}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange 주체 결함과 시간 범위 결함이 서로의 범위를 다시 열게 한다. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-identity 원형과 placement 구분에 따라 전파 대상을 계산한다. -->

주체 defect가 확정되면 dependency graph는 그 주체를 전달하는 frame, 구간과 상위 표면을 stale로 표시한다. 시간 범위 defect의 원인이 주체로 귀속되면 같은 원형을 참조하는 다른 placement 주체도 재검토 대상으로 표시한다.

전파는 선언된 구성과 참조 관계로만 계산하고 identity 문자열의 접두사나 이름 유사도로 계산하지 않는다.
