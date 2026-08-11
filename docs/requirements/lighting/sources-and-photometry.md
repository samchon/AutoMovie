# Light Source와 Photometry

## 형상과 단위를 가진 광원 {#lighting-sources-photometry}

Directional, point, spot, area, line, dome, emissive surface와 project-defined source를 실제 geometry, direction, range, angle와 supported photometric quantity로 표현할 수 있어야 한다.

### Intensity Basis {#lighting-intensity-basis}

Radiometric, photometric, exposure-like와 artistic scalar 중 어떤 basis와 unit를 사용하는지 명시하고 서로 다른 quantity를 같은 숫자로 비교하지 않아야 한다.

### Distribution {#lighting-source-distribution}

Uniform, cosine, spot cone, shaped, texture 또는 IES-like distribution을 orientation, normalization와 supported sampling에 연결할 수 있어야 한다.

### Color와 Temperature {#lighting-source-color-temperature}

RGB 또는 spectrum, color temperature와 tint를 구분하고 color management basis와 conversion을 기록해야 한다.

### Source Refusal {#lighting-source-refusal}

Negative intensity, invalid cone, non-finite color, zero direction, unsupported profile와 unbounded range를 거부해야 한다.
