# Sun, Sky와 Environment

## World를 비추는 Environment Light {#lighting-sun-sky-environment}

Sun direction과 illuminance, sky 또는 environment image, horizon, cloud·fog attenuation와 ambient context를 map location과 film time state에 연결할 수 있어야 한다.

### 선언된 Sun {#lighting-declared-sun}

Production은 필요한 sun direction과 intensity를 직접 선언하거나 자신이 채택한 외부 계산 결과를 provenance와 함께 제공할 수 있고 repository가 장소·달력 content를 내장한다고 가정하지 않아야 한다.

### Image-based Lighting {#lighting-image-based-environment}

Environment image를 reflection과 diffuse lighting에 사용할 수 있으며 source, digest, projection, rotation, exposure, color space와 consumer를 추적해야 한다.

### Spatial Variation {#lighting-environment-spatial-variation}

광역 map의 region, interior opening, fog와 local weather에 따라 environment contribution이 달라질 수 있고 하나의 global ambient 값으로 모든 공간을 강제하지 않아야 한다.

### Environment Claim 경계 {#lighting-environment-claim-boundary}

Authored sky와 bounded light state를 실제 기상, 대기 산란 또는 global illumination simulation으로 주장하지 않아야 한다.
