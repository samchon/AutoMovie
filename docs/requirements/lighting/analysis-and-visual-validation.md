# 분석과 시각 검증

## Light를 수치와 Frame으로 검토 {#lighting-analysis-visual-validation}

Lighting은 declared source와 supported analysis, rendered pixels, structural pass와 story readability를 함께 검토할 수 있어야 한다.

### Analysis Contract {#lighting-analysis-contract}

각 분석은 질문, quantity와 unit, source·material·geometry·camera의 identity와 revision, domain, sampling points·directions·times, boundary condition, solver 또는 approximation tier, tolerance와 unsupported 현상을 선언해야 한다.

### 측정 가능한 결과 {#lighting-measurable-results}

Illuminance-like sample, luminance, contrast, shadow extent, clipping와 exposure metric을 지원하는 경우 unit, sampling grid, time와 exclusions를 report해야 한다.

### Geometry Trace Validation {#lighting-analysis-geometry-trace}

Daylight path, occlusion, shadow, reflection, transmission와 light linking 분석은 실제 opening, blocker, caster, receiver, surface normal, material와 camera의 resolved identity와 revision을 report하여 다른 geometry의 pass를 재사용하지 않아야 한다.

### Form-revealing Review {#lighting-form-revealing-review}

Geometry 판단에는 directional form-revealing light, flat shading와 normal view를 사용할 수 있고 soft wash가 shape defect를 숨기지 않게 해야 한다.

### A/B와 Multi-time {#lighting-ab-multitime}

Source, material, exposure와 display change를 같은 camera·state의 A/B로 비교하고 start, event, middle와 end에서 temporal lighting을 확인해야 한다.

### Deterministic Recheck {#lighting-deterministic-recheck}

같은 source digest, geometry·material state, timebase, samples, seed와 analysis profile은 실행 순서에 관계없이 같은 metric, finding와 frame decision을 만들어야 한다.

### Positive, Negative와 Boundary {#lighting-analysis-validation-twins}

Source contribution, practical state, link, shadow, reflection, color transform, continuity와 budget rule은 성립하는 사례, 한 조건만 깨뜨린 negative twin과 exact threshold case를 구분해 검토할 수 있어야 한다.

### Result Status {#lighting-analysis-status}

Solved metric, rendered review, failed, unsupported와 not-run을 구분하고 beauty image가 그럴듯하다는 이유로 physical analysis를 통과했다고 주장하지 않아야 한다.

### Fresh Visual Evidence {#lighting-fresh-visual-evidence}

Source, geometry, material, camera, exposure, display 또는 lighting branch가 바뀌면 affected metric과 capture를 stale로 표시하고 current beauty·structural pass와 동일한 조건의 report를 다시 확인해야 한다.
