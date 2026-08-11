# Scale, Palette, Material과 State {#narrative-intent-scale-material-document}

## Scale과 Frame 계약 {#narrative-intent-scale-frame-contract}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-scale-proportion subject와 location의 측정값 및 관계를 정한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-units-coordinate-frame unit, axis, frame과 origin을 명시한다. -->

Dimension은 subject 또는 location, length, angle, area 또는 volume unit, value 또는 range, coordinate frame, origin, source, basis, tolerance, confidence와 variant를 가진다. External source의 unit와 axis는 adopted design frame으로 가는 명시적 transform을 가지며 composition 편의를 위한 숨은 scale은 거절된다.

### Silhouette와 Detail Frequency {#narrative-intent-silhouette-detail-contract}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-silhouette-identity critical view에서 subject identity를 구분하는 mass와 negative space를 정한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-detail-frequency delivery tier에서 살아야 할 form frequency를 정한다. -->

Silhouette requirement는 expected camera distance, front, side, three-quarter, action 또는 project-defined view, major mass, landmark, negative space, background contrast와 delivery raster를 가진다. Large, medium와 small form은 실제 크기와 projected purpose를 가지며 texture noise와 보이지 않는 detail은 구조나 interaction 근거 없이 필수 scope가 아니다.

### Repeated Scale와 Proportion {#narrative-intent-repeated-scale-proportion}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-repeated-scale prototype scale과 bounded variation을 선언한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-proportion-rules-exceptions shared proportion rule과 승인 예외를 분리한다. -->

Repeated population은 prototype dimension, axis별 variation range, distribution 또는 selection rule, correlated seed와 hero override를 가진다. Exception은 target, reason, scope와 downstream effect를 기록하고 prototype을 바꾸지 않으며 variation은 human clearance, module, spacing와 story hierarchy를 깨지 않는다.

### Host, Clearance와 Conflict {#narrative-intent-scale-clearance-conflict}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-host-clearance opening, support, reach와 travel 범위의 fit을 판정한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-scale-conflict-refusal 모순 dimension과 불가능한 scale을 자동 보정하지 않는다. -->

Hosted subject는 host opening, support, reach, travel와 keep-out volume을 같은 frame에서 비교하고 전체 motion range와 tolerance의 clearance를 출력한다. 모순 dimension, non-positive scale, collapsed axis, host 밖 placement와 불가능한 clearance는 source와 owner별 conflict이며 평균이나 clamp로 해결하지 않는다.

### Tier 보존과 Scale Evidence {#narrative-intent-scale-tier-evidence}

<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-scale-across-tiers tier 사이 extent, landmark와 contact point를 보존한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-scale-evidence dimension, bounds, plan, section과 render를 함께 관찰한다. -->
<!-- @evidence requirements/production-design/scale-proportion-and-silhouette.md#production-design-silhouette-acceptance actual shot condition에서 silhouette를 판정한다. -->

Proxy, standard, hero, imported와 repainted representation은 world extent, landmark, contact point와 major mass mapping을 가진다. Scale verdict는 authoritative dimension과 structural bounds, plan 또는 section과 current image를 적용 view에서 비교하고 perspective 착시나 확대 turntable 하나로 다른 view를 통과시키지 않는다.

## Palette와 Material 상태 {#narrative-intent-palette-material-state}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-palette-material-state surface와 color state를 location, faction, character와 phase에 연결한다. -->

Palette와 material decision은 stable identity, 적용 surface 또는 subject, base state, variant, source, story location 또는 faction, time phase, viewing condition과 purpose를 가진다. Render의 우연한 색과 appearance는 승인 palette나 material source로 역승격되지 않는다.

### Palette Role과 Distinction {#narrative-intent-palette-role-distinction}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-palette-roles dominant, supporting, accent, warning, identity와 transformation 역할을 정한다. -->

Color role은 허용 범위, contrast 상대, 사용 priority 또는 ratio, 금지 혼동, color-vision과 grayscale distinction을 가진다. 숫자 색상 일치만 있고 subject hierarchy와 transformation readability가 사라진 결과는 role criterion을 충족하지 않는다.

### Material Layer와 Representation {#narrative-intent-material-layer-representation}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-language surface, substance, assembly와 shader representation을 구분한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-texture-scale-mapping texture scale, mapping과 seam 조건을 실제 surface에 결속한다. -->

Material fact는 visible surface, physical substance, layered assembly, pattern과 shader 또는 texture representation을 별도 층으로 가진다. Texture는 real scale, mapping frame, orientation, repeat, seam, texel purpose와 channel intent를 가지며 같은 색이나 파일 이름으로 서로 다른 substance를 합치지 않는다.

### Color와 Lighting 경계 {#narrative-intent-material-color-lighting-boundary}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-color-management-boundary authored color와 display 변환을 분리한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-lighting-readability required light condition에서 material 구분을 판정한다. -->

Authored color, texture decoding intent, working space, display transform과 output encoding은 서로 다른 state이고 변환 identity를 기록한다. Material readability는 required light, view, raster와 neighbor contrast에서 판단하며 조명 하나의 appearance를 intrinsic material 값으로 되돌려 쓰지 않는다.

### Wear, Damage와 State Continuity {#narrative-intent-material-state-continuity}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-state-variation wear, wetness, dirt와 damage의 원인 및 mask를 정한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-state-continuity scene 경계의 material state를 story event와 연결한다. -->

Wear, dirt, wetness, damage, repair와 transformation은 subject, affected surface, base state, variant, mask 또는 region, cause event, valid time과 phase를 가진다. 설명 없는 state reset, 원인 없는 procedural noise와 같은 story moment의 mutually exclusive material state는 continuity failure다.

### Provenance, Substitution과 Acceptance {#narrative-intent-material-provenance-substitution}

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-provenance material source와 adopted interpretation을 추적한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-substitution 대체 전후 appearance, capability와 consumer compatibility를 비교한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-palette-material-acceptance current structural 및 visual evidence로 판정한다. -->

Material source는 origin, rights, observation, interpretation, processing lineage와 consumer permission을 가진다. Substitution은 identity, surface role, scale, reflectance, transparency, state capability, loss와 affected consumer를 비교하고 current structural 및 visual evidence와 authority가 있어야 approved replacement가 된다.
