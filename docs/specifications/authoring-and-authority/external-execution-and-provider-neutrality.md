# 외부 실행과 provider 중립성

## 제공자 중립 외부 실행 경계 {#spec-authoring-provider-neutral-boundary}

<!-- @evidence requirements/product/choice-and-external-services.md#product-provider-neutral-capability 이 경계가 외부 능력을 특정 provider가 아니라 input, output, provenance와 failure로 정의한다. -->
<!-- @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-provider-neutrality 이 경계가 안내 surface에서 provider, model, account와 catalogue를 기본 경로로 고정하지 않게 한다. -->

외부 생성, 분석, 저장, 변환과 전달은 선택 가능한 execution boundary다. 시스템 contract는 provider별 API가 아니라 요청 identity, 전달 input, 반환 bytes, provenance, 한계와 failure를 정의해야 한다.

### 선택 입력 {#spec-authoring-external-selection-input}

<!-- @evidence requirements/product/choice-and-external-services.md#product-user-controlled-choice 이 입력이 provider, 외부 input, 품질 lane과 비용 한도를 사용자 또는 위임받은 agent가 선택하게 한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery 이 입력이 local, external, 품질 tier와 부분 경로의 선행 조건을 비교 가능하게 한다. -->

선택 입력은 목적, target, 허용 execution kind, provider와 model identity를 선택한 경우 그 exact version, 비용 한도, input retention 조건, consumer 권한, 품질 조건과 결정 주체다. 설치되거나 접근 가능한 service는 후보일 뿐 선택이 아니다.

### 외부 실행 상태 {#spec-authoring-external-execution-state}

<!-- @evidence requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision 이 상태가 직접 선택, 위임과 보류를 service 가용성과 분리한다. -->
<!-- @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-no-surprise-external-effects 이 상태가 명시 요청 전 upload와 외부 generation을 금지한다. -->

외부 실행은 `unselected`, `authorized`, `running`, `refused`, `returned`, `adopted`, `superseded` 상태를 가진다. `authorized` 전에는 input 전송과 비용 발생이 없어야 하며, `returned` 결과는 사용자 또는 해당 선택을 위임받은 코딩 에이전트가 채택하기 전까지 작품 source나 current rendition이 아니다.

### 실행 요청과 side effect {#spec-authoring-external-request-output}

<!-- @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-no-surprise-external-effects 이 요청이 service, 전달 input, 결과 용도와 비용 경계를 명시하게 한다. -->

외부 실행 요청은 선택된 service identity, exact target, 전송할 input digest 목록, parameter, 결과 용도와 허용 비용을 포함해야 한다. 출력은 attempt identity, 실제 execution identity, returned bytes 또는 structured refusal이며 지식 조회와 deterministic evidence 요청은 이 실행을 암묵적으로 만들 수 없다.

### 채택 결과와 결정론 {#spec-authoring-external-adoption-output}

<!-- @evidence requirements/product/choice-and-external-services.md#product-deterministic-external-adoption 이 출력이 비결정적 실행 결과를 exact bytes와 provenance로 고정한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes 이 출력이 채택된 외부 bytes를 project-owned identity로 봉인한다. -->

채택 결과는 output digest, exact bytes location, provider·model·version, execution boundary, parameter, source inputs, attempt identity, 채택 주체와 위임 범위, reproducibility claim을 포함한다. 후속 결정론은 이 고정된 결과에서 시작하며 동일 seed만으로 원격 실행의 재현성을 주장해서는 안 된다.

### 중립성과 source authority 불변식 {#spec-authoring-provider-source-invariant}

<!-- @evidence requirements/product/scope-and-exclusions.md#product-nondeterministic-completion-exclusion 이 불변식이 매 실행마다 달라지는 외부 구조를 작품 정본으로 쓰지 못하게 한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-editable-source-authority 이 불변식이 remote result가 명시적 채택 없이 source보다 높은 권위를 갖지 못하게 한다. -->

어떤 provider도 mandatory 또는 hidden default가 될 수 없고, remote alias나 latest result를 current input으로 재해석할 수 없다. 외부 결과는 명시 채택 뒤에도 source-owned 구조와 별개의 input identity이며 작품의 구조적 truth를 자동 수정하지 않는다.

### 실패와 대체 선택 {#spec-authoring-external-failure-substitution}

<!-- @evidence requirements/product/choice-and-external-services.md#product-external-substitution-choice 이 실패가 provider 장애 뒤 대체 경로를 사용자 또는 위임받은 agent의 선택으로 남긴다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal 이 실패가 provenance가 불명확한 returned result의 채택을 거부한다. -->

Unavailable service, unauthorized input, changed input identity, invalid output 또는 incomplete provenance는 `refused` 결과다. 시스템은 다른 service로 자동 전환하지 않고 지원되는 대체 execution, local tool, pre-generated result, provisional placeholder 또는 defer 선택지를 반환해야 한다.

### Provider 변화 호환성 {#spec-authoring-provider-compatibility}

<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change 이 호환성이 외부 exchange 의미 변화에 version과 migration을 요구한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability 이 호환성이 source와 공개 contract를 유지한 provider 교체를 허용한다. -->

Provider-specific metadata는 core adoption record를 바꾸지 않는 additive field로만 확장할 수 있다. Provider나 model 변화는 새 execution identity와 adoption result를 만들며 기존 source, 이전 adopted bytes와 provenance chain을 덮어쓰지 않아야 한다.
