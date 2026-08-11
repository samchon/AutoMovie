# Repaint 범위와 선택권

## 사용자가 선택하는 Optional Rendition {#repaint-scope-user-choice}

사용자와 `automovie-mcp`를 사용하는 저작 에이전트는 deterministic delivery를 유지하거나 external repaint·image-to-image-like service로 별도 rendition을 만들지 선택할 수 있어야 한다.

### Provider 독립성 {#repaint-provider-independence}

AutoMovie는 특정 third-party API, model, vendor와 account를 필수 또는 기본으로 정하지 않고 사용자 소유 도구의 결과를 contract 안에서 채택할 수 있어야 한다.

### 구조와 Appearance {#repaint-structure-appearance}

Subject identity와 count, pose, contact, camera, layout, event order, screen direction와 timing은 deterministic source가 소유하고 repaint는 appearance만 보강해야 한다.

### 독립 Artifact {#repaint-independent-artifact}

Repaint output은 source frame과 다른 rendition identity, digest, provenance, review와 publication state를 가져야 한다.

### 자동 Routing 금지 {#repaint-no-automatic-routing}

Beauty가 부족하다는 heuristic, available API key와 provider 응답을 이유로 deterministic shot를 자동 repaint하지 않아야 한다.
