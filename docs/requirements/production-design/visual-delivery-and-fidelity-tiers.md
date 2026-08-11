# Visual Delivery와 Fidelity Tier

## Prototype과 최종 표현 경계 {#production-design-visual-delivery}

Production은 deterministic prototype, guide pass, proxy, final deterministic render와 optional repaint rendition 중 필요한 visual delivery를 선언하고 서로 다른 성공 기준을 구분해야 한다.

### Blocking Pass {#production-design-blocking-pass}

Blocking pass는 staging, motion, timing, subject identity, camera와 readable state를 정확하고 재현 가능하게 보여야 하며 photoreal finish를 성공 조건으로 삼지 않아야 한다.

### Representation Tier {#production-design-representation-tier}

Proxy, standard, hero와 special-purpose representation은 geometry, material, rig, texture, collision와 review requirement가 무엇인지 명시해야 한다.

### Tier 전환 {#production-design-tier-transition}

낮은 tier에서 높은 tier로 바꿀 때 identity, transform, state, attachment, motion와 evidence target을 보존하고 silent silhouette·scale drift를 허용하지 않아야 한다.

### Repaint 경계 {#production-design-repaint-boundary}

Repaint는 승인된 deterministic 구조의 appearance를 보강하는 별도 rendition이며 subject count, pose, contact, camera, event order와 timing 결함을 대신 고치는 경로가 아니어야 한다.
