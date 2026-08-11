# Validation과 Diagnostics 시스템 명세

Validation과 diagnostics는 저작 입력부터 파생 산출물과 외부 경계까지 같은 상태 언어로 검사 사실, 실패, 불확실성, 중단과 복구 행동을 교환하는 시스템 경계다. 이 명세는 분야별 규칙의 내용을 다시 정의하지 않고 그 규칙을 실행하고 결과를 전달하는 공통 계약을 정의한다.

## 시스템 입력과 결과 경계 {#validation-diagnostics-system-boundary}

<!-- @evidence requirements/diagnostics/README.md#diagnostics-user-promise 사용자가 진단만으로 실패와 미확인 범위 및 다음 행동을 판단하게 하는 공통 입출력 경계를 정의한다. -->

한 validation session의 입력은 대상 identity와 revision, 검사 범위, 적용할 규칙과 정책의 version, 수집 방식, 자원 예산, 표시 locale, compatibility identity와 외부 dependency snapshot이다. Session은 이 effective input을 확정한 뒤 검사하며, 요청값과 default 또는 해석을 거쳐 확정된 값을 함께 기록한다.

결과는 session과 입력 identity, 실제 검사한 범위, 수행하지 못한 범위, 진단의 정규 목록, complete, incomplete 또는 refused 상태, 전체 판정과 생성되거나 보존된 산출물 상태를 하나의 결속된 결과로 제공한다. 성공 boolean만으로 warning, unknown, unsupported, not-run, truncation 또는 partial artifact를 잃어서는 안 된다.

## 검증 범위와 책임 경계 {#validation-diagnostics-scope-ownership}

<!-- @evidence requirements/diagnostics/README.md#diagnostics-scope 각 저작 영역의 규칙과 공통 진단 전달 계층 및 사람의 검토 권한을 분리한다. -->

각 domain boundary는 자신이 판정할 수 있는 구조, 관계, 수치, 시간과 산출물 invariant를 소유하고 공통 진단 경계는 그 판정을 identity, location, severity, classification, cause와 correction으로 정규화한다. 한 boundary가 판정하지 않은 다른 domain의 사실을 추론하여 성공이나 실패로 만들지 않는다.

Validation order는 요청과 snapshot의 해석, 접근 및 security 전제조건, 구조와 값 범위, identity와 reference closure, domain invariant와 상태 전이, derived result의 integrity와 freshness, 필요한 evidence 및 사람 검토 전제조건 순으로 dependency를 형성한다. Domain은 이 순서에 check를 추가할 수 있지만 후속 check가 실패한 선행 사실을 유효하다고 가정하거나 더 이른 원인을 downstream symptom으로 대체하지 않는다.

자동 validation은 관찰한 사실과 반증 가능한 위반을 산출할 수 있지만 시각, 청각, 서사와 미학의 사람 판단을 대신 확정하지 않는다. 필요한 evidence나 authority가 없으면 해당 검사는 not-run 또는 unknown으로 남고 acceptance verdict와 review finding은 각자의 독립 identity와 생명주기를 유지한다.

## 문서 지도 {#validation-diagnostics-document-map}

<!-- @evidence requirements/diagnostics/README.md#diagnostics-document-map 공통 진단 약속을 시스템 계약별 문서로 분해하고 탐색 경로를 제공한다. -->

- [진단 Identity, 위치와 심각도](./diagnostic-identity-location-and-severity.md)
- [입력, 결과와 상태 분류](./classification-and-causality.md)
- [수집, 순서와 중단](./collection-order-and-termination.md)
- [예산과 Truncation](./budget-and-truncation.md)
- [외부 입력 보안과 Redaction](./external-security-and-redaction.md)
- [Localization과 기계 판독 결과](./localization-and-machine-results.md)
- [부분 Artifact, 복구와 거부](./partial-artifacts-and-refusal.md)
