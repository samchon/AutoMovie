# Retry, Seed와 Variation

## 매 실행을 독립 Result로 취급 {#repaint-retries-seeds-variation}

Retry와 reroll은 같은 request라도 새 attempt identity와 status를 가져야 하며, output이 생겼다면 그 bytes, digest와 review를 해당 attempt에 묶어야 한다.

### Immutable request와 새 variation {#repaint-retry-request-boundary}

같은 request의 transport retry와 같은 control의 reroll을 구분하고 prompt, reference, model, seed 또는 structural control을 바꾸면 새 request identity를 만들어야 한다.

### Seed 의미 {#repaint-seed-semantics}

Seed는 provider request의 한 control이며 model, scheduler, service implementation와 references가 고정되지 않으면 result reproducibility의 충분조건이 아니어야 한다.

### Retry budget과 중단 {#repaint-retry-budget-stop}

사용자는 최대 attempt, 시간과 비용 한도, retry 가능한 failure, backoff, cancellation과 acceptance stop condition을 정할 수 있어야 하며 한도를 넘은 자동 재시도를 거부해야 한다.

이 policy는 외부 실행 전에 완전히 고정한다. Attempt별 timeout, request 전체 elapsed ceiling, metered cost ceiling과 attempt 수 중 하나라도 소진되면 더 호출하지 않으며, retry 간 지연은 attempt 순서에 대응하는 결정론적 값이어야 한다. Valid candidate 하나가 생기면 acceptance stop이 즉시 작동하여 남은 retry budget을 소비하지 않는다.

### Candidate 비교 {#repaint-candidate-comparison}

여러 output을 common source, request와 structural metric 아래 비교하고 각 failure, visual difference와 selection reason을 기록할 수 있어야 한다.

### Attempt failure provenance {#repaint-attempt-failure-provenance}

Timeout, rate limit, provider refusal, invalid media, cancellation과 partial output은 attempt별 status와 available receipt를 보존하되 accepted rendition이나 successful output으로 가장하지 않아야 한다.

Request identity는 transport attempt보다 상위에 있고, terminal attempt는 request identity, attempt identity와 순서, 시작·종료 UTC instant, provider·model identity, seed control, source·reference·request digest, cost, failure class·retryability와 available output digest를 보존한다. 자동 retry는 이 request identity를 유지하고, reroll은 control이 우연히 같아도 새 request identity를 만든다.

### One Accepted Lineage {#repaint-one-accepted-lineage}

하나의 selected rendition만 current publication lineage에 들어가고 rejected candidate의 review와 digest를 selected output에 섞지 않아야 한다.

검증된 output을 쓰는 transaction은 immutable candidate와 attempt만 추가하고 active pointer를 바꾸지 않는다. Selection과 reversal은 generator를 호출하지 않는 별도 transaction이며, current source·request·adoption·candidate bytes와 기존 pointer snapshot을 다시 검증한 뒤에만 새 selection record와 pointer를 함께 publish한다.

### Retry Refusal {#repaint-retry-refusal}

이전 output을 새 attempt로 가장하거나 provider error, partial bytes, wrong dimensions와 missing receipt를 successful reroll로 기록하지 않아야 한다.
