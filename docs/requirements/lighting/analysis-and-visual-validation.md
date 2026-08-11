# 분석과 시각 검증

## Light를 수치와 Frame으로 검토 {#lighting-analysis-visual-validation}

Lighting은 declared source와 supported analysis, rendered pixels, structural pass와 story readability를 함께 검토할 수 있어야 한다.

### 측정 가능한 결과 {#lighting-measurable-results}

Illuminance-like sample, luminance, contrast, shadow extent, clipping와 exposure metric을 지원하는 경우 unit, sampling grid, time와 exclusions를 report해야 한다.

### Form-revealing Review {#lighting-form-revealing-review}

Geometry 판단에는 directional form-revealing light, flat shading와 normal view를 사용할 수 있고 soft wash가 shape defect를 숨기지 않게 해야 한다.

### A/B와 Multi-time {#lighting-ab-multitime}

Source, material, exposure와 display change를 같은 camera·state의 A/B로 비교하고 start, event, middle와 end에서 temporal lighting을 확인해야 한다.

### Result Status {#lighting-analysis-status}

Solved metric, rendered review, failed, unsupported와 not-run을 구분하고 beauty image가 그럴듯하다는 이유로 physical analysis를 통과했다고 주장하지 않아야 한다.
