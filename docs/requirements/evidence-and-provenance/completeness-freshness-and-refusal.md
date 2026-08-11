# 완전성, 현재성과 거부

## 판정에 충분한 증거의 표시 {#evidence-completeness-and-freshness}

사용자는 claim, approval 또는 publication마다 필요한 evidence 종류와 범위, 실제로 존재하는 record, 누락, 상태와 freshness를 비교할 수 있어야 하며, 일부 성공이나 오래된 evidence가 전체 current 판정을 충족한 것처럼 보여서는 안 된다.

### Dependency 기반 current 판정 {#evidence-dependency-based-current-status}

Evidence의 current 상태는 filename이나 생성 시각만이 아니라 검사한 subject revision, source와 dependency digest, activity, 조건, rubric과 reviewer decision에 연결해야 하며, 그중 결과에 영향을 주는 항목이 바뀌면 관련 evidence와 downstream 판단을 stale로 전환해야 한다.

### Unsupported와 not-run {#evidence-unsupported-and-not-run}

검사할 능력이 없는 unsupported, 필요한 입력이나 환경이 없어 실행하지 않은 not-run, 실행 중 실패한 error와 검사 결과가 기준을 충족하지 않은 fail을 구분하고, 어느 상태도 pass나 verified로 집계해서는 안 된다.

### 부분 결과와 집계 {#evidence-partial-results-and-aggregation}

부분 frame, 일부 channel, sample, proxy, 제한된 platform 또는 선택된 variant만 검사했다면 그 범위를 보존하고, 여러 부분 결과를 집계할 때 누락, fail, stale와 충돌을 숨기지 않아야 한다.

### 재현과 재검증의 경계 {#evidence-reproduction-boundary}

결정적 activity는 고정된 입력과 실행 identity로 같은 결과를 재검증할 수 있어야 하며, 외부 service나 사람 판단처럼 재현을 보장할 수 없는 activity는 원시 output과 당시 조건을 보존하고 재현 가능하다고 주장하지 않아야 한다.

### 정직한 거부 {#evidence-honest-refusal}

필수 parent, source, digest, rights record, custody, credential 분리, 실행 조건 또는 review authority가 없거나 서로 모순되면 current, verified, approved 또는 publishable 판정을 거부하고, 사용자가 보완할 수 있는 누락 identity와 마지막 정상 범위를 알려야 한다.

### 교체 뒤의 재승인 {#evidence-reapproval-after-change}

Source, tool, policy, rights, transformation, output 또는 judgment가 교체되면 영향받은 판정을 새 evidence 없이 이전 approval에서 상속하지 않아야 하며, 영향이 없다고 판단한 경우에도 그 판단의 범위와 근거를 새 record로 남겨야 한다.
