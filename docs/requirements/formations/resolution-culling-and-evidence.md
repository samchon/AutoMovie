# Resolution, Culling과 Evidence

## Logical Formation과 표시 해상도의 분리 {#formation-resolution-culling-evidence}

Formation의 identity, hierarchy, count, slot, hero, state와 semantic event는 expanded object, animated rig, render instance, proxy, aggregate와 culled representation 중 무엇으로 표시되는지와 독립적으로 유지되어야 한다.

### 사용자 선택 Policy {#formation-resolution-policy-selection}

사용자와 저작 에이전트는 shot, distance, evidence purpose와 resource budget에 따른 expansion, animation, collision, audio, proxy와 culling policy를 선택하고, renderer가 story-relevant member를 임의로 낮추거나 제거하지 않게 해야 한다.

### Semantic Minimum {#formation-resolution-semantic-minimum}

Hero, speaker, contact participant, state-changing member, unique prop와 acceptance sample은 필요한 identity와 behavior를 유지해야 하며 aggregate나 silhouette tier가 event 수행을 대신했다고 주장하지 않아야 한다.

### Stable Resolution 전환 {#formation-resolution-transition}

Representation이 shot 또는 distance에 따라 바뀔 때 member assignment, placement, motion phase, appearance seed, count와 state가 유지되고 전환 경계와 visual difference가 명시되어야 한다.

### Evidence와 Quantity {#formation-resolution-evidence-quantity}

Logical, resolved, visible, animated, collidable, audible, culled와 evidence-sampled count를 각각 보고하고 quantity, overlap와 event 검증이 어떤 population과 representation을 사용했는지 추적할 수 있어야 한다.

### Culling Refusal {#formation-resolution-culling-refusal}

Budget 초과, unsupported tier와 missing proxy를 member drop, count 변경, hero 교체 또는 stale evidence로 숨기지 않고 사용자가 규모, shot, policy 또는 asset을 바꿀 수 있는 finding으로 보고해야 한다.
