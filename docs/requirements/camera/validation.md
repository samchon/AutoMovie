# Camera 검증

## Numeric Frame과 실제 Pixel 검증 {#camera-validation}

Camera는 projection, transform, target, framing, clipping, path, grammar, sampling와 required subject delivery를 수치와 current render 양쪽에서 검증해야 한다.

### Hand-computable Geometry {#camera-hand-computable-geometry}

Canonical case에서 field of view, depth, projected bounds, screen region, look direction와 clipping을 독립적으로 손계산 가능한 값과 대조할 수 있어야 한다.

### Boundary와 Negative {#camera-boundary-negative}

Exact frame edge, near·far plane, maximum movement, target loss, line cross와 occlusion threshold의 positive, negative와 boundary case를 검사해야 한다.

### Multi-time Capture {#camera-multi-time-capture}

Static screenshot 하나가 아니라 start, middle, end와 event·transition critical time에서 framing, movement, subject readability와 continuity를 확인해야 한다.

### Current Viewer Evidence {#camera-current-viewer-evidence}

Source 수정 뒤 실제 deployed viewer의 current pixels와 geometry metadata를 함께 검토하고 stale capture나 예상 설명으로 성공을 보고하지 않아야 한다.

### 결과 상태 {#camera-validation-status}

Numeric pass, frame pass, sequence grammar pass, failed, unsupported와 not-run을 구분하고 viewer 검증 없이 camera가 잘 작동한다고 주장하지 않아야 한다.
