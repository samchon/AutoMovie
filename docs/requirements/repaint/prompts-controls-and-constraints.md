# Prompt, Control과 Structural Constraint

## Appearance를 요청하는 명시적 Input {#repaint-prompts-controls-constraints}

Repaint request는 positive prompt, optional negative prompt, seed 또는 provider control, strength-like bounded parameter, reference roles와 structural preservation requirements를 가져야 한다.

### Prompt Scope {#repaint-prompt-scope}

Prompt는 material, texture, atmosphere, lighting character, palette와 finish를 설명하고 subject count, pose, camera, contact와 timing을 바꾸라고 요구하지 않아야 한다.

### Stable Control {#repaint-stable-controls}

Control name, scalar 또는 structured value, adapter·model version와 supported range를 기록하고 provider default가 바뀌어도 request identity가 모호하지 않게 해야 한다.

### Negative Prompt {#repaint-negative-prompt}

Negative prompt는 concrete failure mode를 겨냥할 수 있으나 vast generic quality phrase로 structural validation을 대신하지 않아야 한다.

### Request Refusal {#repaint-request-refusal}

Blank prompt, non-finite control, out-of-range strength, missing reference와 structure 변경을 요구하는 conflict를 거부해야 한다.
