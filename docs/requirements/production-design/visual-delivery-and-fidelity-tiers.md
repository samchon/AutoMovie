# Visual Delivery와 Fidelity Tier

## Prototype과 최종 표현 경계 {#production-design-visual-delivery}

Production은 deterministic prototype, guide pass, proxy, final deterministic render와 optional repaint rendition 중 필요한 visual delivery를 선언하고 서로 다른 성공 기준을 구분해야 한다.

각 deliverable은 목적, target audience, raster 또는 scale, frame clock 또는 view set, required pass, fidelity tier, source revision와 acceptance를 가질 수 있어야 한다. Preview, diagnostic capture와 final delivery를 filename이나 해상도만으로 구분하지 않아야 한다.

### Blocking Pass {#production-design-blocking-pass}

Blocking pass는 staging, motion, timing, subject identity, camera와 readable state를 정확하고 재현 가능하게 보여야 하며 photoreal finish를 성공 조건으로 삼지 않아야 한다.

Crude geometry와 material도 scale, silhouette, contact, occlusion, event order와 continuity를 오도하지 않아야 한다. Detail이 부족하다는 사실과 story 또는 staging이 잘못되었다는 사실을 서로 다른 finding으로 보고해야 한다.

### Representation Tier {#production-design-representation-tier}

Proxy, standard, hero와 special-purpose representation은 geometry, material, rig, texture, collision와 review requirement가 무엇인지 명시해야 한다.

Tier는 subject, scene, camera distance, interaction, pass와 deliverable별로 선택할 수 있어야 하며 한 이름이 모든 production에서 같은 polygon count나 texture size를 뜻한다고 가정하지 않아야 한다. Project는 각 tier의 관찰 가능한 ceiling을 정의해야 한다.

### Tier 전환 {#production-design-tier-transition}

낮은 tier에서 높은 tier로 바꿀 때 identity, transform, state, attachment, motion와 evidence target을 보존하고 silent silhouette·scale drift를 허용하지 않아야 한다.

전환은 source와 target representation, mapping, preserved fact, deliberate difference, loss, reviewer와 current evidence를 가질 수 있어야 한다. 자동 변환 결과가 존재한다는 이유로 higher tier가 승인된 것으로 간주하지 않아야 한다.

### Repaint 경계 {#production-design-repaint-boundary}

Repaint는 승인된 deterministic 구조의 appearance를 보강하는 별도 rendition이며 subject count, pose, contact, camera, event order와 timing 결함을 대신 고치는 경로가 아니어야 한다.

Repaint delivery는 source render, control evidence, fixed references, provider와 exact execution identity, parameters, output digest, media facts와 별도 review를 가져야 한다. 같은 seed 또는 prompt가 같은 output을 보장한다고 주장하지 않아야 한다.

### Fidelity Requirement의 근거 {#production-design-fidelity-rationale}

Hero detail, material response, deformation, text legibility와 effect quality는 어떤 shot, viewing distance, interaction 또는 delivery가 요구하는지 연결할 수 있어야 한다. 관찰되지 않는 detail을 prestige 또는 realism이라는 말만으로 필수 tier에 올리지 않아야 한다.

### Structural Pass와 Beauty의 역할 {#production-design-delivery-passes}

Beauty, depth, mask, normal, outline, pose와 project-defined pass는 어떤 design 사실을 검토하는지 선언할 수 있어야 한다. Structural pass를 최종 appearance의 증거로 사용하거나 beauty frame만으로 semantic identity와 geometry 관계를 모두 증명하지 않아야 한다.

### 미지원 Fidelity와 Honest Fallback {#production-design-unsupported-fidelity}

요구한 likeness, surface detail, deformation 또는 renderer feature를 authoring agent와 deterministic engine이 구동할 수 없으면 unsupported scope와 영향을 보고해야 한다. 낮은 tier, external asset, repaint 또는 design revision 중 fallback은 사용자 승인을 받아야 하며 조용한 대체가 아니어야 한다.

### Cross-shot Visual Continuity {#production-design-cross-shot-visual-continuity}

Representation, palette, material, state, light response와 repaint reference는 연결된 shot 사이에서 같은 design identity에 답해야 한다. 각 shot이 개별적으로 보기 좋다는 이유로 전체 film의 visual continuity를 통과시키지 않아야 한다.

### Delivery Freshness와 Identity {#production-design-delivery-freshness}

모든 visual deliverable과 review는 design, asset, source, renderer 또는 repaint input의 exact revision과 digest를 가리켜야 한다. 입력 변경 뒤 이전 capture와 rendition을 current라고 제시하지 않아야 한다.

### Fidelity Acceptance {#production-design-fidelity-acceptance}

검토자는 declared tier와 deliverable purpose에 따라 scale, silhouette, state, material, temporal coherence와 provenance를 판정할 수 있어야 한다. Prototype을 photorealism으로 거부하거나 repaint를 deterministic structure의 검증 대신 통과시키지 않아야 한다.
