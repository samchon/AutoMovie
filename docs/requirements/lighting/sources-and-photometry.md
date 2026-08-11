# Light Source와 Photometry

## 형상과 단위를 가진 광원 {#lighting-sources-photometry}

Directional, point, spot, area, line, dome, emissive surface와 project-defined source를 실제 geometry, direction, range, angle와 supported photometric quantity로 표현할 수 있어야 한다.

### Emitting Geometry {#lighting-emitting-geometry}

Point·line·area·surface source는 size, shape, emitting side, origin, orientation와 transform을 가져야 하며 visible source geometry와 방출 geometry가 다른 경우 그 관계와 approximation을 명시해야 한다.

### Intensity Basis {#lighting-intensity-basis}

Radiometric, photometric, exposure-like와 artistic scalar 중 어떤 basis와 unit를 사용하는지 명시하고 서로 다른 quantity를 같은 숫자로 비교하지 않아야 한다.

### Quantity Semantics {#lighting-photometric-quantity-semantics}

Radiant 또는 luminous flux, intensity, radiance·luminance와 surface illuminance-like result를 구분하고 source kind와 emitting geometry에 맞는 quantity를 사용하며 변환한 값은 assumptions와 conversion을 report해야 한다.

### Distance와 Falloff {#lighting-distance-falloff}

Source kind별 distance response, range 또는 cutoff, normalization와 near-source behavior를 선언하고 arbitrary range와 intensity compensation으로 서로 다른 photometric model을 같은 light처럼 비교하지 않아야 한다.

### Distribution {#lighting-source-distribution}

Uniform, cosine, spot cone, shaped, texture 또는 IES-like distribution을 orientation, normalization와 supported sampling에 연결할 수 있어야 한다.

### Profile Provenance {#lighting-profile-provenance}

Measured 또는 external distribution은 source, digest, unit, coordinate convention, normalization, supported channels와 변환을 추적하고 filename만으로 photometric truth를 가정하지 않아야 한다.

### Color와 Temperature {#lighting-source-color-temperature}

RGB 또는 spectrum, color temperature와 tint를 구분하고 color management basis와 conversion을 기록해야 한다.

### Source Sampling {#lighting-source-time-sampling}

Transform, intensity, color, distribution와 range가 시간에 따라 변하면 같은 fixed-clock convention에서 직접 sample하고 이전 frame state나 evaluation order에 따라 결과가 달라지지 않아야 한다.

### Source Refusal {#lighting-source-refusal}

Negative intensity, invalid cone, non-finite color, zero direction, unsupported profile와 unbounded range를 거부해야 한다.
