# 충실도 경계와 검증

## 충실도 계약 경계 {#asset-spec-fidelity-boundary}

### 목적별 capability 입력 {#asset-spec-validation-purpose-inputs}

<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling 직접 저작 actor의 충실도 ceiling을 정직하게 고지해야 한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-blocking-pass 결정론적 결과는 staging, motion과 timing을 검토하는 blocking pass이다. -->

시스템이 직접 저작하는 결과의 계약은 실제 치수, 식별자, 구조, pose, motion, contact, timing과 반복 가능한 blocking 표현이다. 세밀한 인물 likeness, 사실적인 피부·머리카락·의상 변형과 완성 photoreal shot은 직접 저작의 보장 범위가 아니며, 외부 고충실도 외형을 채택해도 시스템이 이해하거나 제어하는 의미와 능력이 자동으로 늘어나지 않는다.

<!-- @evidence requirements/asset-authoring/validation.md#asset-validation 모든 자산을 사용 전에 목적과 현재 revision에 맞게 검증해야 한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-purpose-validation hero close-up, background, collision, motion과 blocking 등 사용 목적별 적합성을 검증해야 한다. -->

검증 입력은 자산·모델·representation revision, 목적과 shot 규모, 필요한 구조·표면·rig·state·contact·continuity 능력, 허용 수치·화면 오차, 시간 구간과 비교 기준을 포함한다. 목적이나 acceptance threshold가 없으면 시스템은 보편적인 `고품질` 판정으로 대신하지 않고 검증 범위를 불완전으로 표시한다.

### 수치와 구조 검증 {#asset-spec-validation-numeric-structure}

<!-- @evidence requirements/asset-authoring/validation.md#asset-geometry-validation 기하 수치, 치수, topology와 교차를 사용 전에 검증해야 한다. -->
<!-- @evidence requirements/actors/validation.md#actor-input-binding-validation 선택된 모델, rig, morph, motion과 attachment 결합을 검증해야 한다. -->

수치·구조 검증은 유한값, 실제 단위와 치수, 좌표 변환, topology, surface role, resource closure, rig hierarchy, skin·morph basis, state coverage, bounds, pivot, anchor와 dependency binding을 검사한다. 결과는 검사 항목별 observed value, expected constraint, source revision과 pass·fail·unknown 상태를 보존한다.

### 표면과 시각 검증 {#asset-spec-validation-surface-visual}

<!-- @evidence requirements/asset-authoring/validation.md#asset-surface-validation 재료, texture 좌표, channel, color space와 seam을 검증해야 한다. -->
<!-- @evidence requirements/actors/validation.md#actor-multi-angle-review 정면 한 장이 아니라 여러 각도와 거리에서 silhouette, 관통과 attachment를 검토해야 한다. -->

표면·시각 검증은 material role, texture scale·좌표·channel·color space, seam, 상태 변화, silhouette, 관통, self-intersection, attachment와 접촉을 목적 거리와 여러 대표 각도에서 검사한다. 직접 frame 검토가 필요한 항목은 실제 검토한 frame identity와 시각 조건을 기록하며, source 사실만 보고 frame 검토를 통과로 간주하지 않는다.

### 동작과 전환 검증 {#asset-spec-validation-motion-transitions}

<!-- @evidence requirements/asset-authoring/validation.md#asset-rig-validation neutral pose, 극단 pose와 요구 동작에서 리그와 변형을 검증해야 한다. -->
<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability 표현 전환의 scale, contact, silhouette와 animation 안정성을 검토해야 한다. -->

동작 검증은 neutral·rest·bind pose, 요구 동작과 허용 범위의 극단 pose, constraint, root motion, contact, state handoff와 동적 bounds를 검사한다. 표현 전환 검증은 같은 시간의 두 표현을 비교해 identity, scale, pivot, contact, silhouette와 animation phase의 차이를 수치와 frame evidence로 남긴다.

### 현재 evidence와 비교 출력 {#asset-spec-validation-current-evidence}

<!-- @evidence requirements/actors/validation.md#actor-current-evidence 변경 전후 A/B와 current evidence로 regression을 판정해야 한다. -->

검증 출력은 대상·source·representation revision과 digest, 검증 규칙 revision, 실행 시점, 목적, 입력 조건, 수치 결과, frame reference, 이전 승인 결과와의 차이, 최종 상태를 포함한다. 대상이나 검증 규칙이 바뀌면 이전 출력은 stale이며, A/B 비교는 서로 다른 camera·pose·조명·시간 조건을 같은 조건인 것처럼 제시하지 않는다.

### 상태와 실패 표현 {#asset-spec-validation-status-failures}

<!-- @evidence requirements/asset-authoring/validation.md#asset-validation-gap 확인하지 않은 사실을 지원됨이나 통과로 표시하지 않아야 한다. -->
<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-degradation unsupported, failed, degraded, partial과 unknown을 구분해야 한다. -->

검증 상태는 최소 `passed`, `failed`, `partial`, `degraded`, `unsupported`, `unknown`, `not-run`, `stale`을 구분하고 진단은 element, 목적, 기대와 관측을 지목한다. 일부 검사 통과를 전체 통과로 올리거나, placeholder·proxy·외부 외형의 존재를 최종 충실도 보장으로 표시하거나, 사용자 승인 없는 degradation으로 실패를 숨기지 않는다.

### 호환성과 ceiling 승인 {#asset-spec-validation-compatibility-ceiling}

<!-- @evidence requirements/actors/validation.md#actor-validation-ceiling 직접 저작, 외부 채택과 후처리 각각의 품질 ceiling을 정직하게 설명해야 한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-unsupported-fidelity 지원하지 않는 fidelity는 거부하거나 사용자가 선택한 대안을 기록해야 한다. -->

호환 출력은 요청한 목적마다 보존된 능력, 근사·누락 사실, 직접 저작 ceiling, 외부 자산 의존과 선택 가능한 대안을 제시한다. 요구 충실도가 현재 representation으로 검증되지 않으면 시스템은 더 높은 품질 명칭을 붙이지 않고, 사용자가 다른 representation, 외부 자산, blocking 결과 또는 별도 재도색 rendition 가운데 하나를 명시적으로 선택하도록 한다.
