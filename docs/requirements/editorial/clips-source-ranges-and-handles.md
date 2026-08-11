# Clip, Source Range와 Handle

## Source 일부를 Film에 배치 {#editorial-clips-source-ranges-handles}

Clip은 stable identity, source identity와 revision, available source range, selected source range, film placement, rate relation, enabled state와 media reference를 가져야 한다. 같은 source를 여러 번 사용하면 각 placement는 별도 identity를 가지면서 공통 source lineage를 유지해야 한다.

### Source와 Film Range {#editorial-source-film-range}

Source start와 duration은 film start와 duration에서 분리되어야 한다. Trim과 retime 뒤에도 어느 source event와 state가 관객에게 보이는지 추적할 수 있어야 하며 placement 수정이 source range를 암묵적으로 바꾸어서는 안 된다.

### Handle {#editorial-clip-handles}

Head와 tail handle은 available source range 안에서 selected range 밖에 남은 실제 시간으로 계산되어야 한다. Transition, J-cut, L-cut과 revision 요청은 필요한 handle 양과 소비 방향을 밝히고, 부족한 handle을 freeze나 반복으로 자동 보충해서는 안 된다.

### Retime과 Direction {#editorial-clip-retime-direction}

Constant speed, supported variable speed, hold와 reverse는 source-to-film mapping과 audio 처리 여부를 명시해야 한다. Duration 변화, sample 경계와 event 순서는 결정적이어야 하며 지원하지 않는 retime을 정상 속도로 조용히 대체해서는 안 된다.

### Missing과 Generated Media {#editorial-missing-generated-media}

External, missing, generated, image sequence와 provisional media reference를 구분해야 한다. Offline media는 stable placeholder와 expected facts를 유지할 수 있지만 검정 frame이나 silence를 실제 source로 위장하여 final conform을 완료해서는 안 된다.

### Proxy와 Replacement {#editorial-clip-replacement}

Proxy 또는 대체 media는 원 source identity, selected range, frame 또는 sample mapping과 channel relation을 증명해야 한다. Replacement가 duration이나 content lineage를 바꾸면 기존 clip을 그대로 current로 유지하지 말고 새 revision 또는 명시적 incompatibility를 만들어야 한다.

### Clip Boundary Result {#editorial-clip-boundary-result}

Clip의 첫 sample과 end-exclusive 뒤 첫 sample에서 어느 source가 picture와 sound에 기여하는지 판정할 수 있어야 한다. Gap, cut, overlap과 transition 경계에서 동일 sample이 중복 재생되거나 누락되지 않아야 한다.

### Clip Refusal {#editorial-clip-refusal}

Available range 밖의 trim, negative handle, stale digest, duration mismatch, missing required event, ambiguous rate와 invalid reference는 거절해야 한다. Batch 처리에서는 유효한 clip과 invalid clip을 각각 보고하되 invalid clip을 뺀 timeline을 원래 cut의 성공 결과로 간주해서는 안 된다.
