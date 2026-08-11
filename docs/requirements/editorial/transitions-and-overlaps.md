# Transition과 Overlap

## 두 Source 사이의 시간 관계 {#editorial-transitions-overlaps}

Cut, dissolve, fade, wipe-like supported transition, audio crossfade와 project-defined transition을 incoming·outgoing source, overlap range, curve와 presentation result로 표현할 수 있어야 한다.

### Handle Consumption {#editorial-transition-handles}

Transition duration은 양 clip의 available handle을 실제로 소비하고 timeline duration과 source sampling에 반영되어야 한다.

### Picture와 Sound Transition {#editorial-picture-sound-transition}

Picture transition, audio fade, ambience continuation와 music bridge를 독립적으로 저작할 수 있고 하나의 transition name이 모든 track을 자동 바꾸지 않아야 한다.

### Transition Timing {#editorial-transition-timing}

Start, center, end, curve와 boundary sample을 rational time으로 고정하여 frame rate와 seek order에 따라 blend가 달라지지 않아야 한다.

### Transition Refusal {#editorial-transition-refusal}

Handle 부족, negative overlap, incompatible layer, missing side와 unsupported effect를 hard cut로 몰래 대체하지 않아야 한다.
