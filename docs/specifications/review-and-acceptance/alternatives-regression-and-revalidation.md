# Alternative, 회귀와 재판정

## Alternative Set {#review-system-alternative-set}

<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-alternative-takes-versions Defines comparison and selection across take, edit, render, rendition and delivery versions. -->

Alternative set은 공통 intent와 source identity, candidate identities, 차이를 만든 revision relation, comparison context와 selection state를 가진다. Candidate는 독립 target과 verdict를 유지하며 set membership이 current 선택이나 acceptance를 뜻하지 않는다.

### 공통 Basis와 Difference {#review-system-alternative-basis-difference}

<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-alternative-common-basis-difference Separates shared source and intent from performance, staging, edit, style and delivery differences. -->

Alternative comparison은 공통 source, intent와 unchanged dependency를 먼저 식별하고 performance, staging, camera, timing, edit, style, quality와 delivery 조건의 차이를 정규 change set으로 보존한다.

### 동기화된 비교 {#review-system-synchronized-comparison}

<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-synchronized-comparison Aligns candidates by semantic event, frame or time range under comparable presentation. -->

후보의 대응은 같은 semantic event, frame 또는 time range를 명시하고 가능한 같은 presentation context에서 관찰한다. 길이나 구조가 달라 대응하지 않는 영역은 unmapped로 남기며 임의의 time ratio로 같은 순간을 만들지 않는다.

### Candidate별 Finding {#review-system-candidate-findings}

<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-candidate-specific-findings Keeps annotations, findings, coverage and verdicts isolated per candidate. -->

Observation, annotation, finding, evidence coverage와 verdict는 candidate identity에 결속된다. Shared observation을 재사용할 수 있는 경우에도 target과 context가 동등하다는 explicit relation이 필요하다.

### 선택과 비교 이력 {#review-system-alternative-selection-history}

<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-alternative-selection Defines selected, alternate, hold, rejected and superseded states with tradeoffs. -->
<!-- @evidence requirements/review/alternative-takes-and-versions.md#review-comparison-history Preserves earlier comparison and selection decisions after new versions arrive. -->

Selection state는 selected, alternate, hold, rejected와 superseded를 구분하고 selector, criteria, tradeoff, finding과 time을 가진다. 새 version이나 선택 변경은 이전 comparison과 selection record를 덮어쓰지 않는다.

## 변경 영향 집합 {#acceptance-system-change-impact-set}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-change-impact Identifies acceptance scopes affected by target, dependency, criterion, profile, authority, runtime or evidence changes. -->

Change impact set은 changed identity와 field, dependency edges, affected target, criterion, evidence, verdict, approval와 publication을 결정적인 순서로 열거한다. 영향 확인을 하지 않은 전체 approval은 current로 유지하지 않는다.

### Criterion 변경 {#acceptance-system-criterion-change}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-criterion-change Gives changed expectations, comparison, tolerance, evidence, severity or aggregation a new criterion version. -->

Expected state, comparison rule, tolerance, exact declaration, required evidence, severity 또는 aggregation rule이 바뀌면 새 criterion version을 만든다. 이전 version verdict와 새 version verdict는 같은 fact로 합치지 않는다.

### Target과 환경 변경 {#acceptance-system-target-environment-change}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-target-change Invalidates observations affected by authored or derived target changes. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-environment-profile-change Invalidates review scopes affected by display, decoder, platform, language or profile changes. -->

Source, asset, state, timing, camera, edit, sound, render, caption, repaint, delivery와 required presentation environment의 변경은 영향을 받는 observation과 verdict를 stale로 만든다. Dependency가 없는 sibling 결과는 근거와 함께 current로 보존할 수 있다.

## Regression Comparison {#acceptance-system-regression-comparison}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-regression-comparison Aligns current and baseline identities, profiles, conditions and criterion versions. -->

Regression comparison은 current와 baseline의 target lineage, profile, criterion version, sample plan과 presentation context를 대조하고 observable difference와 mapping gap을 산출한다. 비교 가능성 조건이 충족되지 않으면 regression verdict를 만들지 않는다.

### 개선과 Criterion 충족 {#acceptance-system-improvement-correctness}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-improvement-correctness Separates improvement over baseline from satisfying the current criterion. -->

Baseline보다 개선되었다는 comparison result와 current criterion pass를 독립적으로 기록한다. 개선 후에도 threshold 밖이면 fail이며 appearance 차이가 있어도 criterion을 계속 충족하면 자동 regression이 아니다.

### 의도된 변경 {#acceptance-system-intentional-change}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-intentional-change Requires intentional differences to be grounded in an approved change and new expectation. -->

Intentional difference는 change decision, authority, affected criterion과 새 expected state에 연결된다. Observation 뒤에 추가한 설명만으로 unauthorized difference를 intended로 소급 분류하지 않는다.

## 재판정 범위 {#acceptance-system-revalidation-scope}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-revalidation-scope Includes the whole consequence surface sharing state, time, assets, artifacts or approval dependencies. -->

Revalidation set은 직접 변경된 criterion과 같은 state, time, asset, output 또는 approval dependency를 공유하는 consequence surface를 포함한다. 각 scope는 required evidence와 authority를 current identity로 다시 결속한다.

### 재판정 완료 {#acceptance-system-revalidation-completion}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-revalidation-completion Restores current approval only after all affected required criteria and authority decisions are current. -->

Revalidation은 영향받은 모든 required criterion이 current evidence로 결론적으로 판정되고 blocking criterion이 pass 또는 유효한 허용 deviation 상태이며 필요한 authority가 새 결과를 채택할 때 완료된다. 완료 전에는 이전 approval과 동등한 current 상태를 회복하지 않는다.
