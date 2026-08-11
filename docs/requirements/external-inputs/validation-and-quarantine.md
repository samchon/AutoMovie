# 검증과 Quarantine

## 신뢰 전 검증 상태 {#external-validation-quarantine}

취득한 외부 입력은 검증되기 전까지 작품의 실행 가능한 자원이나 current production input이 아닌 quarantine 상태로 구분해야 한다. 사용자는 raw input을 조사할 수 있지만 검증하지 않은 bytes가 scene, timeline, agent context, build result와 publication에 자동 참여하지 않아야 한다.

### 선언과 실제 내용의 교차 확인 {#external-validation-content-facts}

Filename extension, declared media type, response header, magic 또는 signature, parser가 확인한 format과 내부 metadata를 서로 독립된 사실로 비교해야 한다. 서로 모순되거나 polyglot처럼 해석이 불명확한 입력은 가장 편리한 decoder로 넘기지 않고 격리하거나 거부해야 한다.

### 구조와 의미 검증 {#external-validation-structure-semantics}

Syntax와 container 무결성뿐 아니라 reference resolution, count와 range, finite numeric value, topology 또는 hierarchy, clock, coordinate, unit, channel, schema와 required identity를 media family에 맞게 검증해야 한다. Parser가 열었다는 사실만으로 배치, retarget, sync, geographic alignment 또는 publication에 적합하다고 판단하지 않아야 한다.

### 능동 Content의 경계 {#external-validation-active-content}

Macro, script, executable payload, embedded command, dynamic link와 instruction-like text는 data inspection과 명시적 tool execution을 구분해야 한다. 사용자가 별도 실행을 요청하지 않은 active content를 import 과정에서 실행하거나, 외부 text가 credential, filesystem와 network 권한을 얻지 않아야 한다.

### Quarantine에서 채택으로의 전환 {#external-validation-adoption-gate}

채택에는 source revision, 검증 결과, 지원 범위, 필요한 user decision, license 상태와 선택된 degradation이 결속되어야 한다. 검증 뒤 bytes나 dependency가 바뀌면 이전 통과 상태를 재사용하지 않고 새 revision을 다시 판단해야 한다.

### 진단과 Result 상태 {#external-validation-result-states}

Acquired, quarantined, validating, accepted, rejected, unavailable, unsupported, degraded와 not-run을 구분하고 문제의 source member, element, rule과 consequence를 식별할 수 있어야 한다. 일부 항목이 통과했다는 이유로 전체 closure나 선택한 사용 목적이 검증되었다고 주장하지 않아야 한다.

### Quarantine 자료의 노출과 폐기 {#external-validation-quarantine-handling}

격리 자료의 preview, log와 diagnostic은 credential, 개인 정보, hostile markup과 임의 binary content를 그대로 확산하지 않아야 한다. 사용자는 실패한 자료를 안전하게 교체하거나 제거할 수 있고, 제거 뒤에는 current input, cache와 publication 후보에 남아 있지 않음을 확인할 수 있어야 한다.
