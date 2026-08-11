# Fidelity, Reference와 Provenance {#narrative-intent-fidelity-reference-document}

## Visual Deliverable 계약 {#narrative-intent-visual-deliverable-contract}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-visual-delivery 각 deliverable의 audience, raster, clock, tier와 source revision을 정한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-representation-tier project가 tier별 관찰 가능한 ceiling을 정의하게 한다. -->

Visual deliverable은 stable identity, purpose, target audience, raster 또는 scale, frame clock 또는 view set, required pass, representation tier, source design revision, delivery state와 acceptance profile을 가진다. Proxy, guide, blocking, final deterministic와 optional rendition은 이름이나 해상도가 아니라 이 계약으로 구분된다.

### Blocking Pass 불변식 {#narrative-intent-blocking-pass-invariants}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-blocking-pass staging, motion, timing과 readable state를 재현 가능하게 증명한다. -->

Blocking pass는 subject identity, scale, silhouette, staging, contact, occlusion, motion, event order, timing, camera와 frame-to-frame continuity를 오도하지 않아야 한다. Photoreal finish와 detailed likeness는 필수 조건이 아니며 detail 부족과 story 또는 staging failure를 다른 finding으로 출력한다.

### Tier 전환과 Fidelity 근거 {#narrative-intent-fidelity-tier-transition}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-tier-transition identity, transform, state, attachment와 motion을 전환 중 보존한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-fidelity-rationale 요구 detail을 shot, distance, interaction 또는 delivery에 연결한다. -->

Tier transition은 source와 target representation, preserved facts, deliberate differences, loss, mapping, reviewer와 evidence target을 가진다. Hero detail, material response, deformation, text legibility와 effect quality는 실제 consumer와 viewing condition에서 필요할 때만 상위 tier requirement가 된다.

### Repaint와 Structural Truth 경계 {#narrative-intent-repaint-structural-boundary}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-repaint-boundary repaint를 구조 결함 수정 경로가 아닌 별도 rendition으로 제한한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-delivery-passes beauty와 structural pass의 증명 범위를 나눈다. -->

Optional repaint는 승인된 deterministic structure, source render, control evidence, fixed references, execution identity, parameters, output digest와 별도 review를 가진 appearance rendition이다. Subject count, pose, contact, camera, event order와 timing을 바꿔 구조 failure를 숨길 수 없고 beauty, depth, mask, normal, outline와 pose pass는 선언된 사실만 증명한다.

### Unsupported Fidelity와 Continuity {#narrative-intent-unsupported-fidelity-continuity}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-unsupported-fidelity unsupported scope와 사용자 승인 fallback을 요구한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-cross-shot-visual-continuity 연결 shot이 같은 design identity에 답하게 한다. -->

요구 likeness, detail, deformation 또는 feature를 구동할 수 없으면 exact scope와 impact를 unsupported로 출력한다. Lower tier, external asset, repaint 또는 design revision fallback은 consequence와 사용자 승인을 요구하고 연결 shot의 representation, palette, material, state, light response와 reference identity를 보존한다.

### Freshness와 Fidelity Acceptance {#narrative-intent-fidelity-freshness-acceptance}

<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-delivery-freshness deliverable과 review를 exact input revision 및 digest에 결속한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-fidelity-acceptance declared tier와 purpose에 맞게 current evidence를 판정한다. -->

Deliverable과 review는 design, asset, source, renderer, repaint input와 output digest의 exact fingerprint를 가진다. 입력이 바뀌면 stale이고 acceptance는 declared tier와 purpose에 맞는 scale, silhouette, state, material, temporal coherence와 provenance만 판정한다.

## Reference Record 경계 {#narrative-intent-reference-record-boundary}

<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-references-provenance external 자료를 독립된 관찰 근거로 등록한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-observation-interpretation raw observation과 adopted interpretation을 분리한다. -->

Reference record는 stable identity, media kind, creator 또는 provider, source location 또는 generated identity, acquisition time, exact bytes digest, license, rights, observed range와 consumer를 가진다. Raw mark와 measured fact, semantic candidate, interpretation과 adopted design decision은 별도 claim이며 등록만으로 design truth가 되지 않는다.

### Original, Derived와 Generated Reference {#narrative-intent-reference-lineage}

<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference generated reference의 provider, model, prompt와 digest를 기록한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-original-derived original과 processing-derived 자료의 lineage를 보존한다. -->

Original reference는 acquired bytes와 source를 가지고 derived reference는 parent digest, activity, tool identity, parameters와 output digest를 가진다. Generated reference는 provider, exact model, request identity 또는 null, instruction과 digest, ordered inputs, controls, terms, output digest와 honest reproducibility를 가지며 존재하지 않는 acquisition URL을 만들지 않는다.

### 권리, Secret과 Consumer Permission {#narrative-intent-reference-rights-boundary}

<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-rights-consumer license, attribution과 downstream consumer 허가를 정한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-secret-boundary credential과 access token을 provenance에서 제외한다. -->

Reference permission은 production과 design observation, asset ingest, model input, repaint input, publication 또는 redistribution 같은 consumer role별로 명시된다. Credential, token과 private access material은 provenance record와 deliverable에서 제외하고 필요한 권리나 permission이 불명확하면 해당 consumer 사용을 거절한다.

### Authority, Replacement와 Incomplete 자료 {#narrative-intent-reference-authority-replacement}

<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-authority-confidence source authority, confidence와 disagreement를 보존한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-replacement 교체 자료가 기존 observation과 decision을 자동 재해석하지 않게 한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-unsupported-incomplete 분석 실패와 unsupported geometry를 보존한다. -->

Observation과 interpretation은 authority, confidence, uncertainty와 disagreement를 가진다. Reference replacement는 새 identity와 explicit supersession relation을 만들고 과거 reading을 자동 이식하지 않으며 unreadable range, unknown scale, ambiguous candidate, missing rights, unsupported analysis와 not-run attempt는 삭제하지 않고 withheld 또는 skipped 상태로 출력한다.

### Manifest Closure와 Review {#narrative-intent-reference-manifest-review}

<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-manifest-closure accepted design이 exact source bytes와 lineage로 재구성되게 한다. -->
<!-- @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review source, observation, decision과 consumer 관계를 함께 검토한다. -->

Accepted reference closure는 exact bytes 또는 generated identity, required sidecar와 license, lineage, adopted reading, design decision과 every consumer를 탐색 가능하게 만든다. Review는 이 관계와 uncertainty를 확인할 뿐 source 내용의 진실이나 design quality를 provenance 존재만으로 인증하지 않는다.
