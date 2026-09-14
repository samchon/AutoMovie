# Source 권위와 파생 관계

## 작품 사실의 정본 경계 {#spec-authoring-source-authority-boundary}

### Source와 파생 상태 {#spec-authoring-source-derivation-state}

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link 이 상태가 각 결과를 정확한 source revision과 input bytes에 연결한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-project-owned-facts 이 경계가 작품의 script, 자산과 저작 helper를 사용자 project의 정본으로 둔다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-owned-loop 이 계약이 source 편집에서 검증과 delivery까지의 반복을 정본 중심으로 정의한다. -->

사용자가 읽고 수정할 수 있는 project source와 명시적으로 채택한 bytes가 작품 사실의 정본이다. Compile, render, 분석, review와 delivery artifact는 정본을 소비하는 파생 결과이며 독립적으로 작품 사실을 변경할 수 없다.

<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-editable-source-authority 이 상태가 editable source보다 cache나 remote state에 높은 권위를 부여하지 못하게 한다. -->

Source snapshot은 revision과 모든 채택 input digest로 식별된다. 파생 결과는 `current`, `stale`, `missing`, `refused` 중 하나이며, 결과가 참조한 snapshot과 현재 snapshot이 동일하고 자체 검증이 성공한 경우에만 `current`다.

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check 좁은 확인이 입력이 그대로인 동안 이전 gate 판정을 다시 사용해 확인 경계마다 source 전체 실행을 반복하지 않게 한다. -->

Read-only source gate의 판정도 파생 결과다. 판정의 snapshot은 builder 입력 identity, library resident guard identity, screenplay index, validation이 실제로 읽은 문서 bytes, builder 소유 output의 전체 목록과 각 digest로 이루어진다. 새로 읽은 snapshot의 모든 항목이 이전 snapshot과 같고, 그 판정이 성공했으며, 판정이 실행한 project module이 모두 fingerprint된 입력일 때만 이전 판정을 다시 `current`로 사용할 수 있다. 한 항목이라도 다르거나 snapshot을 끝까지 읽지 못하면 gate를 다시 실행한다. 실패한 판정은 다시 사용하지 않으므로 매번 gate를 실행해 진단과 원래 원인을 그대로 반환한다. 생성 시각, 경로 존재, watcher 알림이나 이전 성공만으로 판정을 다시 사용해서는 안 된다.

Revision은 snapshot을 읽은 시점을 나타내며, 읽는 도중 바뀌면 그 snapshot은 사용하지 않는다. 입력을 바꾸는 project 쓰기는 위 항목 중 하나를 함께 바꾸므로, render commit처럼 입력을 바꾸지 않는 쓰기로 revision만 바뀌었다면 판정을 다시 실행하지 않고 새 revision을 표시해 반환한다. 다만 camera clearance report처럼 판정 결과가 revision 값 자체를 기록했다면 revision도 입력이므로, revision이 바뀌면 gate를 다시 실행한다.

### Source 입력 {#spec-authoring-source-input}

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring 이 입력이 숨은 editor 상태가 아닌 읽고 diff할 수 있는 일반 source가 되게 한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring 이 입력이 공개 contract와 문서화된 toolchain만으로 새 checkout에서 재현 가능하게 한다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link 이 입력 목록이 결과 identity가 추적할 production namespace, source revision과 input bytes를 정하고 checkout 위치를 그 목록에서 뺀다. -->

파생 시도는 exact source revision, normalized source bytes, 채택 자산 digest, 공개 contract version과 명시 configuration을 입력으로 받는다. 개인 machine path, editor cache, 대화 기억과 선언되지 않은 network state는 입력이 될 수 없다.

