# State Handoff와 Continuity

## Shot와 Scene 경계의 상태 인계 {#staging-state-handoff-continuity}

Actor pose와 location, prop ownership, object state, formation, environment, light, damage와 effect state를 shot와 scene 종료에서 다음 source interval로 인계해야 한다.

### Edit Boundary {#staging-edit-boundary-state}

연속 action의 source interval이 edit로 나뉘어도 경계 양쪽의 motion phase, contact, eyeline, screen direction와 sound event가 intentional continuity를 가져야 한다.

### Off-screen Change {#staging-offscreen-change}

생략 시간과 화면 밖 사건으로 state가 바뀌면 story ledger나 authored transition을 참조하고 편의상 reset하지 않아야 한다.

### Alternative Take {#staging-state-alternatives}

서로 다른 blocking과 performance take는 독립 state lineage를 가지며 한 take의 시작과 다른 take의 끝을 조합하지 않아야 한다.

### Continuity Finding {#staging-continuity-finding}

Teleport, prop hand swap, opening reset, damage disappearance, formation count drift와 light·weather mismatch를 named finding으로 남겨야 한다.
