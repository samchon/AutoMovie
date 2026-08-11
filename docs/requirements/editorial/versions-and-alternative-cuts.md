# Version과 Alternative Cut

## 같은 Source에서 파생되는 여러 Edit {#editorial-versions-alternative-cuts}

Rough cut, selected authored cut, trailer, language cut, accessibility cut과 project-defined alternative는 stable version identity, purpose, parent, source closure와 exact differences를 가져야 한다. 공통 source를 공유해도 각 version의 review와 publication 상태는 독립적이어야 한다.

### Append-only Revision {#editorial-append-only-revision}

Published 또는 reviewed cut을 제자리에서 바꾸지 말고 새 edit revision과 parent relation을 만들어야 한다. Correction도 무엇이 바뀌었는지 추적할 수 있어야 하며 삭제된 draft의 identity를 다른 내용에 재사용해서는 안 된다.

### Difference Report {#editorial-difference-report}

Clip 추가와 삭제, order, source range, film placement, transition, track, marker, effect, duration과 media reference 차이를 canonical order로 보고할 수 있어야 한다. 동일한 의미의 시간 표현이나 경로 표기 차이는 가짜 edit difference를 만들지 않아야 한다.

### Alternative Independence {#editorial-alternative-independence}

Alternative는 공통 parent에서 의도적으로 갈라진 version이어야 하며 한 version의 selection, marker, temporary mute 또는 conform replacement가 다른 version을 암묵적으로 바꾸어서는 안 된다. 공유 source가 갱신되면 영향받는 모든 descendant를 식별해야 한다.

### Selection State {#editorial-selection-state}

Draft, candidate, selected, superseded, rejected와 withdrawn 상태를 구분해야 한다. 한 목적과 audience에 대해 selected version이 둘 이상이면 충돌을 보고하고, selected가 아닌 render나 review를 current film evidence로 사용해서는 안 된다.

### Merge와 Conflict {#editorial-version-merge-conflict}

서로 다른 revision의 편집 결정을 결합할 때 common ancestor와 겹치는 변경을 제시해야 한다. Clip order, range 또는 transition에 대한 충돌을 timestamp 승자 방식으로 자동 해결하지 말고 사용자의 명시적 선택을 요구해야 한다.

### Stale Review {#editorial-version-stale-review}

Edit version이 바뀌면 영향을 받는 sequence와 film review, final render, conform, mix와 media probe를 stale로 만들어야 한다. Source와 range가 실제로 변하지 않은 evidence는 재사용 근거와 범위를 기록한 경우에만 fresh로 유지할 수 있다.

### Version Refusal {#editorial-version-refusal}

Missing parent, ancestry cycle, duplicate identity, incompatible source closure, unresolved conflict와 목적 없는 selected state는 거절해야 한다. Valid alternative는 보존하되 실패한 version을 제외한 결과를 원래 요청 전체의 성공으로 보고해서는 안 된다.
