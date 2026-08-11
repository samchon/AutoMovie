# Entity, Activity, Actor와 Lineage

## Typed lineage graph {#evp-typed-lineage-graph}

### Entity revision model {#evp-entity-revision-model}

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-readable-lineage entity, activity와 actor 사이의 사용·생성·파생·귀속·인계·무효화 관계를 시스템 graph로 정의한다. -->

Lineage 입력은 versioned entity, activity와 actor node 및 typed edge다. 출력 graph는 각 node의 stable identity와 revision, edge direction, role, effective time과 source record를 보존하고, entity와 activity 또는 실제 actor와 책임 role을 같은 node로 합치지 않아야 한다.

`used`, `generated`, `derivedFrom`, `revisionOf`, `attributedTo`, `transferredTo`와 `invalidatedBy` relation은 domain이 고정되어야 한다. 존재하지 않는 node, 허용되지 않은 endpoint 조합과 derivation cycle은 invalid이며 부분 graph로 보존하더라도 complete lineage로 표시해서는 안 된다.

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-entity-and-revision 원본, 중간 산출물, reference, evidence와 delivery의 revision 관계를 immutable entity로 구체화한다. -->

Entity 입력은 logical identity, revision identity, kind, content identity, provenance identity와 availability state다. Bytes 또는 meaning이 바뀌면 새 revision을 만들고 `revisionOf` relation으로 이전 revision을 가리키며, metadata-only 차이가 rights나 interpretation을 바꾸면 content digest가 같아도 별도 revision이어야 한다.

같은 bytes를 여러 source에서 얻은 entity는 content identity를 공유할 수 있지만 provenance revision을 합치지 않아야 한다. 이전 schema의 entity를 읽을 때 알려진 identity는 유지하고 새 kind나 field를 모르면 unavailable이 아니라 unsupported interpretation으로 보고해야 한다.

### Activity execution record {#evp-activity-execution-record}

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-activity-inputs-outputs activity의 시간, 입력, 출력, 설정과 실패 상태를 하나의 실행 record로 결속한다. -->

Activity 입력은 type, attempt identity, start time, declared inputs, settings, execution boundary와 responsible actor roles다. 상태는 planned, running, succeeded, failed, cancelled 또는 partial이며 종료 시점에 actual inputs, outputs, result와 end time을 append-only completion record로 출력해야 한다.

Succeeded activity만 generated output의 authoritative producer가 될 수 있다. Failed, cancelled 또는 partial activity의 output은 상태와 완전 범위를 명시하면 recovery evidence로 보존할 수 있지만 successful output으로 연결해서는 안 된다.

### Actor와 role binding {#evp-actor-role-binding}

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-agent-role-responsibility 사람, agent, tool, 조직과 provider의 실행·지시·승인·권리 역할을 분리한다. -->

Actor record는 actor kind, stable identity 또는 authorized pseudonym, version이나 organizational context와 disclosure class를 포함해야 한다. Activity relation은 executor, requester, operator, approver, publisher와 rights-holder role을 각각 결속하고 한 role의 존재로 다른 role을 추정하지 않아야 한다.

Actor identity를 공개할 수 없으면 restricted mapping을 두고 public graph에는 role과 pseudonym만 출력할 수 있다. Mapping 부재나 authority 불명은 권한 있는 approval로 승격할 수 없으며 actor kind 확장 시 unknown actor를 사람 또는 tool로 추정하지 않아야 한다.

### Primary와 derived source relation {#evp-primary-derived-source-relation}

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-primary-and-derived-source primary source, mirror, snapshot, 변환본, 편집본과 요약본의 관계를 보존한다. -->

Source entity는 primary, mirror, snapshot, transformed, edited 또는 summarized role을 선언하고 immediate parent와 가능한 earliest known source를 별도 relation으로 가져야 한다. Mirror나 snapshot의 locator가 더 가까워도 known creator, publisher와 upstream revision을 제거해서는 안 된다.

Primary 여부가 claim일 뿐 확인되지 않았으면 claimed-primary로 표시하고 supporting source record를 요구해야 한다. Source role을 모르는 legacy record는 unknown으로 유지하며 primary로 default하지 않아야 한다.

### Lineage gap representation {#evp-lineage-gap-representation}

<!-- @evidence requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps 알 수 없거나 접근 불가능한 parent, actor, time, 설정과 source를 명시적 gap으로 출력한다. -->

Missing relation은 expected role, downstream node, last verified ancestor, missing reason과 known time range를 가진 gap record로 표현해야 한다. 추정 후보는 candidate relation으로만 보존하고 verified edge에 포함하지 않아야 한다.

필수 gap이 있으면 completeness는 partial이며 complete lineage 판정을 거부해야 한다. 나중에 parent가 복구되면 recovery activity와 resolved relation을 추가하고 과거 gap record를 삭제하지 않아야 한다.
