# Shadow, Reflection과 Transmission

## Geometry와 Material에 답하는 Light Result {#lighting-shadows-reflections-transmission}

Shadow casting·receiving, reflection, transmission, refraction와 opacity는 light, resolved geometry, material, environment와 render mode의 같은 state를 읽어야 한다.

### Shadow Identity {#lighting-shadow-identity}

Source size, direction, bias 또는 tolerance, caster, receiver와 intended softness를 구분하고 unsupported shadow를 ambient darkening으로 흉내 내지 않아야 한다.

### Shadow Sampling {#lighting-shadow-time-sampling}

Moving source, caster, receiver, opening와 deformation은 같은 fixed-clock sample과 geometry revision에서 shadow를 만들고 sample 사이의 contact loss와 detached shadow를 critical interval에서 검토해야 한다.

### Reflection Identity {#lighting-reflection-identity}

Mirror, glossy surface, water와 metal의 reflection은 source environment 또는 local light, reflecting surface, reflected subject, view camera, update policy와 supported approximation을 식별해야 한다.

### Transparent Boundary {#lighting-transparent-boundary}

Glass, water, screen와 translucent material이 direct view, shadow, reflection와 transmitted light에 미치는 supported subset을 명시해야 한다.

### Optical Approximation {#lighting-optical-approximation}

Reflection probe, screen-space result, authored field, simplified transmission와 omitted refraction은 적용 범위, known artifact와 실패가 드러나는 camera·geometry condition을 밝혀 full light transport로 오인되지 않아야 한다.

### Evidence Pass {#lighting-structural-passes}

Beauty, depth, normal, mask, shadow와 other structural pass가 light와 material override를 어떻게 다루는지 선언하고 guide pass에 beauty-only environment가 새지 않아야 한다.

### Result Finding {#lighting-result-findings}

Light leak, detached shadow, wrong-side illumination, missing reflection, black transmission와 unsupported optical claim을 검토 가능한 finding으로 남겨야 한다.

### Intentional Optical Break {#lighting-intentional-optical-break}

Story readability를 위해 shadow, reflection 또는 transmission 관계를 의도적으로 바꾸면 affected source·surface·camera·interval, reason, expected visual cue와 acceptance를 기록하고 물리 분석 pass로 보고하지 않아야 한다.
