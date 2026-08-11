# Palette, Material과 상태

## 세계를 잇는 표면과 색 State {#production-design-palette-material-state}

Palette, material family, texture scale, reflectance, transparency, emission, wear와 environmental response를 story location, faction, character와 time phase에 연결할 수 있어야 한다.

Material과 palette decision은 적용 surface 또는 subject, base state, variant, source, viewing condition와 purpose를 식별할 수 있어야 한다. Render에서 우연히 나온 색을 승인 palette의 새 값으로 되돌려 쓰지 않아야 한다.

### Palette Role {#production-design-palette-roles}

Dominant, supporting, accent, warning, identity와 transformation color role을 구분하고 모든 subject를 하나의 색조로 단순 통일하지 않아야 한다.

각 color role은 허용 범위, contrast 상대, 사용 비율 또는 priority, 금지된 혼동과 color-vision 또는 grayscale에서 필요한 distinction을 가질 수 있어야 한다. 숫자 색상만 일치하고 story hierarchy가 사라지는 결과를 통과시키지 않아야 한다.

### Material Language {#production-design-material-language}

Natural, fabricated, polished, rough, transparent, soft, damaged와 fictional material character를 실제 surface 속성, assembly와 pattern 선택으로 내려야 한다.

보이는 surface, 물리적 substance, layered assembly와 shader 또는 texture representation을 서로 다른 사실로 구분해야 한다. 같은 색이라는 이유로 밀도, 두께, 반사, 투과, 마모와 구조 역할이 같은 material이라고 추정하지 않아야 한다.

### State Variation {#production-design-state-variation}

Clean, used, wet, dusty, burned, broken, repaired와 aged state를 base identity와 event 또는 phase에 연결하고 shot마다 임의 noise로 다시 만들지 않아야 한다.

Wear, soiling, aging와 damage는 source region 또는 mask, 원인, 시간 state, intensity, material response와 사용자 선택을 가질 수 있어야 한다. 제품이 모든 surface에 같은 procedural dirt를 자동 추가하여 realism이라고 주장하지 않아야 한다.

### Color 관리 경계 {#production-design-color-management-boundary}

Design palette의 scene-referred intent와 display transform, grade와 delivery view를 구분하여 monitor appearance를 raw material value로 되돌려 쓰지 않아야 한다.

### Texture Scale와 Mapping {#production-design-texture-scale-mapping}

Texture와 physical pattern은 실제 scale, coordinate source, orientation, seam, repeat 또는 non-repeat rule과 expected filtering을 가질 수 있어야 한다. Image pixel 수나 default UV만으로 실제 material scale을 추정하지 않아야 한다.

### Lighting에 따른 Material Readability {#production-design-material-lighting-readability}

Material separation은 intended scene lighting, environment, exposure와 structural pass에서 필요한 관찰 조건을 가질 수 있어야 한다. Material value를 lighting failure의 보정값으로 영구 변경하거나 한 light rig의 appearance를 모든 scene의 material truth로 간주하지 않아야 한다.

### Material Source와 Provenance {#production-design-material-provenance}

External texture, scan, measured property, generated map와 reference sample은 source, license 또는 permission, digest, color 또는 data interpretation, unit, processing lineage와 consumer를 추적할 수 있어야 한다. Filename과 extension만으로 media type과 decoding intent를 보증하지 않아야 한다.

### Material 대체와 Compatibility {#production-design-material-substitution}

Material 또는 texture를 대체할 때 palette role, scale, reflectance, transparency, surface state, license, budget와 affected subject를 비교할 수 있어야 한다. 가까운 색이라는 이유로 functional 또는 visual requirement가 다른 material을 자동 대체하지 않아야 한다.

### State Continuity {#production-design-material-state-continuity}

Wetness, dirt, damage, repair, emission와 transformation state는 story event와 time phase에 따라 scene 사이에서 이어져야 한다. Edit order, random seed 재생성 또는 repaint reroll이 authored state를 바꾸지 않아야 한다.

### Palette와 Material Acceptance {#production-design-palette-material-acceptance}

Current subject, location와 representative shots에서 palette hierarchy, material distinction, texture scale, state와 delivery transform을 검토할 수 있어야 한다. Mood board와 isolated swatch만으로 actual geometry와 lighting에서의 성공을 통과시키지 않아야 한다.
