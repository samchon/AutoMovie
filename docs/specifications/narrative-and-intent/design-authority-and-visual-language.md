# 디자인 권위와 시각 언어 {#narrative-intent-design-authority-document}

## Production Design 정본 경계 {#narrative-intent-design-authority-boundary}

<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-scope 작품에 필요한 디자인 범위를 story use와 연결한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-source-ownership tracked design source와 입력 또는 evidence를 분리한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-source-authority scale, material, state와 identity 충돌의 owner를 드러낸다. -->

입력은 stable design identity, revision, author 또는 approver, 상태, 적용 scope와 story requirement이고 출력은 owning source와 authority가 명시된 current design snapshot이다. Reference, mood board, chat, derived drawing, asset, render와 review는 입력 또는 evidence이며 명시적 design decision 없이 정본을 바꾸지 않는다.

### Story와 Design 소유권 {#narrative-intent-story-design-ownership}

<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-story-boundary screenplay requirement와 production design decision의 소유 경계를 정한다. -->
<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-production-distinction 실현 교체에도 이야기 identity와 success condition을 보존한다. -->

Story는 필요한 장소, 대상, 사건과 변화 이유를 소유하고 design은 공유 visual language, scale, material, state, representation과 제작 범위를 소유한다. Design 편의를 위한 사건 삭제와 render 우연을 story fact로 승격하는 변경은 거절되고 story 변경은 별도 revision으로 처리된다.

### 필요한 범위와 Completeness {#narrative-intent-design-scope-completeness}

<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-necessary-scope visible, interactive, reflective, shadow, audible와 evidence scope를 분리한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-scope-completeness scene-required subject와 design purpose의 양방향 closure를 요구한다. -->

Design unit은 subject identity, 필요한 representation과 state, 사용 scene 또는 delivery purpose, viewing condition, interaction과 영향 scope를 가진다. 모든 required subject는 owner와 delivery plan을 가져야 하고 모든 design unit은 story, visual 또는 delivery consumer를 가져야 하며 영향 없는 세계 전체 detail은 필수 범위가 아니다.

### 상태, Unknown과 Refusal {#narrative-intent-design-status-unknown}

<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-status-approval design unit의 제안, 검토, 승인과 퇴역 상태를 구분한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-unknown-refusal 미정 선택과 unsupported fidelity를 임의 preset으로 채우지 않는다. -->

Design unit은 proposed, under-review, approved, rejected 또는 superseded 상태와 적용 variant를 가진다. Unknown은 owner, affected subject와 scene, 선택지, 필요한 자료, budget consequence와 blocking 여부를 출력하고 unsupported fidelity나 missing source를 placeholder detail로 감추지 않는다.

## Capability와 Content 경계 {#narrative-intent-design-capability-boundary}

<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-capability-content 일반 저작 capability와 완성 style catalogue를 분리한다. -->
<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-capability-content-boundary 예시를 새 작품의 정본 content로 사용하지 않는다. -->

시스템은 일반 형상, 재료, pattern, 외부 asset, composition, relation, validation과 example을 다룰 수 있지만 특정 시대, 성곽, 가구, 의상, 차량, 식생, palette나 historical style의 완성 kit를 약속하지 않는다. 예시 값은 기법 설명일 뿐 사용자 선택과 provenance 없는 design default가 아니다.

## Visual Language 상태 {#narrative-intent-visual-language-state}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction 반복 가능한 시각 원칙의 적용 범위와 결과를 정한다. -->
<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reasoned-choice 각 원칙을 story, era, environment 또는 constraint에 연결한다. -->

Visual rule은 stable identity, shape, proportion, palette, material character, contrast, density, aging, graphics 또는 composition 축, 적용 subject와 location, priority, 허용 variation, exception condition, reason과 observable outcome을 가진다. 단어와 adjective만 있고 design 선택이나 관찰 결과를 구분하지 못하면 invalid-rule이다.

### 공유 언어와 Variation {#narrative-intent-visual-language-variation}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-consistency-variation shared language와 faction, place 및 phase 차이를 함께 정의한다. -->
<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-phase-visual-language base identity와 시간 또는 story phase override를 분리한다. -->

Shared rule과 faction, character, place, time 또는 phase별 override는 공유 축과 달라지는 축, scope, selection rule과 seed 필요 여부를 명시한다. 모든 대상을 같은 색과 모양으로 만드는 것은 일관성 조건이 아니며 shot마다 새 palette를 만드는 것은 phase variation이 아니다.

### Reference Realization과 Drift {#narrative-intent-design-reference-realization}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-reference-realization reference observation을 구체적 design decision으로 변환한다. -->
<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-style-drift 편의적 변경과 승인된 예외를 구분한다. -->

Reference의 구체 observation은 geometry, material, pattern, light, dressing 또는 state decision과 consumer를 출력하고 source likeness나 전체 style 복제를 결과로 주장하지 않는다. 공유 규칙과 충돌한 변경은 affected scope와 approved exception이 없으면 style-drift finding이다.

### Hierarchy와 Viewing Condition {#narrative-intent-visual-hierarchy-viewing}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-visual-hierarchy hero, supporting, background와 landmark의 시각 priority를 정한다. -->
<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-viewing-conditions delivery raster, 거리, motion과 light에서 살아야 할 특징을 정한다. -->

각 subject 또는 effect는 hero, supporting, background, landmark와 같은 priority, 예상 raster, distance, movement와 lighting condition, silhouette, value, color, detail 및 motion contrast 목표를 가진다. 확대 concept에서만 보이는 detail이나 모든 요소가 같은 주목도를 요구하는 결과는 readability를 충족하지 않는다.

### Graphics와 승인된 예외 {#narrative-intent-graphics-style-exceptions}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-graphic-language 화면 내 text와 graphic의 언어, 권리 및 가독성을 요구한다. -->
<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-exceptions style rupture의 진입, 종료와 consequence를 기록한다. -->

Signage, symbol, emblem, map, interface와 typography는 language, script, scale, placement, legibility, rights와 world context를 가진다. Dream, archival 또는 intentional rupture는 exact scope, reason, entry와 exit condition과 continuity consequence가 있어야 하고 placeholder text와 생성된 unreadable glyph는 승인 design이 아니다.

### Visual Language Acceptance {#narrative-intent-visual-language-acceptance}

<!-- @evidence requirements/production-design/art-direction-and-visual-language.md#production-design-art-direction-acceptance representative current evidence에서 원칙과 결과의 일치를 판정한다. -->

Acceptance 출력은 representative subject와 location, phase, viewing condition, current evidence와 authority를 결속하여 shared rule, intentional variation과 hierarchy의 observable outcome을 판정한다. 미감의 유일한 정답은 만들지 않지만 선언한 rule과 current result의 불일치는 finding으로 남긴다.
