# Practical과 Local Light

## 화면 속 Source와 실제 방출의 일치 {#lighting-practicals-local}

Lamp, candle, screen, sign, fire, vehicle light, window와 project-defined practical은 visible geometry, emissive appearance, emitted light, control와 current state를 연결할 수 있어야 한다.

### Host와 Attachment {#lighting-practical-host}

Practical은 building, interior, vehicle, prop, actor 또는 map support의 named attachment, local transform와 power 또는 fuel state를 가져야 한다.

### On-screen Consistency {#lighting-practical-consistency}

Visible bulb나 flame이 off이면 emitted light도 꺼지고, source 밖 light가 필요하면 off-screen 또는 motivated source identity를 따로 가져야 한다.

### Flicker와 Failure {#lighting-flicker-failure}

Flicker, pulse, dim, outage, ignition와 color change를 bounded curve, seed와 event로 표현하고 frame마다 nondeterministic noise를 사용하지 않아야 한다.

### Practical Refusal {#lighting-practical-refusal}

Host 없는 light, source geometry와 다른 위치, contradictory state, unsupported distribution와 unbounded flicker를 거부해야 한다.
