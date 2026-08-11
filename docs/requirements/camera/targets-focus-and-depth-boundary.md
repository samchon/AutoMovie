# Target, Focus와 Depth 경계

## Camera가 주의를 두는 Target {#camera-target-focus-depth}

Camera는 actor landmark, object, group, spatial mark, moving event와 authored world point를 framing 또는 orientation target으로 가질 수 있어야 한다.

### Target Sampling {#camera-target-sampling}

Moving target은 actor performance, object state와 formation motion의 같은 film-time sample을 읽고 stale position이나 previous frame cache를 사용하지 않아야 한다.

### Focus Distance {#camera-focus-distance}

Focus target과 distance를 optical metadata 또는 downstream appearance intent로 선언할 수 있으나 이를 실제 depth-of-field blur가 구현되었다는 주장과 구분해야 한다.

### Depth-of-field 경계 {#camera-depth-of-field-boundary}

Deterministic camera geometry는 frame과 focus intent를 제공하고 depth-of-field appearance는 지원 renderer 또는 별도 rendition profile이 명시할 때만 결과로 주장해야 한다.

### Target Refusal {#camera-target-refusal}

Missing target, detached landmark, zero look direction, impossible tracking speed와 required interval의 target loss를 거부해야 한다.
