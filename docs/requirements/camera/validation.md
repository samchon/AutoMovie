# Camera 검증

## Numeric Frame과 실제 Pixel 검증 {#camera-validation}

Camera는 projection, transform, target, framing, clipping, path, grammar, sampling와 required subject delivery를 수치와 current render 양쪽에서 검증해야 한다.

### Validation Manifest {#camera-validation-manifest}

검증 결과는 camera와 take identity, story·staging source, production design revision, scene geometry revision, raster, film-time samples, optical state, tolerance와 수행한 review surface를 기록해야 한다.

### Hand-computable Geometry {#camera-hand-computable-geometry}

Canonical case에서 field of view, depth, projected bounds, screen region, look direction와 clipping을 독립적으로 손계산 가능한 값과 대조할 수 있어야 한다.

### Boundary와 Negative {#camera-boundary-negative}

Exact frame edge, near·far plane, maximum movement, target loss, line cross와 occlusion threshold의 positive, negative와 boundary case를 검사해야 한다.

### Cross-condition Negative Twin {#camera-cross-condition-negative-twin}

Projection, sensor fit, framing, movement, focus, clipping, occlusion, exposure와 grammar의 핵심 acceptance는 한 조건만 깨뜨린 negative twin을 가져야 하며 다른 camera나 다른 geometry revision의 failure로 rule을 검증했다고 간주하지 않아야 한다.

### Multi-time Capture {#camera-multi-time-capture}

Static screenshot 하나가 아니라 start, middle, end와 event·transition critical time에서 framing, movement, subject readability와 continuity를 확인해야 한다.

### Current Viewer Evidence {#camera-current-viewer-evidence}

Source 수정 뒤 실제 deployed viewer의 current pixels와 geometry metadata를 함께 검토하고 stale capture나 예상 설명으로 성공을 보고하지 않아야 한다.

### Reproducible Capture {#camera-reproducible-capture}

같은 source digest, scene state, camera take, timebase, frame index, shutter sample와 delivery profile의 capture는 같은 geometry와 pixel decision을 재현해야 하며 달라진 runtime 또는 unsupported appearance는 별도 상태로 밝혀야 한다.

### 결과 상태 {#camera-validation-status}

Numeric pass, frame pass, sequence grammar pass, failed, unsupported와 not-run을 구분하고 viewer 검증 없이 camera가 잘 작동한다고 주장하지 않아야 한다.
