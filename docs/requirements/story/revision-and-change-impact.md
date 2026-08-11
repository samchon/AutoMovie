# 개정과 변경 영향

## 이야기 변경의 하류 추적 {#story-revision-change-impact}

Logline, treatment, sequence, beat, scene, character와 dialogue 변경은 그 사실을 구현하는 design, subject, shot, acceptance, edit, sound와 review evidence를 식별할 수 있어야 한다.

변경 영향은 직접 참조뿐 아니라 state handoff, causality, chronology, setup과 payoff, motif occurrence와 deliverable까지 추적할 수 있어야 한다. 파일 하나만 바뀌었다는 이유로 consequence surface를 그 파일에 한정하지 않아야 한다.

### Stable Identity {#story-revision-stable-identity}

문구 수정과 identity 변경을 구분하여 같은 dramatic unit의 개정은 link를 보존하고 실제로 대체된 unit은 새 identity와 replacement 관계를 가져야 한다.

문구, 제목, 파일 위치와 순서 변경이 의미를 보존하는지 사용자가 검토할 수 있어야 한다. 의미 변경을 cosmetic edit로 표시하거나 단순 spelling 수정을 새 event로 만들지 않아야 한다.

### 삭제와 무효화 {#story-deletion-invalidation}

삭제된 beat와 scene을 참조하는 shot, event, asset와 edit를 stale 또는 invalid로 만들고 빈 target을 다른 사건에 자동 재지정하지 않아야 한다.

삭제된 단위는 tombstone, omission 또는 replacement 관계를 통해 과거 evidence와 변경 이유를 해석할 수 있어야 한다. 번호와 identity를 재사용해 오래된 참조가 새 내용을 가리키지 않아야 한다.

### Alternative와 선택 {#story-revision-alternatives}

서로 다른 scene, ending, character choice와 dialogue version을 별도 alternative로 비교하고 선택 전까지 결과와 evidence를 섞지 않아야 한다.

Alternative는 공통 base, 달라지는 단위, 예상 영향, status와 선택 기준을 가질 수 있어야 한다. Branch가 합쳐질 때 서로 양립할 수 없는 state, chronology와 acceptance를 자동으로 결합하지 않아야 한다.

### 변경 이유 {#story-revision-reason}

중요 변경은 문제, 의도, 영향을 받는 약속과 선택 결과를 기록하여 단순 최신 파일이 정본인 이유를 추적할 수 있어야 한다.

### Revision Identity와 계보 {#story-revision-lineage}

각 중요한 revision은 stable identity, base revision, author, timestamp 또는 project-defined order, 변경 집합과 승인 상태를 가져야 한다. 최신 수정 시간이 같거나 file order가 바뀌어도 계보가 모호해지지 않아야 한다.

### Soft Lock와 삽입 {#story-revision-soft-lock}

Screenplay ladder가 production에 사용되기 시작하면 scene와 sequence의 번호를 soft lock하고, 삽입과 omission이 기존 identity와 downstream join을 보존해야 한다. Lock는 수정 금지가 아니라 변경 영향과 명시적 migration을 요구하는 상태여야 한다.

### 승인, 거부와 보류 {#story-revision-approval-status}

변경 제안은 draft, review, approved, rejected, superseded 또는 project-defined 상태와 결정 권한을 가질 수 있어야 한다. 미승인 변경이 current production과 acceptance의 정본으로 조용히 채택되지 않아야 한다.

### 충돌과 Authority {#story-revision-conflict-authority}

동시에 수정된 상위 약속과 하류 단위가 충돌하면 어느 source와 승인 결정이 우선하는지 보고하고 자동으로 최신 파일을 승자로 선택하지 않아야 한다. 충돌 해결은 버려진 선택과 영향을 기록해야 한다.

### Rollback과 재현 {#story-revision-rollback-reproduction}

이전 승인 revision을 다시 선택할 때 그 revision의 story 단위, 선택된 alternatives와 source provenance를 재구성할 수 있어야 한다. 현재 asset 또는 render를 과거 이야기의 증거로 재사용하려면 exact dependency가 일치하는지 확인해야 한다.

### 변경 뒤 Freshness {#story-revision-freshness}

Story 변경 뒤 하류 design, source, capture, review와 deliverable은 재검토 전까지 stale 또는 not-run으로 표시되어야 한다. 시스템은 변경 이전의 통과 결과를 현재 revision의 성공으로 제시하지 않아야 한다.
