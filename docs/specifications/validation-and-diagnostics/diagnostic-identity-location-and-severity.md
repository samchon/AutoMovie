# 진단 Identity, 위치와 심각도

## 정규 진단 레코드 {#validation-diagnostic-record}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-traceable-record 표시 문구와 무관하게 같은 진단 종류와 한 발생을 추적할 레코드 경계를 정한다. -->

정규 진단 레코드는 protocol version, diagnostic identity, occurrence identity, session과 input identity, classification, severity, 발견 위치, 영향 범위, 원인, correction, 검사 상태와 관련 evidence identity를 가진다. 선택 항목의 부재는 해당 맥락이 적용되지 않음을 뜻하고 unknown이나 redacted 상태는 명시된 값으로 구분한다.

Occurrence identity는 한 확정 입력에서 같은 의미와 위치의 발생을 안정적으로 대조할 수 있어야 하지만 다른 입력 revision의 발생을 같은 사건으로 합치지 않는다. Display message, locale, 병렬 실행 순서와 wall-clock 시각은 diagnostic 또는 occurrence identity를 결정하지 않는다.

### Identity 의미와 Version {#validation-diagnostic-identity-version}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-identity-stability 진단 identity가 같은 실패 조건과 교정 의미를 지속해서 가리키도록 한다. -->

Diagnostic identity는 하나의 판정 조건, classification과 correction 의미를 영속적으로 가리킨다. 그 의미나 판정 경계가 달라지면 새 identity를 발급하고 이전 identity의 replacement 또는 retirement 관계와 처음 적용되는 compatibility version을 공개한다.

기존 identity를 다른 원인에 재사용하거나 여러 원인을 하나의 generic identity로 축약하지 않는다. 새 소비자가 알지 못하는 identity도 레코드의 원래 값으로 보존되며, unknown code를 success나 무시 가능한 정보로 해석하지 않는다.

### Code catalog와 behavioral reference {#validation-diagnostic-code-catalog-reference}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference 진단 code의 닫힌 목록과 사용자 행동 참조가 같은 version으로 전달되게 한다. -->
<!-- @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance 각 진단의 행동 참조를 사용자가 이용하는 지식 표면에서 찾을 수 있게 한다. -->

Diagnostic protocol revision은 발생 가능한 code의 canonical ordered catalog를 출력하고 각 code를 판정 조건, parameter 의미, 영향 범위와 correction을 설명하는 정확히 하나의 behavioral reference identity와 revision에 연결한다. Reference identity는 user-facing knowledge surface에서 code로 resolve되어야 하고, resolved contract는 correction owner와 재검증 범위를 설명하되 source를 수정하거나 correction을 적용하지 않는다. Delivery receipt는 catalog revision, reference-set digest와 code-to-reference mapping을 결속하며 emitted code 누락, 하나의 code에 대한 reference 부재 또는 중복, catalog에 없는 code와 revision 불일치를 complete delivery로 승인하지 않는다.

### 발견 경로와 영향 범위 {#validation-diagnostic-path-scope}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope 발견 위치와 더 넓을 수 있는 무효화 범위를 독립 필드로 보존한다. -->

발견 경로는 named root와 그 root 안의 구조 segment 또는 artifact member를 함께 가져야 한다. Segment는 field, stable identity, collection position과 member path 중 실제 입력을 다시 찾는 데 필요한 종류를 보존하고, 위치 순서가 의미 없는 집합에서는 임시 탐색 순서만으로 대상을 식별하지 않는다.

영향 범위는 value, relation, subject, interval, shot, scene, artifact, validation target 또는 request 중 어느 단위가 invalid, incomplete, blocked 또는 uncertain인지 별도로 나타낸다. 한 원인이 여러 범위에 전파되면 최초 발견 경로, 직접 영향과 파생 영향을 구분하고 상위 범위를 자동으로 과장하지 않는다.

