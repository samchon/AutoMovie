# 생성 프로젝트 증거 그래프 명세

## 그래프 구성과 검증 {#spec-authoring-production-evidence-construction}

### 고정 공통 계약 해석 {#spec-authoring-production-evidence-shared-contract}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract 모든 프로젝트가 같은 공통 대상 집합을 해석하게 한다. -->

팩터리는 `docs/principles`, `docs/obligations`, domain 별 `docs/upstream/{design,story,delivery}`와 `docs/discovery`의 정규화된 상대 경로와 명시적 H2 anchor 목록을 하나의 고정 inventory로 읽는다. 그래프를 구성하기 전에 inventory의 파일·anchor identity와 실제 문서 트리가 서로 정확히 일치하는지 검사한다.

모든 원칙 reference는 선택된 저술 H2/H3/H4 host에 `checklist: true`, `noEvidenceExclude: true`로 연결한다. 각 저술 의무 문서에는 `docs/accounts/<layer>`의 전용 account 파일을 배정한다. Account H2는 정확히 한 의무 H2를 소유하고 같은 계층의 완전한 H2 모집단을 `checklist: true`, `noEvidenceExclude: true`로 비교한다. 저술 H2/H3/H4에는 이 모집단 질문을 반복하지 않는다. TypeScript source 의무는 그 family가 선택한 public export 모집단에 기존 coverage 방식으로 연결한다. 한 공용 reference builder가 checklist 여부와 진실한 무결과 허용 여부를 명시적으로 받아 family별 flag 조합을 한 곳에서 드러내야 한다.

팩터리는 settings가 모든 후속 저술 계층에 제공하는 edge와 `DESIGN_FOUNDATIONS`의 edge를 하나의 provider-consumer topology로 투영한다. 각 행은 `uses | inapplicable` 상태와 사유를 가지며 inspector는 missing consumer, extra provider, disabled residue, wrong order, unknown branch, duplicate declaration과 빈 사유를 결정적 순서로 보고한다. Motions와 systems의 상호 edge만 같은 coordinated order를 허용한다. Manifest와 project reader는 이 matrix와 diagnostics를 그대로 공개하며 unit-local foundation claim은 별도로 유지한다.

상위 수정 reference는 상속하는 design·brief·서사 H2/H3/H4와 source export에 `checklist: true`로 연결하고 제외를 허용한다. 각 host는 하위 저작이 드러내어 가장 이른 부모에서 수리한 결함을 양의 evidence로 기록하거나, 실제 부모와 시험한 결정을 밝힌 제외로 충분성을 기록한다. 설정과 조사는 이 reference를 선택하지 않는다. 별도의 무배제 parent-differentiation 원칙과 실제 계보 관계가 자식의 layer-owned 추가 결정과 한 개 이상의 실제 부모를 각각 검사하므로, 상위 수정 제외가 부모 없는 host를 정당화할 수 없다.

팩터리는 반환 전에 현재 프로젝트의 저술 Markdown과 TypeScript host에서 인접한 acknowledgement-review 쌍과 host별 review 관찰을 결정적인 순서로 읽는다. 구두점·기호·대소문자·기계적인 비교 도입부를 정규화한 review가 acknowledgement와 같거나, target 경로만 바꾼 같은 관찰이 한 host의 서로 다른 target에 반복되면 문서·host·line·target을 밝히며 실패한다. 이 검사는 fingerprint, outcome, queue 또는 review ledger를 만들지 않고 그 밖의 산문 품질을 판정하지 않는다.

Project reader는 같은 문서 모집단을 semantic alarm inspector에도 전달한다. Inspector는 layer와 acknowledgement 또는 exclusion 종류별로 quote, Markdown·TypeScript path, 숫자와 target 문구 slot을 정규화한 review frame을 세고 임계 이상인 모든 위치를 반환한다. Target 문서가 제공되면 각 H2의 Review question을 읽어 이유에 그 질문이 그대로 포함된 위치를 반환하고 `questionPasteChecked: true`를 기록한다. 두 alarm은 Self-Review 관찰일 뿐 graph 실패나 review 판정이 아니다.

<!-- @evidenceObligation shared-contract 고정된 공통 문서·H2 inventory와 실제 트리 사이의 양방향 일치, 원칙과 상위 수정의 단위별 checklist, 의무의 계층 모집단 coverage, 기계적으로 복제된 review 이유의 무상태 거부. -->

