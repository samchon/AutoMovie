# Actor Population과 Double

## 반복 Actor와 개별 인물 {#actor-populations-doubles}

Crowd, army, audience, workers와 background actor를 prototype, bounded population, group와 stable variation으로 구성하면서 hero character와 story-relevant member의 개별 identity를 유지해야 한다.

### Prototype Variation {#actor-prototype-variation}

Body scale, appearance, costume, pose phase, motion timing와 prop variation을 bounded seed로 만들고 관련 없는 scene 수정으로 population이 다시 섞이지 않아야 한다.

### Double과 Representation 교체 {#actor-doubles-replacement}

Stunt, distant, silhouette, stand-in와 rendering double을 같은 character performance에 연결할 수 있으나 적용 shot과 time range, capability, contact, silhouette와 visual difference를 명시해야 한다. 교체는 user-authored policy를 따르고 story-relevant actor에게 budget만으로 자동 적용하지 않아야 한다.

### Population Budget {#actor-population-budget}

Authored, visible, animated, collidable, audible와 evidence-sampled actor count를 구분하고 worst-case bound를 report해야 한다.

### 반복 오류 {#actor-population-refusal}

동일 transform, 겹침, unbounded spawn, hero 누락, group 밖 actor와 budget 초과를 silent culling으로 숨기지 않아야 한다.
