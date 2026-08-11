# 부분 target과 원자적 결과

## 부분 target 작업 경계 {#spec-authoring-partial-target-boundary}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-honest-partial-work 이 경계가 전체 film이 미완성이어도 선언된 부분 target을 검증 가능하게 한다. -->

작업과 검증의 원자성은 전체 production이 아니라 요청된 target과 그 dependency closure에 적용된다. Target 밖의 명시 omission은 부분 target의 성공을 막지 않으며 그 성공은 더 넓은 범위로 확장되지 않는다.

### Target 선언 입력 {#spec-authoring-partial-target-input}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission 이 입력이 omission의 범위, 이유, 영향 대상과 다음 단계를 명시하게 한다. -->

Target 입력은 stable identity, 포함 범위, dependency identity, expected output, source snapshot과 제외된 범위를 가진다. Omission은 대상 또는 interval, 이유, 영향, provisional representation과 다음 저작 단계를 별도 record로 선언해야 한다.

### 부분 작업 상태 {#spec-authoring-partial-work-state}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-partial-work-gap-distinction 이 상태가 미저작, 의도적 보류와 capability gap을 구분한다. -->

부분 target은 `undeclared`, `incomplete`, `ready`, `succeeded`, `failed`, `stale` 상태를 가진다. `incomplete`는 미저작 또는 의도적 보류 reason을, `failed`는 요청한 capability 또는 validation failure를, `stale`은 source나 dependency identity 변화를 나타내야 한다.

### 원자적 결과 불변식 {#spec-authoring-partial-atomic-invariant}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-atomic-compilation 이 불변식이 target마다 완전한 artifact 또는 구조화된 failure만 허용한다. -->

한 attempt는 target closure 전체가 같은 source snapshot에서 검증된 성공 artifact이거나 current target으로 publish 가능한 artifact가 없는 structured failure여야 한다. 이전 성공 bytes, 현재 실패 일부와 임의 substitute를 섞은 결과를 current target으로 publish할 수 없다.

### 결과와 checkpoint {#spec-authoring-partial-result-checkpoint}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control 이 출력이 부분 결과를 채택, 수정 또는 폐기하는 사용자 선택을 보존한다. -->

성공 출력은 target, source snapshot, dependency identity, artifact digest, covered scope와 remaining omission을 제공한다. 사용자는 이를 checkpoint로 채택해 다음 작업의 입력으로 삼거나 수정·폐기할 수 있으며 checkpoint는 final delivery 승인이 아니다.

### 검증 범위 불변식 {#spec-authoring-partial-verification-invariant}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-partial-verification-scope 이 불변식이 부분 성공을 다른 view, platform 또는 전체 film 성공으로 확대하지 못하게 한다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check 이 불변식이 현재 질문에 답하는 가장 좁은 유효 target을 선택하게 한다. -->

검증 결과는 exact target, input identity, view, platform과 조건을 명시해야 한다. 한 frame, shot, analysis 또는 test가 답하지 않은 scope에는 `unknown`을 유지하고 성공을 전파하지 않아야 한다.

### Omission과 placeholder 실패 {#spec-authoring-partial-omission-failure}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission 이 실패가 placeholder를 완성된 shot으로 세지 못하게 한다. -->

Target 안의 필수 사실이 누락되면 failure는 missing identity와 correction을 반환해야 한다. 사용자가 선택한 placeholder는 provisional 상태와 omission relation을 유지하며 review와 delivery가 이를 완성 결과로 계산하지 않아야 한다.

### 재개 호환성 {#spec-authoring-partial-resume-compatibility}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-resumable-authoring 이 호환성이 versioned source와 진단에서 hidden session 없이 작업을 재개하게 한다. -->

재개는 checkpoint가 참조한 source snapshot, dependency identity, omission, diagnostics와 next step만으로 가능해야 한다. 현재 source가 달라졌으면 checkpoint를 `stale`로 표시하고 새 target attempt를 요구하되 이전 partial artifact를 현재 결과로 섞지 않아야 한다.
