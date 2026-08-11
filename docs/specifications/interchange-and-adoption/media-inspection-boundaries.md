# Media Inspection Boundary

## Family Dispatch와 Fact Envelope {#interchange-media-inspection-dispatch}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-family-contract Filename이 아니라 검증된 family와 해석 facts로 decoder boundary를 선택한다. -->

Inspection은 declared media type, filename suffix, byte signature와 parser-confirmed container를 별도 observation으로 기록하고, 합의한 supported family에만 bounded inspector를 배정한다. 성공한 inspector는 container version, supported feature inventory, dependency edges, expanded resource estimates와 해석에 필요한 technical facts를 반환하며 서로 모순된 observation은 quarantine finding이 된다.

### glTF와 GLB Scene Inspection {#interchange-gltf-glb-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-gltf-glb glTF와 GLB의 scene graph 및 지원 feature를 element 단위로 검사한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation Direct placement가 보존할 scene graph inventory를 inspection 결과로 제공한다. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-gltf-semantics Map 소비자가 의미 보강 전에 읽을 source scene facts를 확정한다. -->

glTF 또는 GLB inspection은 container와 asset version, scene roots, node parentage와 local transform, mesh·primitive와 reuse, material·texture, skin·joint, morph, animation sampler와 channel, camera, light, extension, embedded chunk와 external URI를 index-stable element inventory로 만든다. Required index, accessor range, byte span, hierarchy와 profile constraint가 성립하지 않으면 repair하지 않고 해당 source revision을 invalid로 판정하며 지원하지 않는 extension은 element별 support result로 남긴다.

### Image와 Video Inspection {#interchange-image-video-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-image-video Image와 video의 raster, color, alpha와 clock facts를 parser 결과로 확정한다. -->

Image inspection은 decoded width와 height, orientation, pixel format, channel, alpha semantics, embedded color description과 frame count를 산출한다. Video inspection은 이에 더해 stream inventory, codec profile, rational frame rate와 timestamps, frame count, duration, pixel aspect와 attached sidecar relation을 산출하고, sequence gap·duplicate 또는 variable timing을 fixed-rate media로 가장하지 않는다.

### Audio Inspection {#interchange-audio-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-audio Audio container의 sample, channel와 timing facts를 decode 전후로 구분한다. -->
<!-- @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract 외부 audio의 supported decode subset과 expanded bound를 검사한다. -->

Audio inspection은 container와 codec, encoded sample representation, source sample rate, channel layout, frame count, exact duration, start 또는 synchronization marker, metadata chunk와 expanded sample bound를 산출한다. Downmix, resample과 loudness measurement는 source fact가 아니라 별도 processing result이며 unknown channel, empty sample range와 malformed chunk를 stereo silence로 변환하지 않는다.

### Motion Inspection {#interchange-motion-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-motion Motion source의 rig, clock, event와 contact facts를 함께 검사한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Retarget 이전 source motion의 skeleton, time basis와 receipt identity를 확정한다. -->

Motion inspection은 clip과 track identity, target skeleton 또는 semantic roles, rest basis, root channel, translation과 angle units, key times와 interpolation, loop interval, named event, declared contact와 unsupported channel을 inventory로 만든다. Retarget mapping은 inspection fact가 아니라 후속 adoption decision이며 bone name similarity만으로 target role을 확정하지 않는다.

### Spatial Data Inspection {#interchange-spatial-data-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-spatial-data 공간 자료의 reference, extent, resolution, time와 uncertainty를 검사한다. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-spatial-data 외부 raster, vector, point와 survey source의 format-specific facts를 확정한다. -->

Spatial inspection은 geometry 또는 sample kind, coordinate reference와 version, horizontal·vertical datum, local origin, axis와 unit, extent, resolution 또는 level, no-data semantics, feature와 attribute schema, timestamp 또는 epoch, accuracy와 uncertainty를 산출한다. Reference가 없는 자료는 local-unresolved로 남고 지리 좌표나 높이 기준을 추정하지 않는다.

### Text와 Metadata Inspection {#interchange-text-metadata-inspection}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-text-metadata Text와 metadata의 encoding, schema, reference와 instruction 경계를 검사한다. -->

Text와 metadata inspection은 byte encoding, language claim, document 또는 schema identity와 version, record ordering, identity fields, external reference, markup과 active-content inventory를 산출한다. Parse result는 content를 data tree로만 제공하고 embedded command, prompt와 URL을 실행 계획 또는 agent authority로 해석하지 않는다.

### Extensible Family Profile {#interchange-extensible-media-profile}

<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-extensible-families 새로운 format이 동일한 provenance, closure와 validation 계약 아래 추가되게 한다. -->

새 media profile은 byte-identification rule, accepted versions와 feature subset, required technical facts, dependency extraction, expanded resource bound, deterministic interpretation version과 refusal catalog를 함께 선언해야 등록할 수 있다. Provider 이름이나 filename suffix만 추가한 profile은 유효하지 않고, 기존 family로의 conversion은 원본 revision과 별도 derived revision 및 receipt를 만든다.
