# Geometry, Visibility와 Culling

## Frame에 참여하는 실제 Geometry {#rendering-geometry-visibility-culling}

Resolved model, instance, skin, morph, soft surface, terrain, building, interior와 effect geometry가 camera frustum, visibility state, layer와 pass에 따라 frame에 참여해야 한다.

### Hierarchical Transform {#rendering-hierarchical-transforms}

External glTF node, project group, actor skeleton, formation와 runtime parent의 local transform을 ordered hierarchy로 합성하고 instance transform을 잃지 않아야 한다.

### Visibility State {#rendering-visibility-state}

Authored visible, hidden, phase-disabled, room-culled, frustum-culled와 unsupported state를 구분하고 culling을 source deletion으로 취급하지 않아야 한다.

### Room과 Region Culling {#rendering-room-region-culling}

Portal, interior space, map tile, distance와 view range를 사용할 수 있으나 reflection, shadow, sound, effect와 evidence consumer를 함께 고려해야 한다.

### Culling Refusal {#rendering-culling-refusal}

Required subject, hero, shadow caster, reflected object와 acceptance target을 budget 편의로 몰래 제거하지 않아야 한다.
