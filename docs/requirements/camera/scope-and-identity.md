# Camera 범위와 Identity

## Film Frame의 공간 관찰자 {#camera-scope-identity}

Camera는 stable identity, projection, optical parameters, transform, film-time state, target 또는 intent, clipping와 owning shot을 가져야 한다.

### Camera와 Shot {#camera-shot-distinction}

하나의 camera rig를 여러 shot이 사용할 수 있고 한 shot이 time-varying camera를 가질 수 있으므로 camera identity와 edit identity를 동일시하지 않아야 한다.

### Geometric Truth {#camera-geometric-truth}

Camera source의 projection과 transform이 deterministic frame geometry의 정본이며 repaint, crop preview와 설명문이 이를 바꾸지 않아야 한다.

### Authored Intent {#camera-authored-intent}

Subject, event, shot size, angle, movement, screen relation와 deliberate violation을 사용자와 저작 에이전트가 명시하고 engine이 dramatic intent를 임의 선택하지 않아야 한다.

### Missing Camera {#camera-missing-refusal}

필수 subject와 event를 볼 수 있는 camera가 없거나 invalid projection이면 default origin camera로 render를 성공시키지 않아야 한다.
