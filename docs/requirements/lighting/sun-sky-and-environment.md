# Sun, Sky와 Environment

## World를 비추는 Environment Light {#lighting-sun-sky-environment}

Sun direction과 illuminance, sky 또는 environment image, horizon, cloud·fog attenuation와 ambient context를 map location과 film time state에 연결할 수 있어야 한다.

### Geometry와 Environment Trace {#lighting-environment-geometry-trace}

Environment contribution은 map·building exterior·interior의 resolved horizon, opening, portal, occluder, reflective surface와 fog state의 exact revision을 참조하고 다른 revision의 visibility나 enclosure를 재사용하지 않아야 한다.

### 선언된 Sun {#lighting-declared-sun}

Production은 필요한 sun direction과 intensity를 직접 선언하거나 자신이 채택한 외부 계산 결과를 provenance와 함께 제공할 수 있고 repository가 장소·달력 content를 내장한다고 가정하지 않아야 한다.

### Image-based Lighting {#lighting-image-based-environment}

Environment image를 reflection과 diffuse lighting에 사용할 수 있으며 source, digest, projection, rotation, source intensity 또는 source-exposure-like scale, color space와 consumer를 추적하고 이를 camera exposure와 구분해야 한다.

### Background와 Illumination {#lighting-environment-background-illumination}

Camera background, reflection environment와 diffuse illumination이 같은 image 또는 서로 다른 source를 읽는지 명시하고 보이는 sky가 자동으로 동일한 scene light를 방출한다고 가정하지 않아야 한다.

### Spatial Variation {#lighting-environment-spatial-variation}

광역 map의 region, interior opening, fog와 local weather에 따라 environment contribution이 달라질 수 있고 하나의 global ambient 값으로 모든 공간을 강제하지 않아야 한다.

### Environment Time Sampling {#lighting-environment-time-sampling}

Sun, sky, cloud·fog attenuation, environment rotation와 region state는 story time에서 film time으로 명시적으로 변환되고 camera, material과 local light가 읽는 같은 sample에서 평가되어야 한다.

### Environment Alternative {#lighting-environment-alternatives}

Time-of-day, weather, sky source와 lighting take alternative는 독립 provenance와 state lineage를 가져야 하며 비교하지 않은 condition의 result를 선택된 environment의 evidence로 사용하지 않아야 한다.

### Environment Claim 경계 {#lighting-environment-claim-boundary}

Authored sky와 bounded light state를 실제 기상, 대기 산란 또는 global illumination simulation으로 주장하지 않아야 한다.
