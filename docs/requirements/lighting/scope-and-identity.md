# 조명 범위와 Identity

## Scene-referred Light 계약 {#lighting-scope-identity}

Light는 stable identity, source kind, geometry 또는 direction, transform, intensity, color 또는 spectrum, distribution, shadow, time state, owning environment 또는 subject와 적용되는 design revision을 가져야 한다.

### Story와 Design Binding {#lighting-story-design-binding}

Light는 time of day, location, practical source, event, mood와 subject readability 중 어떤 의도에 답하는지 연결할 수 있어야 한다.

### Source Trace {#lighting-upstream-source-trace}

각 light와 environment state는 자신이 실현하는 story scene·event, production design location·palette·material·phase, staging mark·practical·cue와 camera delivery를 직접 식별하고 이름 유사성이나 현재 frame에서 관계를 역추정하지 않아야 한다.

### Spatial Binding {#lighting-spatial-binding}

Source, filter, portal, caster, receiver, reflective·transmissive surface와 analysis point는 같은 coordinate frame, unit, resolved geometry revision와 film-time sample을 읽어야 한다.

### Authored Input {#lighting-authored-input}

Sun direction, source placement, intensity와 color는 project가 소유하며 location name과 date에서 임의 기후·천문 사실을 자동 생성하지 않아야 한다.

### Light와 Appearance {#lighting-appearance-distinction}

Scene light, material emission, camera exposure, display transform, grade와 repaint appearance를 구분하고 한 단계의 보정을 다른 단계의 사실로 되돌려 쓰지 않아야 한다.

### Lighting Branch {#lighting-branch-identity}

Base setup, scene phase, shot override와 alternative take는 공통 source와 독립 identity, precedence, 유효 interval과 차이를 가져야 하며 어느 순간의 effective lighting state가 하나로 추적되어야 한다.

### Missing Light {#lighting-missing-refusal}

필수 subject가 어둡거나 source가 없는 practical을 default ambient wash로 덮어 완성된 lighting처럼 만들지 않아야 한다.
