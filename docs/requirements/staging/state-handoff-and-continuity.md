# State Handoff와 Continuity

## Shot와 Scene 경계의 상태 인계 {#staging-state-handoff-continuity}

Actor pose와 location, prop ownership, object state, formation, environment, light, damage와 effect state를 shot와 scene 종료에서 다음 source interval로 인계해야 한다.

### State Lineage {#staging-state-lineage}

인계 state는 source scene, production design revision, 발생 event, story time와 take identity를 가리키고 다음 shot이 어느 snapshot 또는 authored transition을 읽었는지 추적할 수 있어야 한다.

### Edit Boundary {#staging-edit-boundary-state}

연속 action의 source interval이 edit로 나뉘어도 경계 양쪽의 motion phase, contact, eyeline, screen direction와 sound event가 intentional continuity를 가져야 한다.

### Cross-domain Continuity {#staging-cross-domain-continuity}

같은 boundary에서 actor·prop state뿐 아니라 camera relation, opening과 support geometry, practical과 shadow direction, weather, effect와 audible consequence를 같은 story state로 비교하고 한 영역의 reset을 다른 영역의 continuity로 숨기지 않아야 한다.

### Off-screen Change {#staging-offscreen-change}

생략 시간과 화면 밖 사건으로 state가 바뀌면 story ledger나 authored transition을 참조하고 편의상 reset하지 않아야 한다.

### Alternative Take {#staging-state-alternatives}

서로 다른 blocking과 performance take는 독립 state lineage를 가지며 한 take의 시작과 다른 take의 끝을 조합하지 않아야 한다.

### Time Jump와 Discontinuity {#staging-authored-discontinuity}

Time jump, montage, dream, replay와 deliberate continuity break는 이전·이후 state, 관객이 변화를 이해할 cue, affected rules와 acceptance를 선언하고 단순 mismatch suppression으로 표현하지 않아야 한다.

### Continuity Finding {#staging-continuity-finding}

Teleport, prop hand swap, opening reset, damage disappearance, formation count drift와 light·weather mismatch를 named finding으로 남겨야 한다.
