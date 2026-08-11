# Light Source, Photometry와 Environment {#light-source-photometry-environment-specification}

## Scene-referred Light State {#clv-scene-light-state}

### Authored Source, Branch와 Missing State {#clv-light-authority-branches}

<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-scope-identity Light identity, source, transform, intensity, color, shadow와 time state를 정규화한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-story-design-binding Light가 답하는 story, location, event와 readability 목적을 보존한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-upstream-source-trace Story, design, staging와 camera delivery source를 lineage로 고정한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-spatial-binding Source와 geometry를 같은 frame, unit, revision과 sample에 묶는다. -->

Light state는 stable identity, source kind, emitting geometry 또는 direction, transform, scene-referred intensity quantity, color 또는 spectrum, distribution, range, shadow intent, owning environment·subject, valid interval과 design revision을 가진다. Effective state는 story scene·event, production-design location·palette·material·phase, staging mark·practical·cue와 camera delivery를 직접 가리킨다.

Source, filter, portal, caster, receiver, reflective·transmissive surface와 analysis point는 같은 coordinate convention, length unit, resolved geometry revision와 rational film sample을 읽는다. 다른 revision에서 계산된 enclosure, opening, link나 visibility를 current light state에 결합하지 않는다.

<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Sun direction, placement, intensity와 color를 project-owned 입력으로 유지한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-appearance-distinction Scene light와 emission, exposure, display와 repaint를 분리한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-branch-identity Base, phase, override와 alternative의 effective state를 추적한다. -->
<!-- @evidence requirements/lighting/scope-and-identity.md#lighting-missing-refusal Missing source나 어두운 delivery를 default ambient로 숨기지 않게 한다. -->

Sun, environment와 local-source 값은 project가 직접 선언하거나 provenance가 있는 외부 결과를 채택한다. 장소명, 날짜, mood 단어 또는 화면 밝기에서 천문·기후·광원 사실을 자동 생성하지 않는다.

Base setup, production phase, shot override와 alternative는 독립 branch identity, inheritance order, valid interval과 difference set을 가진다. 같은 sample에는 하나의 effective light state만 있으며 source light, emission, camera exposure, display transform, grade와 optional repaint는 서로의 정본을 변경하지 않는다. 필수 subject가 전달되지 않거나 practical의 visible source에 대응하는 light가 없으면 `failed` 또는 명시적 approved limitation이며 default ambient wash를 삽입하지 않는다.

## Photometric Source Model {#clv-photometric-source-model}

### Distribution, Falloff와 Color {#clv-source-distribution-color}

<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-sources-photometry Source kind를 geometry, direction, range와 supported quantity에 연결한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-emitting-geometry Emitting shape, side, origin과 visible geometry relation을 정밀화한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-intensity-basis Radiometric, photometric와 artistic scalar의 basis를 구분한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-photometric-quantity-semantics Source quantity와 surface result quantity를 분리한다. -->

지원되는 source kind는 point, line, area, surface, directional, cone, dome 또는 project-defined model처럼 emitting domain과 direction law를 선언한다. Point가 아닌 source는 size, shape, emitting side, origin, orientation과 transform을 가지며 visible fixture geometry와 emitting geometry가 다르면 mapping, approximation과 revision을 기록한다.

각 intensity 값은 radiant 또는 luminous flux, radiant 또는 luminous intensity, radiance·luminance, illuminance-like result 또는 artistic scalar 중 quantity, unit, reference area·solid angle과 normalization을 가진다. Quantity conversion은 source assumptions, spectrum 또는 efficacy basis, geometry와 formula를 receipt에 남기며 서로 다른 quantity를 숫자만으로 비교하지 않는다.

<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Distance response, cutoff와 near-source behavior를 source model에 고정한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-source-distribution Angular 또는 textured distribution의 orientation과 normalization을 정한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-profile-provenance External profile의 bytes, unit, convention과 변환을 추적한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-source-color-temperature RGB, spectrum, temperature와 tint의 color basis를 구분한다. -->

