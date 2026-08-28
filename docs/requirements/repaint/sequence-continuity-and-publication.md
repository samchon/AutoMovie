# Sequence Continuity와 Publication

## 여러 Repaint Shot의 동일한 Film {#repaint-sequence-continuity-publication}

Character, costume, prop, location, material, palette, light, weather, damage와 texture identity를 sequence의 repaint outputs 사이에 추적할 수 있어야 한다.

### Reference Continuity {#repaint-reference-continuity}

Shared style와 character reference, model version, control policy와 critical palette를 sequence에서 고정하거나 intentional change를 명시해야 한다.

### Continuity baseline과 변화 {#repaint-continuity-baseline-changes}

Sequence는 continuity baseline의 version과 적용 shot 범위를 가져야 하며 costume, damage, weather, lighting과 다른 이야기상의 변화는 시작과 종료 경계를 명시하여 accidental drift와 구분해야 한다.

이 baseline과 shot별 intended delta는 settings, design, screenplay 또는 brief와 shot owner로 이어지는 stable evidence address를 가져야 한다. Film continuity가 적용되지 않는 단일 image, bounded brief 또는 reusable library에는 가짜 sequence baseline을 만들지 않고 적용 제외를 명시한다.

### Drift 전파 제한 {#repaint-continuity-drift-propagation}

앞선 repainted output을 다음 shot의 reference로 사용할 때 derivation과 승인 범위를 기록하고, 검토되지 않은 변화가 연쇄 reference를 통해 sequence 전체에 누적되지 않게 해야 한다.

### Temporal Artifact {#repaint-temporal-artifacts}

Frame별 또는 shot별 repaint에서 flicker, identity drift, geometry warp, texture crawl와 transition mismatch를 sequence playback에서 검토해야 한다.

Playback observation은 선택된 candidate digest 집합과 baseline version에 묶고 다섯 artifact 각각을 독립적으로 pass 또는 fail시킬 수 있어야 한다. 정지 frame 비교나 receipt 존재만으로 temporal review를 대신하지 않는다.

### Mixed Delivery {#repaint-mixed-delivery}

Deterministic와 repainted shot를 한 film에 섞는 정책, transition와 review requirement를 명시하고 inadvertent lane mixing을 거부해야 한다.

### Publication Gate {#repaint-publication-gate}

Selected rendition의 source, provenance, structural comparison, shot, sequence와 film review가 current일 때만 final delivery에 publish해야 한다.

Final verification은 active pointer가 가리키는 explicit selection, 그 selection의 immutable candidate, 현재 source와 generator adoption, 구조 review, 그리고 continuity evidence address가 있는 film request의 current playback observation을 함께 다시 읽는다. Candidate가 존재하지만 selection이 없거나, terms review가 execution 또는 selection UTC date보다 미래이거나, continuity baseline·candidate·observation 중 하나가 stale이면 publication을 거부한다.
