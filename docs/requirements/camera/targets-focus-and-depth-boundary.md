# Target, Focus와 Depth 경계

## Camera가 주의를 두는 Target {#camera-target-focus-depth}

Camera는 actor landmark, object, group, spatial mark, moving event와 authored world point를 framing 또는 orientation target으로 가질 수 있어야 한다.

### Target Sampling {#camera-target-sampling}

Moving target은 actor performance, object state와 formation motion의 같은 film-time sample을 읽고 stale position이나 previous frame cache를 사용하지 않아야 한다.

### Target Loss Policy {#camera-target-loss-policy}

Target이 occluded, detached, destroyed, merged 또는 frame 밖으로 이동할 수 있는 interval은 hold, transfer, authored world point, continue motion 또는 refusal 중 project가 선택한 결과를 가져야 하며 마지막 valid position을 설명 없이 계속 사용하지 않아야 한다.

### Focus Distance {#camera-focus-distance}

Focus target과 distance를 optical metadata 또는 downstream appearance intent로 선언할 수 있으나 이를 실제 depth-of-field blur가 구현되었다는 주장과 구분해야 한다.

### Focus Pull {#camera-focus-pulls}

Focus change는 시작·종료 target 또는 distance, event anchors, duration, interpolation, 허용 error와 review times를 가져야 하며 subject motion과 camera motion을 같은 fixed-clock sample에서 반영해야 한다.

### Focus와 Visibility {#camera-focus-visibility}

Focus target이 존재한다는 사실과 그 target의 framing·occlusion·readability를 구분하고 가려진 target에 맞춘 focus metadata만으로 관객의 주의 전달을 통과시키지 않아야 한다.

### Depth-of-field 경계 {#camera-depth-of-field-boundary}

Deterministic camera geometry는 frame과 focus intent를 제공하고 depth-of-field appearance는 지원 renderer 또는 별도 rendition profile이 명시할 때만 결과로 주장해야 한다.

### Depth Claim Validation {#camera-depth-claim-validation}

Depth-of-field, focus breathing, bokeh와 rack-focus appearance를 검토할 때 사용한 rendition profile, lens metadata, sample times와 current pixels를 식별하고 지원되지 않은 appearance를 geometric focus pass로 보고하지 않아야 한다.

### Target Refusal {#camera-target-refusal}

Missing target, detached landmark, zero look direction, impossible tracking speed와 required interval의 target loss를 거부해야 한다.
