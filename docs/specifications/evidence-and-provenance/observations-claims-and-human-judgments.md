# 관찰, 주장과 판단 Record

## Record kind와 relation 경계 {#evp-observation-claim-judgment-boundary}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observations-and-claims observation, claim, 자동 판정과 사람 judgment를 독립 record kind와 relation으로 구체화한다. -->

System은 `observation`, `claim`, `automatedFinding`과 `humanJudgment`를 서로 다른 record kind로 받아야 한다. Claim과 judgment는 근거 record id를 명시적으로 참조하고, observation payload에 해석을 삽입하거나 judgment를 자동 측정값으로 직렬화하는 입력을 invalid로 거부해야 한다.

Relation은 `supports`, `contradicts`, `interprets`, `evaluates`와 `supersedes`처럼 방향과 의미가 고정된 kind를 가져야 한다. 알 수 없는 relation kind는 graph를 끊지 않고 보존하되 current approval 계산에는 참여시키지 않아야 한다.

### Observation input과 output {#evp-observation-record-contract}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions 직접 관찰의 대상, 조건, 방법과 실제 결과를 재검토 가능한 record로 만든다. -->

Observation 입력은 exact subject revision, 시간 또는 frame range, view나 channel, method identity와 version, 실행 조건, unit과 observed value 또는 artifact reference를 포함해야 한다. 출력은 입력을 그대로 결속한 record와 local measurement status인 success, partial, failed, unsupported, not-run 또는 cancelled를 가지며, canonical outcome으로 정규화할 때 success는 pass, failed는 error, partial은 관찰된 child scope와 누락 scope를 분리하고 전체 completeness를 partial로 유지해야 한다. 관찰하지 않은 값과 원인 추정은 포함하지 않아야 한다.

Range, unit, method 또는 subject가 모호하거나 observed artifact digest가 맞지 않으면 observation을 current로 만들지 않아야 한다. Method version이 바뀌어도 이전 observation은 보존하고 새 실행을 별도 record로 만들어 비교할 수 있어야 한다.

### Claim evaluation {#evp-claim-evaluation-contract}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-claim-basis claim의 근거, 가정, 불확실성과 반증 조건을 검증 가능한 입력으로 만든다. -->

Claim 입력은 proposition, scope, supporting 또는 contradicting record ids, derivation ids, assumptions, uncertainty 표현과 falsification condition을 포함해야 한다. 평가 출력은 supported, contradicted, unresolved, stale 또는 invalid 상태와 실제 사용한 근거 집합이며 source 또는 signature의 존재만으로 supported를 만들지 않아야 한다.

근거가 claim scope를 덮지 않거나 stale, unavailable 또는 contradictory이면 unresolved 또는 stale로 남겨야 한다. Claim schema가 확장되어도 기존 proposition과 근거 relation의 의미는 유지하고 새 uncertainty kind를 모르는 reader는 확정 판정으로 낮추지 않아야 한다.

### Automated finding result {#evp-automated-finding-result}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary 자동 검사 결과와 설명 또는 심각도 추정을 분리하는 출력 구조를 정의한다. -->

Automated finding 입력은 rule identity와 version, subject revision, checked scope, expected condition과 execution identity다. 출력은 observed result, canonical outcome, severity, affected scope와 diagnostic context를 독립 field로 제공해야 하며 outcome은 pass, fail, unsupported, not-run, cancelled 또는 error를 구분해야 한다. Warning은 outcome이 아니라 severity이고 criterion이 충족되면 pass, 충족되지 않으면 fail과 결합하므로 경고가 만족 여부를 대신하지 않는다.

Rule을 실행하지 않았거나 execution이 중단되면 pass를 출력할 수 없고, severity 변경은 observed result를 바꾸지 않아야 한다. 표시 문구와 locale 변화도 rule identity, observed result와 outcome을 바꾸어서는 안 된다.

### Human judgment activity {#evp-human-judgment-activity}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-human-judgment-history 사람의 승인, 거부, 예외와 정성 평가를 권한과 근거가 있는 append-only activity로 만든다. -->

Human judgment 입력은 reviewer identity 또는 authorized pseudonym, role과 authority scope, subject revision, rubric 또는 question revision, reviewed evidence ids, decision, rationale와 decision time을 포함해야 한다. 출력 judgment는 pending, approved, approved-with-conditions, rejected, waived 또는 superseded 상태를 가지며 자동 finding이 대신 생성할 수 없다.

Authority가 scope를 포함하지 않거나 필수 evidence가 stale이면 final judgment를 거부해야 한다. 정정과 재판정은 새 activity로 추가하고 과거 decision, rationale와 당시 evidence를 변경하지 않아야 한다.

### Disagreement resolution {#evp-disagreement-resolution}

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-disagreement-and-resolution 충돌 record를 보존하면서 current 판정과 미해결 상태를 계산한다. -->

Conflict detector는 같은 subject와 겹치는 scope에서 양립할 수 없는 observation, claim 또는 judgment를 입력받아 conflict set을 출력해야 한다. Resolution은 authority, additional evidence, resolution rationale와 resolved time을 가진 새 record이며 어느 member를 current로 선택하거나 모두 unresolved로 두었는지 명시해야 한다.

Conflict member 삭제, 입력 순서 또는 최근성만으로 승자를 고르는 동작은 금지한다. 새 record kind와 과거 reader가 공존할 때 해석할 수 없는 conflict는 unresolved로 유지해야 한다.
