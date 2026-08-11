# 최종 Delivery 검증

## 실제 Published Bytes의 재검증 {#delivery-validation}

Delivery 검증은 profile revision, selected film, manifest, path, digest, container, stream, codec, duration, frame rate, dimensions, color, audio, caption, language, accessibility asset, provenance와 publication state를 actual candidate 또는 published bytes에서 확인해야 한다. 각 verdict는 exact artifact identity와 scope를 가져야 한다.

### Profile Conformance {#delivery-profile-conformance}

각 required field와 asset의 measured fact를 profile target, range, allowed set 또는 conditional rule과 비교해야 한다. Planned setting, file extension, request log 또는 manifest assertion을 actual result로 사용해서는 안 된다.

### Package Closure {#delivery-package-closure-validation}

Manifest에 선언된 모든 required artifact가 safe path에 존재하고 size, digest, media facts와 dependency가 일치하며 undeclared bytes가 policy를 위반하지 않는지 확인해야 한다. External reference는 declared availability와 immutable identity를 별도로 검사해야 한다.

### Audiovisual Review {#delivery-audiovisual-review}

Final decoded film에서 picture, motion, sound, caption, language, accessibility alternative, sync, artifact와 ending state를 전체 재생 또는 declared review protocol로 검토해야 한다. Render source나 intermediate review를 final decode review로 대체해서는 안 된다.

### Accessibility Review {#delivery-accessibility-review}

Required caption, subtitle, audio description, transcript, clean audio 또는 other alternative를 intended selection path에서 활성화하고 timing, language, readability, audibility, coverage와 user-visible labeling을 검토해야 한다. Asset 존재만으로 접근 가능한 playback을 증명해서는 안 된다.

### Negative와 Corruption {#delivery-negative-corruption}

Truncated file, missing stream, wrong language, stale caption, digest mismatch, extra 또는 missing frame, wrong channel, path escape와 partial package가 각각 실패하는지 검증해야 한다. Failure injection이 valid published version을 변경해서는 안 된다.

### Cross-artifact Consistency {#delivery-cross-artifact-consistency}

Manifest, container metadata, caption 또는 transcript, provenance, public reference와 actual bytes가 같은 edit, duration, language, profile와 artifact digest를 가리키는지 확인해야 한다. 각각 유효해도 서로 다른 revision을 섞은 package는 실패해야 한다.

### Partial Validation과 Recovery {#delivery-validation-recovery}

Independent profile 또는 artifact의 성공 evidence는 보존할 수 있지만 missing, failed, unsupported와 not-run 항목을 포함한 requested delivery set은 partial이어야 한다. 수정 뒤에는 affected dependency와 downstream review만 다시 실행하고 unchanged evidence의 재사용 근거를 기록해야 한다.

### Final Status {#delivery-final-status}

Planned, assembling, encoded, packaged, probed, reviewed, publishing, published, partial, failed, unsupported, superseded, withdrawn와 not-run을 구분해야 한다. Output path, URL, upload receipt 또는 이전 publication만으로 delivery complete를 주장해서는 안 된다.

### Validation Refusal {#delivery-validation-refusal}

Profile, selected revision, artifact identity, measured facts, required review 또는 publication target이 모호하면 pass나 published status를 만들지 말아야 한다. 자동 fallback으로 바뀐 output은 원 요청이 아니라 별도 candidate profile 결과로 검증해야 한다.
