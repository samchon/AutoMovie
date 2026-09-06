# 생성 프로젝트 증거 설정 입력 명세

## 선언 스키마 {#spec-authoring-production-evidence-declaration}

### 설정 입력 상태 {#spec-authoring-production-evidence-input-state}

<!-- @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection 프로젝트의 완전한 선택을 하나의 명시적 입력 구조로 고정한다. -->

입력은 존재하는 절대 프로젝트 디렉터리 `location`, `film | brief | library | null`인 `kind`, 필수 `populationScope`, 모든 저작·source 분기의 `disabled | draft | evidence | review` 단계, 선택적인 작품 전용 `claims` 배열로 구성한다. `populationScope`는 `{ mode: "complete-production" }`, `{ mode: "complete-production-reset" }` 또는 `{ mode: "first-pilot", partitionGroup? }`인 닫힌 union이다. 분기 집합은 설정, 조사, 모델, 공간, 재료, 인스턴스, 모션, 시스템, treatment, script, screenplay, brief, 각 디자인 source, shot, production source와 film source를 빠짐없이 포함한다. 상대·부재·파일 위치, 닫힌 집합 밖의 종류·범위나 단계, 배열이 아닌 claim 입력은 파일 모집단을 읽기 전에 거부한다.

Film의 `first-pilot`은 `001-`로 시작하는 정확한 lower-kebab delivery-group identity를 `partitionGroup`으로 요구하고 그 group의 script와 screenplay 파일만 선택한다. Treatment는 flat 파일 모집단이므로 존재하는 파일을 모두 선택하며 delivery group이나 물리 identity를 부여하지 않는다. Library의 `first-pilot`은 `partitionGroup`을 금지하고, authoring 절차가 sibling을 만들기 전에 처음 존재하는 실제 design/source branch 하나를 완전한 기존 branch 규칙으로 검토한다. `complete-production`과 `complete-production-reset`은 전체 모집단을 선택하고 group을 금지한다. Brief와 `null`은 `complete-production`만 허용한다.

`complete-production-reset`은 통과한 film pilot의 treatment·script·screenplay 분기 전체 또는 통과한 library pilot의 design/source 분기 전체를 함께 `review`에서 `draft`로 옮기는 유일한 역방향 전이다. Film reset은 세 서사 분기를 모두 `draft`로 요구하고, library reset은 실제로 짝을 이루는 design/source 분기를 함께 `draft`로 요구한다. 이 상태에서 보존한 pilot tag는 claim을 충족하지 않는 비활성 source material이고, 새 몸체는 tag 없이 작성하며, 완전한 모집단의 evidence와 review를 다시 마치기 전에는 `complete-production`으로 전환할 수 없다. 팩터리는 종류·범위·group·단계·실제 host 조합에서 부분 reset과 reset 대상이 아닌 분기의 역행을 거부한다. 이전 pilot이 실제로 두 번의 무결점 검토를 통과했는지와 일반 수정을 reset으로 가장했는지는 저장된 이력으로 추론하지 않고 authoring 절차가 검토한다.

`null`은 아직 제작 종류를 선택하지 않은 빈 프로젝트 상태다. 패키지는 이 구조 밖의 설정 파일, 환경 변수나 파일 존재 여부로 누락된 입력값을 보충하지 않는다.
