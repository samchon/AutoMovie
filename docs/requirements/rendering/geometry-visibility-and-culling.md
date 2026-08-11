# Geometry, Visibility와 Culling

## Frame에 참여하는 실제 Geometry {#rendering-geometry-visibility-culling}

Resolved model, instance, skin, morph, soft surface, terrain, building, interior와 effect geometry는 camera, authored visibility, phase, layer와 pass relation에 따라 frame 참여 여부가 결정되어야 한다. Geometry가 제외된 이유를 source identity까지 역추적할 수 있어야 한다.

### Hierarchical Transform {#rendering-hierarchical-transforms}

External scene node, project group, actor skeleton, formation과 instance placement의 local transform은 하나의 ordered parent hierarchy로 합성되어야 한다. Parent와 child transform의 적용 순서, coordinate handedness와 unit이 고정되어야 하며 instancing이 placement를 덮어써서는 안 된다.

### Bounds와 Deformation {#rendering-deformed-bounds}

Visibility와 budget 판단에 쓰는 bounds는 현재 pose, skin, morph, soft-surface displacement와 supported procedural change를 포함해야 한다. Static source bounds만으로 animated 또는 deformed geometry를 잘라내서는 안 된다.

### Visibility State {#rendering-visibility-state}

Authored visible, hidden, phase-disabled, layer-excluded, room-culled, frustum-culled, occluded-like supported state와 unsupported 상태를 구분해야 한다. Culling은 source deletion이 아니며 다른 camera, pass 또는 frame에서 다시 평가할 수 있어야 한다.

### Room과 Region Culling {#rendering-room-region-culling}

Portal, interior space, map tile, region과 distance 기반 view range를 사용하면 camera membership, opening state와 conservative boundary 규칙을 명시해야 한다. Reflection, shadow, sound-related evidence, effect와 structural pass 같은 다른 consumer의 필요를 beauty camera visibility와 별도로 고려해야 한다.

### Frustum과 Boundary {#rendering-frustum-boundaries}

Near와 far plane, side planes, crop, overscan-like margin과 정확히 접하는 bounds의 포함 규칙을 고정해야 한다. Floating tolerance가 platform마다 object를 보였다 숨겼다 하지 않도록 declared tolerance 또는 unsupported condition을 사용해야 한다.

### Culling Diagnostics와 Recovery {#rendering-culling-diagnostics}

Expected subject가 frame에서 사라지면 source visibility, transform, bounds와 각 culling decision을 단계별로 관찰할 수 있어야 한다. Conservative fallback이 허용된 경우에는 더 많이 그릴 수 있지만 required geometry를 제거하는 방향으로 복구해서는 안 된다.

### Culling Refusal {#rendering-culling-refusal}

Invalid bounds, non-finite transform, hierarchy cycle, unknown visibility state와 required hero, shadow caster 또는 reflected object를 budget 편의로 몰래 제거하는 요청은 거절해야 한다. Partial frame은 누락 대상을 명시하고 final product로 승인할 수 없어야 한다.
