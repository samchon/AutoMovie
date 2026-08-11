# Budget, Safety와 검증

## 실행 가능한 Staging Bound {#staging-budgets-safety-validation}

Shot duration, subject, actor, formation, path, interaction, event, light, effect, collider와 review sample의 worst-case bound를 선언하고 report해야 한다.

### Validation Context {#staging-validation-context}

각 검증 결과는 staging plan, source scene, production design revision, resolved geometry revision, take, film-time range, camera, tolerance와 수행한 검사 수준을 식별하여 다른 조건의 pass를 재사용하지 않아야 한다.

### Spatial Validation {#staging-spatial-validation}

Mark, subject placement, path, contact, clearance, terrain, opening, camera lane와 zone을 resolved location geometry에서 검증해야 한다.

### Temporal Validation {#staging-temporal-validation}

Event order, performance range, contact, state handoff, sound emission와 shot boundary를 fixed clock에서 시작·내부·종료 sample로 확인해야 한다.

### Deterministic Replay {#staging-deterministic-replay}

같은 source, revision, seed, timebase, take와 review samples는 evaluation 순서와 이전 playback history에 관계없이 같은 placements, events, contacts, findings와 frame state를 만들어야 한다.

### Positive, Negative와 Boundary {#staging-validation-twins}

Critical blocking, zone, path, contact, visibility, handoff와 budget rule은 성립하는 사례, 한 조건만 깨뜨린 negative twin과 exact boundary를 구분해 검토할 수 있어야 한다.

### Safety State {#staging-authored-safety-state}

Fall edge, impact, weapon proxy, vehicle route, fire, water와 crowd density의 authored safety zone과 visual effect를 표현할 수 있으나 전문 stunt safety를 검증했다고 주장하지 않아야 한다.

### Viewer Review {#staging-viewer-review}

Actual viewer에서 subject count, blocking, contact, occlusion, scale, action readability와 state consequence를 critical time에 확인하고 source 변경 뒤 current capture로 다시 검토해야 한다.

### Failure 상태 {#staging-failure-status}

Compile failure, geometric failure, acceptance failure, unsupported analysis와 not-run visual review를 구분하고 numeric pass만으로 연출 성공을 주장하지 않아야 한다.
