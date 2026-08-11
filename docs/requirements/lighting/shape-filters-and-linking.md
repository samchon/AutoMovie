# Shape, Filter와 Linking

## 빛의 범위를 저작하는 Control {#lighting-shape-filters-linking}

Barn door, gobo, cookie, blocker, portal, reflector, gel, diffuser와 project-defined shaping control을 source-local geometry, orientation와 effect 범위로 표현할 수 있어야 한다.

### Light Linking {#lighting-linking}

특정 light가 포함하거나 제외할 subject, group, surface와 reflection consumer를 명시하고 filename 또는 render layer에서 추정하지 않아야 한다.

### Filter Order {#lighting-filter-order}

Color, intensity, texture, shape와 shadow filter의 적용 순서와 coordinate를 고정하여 consumer마다 다른 result를 만들지 않아야 한다.

### Portal과 Opening {#lighting-portals-openings}

Window, door, skylight와 set opening을 light transport 또는 authored portal로 사용할 때 실제 opening geometry와 current state를 참조해야 한다.

### Control Refusal {#lighting-control-refusal}

Missing target, cyclic filter, invalid texture, detached blocker와 all-subject exclusion을 명시적으로 보고해야 한다.
