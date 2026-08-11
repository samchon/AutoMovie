# Prototype 결정성과 fidelity 경계

## 구조적 prototype 경계 {#spec-authoring-prototype-boundary}

<!-- @evidence requirements/product/charter.md#product-deterministic-prototype 이 경계가 구조화된 작품 사실을 재현 가능한 film prototype으로 검증·렌더하게 한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-blocking-pass 이 경계가 산출물의 품질 기준을 감독이 판단 가능한 blocking pass로 둔다. -->

Primary output은 story, staging, motion, timing, camera, light와 sound를 판단할 수 있는 deterministic prototype이다. 표면 fidelity는 이 구조적 output의 성공 조건을 바꾸지 않으며 finished photoreal shot으로 오인되어서는 안 된다.

### Deterministic 입력 identity {#spec-authoring-deterministic-input-identity}

<!-- @evidence requirements/product/charter.md#product-reproducible-judgment 이 identity가 같은 선언과 실행 조건을 같은 정규 결과로 연결한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-authored-variation-determinism 이 identity가 seed 기반 변이를 동일한 입력에서 재생 가능하게 한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-nondeterministic-completion-exclusion 이 identity가 선언되지 않은 확률적 completion을 정본에서 제외한다. -->

Deterministic input identity는 normalized declarations, source snapshot, adopted byte digests, contract와 runtime version, frame clock, explicit seed와 실행 조건을 포함한다. 같은 identity는 같은 정규 기록, timeline, derived state와 검토 가능한 산출물을 만들어야 한다.

### 구조 출력 불변식 {#spec-authoring-structural-output-invariant}

<!-- @evidence requirements/product/charter.md#product-structural-output 이 불변식이 structure, placement, action, timing, visibility와 sound event를 판단 가능하게 한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-prototype-geometry 이 불변식이 단순 외형에서도 위치, 크기, 연결과 contact를 속이지 못하게 한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-prototype-motion-time 이 불변식이 motion과 shot boundary를 fixed film clock에서 재현하게 한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-prototype-readability 이 불변식이 화면과 소리에서 subject, action과 event order를 검토 가능하게 한다. -->

Prototype output은 declared target의 geometry, relation, state, time, motion, camera, light와 sound event를 검토 가능한 형태로 제공해야 한다. Proxy와 provisional representation은 그 상태를 표시하며 구조 누락을 finished appearance로 감출 수 없다.

### 저작 자유도와 결정성 {#spec-authoring-choice-determinism-invariant}

<!-- @evidence requirements/product/authorability.md#product-authoring-choice-space 이 불변식이 서로 다른 기법, 구성, 정밀도와 비용 선택을 허용한다. -->
<!-- @evidence requirements/product/authorability.md#product-explicit-control 이 불변식이 결과를 바꾸는 주요 선택을 explicit input으로 둔다. -->

Determinism은 하나의 미술 결과를 강제하는 규칙이 아니다. 사용자는 공개 범위 안에서 기법, 구성, quality tier와 seeded variation을 바꿀 수 있고 각 선택은 새 input identity와 비교 가능한 output을 만들어야 한다.

### 후속 fidelity 출력 {#spec-authoring-downstream-fidelity-output}

<!-- @evidence requirements/product/prototype-quality.md#product-prototype-handoff 이 출력이 prototype을 optional downstream finishing lane의 input으로 제공한다. -->

Downstream fidelity result는 source prototype과 다른 rendition identity, source digest, transformation 또는 execution provenance, output digest와 review state를 가져야 한다. 이 result는 structural prototype과 그 evidence를 대체하거나 source truth로 역승격할 수 없다.

### Fidelity 실패와 선택 {#spec-authoring-fidelity-failure-choice}

<!-- @evidence requirements/product/choice-and-external-services.md#product-external-substitution-choice 이 실패가 external lane 문제 뒤 deterministic output, 대체 경로와 defer를 사용자 선택으로 남긴다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion 이 실패가 현재 직접 완성하지 않는 likeness를 prototype 성공처럼 주장하지 못하게 한다. -->

후속 lane이 구조를 보존하지 못하거나 unavailable이면 rendition을 거부하고 deterministic output, 다른 authorized path 또는 defer를 선택지로 반환해야 한다. 현재 제외된 likeness나 표면 fidelity를 prompt 또는 hidden completion으로 만들어 prototype capability라고 주장할 수 없다.

### 제품 제외와 호환성 {#spec-authoring-prototype-exclusion-compatibility}

<!-- @evidence requirements/product/scope-and-exclusions.md#product-editor-export-exclusion 이 호환성이 generic editor와 scene export를 prototype 판단 경로로 가정하지 않게 한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-exclusion-reopening 이 호환성이 제외를 authorability, 검증과 source ownership 근거가 생길 때만 다시 검토하게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-omission-compatibility 이 호환성이 새 fidelity 선택을 사용하지 않는 input의 기존 의미를 유지한다. -->

새 fidelity lane은 기존 deterministic identity와 output을 유지하는 additive path여야 한다. Generic scene export와 interactive editor는 호환성 전제가 아니며, 제외 범위는 명시 제어, prototype 검증과 source authority가 충족되는 새 contract version에서만 바뀔 수 있다.