Checkout의 물리 root와 configuration에 적힌 절대 위치는 한 attempt를 보호하는 resident 사실이다. Publication guard는 이 값을 비교해 다른 root에서 읽은 evidence와 attempt 도중 교체된 root를 거부하지만, 결과 identity에는 넣지 않는다. 결과 identity는 production namespace, 선택 configuration, graph-selected owner edge, normalized source와 채택·파생 bytes를 포함한다. 따라서 같은 입력과 namespace를 연 두 checkout은 같은 identity를 갖고, namespace나 이 입력 중 하나가 달라지면 다른 identity를 갖는다.

Production namespace 등록도 추적되는 입력이다. 등록 record는 project가 등록한 production id 목록과 design layout version만 담고, 그 목록이 가리키는 design record와 함께 추적된다. 따라서 새 checkout은 추적된 파일만으로 원래 checkout과 같은 namespace를 열고, 등록을 마친 project에서 host가 초기 seed로 쓰던 이름이 바뀌어도 등록은 바뀌지 않는다. 등록 record 없이 production 소유 상태가 있으면 host는 namespace를 이름이나 directory에서 추측하지 않고, 추적 record 복원이나 명시 등록을 요구하며 거부한다.

등록 record의 design layout version은 project가 어느 layout에 맞춰 쓰였는지를 말하며, 옮길 record가 남아 있다는 사실은 아니다. Layout migration의 대상은 registration의 version이 아니라 project에 resident한 legacy record이고, 대상이 하나도 없으면 그 open은 아무것도 staging하지 않고 현재 version만 채택한다.

추적되는 project 문서는 migration 대상이 아니다. 출력 root를 통째로 옮기면 그 안의 추적 문서까지 무시되는 namespace로 들어가므로, 출력 root는 entry 단위로 옮기고 추적 문서는 version control이 두는 자리에 남는다. 출력 root가 production namespace와 같은 이름의 entry를 가지고 있으면 legacy 출력과 그 출력이 publish될 목적지를 한 root가 동시에 갖는 상태이므로, 어느 쪽이 정본인지 추측하지 않고 거부한다.

Incarnation은 identity가 아니라 checkout-local lineage다. Project state의 incarnation과 production마다의 incarnation은 checkout마다 따로 발급되고 추적하지 않으며, 결과 identity와 등록 record 어디에도 들어가지 않는다. Production incarnation은 한 checkout 안에서 그 production local namespace의 세대를 나타내므로, 같은 이력을 clone한 두 checkout은 서로 다른 incarnation과 같은 결과 identity를 갖는다.

Identity 계산 규칙이 바뀌면 이전 규칙으로 기록된 결과는 현재 identity와 일치하지 않으므로 다시 파생할 때까지 `stale`이다. 새 규칙은 이전 결과를 current로 승계하지 않는다.

### 파생 출력과 lineage {#spec-authoring-derivation-output-lineage}

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link 이 출력이 source와 결과의 derivation identity를 제공한다. -->

성공한 파생 결과는 target identity, source snapshot, contract 또는 runtime identity, output digest와 검증 상태를 제공해야 한다. 이 lineage가 없는 artifact는 현재 결과로 열거나 후속 evidence의 parent로 사용할 수 없다.

파생 bytes의 입력 집합과 freshness key의 입력 집합은 같지 않다. 한 artifact의 bytes는 production namespace, design, source, authoring evidence, 채택한 content와 derivation protocol만의 함수이며 snapshot revision은 그 입력이 아니다. Lineage는 artifact bytes 안이 아니라 그 옆의 owned-output manifest가 제공하므로, revision만 움직인 write는 어떤 artifact의 bytes도 바꾸지 않아야 한다.

Revision을 자기 bytes에 기록한 artifact는 영향받지 않은 결과를 재생성한다. 그 재생성이 다시 revision을 올리고 다음 derivation이 올라간 값을 기록하므로 repair가 수렴하지 않으며, 진단은 source나 design이 바뀌었다고 말하게 된다.

