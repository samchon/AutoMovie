# 조명 범위와 Identity

## Scene-referred Light 계약 {#lighting-scope-identity}

Light는 stable identity, source kind, geometry 또는 direction, transform, intensity, color 또는 spectrum, distribution, shadow, time state와 owning environment 또는 subject를 가져야 한다.

### Story와 Design Binding {#lighting-story-design-binding}

Light는 time of day, location, practical source, event, mood와 subject readability 중 어떤 의도에 답하는지 연결할 수 있어야 한다.

### Authored Input {#lighting-authored-input}

Sun direction, source placement, intensity와 color는 project가 소유하며 location name과 date에서 임의 기후·천문 사실을 자동 생성하지 않아야 한다.

### Light와 Appearance {#lighting-appearance-distinction}

Scene light, material emission, camera exposure, display transform, grade와 repaint appearance를 구분하고 한 단계의 보정을 다른 단계의 사실로 되돌려 쓰지 않아야 한다.

### Missing Light {#lighting-missing-refusal}

필수 subject가 어둡거나 source가 없는 practical을 default ambient wash로 덮어 완성된 lighting처럼 만들지 않아야 한다.
