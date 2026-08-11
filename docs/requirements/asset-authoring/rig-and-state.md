# Rig와 상태

## 움직일 수 있는 자산 {#asset-rig-state}

문, 기계, 차량, 무기, 가구, 식생, 직물과 인물처럼 상태가 바뀌는 자산은 움직이는 부분, 축, constraint, dependency와 named state를 선언할 수 있어야 한다.

### 일반적인 관절 관계 {#asset-general-joint-relations}

회전, 이동, scale, slider, hinge, ball joint, path constraint와 dependent driver를 조합하여 catalogue에 없던 새 기계와 물체를 rig할 수 있어야 한다.

### Rig 기준과 control identity {#asset-rig-basis-controls}

Rig는 hierarchy, joint order, rest와 bind 상태, 축과 방향, 허용 범위, dependency와 nameable control의 의미를 명시하여 같은 pose와 motion이 같은 기준에서 해석되게 해야 한다.

### Motion retargeting {#asset-motion-retargeting}

Motion을 다른 rig에 적용할 때 source와 target control mapping, 단위와 좌표 변환, rest 상태 차이, range 제한, unmapped channel, contact와 root motion의 보존 또는 손실을 기록하고 검증할 수 있어야 한다.

### 상태와 동작의 구분 {#asset-state-motion-distinction}

Open, closed, damaged, folded와 같은 named state는 시간에 따른 motion과 구분되며, motion은 유효한 state 사이를 deterministic clock에서 변화시켜야 한다.

### 변형 가능한 표면 {#asset-deformable-surface}

Morph, skin, lattice, soft body와 다른 bounded deformation은 base geometry와 control identity를 유지한 채 사용할 수 있어야 한다.

### Derived deformation basis {#asset-derived-deformation-basis}

Skin binding, morph delta와 다른 derived deformation은 자신이 계산된 base geometry와 rig identity를 가리켜야 하며 그 기준이 바뀌면 stale임을 식별할 수 있어야 한다.

### Constraint refusal {#asset-invalid-rig-refusal}

Cycle, missing target, detached joint, invalid range, incompatible topology와 bounded budget 초과는 실행 중 임의 fallback이 아니라 저작 가능한 진단으로 나타나야 한다.
