# 편집 검증

## Timeline 구조에서 완성 Film까지의 검증 {#editorial-validation}

편집 검증은 rational time, source range, track composition, transition, picture와 sound relation, conform 상태, story coverage, continuity, duration과 선택된 revision을 단계별로 확인해야 한다. 각 단계는 검사한 exact input identity와 범위를 기록해야 한다.

### Structural Validation {#editorial-structural-validation}

Gap, overlap, source overflow, handle shortage, cycle, duplicate identity, missing media, invalid track, ambiguous order와 duration mismatch를 canonical diagnostic으로 보고해야 한다. 같은 입력은 diagnostic identity, order, severity와 location도 같아야 한다.

### Story Coverage {#editorial-story-coverage}

Required scene, beat, semantic event, reaction과 state consequence가 selected source range 및 presentation order에 포함되는지 확인할 수 있어야 한다. 이름만 존재하거나 trim 밖에 있는 사건을 covered로 세어서는 안 된다.

### Sequence Review {#editorial-sequence-review}

연속 clip의 rhythm, transition, screen relation, sound continuity와 information order는 assembled sequence의 현재 revision에서 검토해야 한다. 개별 shot이 승인되었더라도 연결부 검토를 생략해서는 안 된다.

### Film Review {#editorial-film-review}

전체 film의 story arc, pacing, audiovisual continuity, beginning과 ending state, language와 accessibility relation은 selected cut의 시작부터 끝까지 검토해야 한다. Sample review는 선언된 protocol과 coverage를 기록해야 하며 full review로 오인되면 안 된다.

### Boundary와 Negative Cases {#editorial-validation-boundaries}

Timeline start와 end, cut 직전과 직후, transition 양 끝, nested range, zero-duration marker, offline source와 stale revision을 포함한 경계를 검증해야 한다. Missing clip, extra overlap, wrong range와 corrupt reference가 각각 실패하는 negative case를 유지해야 한다.

### Partial Validation과 Recovery {#editorial-validation-recovery}

검증 중 일부 단계가 실패하거나 실행되지 않았으면 성공한 단계와 그 input identity는 보존할 수 있지만 종합 verdict는 partial 또는 failed여야 한다. 수정 뒤에는 영향받는 단계와 downstream evidence만 stale로 만들고 재실행 범위를 명시해야 한다.

### Result Status {#editorial-validation-status}

Draft, structurally-valid, conformed, rendered, probed, reviewed, failed, unsupported와 not-run을 구분해야 한다. Timeline 파일, output path 또는 이전 성공 receipt의 존재만으로 finished film이나 current review를 주장해서는 안 된다.

### Validation Refusal {#editorial-validation-refusal}

Input identity, selected revision, validation scope 또는 required evidence가 모호하면 pass를 만들지 말아야 한다. 오류를 자동 수정한 결과는 원 요청의 검증 성공이 아니라 별도 candidate revision으로 제시해야 한다.
