# 동작 범위와 Identity

## 시간에 따른 명시적 State 변화 {#motion-scope-identity}

Motion은 stable identity, target actor 또는 object, source, duration, clock basis, affected controls와 valid start·end state를 가져야 한다.

### Motion Source {#motion-source-kinds}

Authored keyframe, external clip, procedural gait, path motion, physics result와 performance composition을 구분하고 어느 source가 final channel을 소유하는지 명시해야 한다.

### 의미와 기법 {#motion-meaning-technique}

Walk, grasp, open, fall와 같은 story action meaning을 clip filename이나 solver 이름과 구분하여 여러 기법이 같은 semantic event를 구현할 수 있어야 한다.

### Actor와 Object {#motion-actor-object-scope}

Humanoid proxy, crowd member, prop, door, vehicle, mechanism, plant와 project-defined rigged subject가 같은 fixed-clock 원칙으로 움직일 수 있어야 한다.

### Missing Motion {#motion-missing-refusal}

필수 action에 source, target control, timing 또는 end state가 없으면 generic idle, linear translation와 즉시 snap으로 성공을 가장하지 않아야 한다.
