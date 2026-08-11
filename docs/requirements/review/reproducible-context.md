# 재현 가능한 검토 Context

## 같은 결과를 다시 열 수 있는 검토 맥락 {#review-reproducible-context}

검토 기록은 다른 검토자가 같은 대상을 다시 열고 같은 시간 위치와 비교 기준에서 판정의 근거를 확인할 수 있을 만큼 검토 맥락을 보존해야 한다.

### Source와 Artifact Identity {#review-context-source-artifact-identity}

검토 대상의 project, source, asset, take, edit, render와 delivery identity를 구분하고 파생 결과가 어느 입력과 version에서 나왔는지 추적할 수 있어야 한다.

### 시간과 재생 조건 {#review-context-time-playback}

Frame rate, timebase, frame 또는 time range, 재생 속도, 반복 여부와 audio 동기 조건을 보존하여 같은 순간과 같은 구간을 다시 검토할 수 있어야 한다.

### 표시와 청취 조건 {#review-context-presentation}

판정에 영향을 주는 image size, crop, color와 display profile, channel과 loudness, language와 accessibility track을 식별하고 proxy, thumbnail 또는 muted playback을 원본 검토와 구분해야 한다.

### 기준과 Reference Identity {#review-context-criteria-reference}

적용한 acceptance criterion, tolerance, 비교 대상과 reference의 identity와 version을 남기고 reference가 바뀌면 이전 판정의 근거와 새 근거를 구분해야 한다.

### 다시 열 수 없는 맥락 {#review-context-unavailable}

대상이나 필수 맥락을 다시 열 수 없으면 검토를 재현 가능하다고 주장하지 않아야 하며 누락된 조건과 판정에 미치는 영향을 표시해야 한다.
