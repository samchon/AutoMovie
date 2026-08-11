# Observation, Finding과 Defect

## 관찰에서 판정까지의 기록 사슬 {#review-system-observation-finding-chain}

<!-- @evidence requirements/review/annotations-findings-and-verdicts.md#review-annotations-findings-verdicts Separates located observation, applied criterion, interpretation and verdict. -->
<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observations-and-claims Keeps observations, claims, automated findings and human judgments distinct. -->

Review record는 observation, finding, defect classification, judgment와 final verdict를 서로 다른 identity로 보존하고 각 파생 기록이 의존한 앞선 기록을 가리킨다. 뒷단의 해석은 앞단의 실제 관찰값을 바꾸지 않는다.

### 위치가 있는 Annotation {#review-system-located-annotation}

<!-- @evidence requirements/review/annotations-findings-and-verdicts.md#review-located-annotations Locates annotations on frames, intervals, subjects, sound events, cues or the whole work. -->

Annotation은 target identity와 frame, time range, subject, screen region, sound event, caption cue 또는 whole-work scope 중 필요한 locator를 가진다. Locator가 가리키는 artifact와 context가 stale이면 annotation은 historical로 남고 current observation으로 사용되지 않는다.

### Observation과 해석 {#review-system-observation-interpretation}

<!-- @evidence requirements/review/annotations-findings-and-verdicts.md#review-observation-interpretation Separates observed result, expected result, difference, impact and unverified cause. -->

Observation은 실제 본 결과를, expectation은 적용 criterion의 기대 상태를, interpretation은 차이의 제작상 의미를 기록한다. 원인 evidence가 없으면 가능한 원인을 hypothesis로 표시하고 confirmed cause로 승격하지 않는다.

### Finding 상태 기계 {#review-system-finding-lifecycle}

<!-- @evidence requirements/review/annotations-findings-and-verdicts.md#review-finding-lifecycle Defines open, acknowledged, resolved, dismissed, deferred and reopened states. -->

Finding은 open에서 acknowledged, resolved, dismissed 또는 deferred로 이동할 수 있고 새 evidence가 resolution을 반증하면 reopened가 된다. 모든 전이는 actor, time, reason과 source finding identity를 가지며 terminal state는 최초 observation을 삭제하지 않는다.

### Annotation과 Finding 이력 {#review-system-annotation-history}

<!-- @evidence requirements/review/annotations-findings-and-verdicts.md#review-annotation-history Preserves the history of annotations, replies, findings and verdicts. -->

Annotation, reply, finding과 judgment의 수정은 새 revision이나 superseding record로 남는다. Current projection은 최신 상태를 보여도 historical record와 변경 이유를 다시 읽을 수 있어야 한다.

## Defect 분류 레코드 {#review-system-defect-record}

<!-- @evidence requirements/review/defect-classification.md#review-defect-classification Defines impact category, severity, priority and reproduction as independent dimensions. -->

Defect record는 관련 finding, affected scope, category set, severity, priority, reproduction state와 frequency를 가진다. 분류는 검색과 집계를 위한 정규 identity를 사용하고 표시 문구 변경에 따라 의미가 바뀌지 않는다.

### 작품 관점 Category {#review-system-defect-categories}

<!-- @evidence requirements/review/defect-classification.md#review-defect-categories Preserves every affected story, staging, audiovisual, rendering and delivery viewpoint. -->

Category는 story, staging, camera, performance, motion, continuity, geometry, material, lighting, effect, sound, editorial, repaint, rendering, accessibility와 delivery 같은 관찰 영향 관점을 나타낸다. 한 defect가 여러 관점에 영향을 주면 category set과 공통 finding relation을 함께 보존한다.

### Defect와 허용된 Variation {#review-system-defect-variation-boundary}

<!-- @evidence requirements/review/defect-classification.md#review-defect-versus-variation Separates criterion violations from allowed variation and subjective suggestions. -->

Criterion과 tolerance 안의 variation, 선택적 suggestion과 acceptance violation은 별도 finding kind를 가진다. 사람의 선호 차이는 criterion owner가 기준을 변경하기 전까지 required defect로 분류되지 않는다.

### Severity와 Priority {#review-system-severity-priority}

<!-- @evidence requirements/review/defect-classification.md#review-severity-priority Separates impact severity from scheduling priority. -->

Severity는 작품 이해, continuity, 안전한 재생, 접근성과 delivery 가능성에 미치는 영향을 나타내고 priority는 처리 순서와 제작 결정을 나타낸다. Priority 변경은 관찰된 severity를 덮어쓰지 않으며 blocking 여부는 적용 profile의 criterion relation에서 결정한다.

### 재현 상태와 빈도 {#review-system-reproduction-frequency}

<!-- @evidence requirements/review/defect-classification.md#review-reproduction-frequency Defines always, conditional, intermittent, not-reproduced and unknown outcomes. -->

Reproduction state는 always, conditional, intermittent, not-reproduced와 unavailable을 구분하고 사용한 target, context, sample plan과 횟수를 가진다. 재현하지 못한 결과는 defect가 없다는 판정이 아니라 observation 범위의 사실이다.

### 중복과 공통 영향 {#review-system-duplicate-common-impact}

<!-- @evidence requirements/review/defect-classification.md#review-duplicate-common-impact Preserves individual evidence while linking duplicate manifestations and shared impact. -->

동일 원인의 반복 finding은 canonical defect에 연결할 수 있지만 각 frame, interval과 version의 observation identity를 보존한다. 문구가 같다는 이유로 서로 다른 target이나 원인의 finding을 합치지 않는다.
