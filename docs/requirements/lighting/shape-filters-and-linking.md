# Shape, Filter와 Linking

## 빛의 범위를 저작하는 Control {#lighting-shape-filters-linking}

Barn door, gobo, cookie, blocker, portal, reflector, gel, diffuser와 project-defined shaping control을 source-local geometry, orientation와 effect 범위로 표현할 수 있어야 한다.

### Control Space {#lighting-control-coordinate-space}

각 control은 source-local, host-local 또는 world coordinate 중 어느 공간에 놓이는지, unit, transform order, valid geometry revision와 film interval을 선언해야 한다.

### Light Linking {#lighting-linking}

특정 light가 포함하거나 제외할 subject, group, surface와 reflection consumer를 명시하고 filename 또는 render layer에서 추정하지 않아야 한다.

### Link Resolution {#lighting-link-resolution}

Link target의 membership, instance exception, include·exclude precedence와 missing identity 결과를 고정하고 subject reorder, group expansion 또는 culling 순서에 따라 다른 surface가 빛을 받지 않아야 한다.

### Filter Order {#lighting-filter-order}

Color, intensity, texture, shape와 shadow filter의 적용 순서와 coordinate를 고정하여 consumer마다 다른 result를 만들지 않아야 한다.

### Filter Sampling {#lighting-filter-time-sampling}

Animated filter, gobo, blocker, portal와 link state는 source, target geometry와 같은 fixed-clock sample에서 평가하고 previous-frame cache로 지연된 shadow나 pattern을 만들지 않아야 한다.

### Portal과 Opening {#lighting-portals-openings}

Window, door, skylight와 set opening을 light transport 또는 authored portal로 사용할 때 실제 opening geometry와 current state를 참조해야 한다.

### Control Alternative {#lighting-control-alternatives}

서로 다른 flag, gel, gobo, link와 portal setup은 독립 take 또는 lighting branch로 보존하고 공통 source, 달라진 control과 expected subject consequence를 기록해야 한다.

### Control Refusal {#lighting-control-refusal}

Missing target, cyclic filter, invalid texture, detached blocker와 all-subject exclusion을 명시적으로 보고해야 한다.
