# Headless와 Platform Determinism

## 같은 Production의 반복 Render {#rendering-headless-platform-determinism}

Headless와 interactive capture는 같은 deployed runtime contract, compiled input, film clock, scene lowering, camera, pass와 color 설정을 사용해야 한다. Supported platform 범위 안에서 결과의 의미, schedule과 content identity를 재현할 수 있어야 한다.

### Runtime Identity {#rendering-runtime-identity}

Renderer, browser 또는 graphics runtime, version, platform, device feature set, shader-like capability, font, image와 media decoder identity를 receipt에 기록해야 한다. Identity가 다른 실행의 byte equality나 review freshness를 근거 없이 상속해서는 안 된다.

### Windows와 POSIX {#rendering-cross-platform-paths}

Path separator, case sensitivity, sorting, locale, decimal formatting, newline, executable invocation과 reserved filename 차이가 source identity, schedule, output naming과 dependency discovery를 바꾸어서는 안 된다. Collision은 한쪽 platform에서만 덮어쓰게 두지 말고 공통 경계에서 거절해야 한다.

### Locale과 Time {#rendering-locale-time-determinism}

System locale, timezone, wall clock, daylight-saving transition과 random source는 render state나 artifact naming에 암묵적으로 참여해서는 안 된다. 필요한 seed, date 또는 locale은 declared input으로 고정해야 한다.

### Hardware Variation {#rendering-hardware-variation}

Exact byte 또는 pixel reproducibility가 보장되는 profile과 tolerance 기반 의미 재현만 보장되는 profile을 구분해야 한다. Tolerance는 channel, metric와 bound를 선언하고 hardware 차이를 이유로 missing subject, wrong identity 또는 temporal drift를 허용해서는 안 된다.

### Font와 Decoder Closure {#rendering-font-decoder-closure}

Text, captions와 external media가 frame에 영향을 주면 font 및 decoder dependency를 고정하고 availability를 render 전에 확인해야 한다. Platform fallback font, codec selection 또는 network fetch가 조용히 결과를 바꾸어서는 안 된다.

### Process Isolation과 Exit {#rendering-process-isolation}

Headless job은 previous session state, shared cache mutation, user profile과 interactive input에 의존하지 않아야 한다. Timeout, crash, cancellation과 nonzero exit는 output 존재 여부와 별개로 실패로 기록하고 child process 및 lock을 정리해야 한다.

### Cross-platform Evidence {#rendering-cross-platform-evidence}

재현성 주장은 compared runtime identities, exact input closure, compared frame과 metric을 포함해야 한다. 지원하지 않은 platform은 unsupported로 보고할 수 있지만 blank frame이나 달라진 frame을 successful variation으로 분류해서는 안 된다.

### Headless Refusal {#rendering-headless-refusal}

Required capture surface, requested pass capability, decoder, font, shader-like capability 또는 runtime identity가 없으면 capture를 시작하거나 blank frame을 성공으로 기록해서는 안 된다. Available products가 일부 있더라도 requested set은 partial이며 missing capability와 retry condition을 보고해야 한다.