Source model은 distance law, finite range 또는 cutoff, normalization, zero-distance domain과 near-source behavior를 선언한다. Angular distribution은 uniform, cosine, cone, shaped texture 또는 measured profile의 orientation, normalization과 supported sampling method를 가진다.

External profile은 immutable digest, source, coordinate convention, unit, normalization, supported channels, conversion lineage와 consumer를 가진다. Color는 scene-linear tristimulus 또는 supported spectrum, color-temperature와 tint basis, conversion chain과 valid domain을 기록하고 display RGB를 source energy로 해석하지 않는다.

### Source Sampling과 Refusal {#clv-source-sampling-refusal}

<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-source-time-sampling Transform, intensity, color와 distribution을 같은 fixed clock에서 직접 평가한다. -->
<!-- @evidence requirements/lighting/sources-and-photometry.md#lighting-source-refusal Invalid quantity, geometry, profile와 range를 거부한다. -->

Transform, intensity, color, distribution와 range curve는 rational film time에서 직접 평가되고 evaluation order나 previous-frame state에 의존하지 않는다. Source model이 지원하는 interpolation과 discontinuity event를 선언하며 같은 sample에서 모든 animated field를 원자적으로 교체한다.

Negative intensity, invalid emitting geometry, zero direction, invalid cone, non-finite color, unbounded 또는 contradictory range, unsupported profile와 quantity-unit mismatch는 `failed`다. 지원되지 않은 physical conversion은 artistic scalar로 몰래 바꾸지 않고 `unsupported`로 남긴다.

## Environment State {#clv-environment-light-state}

### Image, Background와 Spatial Variation {#clv-environment-image-spatial-variation}

<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-sun-sky-environment Sun, sky, image, horizon과 attenuation을 world state로 정규화한다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Environment contribution을 horizon, opening과 fog revision에 묶는다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-declared-sun Sun 입력과 채택된 외부 계산의 provenance를 구분한다. -->

Environment state는 world 또는 region identity, sun direction과 quantity, sky 또는 environment source, horizon, cloud·fog attenuation, story-time mapping, valid film interval과 resolved exterior·interior geometry revision을 가진다. 제품이 장소나 기후 content를 내장한다고 가정하지 않으며 채택한 외부 계산은 입력, assumptions, version과 digest를 보존한다.

<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Environment image의 projection, rotation, scale와 consumer를 추적한다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-background-illumination Background, reflection과 diffuse illumination의 source를 분리한다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-spatial-variation Region, opening, fog와 weather에 따른 contribution 변화를 보존한다. -->

Environment image는 immutable source identity, projection, rotation, scene-referred scale, color space, diffuse-lighting·reflection·background consumer와 support status를 가진다. Camera background, reflection environment와 diffuse illumination이 같은 source를 공유하는지 각각 선언하며 보이는 background가 자동으로 동일한 radiance source가 되지 않는다.

Map region, enclosure, portal, opening, horizon obstruction, fog와 local weather state는 environment contribution의 spatial domain을 제한한다. 하나의 global ambient 값은 해당 approximation이 선언되고 required region의 acceptance를 충족할 때만 사용할 수 있다.

### Environment Sampling, Alternative와 Claim 경계 {#clv-environment-sampling-claims}

<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Story time과 film time의 명시적 mapping으로 environment를 sample한다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-alternatives Time-of-day, weather와 sky alternative의 lineage를 분리한다. -->
<!-- @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-claim-boundary Authored environment를 미실행 물리 simulation으로 오인하지 않게 한다. -->

Sun, sky, attenuation, environment rotation와 region state는 story clock에서 film clock으로 선언된 mapping을 거쳐 camera, material과 local source가 읽는 같은 sample에서 평가한다. Alternative는 독립 provenance, state lineage, geometry condition과 review receipt를 가지며 다른 condition의 result를 재사용하지 않는다.

Authored sky, bounded attenuation와 image lighting은 declared lighting model의 결과다. 지원되고 실행된 분석 receipt가 없으면 실제 기상, 대기 산란, daylight transport 또는 global illumination simulation으로 보고하지 않는다.
