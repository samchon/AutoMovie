# 리그, 변형과 상태

## 변형 계약 경계 {#asset-spec-rig-boundary}

### 기준 pose와 rig 입력 {#asset-spec-rig-inputs}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-state 일반 물체와 performer가 관절, 제약, 변형과 상태를 가질 수 있어야 한다. -->

시스템은 리그를 특정 생물 종류에 고정된 부가 기능이 아니라 모델 부품과 표면을 시간에 따라 움직이는 이름 있는 관계 집합으로 취급한다. 정적 모델은 리그가 없어도 유효하지만, 움직임이나 변형 능력을 주장하는 모델은 그 능력을 실제로 운반하는 결합을 가져야 한다.

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls 리그 기준과 control identity를 명시해야 한다. -->

리그 입력은 root, 관절·node 식별자와 parent 관계, rest transform, bind transform, 회전·이동 축과 단위, control identity, 허용 범위, constraint, driver 의존성, 표면 결합을 포함한다. 기준 pose나 축 해석이 둘 이상 가능하면 시스템은 추측한 pose를 저장하지 않고 모호한 channel을 반환한다.

### 관절과 control 불변식 {#asset-spec-joint-control-invariants}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations hinge, slider, 회전, 연결과 사용자 정의 관계를 일반적으로 표현해야 한다. -->
<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers control, driver와 대상 channel의 의존성을 추적해야 한다. -->

모든 관절과 control은 모델 revision 안에서 유일한 identity, 유효한 parent 또는 root, 평가 순서와 구동 대상이 있어야 한다. constraint와 driver graph는 순환 없이 평가 가능해야 하며, limit은 기준 frame과 단위를 포함하고, 존재하지 않는 node나 자신을 간접 구동하는 관계는 유효한 리그가 아니다.

### skin과 morph 사실 {#asset-spec-skin-morph-facts}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface 표면이 bone, weight, morph와 다른 변형 basis에 결합될 수 있어야 한다. -->
<!-- @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation 변형 표면이 기준 pose와 bind 관계에 맞아야 한다. -->

skin은 정점 또는 표면 sample에서 bone identity로 가는 정규화된 영향과 bind 기준을 기록하고, morph는 기준 geometry revision에 대한 이름 있는 차이와 허용 범위를 기록한다. 여러 변형이 함께 적용되면 평가 순서와 합성 규칙을 명시하며, topology나 기준 geometry가 바뀌면 기존 skin·morph를 자동 재사용하지 않는다.

### 상태와 동작의 분리 {#asset-spec-state-motion-separation}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction 문이 열림, 접힘, 손상됨과 같은 상태를 그 상태로 가는 동작과 구분해야 한다. -->

상태는 특정 시점에 유지되는 이름 있는 모델 사실이고, 동작은 시작 상태에서 종료 상태로 channel 값을 변화시키는 시간 함수이다. 상태 기록은 적용된 variant, material state, 관절·morph 값과 provenance를 포함하며, 동작 종료 출력은 다음 장면이 인계할 수 있는 명시적 상태여야 한다.

### retarget 입력과 호환 결과 {#asset-spec-retarget-compatibility}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-motion-retargeting 외부 motion과 다른 rig 사이의 mapping, 축척, root motion과 누락 channel을 다뤄야 한다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-input-compatibility-preview 교체 전에 rig, morph와 motion 결합의 호환성을 미리 제시해야 한다. -->

retarget 입력은 source·target rig revision, bone·control 대응, rest pose 정렬, 축과 단위 변환, scale 정책, root motion 정책, 누락·추가 channel 처리와 목적 동작을 포함한다. 출력은 직접 대응, 근사, 누락, 범위 초과와 contact 영향이 구분된 compatibility report이며, 사용자가 승인하지 않은 근사나 channel 삭제를 자동 적용하지 않는다.

### 파생 basis와 stale 상태 {#asset-spec-derived-deformation-staleness}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis skin, morph와 bake 결과가 기준 geometry와 rig revision을 추적해야 한다. -->

skin weight, morph delta, baked pose, collision proxy와 motion cache는 생성에 사용한 geometry, topology, rig, rest·bind pose와 변환 규칙 revision을 참조한다. 어느 기준이라도 바뀌면 영향받은 파생물은 `stale`이 되고, 새 기준에 대해 다시 검증되기 전에는 current 표현에 결합할 수 없다.

### 출력 검증과 실패 {#asset-spec-rig-output-failures}

<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-invalid-rig-refusal 누락 parent, cycle, 잘못된 weight, 존재하지 않는 bone과 상충 constraint를 거부해야 한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-rig-validation 실제 pose와 극단 pose에서 관절, skin, morph와 contact를 검증해야 한다. -->

리그 검증 출력은 hierarchy, 기준 pose, limit, driver graph, skin weight, morph topology, pose 범위, self-intersection·관통, contact와 retarget 결과를 element별 상태로 제공한다. cycle, 잘못된 parent, 유한하지 않은 transform, 정규화할 수 없는 weight, 없는 bone 참조, 상충 constraint, 기준 불일치 또는 약속한 동작을 수행할 channel 부재는 모델 채택을 거부한다.