Graph-selected TypeScript 결과는 normalized source digest뿐 아니라 실행된 project-relative path와 named export, 그 export가 인용한 정확한 Markdown target을 하나의 owner edge로 보존한다. Review와 final은 이 edge가 현재 fingerprint로 검토되지 않았거나 0개 또는 여러 개로 해석되거나 runtime이 다른 owner를 주장하면 실행과 귀속을 모두 거부한다. Helper import는 허용하지만 graph-selected top-level owner로 승격하지 않는다.

### 변경 영향 불변식 {#spec-authoring-source-change-impact-invariant}

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility 이 불변식이 변경된 source의 downstream target과 evidence를 식별하게 한다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-reviewable-source-change 이 불변식이 변경된 사실과 외부 의존성을 source diff에서 보이게 한다. -->

Source 변경은 영향받는 자산, shot, interval, 분석, review와 delivery identity를 계산해 그 결과를 `stale`로 전이시켜야 한다. 영향받지 않은 결과는 동일 identity를 유지하며 관련 없는 artifact를 재생성해서는 안 된다.

### 변경 영향 보고 {#spec-authoring-change-impact-report}

<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility 변경 결과가 영향받는 downstream target과 evidence를 정확히 열거하게 한다. -->

변경 결과는 실제로 무효화한 target과 유지한 target을 구분하고, caller가 후속 compile, review와 delivery 작업을 선택할 수 있는 안정된 식별자를 반환한다.

### 소유권과 identity 실패 {#spec-authoring-source-ownership-failure}

<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal 이 실패가 source, license, digest 또는 consumer가 불명확한 입력 채택을 막는다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes 이 실패가 network의 최신 결과를 기존 asset identity로 조용히 읽지 못하게 한다. -->

Source, license, digest, consumer 또는 current snapshot이 불명확하면 파생을 거부하고 어느 identity가 미지급인지 반환해야 한다. Cache, generated bytes, render와 remote workspace를 직접 수정해 source disagreement를 해소한 것으로 처리해서는 안 된다.

### 재개와 도구 호환성 {#spec-authoring-source-resume-compatibility}

<!-- @evidence requirements/agent-authoring/partial-work.md#agent-resumable-authoring 이 호환성이 versioned source, input identity, omission과 진단만으로 작업을 재개하게 한다. -->
<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability 이 호환성이 agent, client, external service와 local tool 교체를 허용한다. -->

재개 입력은 source snapshot, 현재 상태 ledger, omission, 진단과 채택 input identity다. 이전 session이나 agent 기억 없이 같은 상태를 열 수 있어야 하며 새 도구가 동일 공개 contract를 지키면 source 권위와 lineage를 이어받을 수 있어야 한다.

### 샌드박스 작업의 물리 귀속 {#spec-authoring-sandbox-physical-ownership}

<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary 이 작업 경계가 실험 root, target과 manifest의 승인 세대를 mutation마다 유지한다. -->

Launcher는 모든 ancestor와 실험 root 및 직접 자식 target을 ordinary physical directory로 캡처한다. Pack 전에 기존 manifest와 refresh baseline은 single-link descriptor bytes와 generation으로 읽어 승인하며, 나머지 변경할 leaf는 ordinary single-link generation 또는 absent slot으로 승인한다. 기존 파일은 그 snapshot으로만 교체하며 새 slot은 exclusive publication으로 만든다. Pack의 로컬 pathname effect, publication과 install 진입·복귀에서 같은 승인을 다시 확인하고 no-install도 승인 경계를 생략하지 않는다. 실패한 cleanup은 원래 원인을 보존하며 stale root나 target을 삭제하지 않는다.

Completed 결과만 새 manifest generation을 승인한다. Partial publication은 실제 effect와 retained 경로를 보고하고 재사용 성공으로 바꾸지 않는다. 외부 package manager 프로세스의 실행 중 filesystem namespace를 격리하는 것은 이 operation-boundary 검사와 별개이며, 사전 검사로 그 격리를 보장했다고 주장하지 않는다.
