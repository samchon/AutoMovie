# Package, Manifest와 Dependency

## Delivery를 재개하고 검증하는 Closure {#delivery-packages-manifests-dependencies}

Delivery package는 film product, streams, captions, accessibility assets, image sequences, required font-like dependency, manifests, validation와 provenance receipts의 complete digest closure를 가져야 한다. Package 밖의 undeclared local 또는 remote state에 의존해서는 안 된다.

### Manifest Identity {#delivery-manifest-identity}

각 artifact의 stable role, normalized relative path, media facts, byte size, digest, dependency, source identity, required 또는 optional 상태와 publication version을 canonical order로 기록해야 한다. Manifest 자신의 identity와 byte digest도 검증 가능해야 한다.

### Relative와 Safe Path {#delivery-safe-relative-paths}

Package path는 normalized relative form을 사용하고 absolute path, parent traversal, reserved name, invalid segment, control character, case-insensitive collision와 symlink-like escape를 거절해야 한다. Validation과 extraction은 최종 resolved target이 package root 안에 있는지 확인해야 한다.

### Missing과 External Reference {#delivery-external-references}

Self-contained bytes, deliberate external reference, optional asset와 missing dependency를 구분해야 한다. External reference는 immutable identity, allowed access expectation과 availability boundary를 가져야 하며 package open 중 undeclared network fetch를 수행해서는 안 된다.

### Archive와 Expansion Bound {#delivery-archive-expansion}

Archive-like package는 entry count, individual size, total expanded size, nesting과 path policy를 materialize 전에 검증해야 한다. Compressed size만으로 안전하다고 판단하거나 duplicate path와 link가 기존 file을 덮어쓰게 해서는 안 된다.

### Deterministic Assembly {#delivery-package-assembly}

같은 artifact set과 profile은 canonical manifest ordering, stable logical paths와 declared packaging metadata를 가져야 한다. Filesystem enumeration, locale, timestamp 또는 host path가 package meaning과 identity를 바꾸어서는 안 된다.

### Partial Package와 Recovery {#delivery-package-partial-recovery}

Assembly가 실패하면 verified artifact와 temporary package를 final destination과 분리하고 expected, missing, invalid와 reusable items를 보고해야 한다. Missing artifact가 복구되면 dependency closure를 다시 계산하고 stale manifest를 current로 재사용해서는 안 된다.

### Package Refusal {#delivery-package-refusal}

Duplicate 또는 escaping path, digest mismatch, missing required artifact, undeclared dependency, manifest inconsistency, expansion bound 초과와 unsupported entry type은 거절해야 한다. 일부 valid bytes가 있어도 package complete 또는 safe로 표시해서는 안 된다.
