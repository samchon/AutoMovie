# Retry, Seed와 Variation

## 매 실행을 독립 Result로 취급 {#repaint-retries-seeds-variation}

Retry와 reroll은 같은 request라도 새 attempt identity와 status를 가져야 하며, output이 생겼다면 그 bytes, digest와 review를 해당 attempt에 묶어야 한다.

### Immutable request와 새 variation {#repaint-retry-request-boundary}

같은 request의 transport retry와 같은 control의 reroll을 구분하고 prompt, reference, model, seed 또는 structural control을 바꾸면 새 request identity를 만들어야 한다.

### Seed 의미 {#repaint-seed-semantics}

Seed는 provider request의 한 control이며 model, scheduler, service implementation와 references가 고정되지 않으면 result reproducibility의 충분조건이 아니어야 한다.

### Retry budget과 중단 {#repaint-retry-budget-stop}

사용자는 최대 attempt, 시간과 비용 한도, retry 가능한 failure, backoff, cancellation과 acceptance stop condition을 정할 수 있어야 하며 한도를 넘은 자동 재시도를 거부해야 한다.

### Candidate 비교 {#repaint-candidate-comparison}

여러 output을 common source, request와 structural metric 아래 비교하고 각 failure, visual difference와 selection reason을 기록할 수 있어야 한다.

### Attempt failure provenance {#repaint-attempt-failure-provenance}

Timeout, rate limit, provider refusal, invalid media, cancellation과 partial output은 attempt별 status와 available receipt를 보존하되 accepted rendition이나 successful output으로 가장하지 않아야 한다.

### One Accepted Lineage {#repaint-one-accepted-lineage}

하나의 selected rendition만 current publication lineage에 들어가고 rejected candidate의 review와 digest를 selected output에 섞지 않아야 한다.

### Retry Refusal {#repaint-retry-refusal}

이전 output을 새 attempt로 가장하거나 provider error, partial bytes, wrong dimensions와 missing receipt를 successful reroll로 기록하지 않아야 한다.