### 작품 고유 계약의 발견 coverage {#spec-authoring-production-evidence-discovery}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-discovery 실제 작품 조사를 수행한 상태와 생략한 상태를 계층별 계약 감사면으로 구분한다. -->

팩터리는 모든 저작 계층마다 `docs/contracts/*.md`를 host로 하고 `file`을 target으로 삼는 발견 claim을 만든다. 각 claim은 `discovery/core/common.md`와 함께 설정에는 `settings`, 각 map·model·space·material·instance·motion·system 분기에는 `designs + 해당 design layer`, `film`의 `treatments`에는 `films + treatments`, `scripts`에는 `films + scripts`, `screenplays`에는 `films + screenplays`, `brief`에는 `briefs`를 연결한다. Research는 `common`만 연결하여 외부 근거 채택과 design boundary 탐색을 같은 결정으로 합치지 않는다. 저작 H2/H3/H4에는 이 발견 관계를 배선하지 않는다.

발견 claim은 계층이 `draft`에 들어가는 순간부터 활성화하여 작품 전용 규칙을 저작보다 먼저 발굴하게 하고, `review`에서는 현재 fingerprint를 요구한다. 저작 산출물에 적용하는 draft no-tags 규칙은 별도 감사면인 `docs/contracts`에는 적용하지 않는다.

독립 결과가 있으면 `contracts/index.md`가 아닌 평면 계약 파일이 file-level 발견 evidence를 소유하고, 명시적 H2 계약 target으로 가장 이른 의미 소유자와 현재 실현을 증명한다. 완전한 조사에서 독립 결과가 없을 때만 `contracts/index.md`가 계층별 발견 제외를 소유할 수 있다. index는 양의 evidence tag와 H2를 가져서는 안 되고, 다른 계약 파일은 발견 제외를 가져서는 안 된다. 계약 디렉터리 바로 아래의 중첩 폴더는 거부한다. 제외 사유는 검사한 구체적 입력·위험과 충분한 기존 소유자를 밝혀야 하며, 구현 유예나 빈 결과 선언으로 대신할 수 없다. 팩터리와 lint는 관계·제외·fingerprint의 구조를 검사하고, 구체성과 진실성은 계약 파일과 계층 전체를 다시 읽는 evidence review가 판정한다. 설정은 이 산문을 자동 해석하지 않는다.

설정 의무 모집단은 발견된 후보 중 action, choice, state, information, resource, control 또는 audience observation을 독립적으로 바꿀 수 있는 person, collective, object, environmental agent, institution, subsystem과 affected population을 빠짐없이 분류한다. 설정 저작과 review 절차는 필요한 미해결 주체가 남으면 그 소비자의 저작 시작을 보류하며, 팩터리는 그 의미 판단을 stage 값만으로 추론하지 않는다.

<!-- @evidenceObligation discovery-coverage 계층별 계약 감사면의 정확한 발견 대상 배치, 초안 선행 활성화, 결과 또는 중앙 장부의 구체적 무결과 제외와 설정의 operative-subject accounting. -->

### 제작 종류와 단계 상태기계 {#spec-authoring-production-evidence-shape-stage}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage 제작 종류별 허용 분기와 단계 선행 조건을 하나의 상태기계로 만든다. -->

`film`은 `settings`에서 `treatments`·`scripts`·`screenplays`·`shots`·`filmSources`로 이어지는 사다리를, `brief`는 `settings`에서 `briefs`·`shots`·`filmSources`로 이어지는 짧은 사다리를 허용한다. 둘은 완성 `filmSources` 전에 `productionSources`의 독립된 검토를 요구한다. `library`는 `settings`, 선택한 디자인 문서·source 분기와 필요할 때 설정만 직렬화하는 `productionSources`를 허용하고 서사·`shots`·편집 분기를 금지한다. 모든 자식 분기의 `draft`는 필요한 부모가 `review`에 도달한 뒤에만 허용하며, 아직 종류를 선택하지 않은 `null`은 모든 단계를 `disabled`로 유지한다. 디자인 분기의 `review`는 그 분기가 기반으로 삼는 모든 활성 디자인 분기가 함께 `review`에 있을 때에만 허용한다. 기반 분기는 자신이 검토되기 전까지 어떤 단위도 자식에게 지불시키지 않으므로, 기반보다 먼저 검토된 분기는 자신이 의존하는 부모에 아무것도 지불하지 않은 완료를 기록한다. `disabled` 기반은 요구하지 않는다. 이 선행 조건을 `draft`가 아니라 `review` 진입에 두는 이유는 `motions`와 `systems`가 서로를 기반으로 삼기 때문이며, 두 분기는 하나의 선언에서 함께 `review`로 승격한다.

