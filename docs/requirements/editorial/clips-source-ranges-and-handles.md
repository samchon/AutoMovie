# Clip, Source Range와 Handle

## Source 일부를 Film에 배치 {#editorial-clips-source-ranges-handles}

Clip은 source identity, available range, selected source range, film placement, enabled state와 media reference를 가져야 한다.

### Source와 Film Range {#editorial-source-film-range}

Source start·duration과 film start·duration을 분리하고 trim이 performance event와 state ledger의 어느 구간을 사용하는지 추적해야 한다.

### Handle {#editorial-clip-handles}

Transition, J-cut, L-cut와 revision에 사용할 head·tail handle을 available source range와 구분하여 요청할 수 있어야 한다.

### Missing와 Generated Media {#editorial-missing-generated-media}

External, missing, generated, image sequence와 placeholder reference를 구분하고 offline media를 검은 frame으로 몰래 완성하지 않아야 한다.

### Clip Refusal {#editorial-clip-refusal}

Source range 밖 trim, negative handle, stale digest, duration mismatch와 required event를 잘라낸 clip을 거부해야 한다.
