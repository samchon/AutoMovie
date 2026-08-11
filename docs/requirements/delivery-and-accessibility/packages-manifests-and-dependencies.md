# Package, Manifest와 Dependency

## Delivery를 재개할 수 있는 Closure {#delivery-packages-manifests-dependencies}

Delivery package는 film product, streams, captions, accessibility asset, image sequence, font-like dependency, manifest, receipt와 digest의 complete closure를 가져야 한다.

### Manifest Identity {#delivery-manifest-identity}

각 artifact의 role, relative path, media facts, size, digest, dependency와 optional status를 canonical order로 기록해야 한다.

### Relative와 Safe Path {#delivery-safe-relative-paths}

Package path는 normalized relative form을 사용하고 absolute path, parent traversal, reserved name, symlink escape와 case collision을 거부해야 한다.

### Missing와 External Reference {#delivery-external-references}

Self-contained bytes, deliberate external reference와 missing dependency를 구분하고 undeclared remote fetch에 의존하지 않아야 한다.

### Package Refusal {#delivery-package-refusal}

Duplicate path, digest mismatch, missing required artifact, archive expansion bound 초과와 manifest 밖 bytes를 거부해야 한다.
