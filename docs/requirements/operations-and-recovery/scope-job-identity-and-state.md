# 범위, Job Identity와 상태

## 긴 제작 작업의 운영 경계 {#operations-scope-job-identity}

Compile, validation, capture, render, encode, package와 publication처럼 중단 이후에도 추적되어야 하는 제작 작업은 요청 시점부터 terminal state까지 하나의 안정된 job identity와 상태 기록을 가져야 한다.

### Job과 Attempt의 구분 {#operations-job-attempt-separation}

논리적으로 같은 작업과 그 작업을 수행한 각 attempt를 구분하고, retry가 이전 attempt의 시작, 종료, 실패 원인과 산출물 기록을 덮어쓰지 않아야 한다.

### Identity를 결정하는 입력 {#operations-job-identity-inputs}

Job identity는 production revision, 대상 범위, 요청한 작업과 품질 profile, 실제로 확정된 입력, dependency, 정책과 compatibility 조건으로 결정되어야 하며 실행 시각, 실행 위치, 대기 시간과 attempt 번호에 의존하지 않아야 한다.

### 요청과 확정된 작업 {#operations-requested-effective-work}

사용자가 요청한 값과 default, 해석, dependency resolution을 거쳐 실제 수행 대상으로 확정된 값을 함께 보존하여 나중에 같은 작업인지 판단할 수 있어야 한다. 명령 host는 command discriminant, 그 명령에 허용된 option, 각 option의 cardinality, positional arity와 default를 포함한 전체 argument vector를 작업 시작 전에 확정해야 한다. 알 수 없는 option, 중복되거나 해당 명령에 적용되지 않는 option, 남는 positional value, 필수 값의 누락이나 공백, 같은 대상을 named와 positional 형식으로 함께 지정한 요청은 거부하고, 거부된 요청은 project state 조회, target 해석, process 실행, capture, compile, derive 또는 mutation을 시작하지 않아야 한다.

### 상태 Vocabulary {#operations-job-state-vocabulary}

적어도 planned, blocked, queued, running, pausing, paused, cancelling, cancelled, succeeded, failed와 abandoned를 서로 구분하고, 현재 상태와 마지막으로 확인된 전이 시각 및 사유를 조회할 수 있어야 한다.

### 상태 전이 기록 {#operations-job-state-transition-history}

각 상태 전이는 이전 상태, 새 상태, 원인, authority와 관련 attempt를 남기고, 허용되지 않거나 뒤늦게 도착한 전이가 더 새로운 상태와 terminal truth를 덮어쓰지 않아야 한다.

### Terminal State의 진실 {#operations-terminal-state-truth}

Terminal state는 해당 attempt가 더 이상 결과를 변경하지 않음을 뜻해야 한다. Succeeded는 요구된 작업 단위와 산출물 검증이 모두 끝났음을 뜻하며, succeeded, published와 retained를 별도 사실로 표현하여 완료되었지만 아직 게시되지 않은 작업을 구분해야 한다.

### 결정적 재실행 Identity {#operations-deterministic-reexecution-identity}

같은 결정적 입력의 재실행은 scheduling, machine assignment, progress reporting, retry count와 wall-clock time 때문에 결과 의미가 달라지지 않아야 하며, 허용된 compatibility 차이는 작업 identity와 결과 기록에 명시되어야 한다.
