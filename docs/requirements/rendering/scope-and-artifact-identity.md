# Render 범위와 Artifact Identity

## Compiled Truth의 Pixel Projection {#rendering-scope-artifact-identity}

Render artifact는 production, edit version, shot 또는 film range, camera, frame schedule, pass, source fingerprint, renderer identity, settings와 output digest를 가져야 한다.

### Compile과 Render 구분 {#rendering-compile-render-distinction}

Compiler가 scene와 timeline 계약을 확정하고 renderer가 그 artifact를 소비하며 render 단계가 missing subject와 state를 구조적으로 자동 보완하지 않아야 한다.

### Planned와 Materialized {#rendering-planned-materialized}

Output path와 render plan, 실제 frame bytes, encoded media와 verified delivery를 별도 상태로 구분해야 한다.

### Deterministic Lane {#rendering-deterministic-lane}

Blocking pass와 deterministic beauty·guide output은 same input에서 reproducible해야 하며 optional generative rendition과 identity를 공유하지 않아야 한다.

### Missing Artifact {#rendering-missing-artifact-refusal}

파일명, directory 존재와 prior receipt만으로 current render가 존재한다고 주장하지 않아야 한다.
