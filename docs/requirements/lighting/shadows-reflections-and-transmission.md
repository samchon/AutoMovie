# Shadow, Reflection과 Transmission

## Geometry와 Material에 답하는 Light Result {#lighting-shadows-reflections-transmission}

Shadow casting·receiving, reflection, transmission, refraction와 opacity는 light, resolved geometry, material, environment와 render mode의 같은 state를 읽어야 한다.

### Shadow Identity {#lighting-shadow-identity}

Source size, direction, bias 또는 tolerance, caster, receiver와 intended softness를 구분하고 unsupported shadow를 ambient darkening으로 흉내 내지 않아야 한다.

### Transparent Boundary {#lighting-transparent-boundary}

Glass, water, screen와 translucent material이 direct view, shadow, reflection와 transmitted light에 미치는 supported subset을 명시해야 한다.

### Evidence Pass {#lighting-structural-passes}

Beauty, depth, normal, mask, shadow와 other structural pass가 light와 material override를 어떻게 다루는지 선언하고 guide pass에 beauty-only environment가 새지 않아야 한다.

### Result Finding {#lighting-result-findings}

Light leak, detached shadow, wrong-side illumination, missing reflection, black transmission와 unsupported optical claim을 검토 가능한 finding으로 남겨야 한다.
