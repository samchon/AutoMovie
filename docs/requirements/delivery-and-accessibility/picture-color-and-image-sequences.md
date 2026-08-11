# Picture, Color와 Image Sequence

## Picture Product의 공간과 색 계약 {#delivery-picture-color-sequences}

Picture product는 width, height, pixel aspect, orientation, crop 또는 display와 data window, channel, precision, alpha, color space, transfer, primaries-like metadata, range와 view transform을 가져야 한다. Planned facts와 decoded bytes의 observed facts를 비교할 수 있어야 한다.

### Scene-linear와 Display-referred {#delivery-scene-display-picture}

Scene-linear intermediate, high-dynamic-range-like working output, display-referred master, proxy와 consumer copy를 구분하고 transform lineage를 기록해야 한다. 같은 view transform을 render와 encode에서 두 번 적용하거나 display-referred image를 scene-linear로 표기해서는 안 된다.

### Dimensions와 Window {#delivery-picture-dimensions-window}

Stored dimensions, intended display dimensions, pixel aspect, crop, padding, overscan-like region과 valid data window를 구분해야 한다. Player가 해석할 정보가 없으면 non-square pixel 또는 cropped picture를 추측에 맡겨서는 안 된다.

### Alpha와 Channel Semantics {#delivery-picture-alpha-channels}

Alpha의 존재, straight 또는 premultiplied relation, background expectation과 각 channel의 semantic, component order, unit과 valid range를 명시해야 한다. Structural numeric channel을 display color로 변환하거나 invalid alpha를 opaque로 조용히 바꾸어서는 안 된다.

### Image Sequence {#delivery-image-sequences}

Frame pattern, start number, exact count, extension, dimensions, channel set, time relation, per-frame digest와 missing frame policy를 선언해야 한다. Duplicate number, gap와 다른 revision의 stray frame을 sequence에 포함해서는 안 된다.

### Multi-part와 Structural Channel {#delivery-multipart-channels}

지원하는 경우 beauty, depth, normal, mask, multiple view와 arbitrary data channel을 part 또는 separate product로 제공하고 각 단위와 encoding을 명시해야 한다. 한 part 실패를 전체 file 성공에 숨기거나 같은 channel 이름에 다른 의미를 사용해서는 안 된다.

### Proxy와 Derivative {#delivery-picture-derivatives}

Thumbnail, proxy와 lower-resolution derivative는 master identity, crop, frame range와 color transform lineage를 참조해야 한다. Derivative review는 master precision, resolution, alpha 또는 color metadata 검증을 대신하지 않는다.

### Picture Refusal {#delivery-picture-refusal}

Wrong dimensions, missing 또는 duplicate frame, unknown color identity, double transform, invalid alpha, clipped required range, mixed channel schema와 digest mismatch는 거절해야 한다. Valid frames는 partial sequence로 격리할 수 있지만 complete picture product로 publish해서는 안 된다.
