# Picture, Color와 Image Sequence

## Picture Product의 공간과 색 계약 {#delivery-picture-color-sequences}

Picture는 width, height, pixel aspect, crop 또는 display·data window, channel, bit depth-like precision, alpha, color space, transfer, primaries-like metadata와 view transform을 가져야 한다.

### Scene-linear와 Display-referred {#delivery-scene-display-picture}

Scene-linear intermediate, HDR-like working output, display-referred master와 encoded consumer copy를 구분하고 변환 lineage를 기록해야 한다.

### Image Sequence {#delivery-image-sequences}

Frame numbering, pattern, start, count, extension, channel set, missing frame policy와 per-frame digest를 선언할 수 있어야 한다.

### Multi-part와 Structural Channel {#delivery-multipart-channels}

지원하는 경우 beauty, depth, normal, mask, multiple view와 arbitrary data channel을 part 또는 separate product로 제공하고 의미와 unit를 명시해야 한다.

### Picture Refusal {#delivery-picture-refusal}

Wrong dimensions, missing frame, duplicate number, unknown color, double transform, invalid alpha와 clipped required range를 거부해야 한다.
