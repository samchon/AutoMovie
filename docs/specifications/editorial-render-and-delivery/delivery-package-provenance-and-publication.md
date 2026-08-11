# Delivery package, provenance와 publication

## Contract units {#spec-delivery-package-provenance-publication-contract-units}

### Safe package와 manifest closure {#spec-delivery-package-safety}
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-packages-manifests-dependencies Delivery package dependency closure를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-manifest-identity Canonical manifest identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-safe-relative-paths Relative path safety를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-external-references External reference boundary를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-archive-expansion Archive expansion bound를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-assembly Deterministic assembly를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-partial-recovery Partial package recovery를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-refusal Unsafe package 거절 조건을 정밀화한다. -->

Package manifest는 film product, streams, captions, accessibility assets, sequences, required dependencies, validation과 provenance receipts 각각의 stable role, normalized relative path, media facts, size, byte digest, source identity, required 상태와 publication version을 canonical order로 기록한다. Manifest 자체도 canonical identity와 digest를 가지며 package 밖 undeclared local·remote state를 소비하지 않는다.

Path validation은 absolute path, parent traversal, empty·reserved·invalid segment, control character, case-insensitive collision, duplicate와 link-like escape를 거절하고 resolved target이 package root 안인지 descriptor 또는 동등한 identity-fenced read로 확인한다. External reference는 self-contained bytes나 missing과 구분하고 immutable identity, allowed access와 availability boundary를 가진다. Archive는 entry count, individual·total expanded size, nesting과 entry type을 추출 전에 검사한다.

Assembly는 isolated destination에서 canonical inventory를 쓰고 모든 bytes를 다시 읽어 digest와 dependency closure를 확인한다. Failure 때 expected, verified, missing, invalid와 reusable items 및 temporary state를 보고하고 stale manifest를 재사용하지 않는다. Duplicate·escaping path, digest mismatch, missing required artifact, undeclared dependency, expansion 초과와 unsupported entry는 complete 또는 safe 상태를 거절한다.

### Provenance, integrity와 disclosure {#spec-delivery-provenance-integrity}
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-integrity-provenance-authenticity Source에서 delivery까지 derivation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-entities-activities Entity, activity와 responsibility를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-canonical-digest Canonical digest 의미를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-revision-invalidation Revision과 evidence invalidation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-generative-provenance Generative와 external transformation 계보를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-signature-verification Signature verification 경계를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-disclosure Public disclosure와 secret 경계를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-authenticity-claim-boundary Authenticity claim 한계를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-partial Partial lineage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-integrity-refusal Integrity failure 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-derivation-chain Optional rendition의 source부터 selected output까지 별도 derivation을 보존한다. -->

Provenance graph는 source production, compile, edit, conform, deterministic render, optional external rendition, mix, translation, encode, package, review와 publication의 entity·activity·responsible party를 분리하고 input-output digest edge로 연결한다. Omitted stage는 not-run 또는 not-applicable이다. Tool operator와 creative approver를 하나의 author field로 합치지 않고, revision 변경은 superseded record를 삭제하지 않은 채 downstream freshness와 replacement relation으로 남긴다.

Structured record는 canonical serialization identity를, binary는 byte digest를, dependency set은 complete closure를 사용한다. External transformation은 submitted input, provider 또는 operator, settings, returned bytes, receipt와 adoption decision을 별도 activity로 기록하고 deterministic source의 검증을 상속하지 않는다. Signature-like record는 signed bytes·manifest identity, signer, method, result와 trust boundary를 구분한다.

Public record는 credential, secret, private locator, absolute host path와 불필요한 personal data를 제외하되 required derivation edge와 verification 결과를 모호하게 만들지 않는다. Digest와 signature는 bytes와 declared history의 결속만 증명하고 품질, 권리, 사실성 또는 승인 권한을 자동 증명하지 않는다. Missing ancestor, digest mismatch, invalid signature, mutable source와 contradictory activity order는 verified 상태를 거절하며 known graph와 missing edge는 partial lineage로 보존한다.

### Atomic publication, readback와 retention {#spec-delivery-publication-retention}
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-retention 검증 뒤 atomic publication을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-candidate-published Candidate와 published 상태를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-preconditions Publication precondition 재검사를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-concurrent-publication Concurrent publication을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-atomicity Atomic visibility와 retry를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-published-verification Destination readback을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-state-change Supersede, withdraw와 rollback을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-retention-cleanup Retention과 cleanup eligibility를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-retention-deletion Deletion evidence를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-refusal Unsafe publication 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-publication-atomicity 승인된 한 version의 artifact만 게시하는 acceptance 경계를 소비한다. -->

Publication state는 temporary, partial, candidate, selected, publishing, published, superseded, withdrawn와 failed를 구분한다. 시작 직전 expected profile revision, selected edit, package·artifact digest, current probe·review·accessibility validation, approvals와 destination identity를 다시 읽고 모두 일치할 때만 immutable version slot을 예약한다. Concurrent publisher는 expected current revision과 exclusive ownership 또는 compare-and-publish precondition을 사용한다.

Bytes와 manifest는 public current와 분리된 destination에서 완전하게 전송·검증된 뒤 한 version으로 visible해진다. Interrupted upload, partial copy 또는 manifest-only update는 current가 아니며 verified bytes는 exact identity 아래 retry에 재사용할 수 있다. Publication 후 destination에서 artifact와 manifest identity, size, digest를 다시 읽고 public reference가 exact version을 resolve하는지 확인한 뒤에만 published activity를 기록한다.

Supersede, withdraw와 rollback-like selection은 append-only decision이며 immutable old bytes를 덮어쓰지 않는다. Retention policy는 source, intermediate, receipt, candidate, published와 superseded artifact별 period, hold, deletion eligibility와 owner를 선언하고 current manifest·provenance·review가 참조하는 bytes를 보호한다. Cleanup은 exact target, policy, deleted bytes와 remaining failure를 기록한다. Failed readback, stale review, missing stream, digest mismatch, race, unsafe destination, partial copy와 retention conflict는 새 publication을 거절하고 이전 current를 유지한다.