<!-- @evidenceObligation shape-stage-machine 세 제작 종류의 허용 분기, 단계 순서와 부모 검토 선행 조건. -->

### 파일 트리 기반 대상 검증 {#spec-authoring-production-evidence-physical-integrity}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity 선택이 실제 대상을 하나만 지배하고 비활성 잔여물을 함께 막게 한다. -->

팩터리는 glob으로 Markdown과 TypeScript host를 열거하고 활성 분기의 최소 host 수, 비활성 분기의 잔여물, 명시적 H2 anchor, 중복 target identity, 각 source 파일의 구체적인 named export owner를 그래프 생성 전에 검사한다. 프로젝트 입력은 `lstat` 기준 regular file이고 symlink가 아니며 `nlink === 1`일 때만 읽는다. 이 판정은 문서·source 모집단과 package identity manifest에 동일하게 적용하여 hardlink 별칭이 별도 계약, source 또는 owner identity로 들어오는 것을 거부한다. `treatments`는 중첩·index가 없는 평면 번호 event 파일이고 각 H2가 한 사건이다. `scripts`와 `screenplays`는 번호 delivery-group 디렉터리와 H1 전용 `index.md`, 번호 unit 파일의 H2/H3/H4 구조를 사용한다. 모든 script와 screenplay 파일 host 및 H2/H3/H4 단위는 treatment H2를 직접 완전 피복하고, screenplay는 대응 script의 group-index H1, unit 파일과 H1, 동일 깊이 lineage와 순서를 정확히 보존한다. 반환된 claim은 lint가 실제 export와 annotation을 선택하여 각 상속 단위가 한 개 이상의 실제 부모를 갖게 하고, 디자인 owner마다 정확히 한 디자인 파일, shot·acceptance owner마다 한 screenplay scene 또는 brief shot, 완전한 target coverage와 단계별 review cardinality를 검사하게 한다.

<!-- @evidenceObligation physical-population-integrity 실제 파일 모집단과 package manifest에서 검증하는 단일 물리 identity, host 수, 잔여물, 소유 cardinality와 계보. -->

### 공통 그래프 뒤의 로컬 합성 {#spec-authoring-production-evidence-additive-extension}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension 작품 전용 관계를 허용하면서 공통 그래프의 무력화를 차단한다. -->

팩터리는 공통 작품별 발견·원칙·의무·저작 단계·source 단계 claim과 실행 canary를 먼저 완성하고, 입력의 `claims`를 그 배열 뒤에 이어 붙인다. 호출자는 공통 배열이나 reference를 입력으로 받지 않으므로 기존 계약을 대체하는 확장 경로를 갖지 않는다.

<!-- @evidenceObligation additive-local-claims 공통 claim을 먼저 완성하고 작품 전용 claim만 뒤에 추가하는 단방향 합성. -->

### 결정론적 출력과 사전 실패 {#spec-authoring-production-evidence-deterministic-result}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result 같은 입력의 동일 출력과 모순 입력의 명시적 실패를 규정한다. -->

파일·anchor·claim, population account, topology와 review-reason 검사는 고정 inventory와 코드 단위 정렬 순서를 사용한다. 검증 실패는 잘못된 종류·단계·분기, 파일 경로와 충돌한 identity, foundation edge 또는 기계적으로 복제된 review의 문서·host·line·target을 이름 붙인 예외로 반환하며, 모든 검증이 끝나기 전에는 부분 그래프를 공개하지 않는다. Semantic review alarm은 같은 입력에 같은 정렬 결과를 내지만 이 실패 집합에는 들어가지 않는다.

<!-- @evidenceObligation deterministic-failure 고정 순서의 그래프 구성과 구체적인 원인을 가진 원자적 사전 실패. -->
