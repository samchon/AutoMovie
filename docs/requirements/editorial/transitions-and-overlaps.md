# Transition과 Overlap

## 두 Source 사이의 시간 관계 {#editorial-transitions-overlaps}

Cut, dissolve, fade, supported wipe-like transition과 audio crossfade는 transition identity, incoming과 outgoing source, film range, source handle consumption, curve와 affected tracks를 명시해야 한다. Transition은 두 clip 사이의 표시 관계이며 원본 clip의 내용을 변경해서는 안 된다.

### Handle Consumption {#editorial-transition-handles}

Transition duration은 양쪽 clip의 available handle에서 실제로 소비되는 source range와 일치해야 한다. 한쪽만 필요한 fade와 양쪽이 필요한 overlap을 구분하고 handle이 부족할 때 duration을 몰래 줄이거나 source 끝을 반복해서는 안 된다.

### Picture와 Sound Transition {#editorial-picture-sound-transition}

Picture transition, dialogue fade, ambience continuation과 music bridge는 독립된 edit point와 curve를 가질 수 있어야 한다. 하나의 transition 이름이 모든 track을 같은 시각에 자동 변경해서는 안 되며 적용되지 않는 track은 그대로 유지되어야 한다.

### Transition Timing {#editorial-transition-timing}

Start, center 또는 end alignment, duration, sample positions와 curve evaluation은 rational film time으로 고정되어야 한다. Seek 방향, preview 시작점, chunk 경계나 frame rate 변환에 따라 같은 transition의 blend 값이 달라져서는 안 된다.

### Overlap Composition {#editorial-overlap-composition}

Overlap 동안 어느 source가 활성화되고 picture alpha, matte, audio gain과 metadata가 어떻게 결합되는지 관찰할 수 있어야 한다. 세 개 이상의 source가 겹치면 pairwise transition의 적용 순서와 stack order가 하나의 결과를 결정해야 한다.

### Boundary Samples {#editorial-transition-boundary-samples}

Transition 시작 직전, 시작, 종료 직전과 종료 sample에서 incoming과 outgoing 기여의 포함 규칙을 명시해야 한다. Zero-duration transition은 cut과 동일하게 처리하거나 거절해야 하며 별도의 모호한 상태를 만들면 안 된다.

### Partial Transition State {#editorial-transition-partial-state}

한쪽 media가 offline이거나 필요한 effect가 unavailable이면 transition은 incomplete 또는 unsupported로 남아야 한다. 이용 가능한 한쪽만 출력한 preview는 diagnostic용 partial 결과임을 표시하고 승인 가능한 final cut으로 사용해서는 안 된다.

### Transition Refusal {#editorial-transition-refusal}

Handle 부족, negative overlap, missing side, incompatible layer, invalid curve, identity collision과 unsupported effect는 hard cut으로 몰래 대체하지 말고 거절해야 한다. 오류는 transition identity, affected range, 필요한 handle과 실제 handle을 함께 보고해야 한다.
