# Render 검증

## Planned Output에서 Current Pixel까지 {#rendering-validation}

Render 검증은 source identity, schedule, runtime, lowered state, expected frame set, pass와 channel, pixel content, encode receipt와 published media facts를 단계별로 확인해야 한다. 모든 verdict는 exact input identity, product, frame range와 validation method를 가져야 한다.

### Schedule와 Set Closure {#rendering-schedule-set-validation}

Expected frame, pass, view와 product가 정확히 한 번씩 materialize되었는지 확인해야 한다. Missing, duplicate, extra, stale와 wrong-numbered output을 각각 구분하고 directory count만으로 closure를 판단해서는 안 된다.

### Nonblank와 Expected Content {#rendering-nonblank-expected-content}

Frame dimensions, alpha, finite channel values, pixel variance, required mask identity, expected subjects와 camera relation을 확인해야 한다. Nonblank라는 사실만으로 correct frame을 증명하지 말고 blank, uniform, missing layer, wrong camera와 stale repeated frame을 구분해야 한다.

### Multi-time와 Multi-pass {#rendering-multitime-multipass}

Start, middle, end, semantic event, cut와 transition boundary의 beauty 및 관련 structural pass를 함께 검사해야 한다. 한 frame이나 beauty pass만으로 motion, state transition 또는 identity coverage를 주장해서는 안 된다.

### Determinism Check {#rendering-determinism-check}

같은 declared input을 clean execution, direct seek, subrange 또는 retry로 render하여 profile이 약속한 exact 또는 tolerance 기준으로 비교할 수 있어야 한다. Runtime identity가 다르면 차이를 숨기지 말고 supported comparison 범위를 기록해야 한다.

### Byte와 Media Probe {#rendering-byte-media-probe}

Frame digest, count, container, streams, codec, timestamps, duration, frame rate, dimensions, channel, color와 audio facts를 실제 output bytes에서 다시 읽어 plan과 비교해야 한다. Receipt만 재검사하거나 extension에서 codec을 추정해서는 안 된다.

### Visual Review {#rendering-visual-review}

Actual deployed viewer 또는 final decoded media에서 composition, motion, lighting, material, transparency, effect, continuity와 ending state를 artifact 자체로 검토해야 한다. Numeric test나 source inspection을 visual review 대신 실행했다고 주장해서는 안 된다.

### Negative와 Boundary Validation {#rendering-negative-boundary-validation}

첫 frame, end-exclusive 경계, chunk boundary, transition, multiple pass, missing texture, wrong camera, corrupt output와 failed encode가 각각 기대한 상태로 실패하는지 확인해야 한다. Error fallback은 final-capable output과 명확히 구분되어야 한다.

### Partial Result와 Recovery {#rendering-validation-recovery}

성공한 independent frame 또는 product의 evidence는 보존할 수 있지만 failed, unsupported와 not-run 범위를 포함한 전체 verdict는 partial이어야 한다. Input 수정 후 dependency relation에 따라 필요한 단계만 다시 실행하고 stale downstream review를 명시해야 한다.

### Result Status {#rendering-validation-status}

Planned, scheduled, rendering, partially-materialized, materialized, probed, reviewed, failed, unsupported와 not-run을 구분해야 한다. Path, file count 또는 이전 성공 receipt만으로 current success를 보고해서는 안 된다.

### Validation Refusal {#rendering-validation-refusal}

Expected identity, scope, product closure, comparison profile 또는 review freshness가 모호하면 pass를 만들지 말아야 한다. 자동 복구로 설정을 바꾼 결과는 원 요청이 아니라 별도 candidate product로 검증해야 한다.
