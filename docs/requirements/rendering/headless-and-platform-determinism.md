# Headless와 Platform Determinism

## 같은 Production의 반복 Render {#rendering-headless-platform-determinism}

Headless와 interactive viewer는 같은 deployed runtime, scene lowering, clock, camera와 pass contract를 사용하고 같은 supported platform에서 reproducible result를 만들어야 한다.

### Runtime Identity {#rendering-runtime-identity}

Renderer, browser 또는 graphics runtime, version, platform, feature set, font와 decoder identity를 receipt에 기록해야 한다.

### Windows와 POSIX {#rendering-cross-platform-paths}

Path, case, separator, sort, locale, newline와 executable invocation 차이가 source identity, frame schedule와 output naming을 바꾸지 않아야 한다.

### Hardware Variation {#rendering-hardware-variation}

정확한 pixel reproducibility가 보장되는 범위와 hardware-dependent result를 구분하고 tolerance 또는 unsupported condition을 명시해야 한다.

### Headless Refusal {#rendering-headless-refusal}

Canvas, pass hook, decoder, font, shader-like feature와 runtime identity가 없으면 blank frame을 성공으로 기록하지 않아야 한다.