### 공간, 시간과 Subject 위치 {#validation-diagnostic-spatiotemporal-subject-location}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-location-time-subject-context 파일과 구조, film clock과 frame, subject를 함께 찾을 수 있는 위치 계약을 정의한다. -->

Source 위치는 source identity, project-relative path 또는 문서 identity, 구조 경로와 가능한 span을 가진다. 공간 위치는 coordinate reference, point, region 또는 bounds를, 시간 위치는 clock identity, rational frame 또는 sample 위치, closed 또는 half-open interval, event나 cue identity를 사용하여 단위와 경계를 명시한다.

Subject 위치는 actor, object, group, camera, light, sound, effect, scene와 artifact처럼 domain이 부여한 stable identity와 필요한 owner chain을 가진다. Display name이 같거나 instance가 반복되어도 서로 다른 subject를 구분하며, 위치를 확정하지 못하면 임의의 origin, frame zero 또는 첫 항목을 사용하지 않고 unknown location으로 남긴다.

### 심각도와 전체 판정 {#validation-diagnostic-severity-outcome}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-severity-and-outcome 문구가 아니라 영향에 따라 치명적 상태, 오류, 경고와 정보를 판정하도록 한다. -->

Severity는 fatal, error, warning과 information의 순서 있는 집합이다. Fatal은 요청 전체가 안전하거나 의미 있게 계속될 수 없음을, error는 명시된 영향 범위를 유효한 결과로 사용할 수 없음을, warning은 결과를 보존할 수 있지만 위험이나 교정 의무가 있음을, information은 판정을 바꾸지 않는 상태와 선택을 뜻한다.

전체 결과는 실제 진단 severity, required 범위의 검사 상태와 적용 정책으로 계산하며 목록의 첫 항목이나 표시 문구로 정하지 않는다. 정책이 severity 또는 blocking 여부를 조정할 수 있는 항목은 정책 identity와 이전 및 effective 값을 기록하고, 무결성, 보안, 필수 결과와 비면제 조건은 warning으로 낮출 수 없다.

Diagnostic severity는 validation 결과에 미치는 영향이고 acceptance criterion의 severity, review finding의 제작 우선순위와 사람의 approval decision은 별도 축이다. 한 축의 값으로 다른 축을 자동 산출하거나 warning을 승인으로 해석하지 않는다.

### 원인, 관찰값과 기대값 {#validation-diagnostic-cause-values}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-cause-observed-expected 검증된 원인과 관찰값, 기대값 및 미확정 가설을 구분한다. -->

Cause는 실패한 invariant 또는 확인하지 못한 질문, 관찰값, 기대값이나 허용 범위, 비교 방향, 단위와 관련 evidence를 구조화한다. 파생 증상만 아는 경우에는 confirmed cause로 표시하지 않고 confirmed fact, candidate cause와 추가 확인에 필요한 입력을 구분한다.

Observed value는 입력값인지 측정된 derived value인지 provenance를 가진다. 민감하거나 큰 값은 안전한 digest, bounded summary 또는 redacted marker로 대체하되 생략 이유를 남기고, formatter가 정규 수치와 단위를 바꾸지 못하게 한다.

### Correction과 재검증 범위 {#validation-diagnostic-correction-revalidation}

<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck 실제 가능한 교정 행동과 그 뒤 다시 검증할 consequence surface를 명시한다. -->

Correction은 행동 identity, 수정할 owner와 target, 필요한 전제조건, 예상되는 의미·품질·비용·보안 변화와 다시 검사할 범위를 구조화한다. Source 수정, dependency 복구, 지원 범위나 fidelity 선택, budget 조정, 사람 검토와 재시도 중 현재 상태에서 가능한 행동만 제시한다.

Correction은 실행 명령이 아니라 선택 가능한 계약 정보이며 자동 적용 여부와 적용 receipt는 별도 상태다. 의미, 품질 단계나 보안 경계를 바꾸는 대안은 사용자 승인 없이 실행하지 않고, 이미 유효한 범위와 stale이 되거나 재검증할 범위를 consequence로 남긴다.
