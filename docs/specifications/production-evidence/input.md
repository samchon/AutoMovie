# 생성 프로젝트 증거 설정 입력 명세

## 선언 스키마 {#spec-authoring-production-evidence-declaration}

### 설정 입력 상태 {#spec-authoring-production-evidence-input-state}

<!-- @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection 프로젝트의 완전한 선택을 하나의 명시적 입력 구조로 고정한다. -->

입력은 존재하는 절대 프로젝트 디렉터리 `location`, `film | brief | library | null`인 `kind`, 필수 `populationScope`, 모든 구성·source 분기의 `disabled | draft | evidence | review` 단계, `naturalness.screenplays`의 독립 단계, 선택적인 작품 전용 `claims` 배열로 구성한다. `populationScope`는 `{ mode: "complete-production" }`, `{ mode: "complete-production-reset", owner, transition }` 또는 `{ mode: "first-pilot", partitionGroup? }`인 닫힌 union이다. 분기 집합은 설정, 조사, map, 모델, 공간, 재료, 인스턴스, 모션, 시스템, treatment, script, construction screenplay, final screenplay naturalness, brief, 각 디자인 source, shot, production source와 film source를 빠짐없이 포함한다. 상대·부재·파일 위치, 닫힌 집합 밖의 종류·범위나 단계, 빠진 naturalness map, 배열이 아닌 claim 입력은 파일 모집단을 읽기 전에 거부한다.

Film의 `first-pilot`은 `001-`로 시작하는 정확한 lower-kebab delivery-group identity를 `partitionGroup`으로 요구하고 그 group의 script, construction screenplay와 selected final screenplay 파일만 선택한다. Treatment는 flat 파일 모집단이므로 존재하는 파일을 모두 선택하며 delivery group이나 물리 identity를 부여하지 않는다. Library의 `first-pilot`은 `partitionGroup`을 금지하고, authoring 절차가 sibling을 만들기 전에 처음 존재하는 실제 design/source branch 하나를 완전한 기존 branch 규칙으로 검토한다. `complete-production`과 `complete-production-reset`은 전체 모집단을 선택하고 group을 금지한다. Brief와 `null`은 `complete-production`만 허용한다.

`complete-production-reset`은 통과한 film pilot의 treatment·script·construction screenplay 분기 전체 또는 통과한 library pilot의 design/source 짝을 함께 `review`에서 `draft`로 옮기는 전이 체크포인트다. 비어 있지 않은 `owner`와 version 1 `transition` receipt가 같은 production root, owner, first-pilot scope, 검토한 분기와 retained host 목록을 선언한다. Film receipt는 treatment, script, construction screenplay와 screenplay naturalness의 검토를 기록하며 reset에서는 세 construction 분기를 `draft`로, `naturalness.screenplays`를 `disabled`로 요구하고 governed final tree를 금지한다. Library receipt는 정확히 하나의 실제 design/source 짝을 기록하며 두 분기를 함께 `draft`로 요구한다. Retained host의 project-relative path, annotation을 제거한 본문 SHA-256, 순서 있는 evidence tag SHA-256을 현재 파일에 대조한다. 선행 파일의 소실·본문 변경·증거 변경, 부분 reset과 기록하지 않은 짝의 reset은 거부한다. 이 체크포인트의 pilot tag는 비활성이며 새 host는 tag를 가질 수 없다.

체크포인트 검증 후에는 재작성 전에 `complete-production`으로 돌아간다. Authoring 절차가 검토된 pilot 및 reset commit과 byte-identical 비활성 보관본을 보존한 뒤, 첫 재작성 계층은 기존 본문을 남기고 예전 annotation과 aggregate account를 제거한 `draft`로 둔다. 그 부모가 아직 준비되지 않은 후속 계층은 governed tree에서 보관본으로 철수하고 `disabled`로 둔다. Film은 treatment부터, library는 해당 design부터 정상 parent-review 순서로 재개하며 현재 문서·source·account가 남은 disabled 분기를 예외로 허용하지 않는다. 보관 파일은 그래프의 현재 host가 아니며, 각 후속 계층은 부모 review 후 필요한 내용을 다시 저작하면서 활성화한다. 이전 pilot의 실제 검토와 보관·철수의 정당성은 authoring 절차가 확인하고, 팩터리는 각 선언의 receipt 정합성, 현재 stage, 모집단과 부모 경계를 검증한다.

`null`은 아직 제작 종류를 선택하지 않은 빈 프로젝트 상태다. 패키지는 이 구조 밖의 설정 파일, 환경 변수나 파일 존재 여부로 누락된 입력값을 보충하지 않는다.

작품 고유 저술 의무 helper 입력은 `name`, 단일 `document`, 종합 증언용 `account` 주소, `layer`, `stage`, `populationScope`와 선택적인 `documentRoot`·`inapplicable`이다. `documentRoot` 기본은 `docs`이고 `docs/contracts`와 bare filename도 같은 평면 계약 identity를 가리킨다. Layer와 scope가 전체 eligible construction H2를 유도한다. 작품 고유 principle helper는 선택적 `pass`를 받으며 기본 `construction`은 해당 layer stage와 일반 host를, `naturalness`는 `naturalness.screenplays` stage와 `final/screenplays` host만 허용한다. Obligation은 naturalness를 거부한다. Local `autoMovieBinding`의 pass·단계·범위·disposition은 바깥 선언과 정확히 일치해야 한다. `inapplicable`은 first-pilot에만 허용한다. Disabled/draft 선언은 inactive 상태로 유지되며 활성 계약의 누락된 target·H2, 선언 없는 account와 주소 충돌은 거부한다.
