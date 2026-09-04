# 제품 능력과 콘텐츠 경계

## 보편 능력의 시스템 경계 {#spec-authoring-general-capability-boundary}

### 시스템 책임과 project 책임 {#spec-authoring-system-project-responsibility}

<!-- @evidence requirements/product/capability-and-content.md#product-general-capability 이 계약이 작품별 완성 콘텐츠와 반복 사용 가능한 보편 능력을 시스템 경계로 분리한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-all-objects-motion 이 경계가 모든 객체와 동작을 향한 장기 확장을 닫힌 콘텐츠 목록이 아닌 표현 능력으로 정의한다. -->

시스템은 project가 선언한 작품 사실을 받아 구조화·검증·재생하는 보편 능력을 제공한다. 작품의 인물, 장소, 양식과 자산 identity는 입력이며 시스템이 미리 선택해 제공하는 결과가 아니다.

<!-- @evidence requirements/product/charter.md#product-author-owned-film 이 분리가 작품 선택은 project에, 보편 표현과 검증은 시스템에 남긴다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary 이 절이 공유 능력과 작품 고유 사실의 책임선을 시스템 용어로 고정한다. -->

시스템 책임은 공개된 표현, 연산, validation, 재생과 진단이다. Project 책임은 작품의 서사, 대상, 측정값, 조합, 자산과 acceptance 선택이며, 어느 쪽도 상대 책임의 사실을 암묵적으로 만들어서는 안 된다.

### Capability 상태 {#spec-authoring-capability-state}

<!-- @evidence requirements/product/authorability.md#product-authorability-threshold 이 상태가 저작과 검증 경로를 모두 가진 능력만 available로 분류한다. -->
<!-- @evidence requirements/product/authorability.md#product-discoverable-control 이 상태 출력이 공개 contract와 검증 경로의 발견 가능성을 포함한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery 이 분류가 구현된 능력과 아직 지급되지 않은 gap을 구별한다. -->

Capability 상태는 `available`, `unsupported`, `unverified` 중 하나다. `available`은 명시 입력, 공개 contract, 실행 경로와 검증 evidence를 생산할 경로가 모두 존재할 때만 허용하며, 구조만 선언되었거나 관찰 경로를 확인하지 못한 경우는 `unverified`, 표현 경로가 없는 경우는 `unsupported`다.

### Capability-not-content 불변식 {#spec-authoring-capability-not-content-invariant}

<!-- @evidence requirements/product/capability-and-content.md#product-era-independent-composition 이 불변식이 시대별 결과를 공통 표현의 조합으로 만들게 한다. -->
<!-- @evidence requirements/product/capability-and-content.md#product-unplanted-subject-authoring 이 불변식이 미리 심지 않은 주제도 같은 능력으로 저작 가능하게 한다. -->
<!-- @evidence requirements/product/capability-and-content.md#product-catalogue-refusal 이 불변식이 완성 자산 목록으로 일반 표현 gap을 숨기지 못하게 한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-content-catalogue-exclusion 이 불변식이 작품별 완성품 공급을 제품 경계 밖에 둔다. -->
<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal 이 불변식이 지식 도구도 완성 콘텐츠 공급자로 변하지 못하게 한다. -->

새 주제는 보편 연산과 project-owned 사실의 조합으로 표현되어야 한다. Named catalogue entry, 전용 shortcut 또는 예시 자산의 존재가 성공의 선행 조건이면 그 경로는 보편 capability로 분류할 수 없다.

### 입력과 출력 {#spec-authoring-capability-input-output}

<!-- @evidence requirements/product/authorability.md#product-explicit-control 이 입출력 계약이 결과를 바꾸는 사실을 명시 입력으로 받게 한다. -->
<!-- @evidence requirements/product/capability-and-content.md#product-project-owned-content 이 출력이 project-owned identity와 provenance를 보존하게 한다. -->
<!-- @evidence requirements/product/capability-and-content.md#product-example-role 이 절이 예시 출력의 역할을 재사용 가능한 기법과 검증법으로 제한한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example 이 절이 예시를 하나의 기법, 조절점과 관찰 결과로 구성하게 한다. -->

입력은 project가 선택한 identity, 관계, parameter, 자산과 품질 한도다. 출력은 그 입력에서 파생된 구조화 결과, 적용된 보편 연산, validation 상태와 진단이며, 안내 예시는 결과 콘텐츠가 아니라 동일한 연산을 다른 subject에 적용하는 방법을 제공해야 한다.

### 실패와 gap {#spec-authoring-capability-failure-gap}

<!-- @evidence requirements/product/authorability.md#product-hidden-inference-refusal 이 실패 계약이 누락된 작품 사실을 heuristic으로 채우지 못하게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-capability-gap 이 실패 출력이 구현되지 않은 요구를 추적 가능한 gap으로 보존한다. -->
<!-- @evidence requirements/agent-authoring/partial-work.md#agent-partial-work-gap-distinction 이 진단이 미저작, 보류와 제품 capability gap을 구별한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-diagnostic-discovery 이 실패가 invariant, 대상, 경로와 correction을 반환하게 한다. -->

필수 입력이 없으면 문서화된 기본값, 범위 축소 또는 `decision-required` 진단 중 하나를 반환해야 한다. 표현이나 검증 능력이 없으면 영향받는 사용자 작업과 지원되지 않는 경계를 가진 capability gap을 반환하며 임의 콘텐츠로 성공을 만들어서는 안 된다.

### 확장과 제외 호환성 {#spec-authoring-capability-extension-compatibility}

<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-additive-expression 이 호환성이 새 표현 능력을 명시 계약의 추가로 수용하게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-independent-extension-axes 이 호환성이 기하, 재료, 의미, 상태와 품질 축을 독립적으로 확장하게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-omission-compatibility 이 호환성이 새 선택을 생략한 기존 입력의 의미를 유지한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change 이 호환성이 의미 변화에 version과 migration 책임을 요구한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-exclusion-reopening 이 절이 제외를 다시 여는 조건을 authorability와 검증 근거로 제한한다. -->

새 capability는 기존 입력을 재해석하지 않는 additive contract로 들어와야 한다. 기존 의미를 바꾸는 변화는 version과 migration 결과를 가져야 하며, 현재 제외는 저작 가능한 입력과 검증 경로가 입증되기 전까지 `unsupported` 상태를 유지한다.

### 제작 언어 module 선택 {#spec-authoring-production-language-module}

<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract 선택한 제작 언어 하나의 계약만 생성 project에 존재하고 같은 설정과 router가 그 identity를 보고하게 한다. -->

Scaffold 입력은 `chinese`, `english`, `japanese`, `korean` 중 정확히 하나의 제작 언어를 요구한다. 출력은 선택한 module의 고정된 discovery, principle과 obligation 파일 집합만 `docs/language`에 물질화하며, 누락·미지원 값, 불완전 module, 예상 밖 파일, 다른 언어를 식별하는 structured rule을 전체 생성 전 거부한다.
