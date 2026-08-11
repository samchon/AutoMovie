# 외부 입력 보안과 Redaction

## 외부 Validation 경계 {#validation-external-boundary}

<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-external-boundary-trace 외부 자료의 출처와 고정 identity 및 검사 범위를 진단에 결속한다. -->

외부 입력 session은 source와 acquisition identity, raw digest 또는 안전한 correlation identity, dependency closure, acquisition time, declared media facts, intended use, trust state와 검사 scope를 입력으로 고정한다. Mutable location이나 provider label만으로 bytes identity를 대신하지 않는다.

외부 failure result는 affected input revision과 consumer scope를 가진다. Source 원문을 공개할 수 없어도 권한 있는 범위에서 같은 revision과 attempt를 대조할 opaque identity를 유지하며 다른 credential scope의 입력을 하나로 합치지 않는다.

### 취득과 해석 Failure Stage {#validation-external-failure-stages}

<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-external-failure-stage 찾기부터 채택까지 실패한 실제 경계를 분리하고 복구 행동을 정한다. -->

External stage vocabulary는 locate, authorize, acquire, transfer, integrity, expand, decode, structural-validate, semantic-validate와 adopt를 구분한다. Diagnostic은 시작한 stage, terminal outcome, upstream status, 관찰한 bytes 또는 response identity와 downstream not-run stages를 가진다.

Authentication, authorization, rate limit, timeout, unavailable response, malformed response와 semantic rejection은 같은 network error로 합치지 않는다. Retry safety, idempotency, backoff 또는 credential correction과 추가 외부 비용 가능성을 stage 결과에 명시한다.

### Security Refusal {#validation-security-refusal}

<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-security-refusal 경계 이탈과 hostile content를 fail-closed로 거부하고 정상 부재나 미지원으로 낮추지 않는다. -->

Path escape, undeclared authority change, surprise remote fetch, integrity mismatch, executable 또는 instruction-like active content, archive expansion과 recursion limit 초과, resource exhaustion, protected file 접근과 credential leakage는 security classification의 fatal 또는 error diagnostic을 만든다. Security check가 확정되지 않으면 입력은 trusted나 accepted 상태로 전이하지 않는다.

Refusal은 policy identity, refused operation, affected source와 consumer scope, safe replacement 또는 removal 행동을 제공한다. 공격 payload, internal stack, secret location과 policy 우회에 필요한 상세는 machine result와 display message 모두에서 공개하지 않는다.

### Quarantine과 Adoption State {#validation-quarantine-adoption-state}

<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-quarantine-and-adoption 검증 전 또는 보안 실패 결과를 current 입력과 분리하고 재채택 계보를 보존한다. -->

External input은 acquired, quarantined, validating, eligible, adopted, rejected와 removed 상태를 구분하고 security refusal 또는 incomplete validation 뒤에는 quarantined나 rejected만 허용한다. Quarantined bytes는 preview도 안전한 bounded representation으로만 제공하고 production, agent instruction, render와 publication consumer에 노출하지 않는다.

Adoption은 exact revision, completed validation, declared support, user decision과 intended consumer를 결속한 별도 상태 전이이다. Bytes, dependency, policy 또는 intended use가 바뀌면 새 validation session이 필요하고 이전 diagnostic과 새 revision 관계를 보존한다.

### Redaction과 공개 범위 {#validation-redaction-boundary}

<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-redaction 조치 가능한 context와 secret 보호를 함께 만족하는 정규 가림 계약을 정의한다. -->

Redaction policy는 field classification, audience와 export surface별 allow, summarize, hash 또는 omit 행동을 결정한다. Credential, token, private key, signed location, private environment value, 개인 정보와 protected source 원문은 observed value, cause, correction, log와 receipt에 평문으로 포함하지 않는다.

가려진 field는 redacted marker, protected value class와 필요한 경우 권한 범위 안에서 안정적인 non-reversible correlation identity를 가진다. Display locale이나 export format 변경이 원문을 복원하지 못해야 하며, redaction이 location, deduplication과 retry correlation을 임시 표시 문자열에 의존하게 만들지 않는다.
