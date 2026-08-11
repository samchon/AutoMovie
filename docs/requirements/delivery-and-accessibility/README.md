# 전달과 접근성 요구사항

Delivery는 selected film version을 목적지별 profile에 맞는 picture, audio, text, accessibility asset, metadata와 manifest로 묶고 실제 bytes를 다시 검증한 뒤 원자적으로 publish한다. 접근성 결과물은 부가 메모가 아니라 film timeline과 language version에 연결된 독립 stream 또는 product이며 required, optional, intentionally absent와 unsupported 상태를 구분해야 한다.

이 디렉터리는 container와 codec, exact timebase와 timecode, picture와 color, audio, captions, audio description, localization, package closure, provenance, publication과 retention을 사용자 관찰 가능 계약으로 정의한다. 계획한 setting이나 output path의 존재는 검증된 delivery를 대신하지 않는다.

- [Delivery 범위와 Profile](./scope-and-profiles.md)
- [Container, Codec과 Media Facts](./containers-codecs-and-media-facts.md)
- [Frame Rate, Timebase와 Timecode](./frame-rate-timebase-and-timecode.md)
- [Picture, Color와 Image Sequence](./picture-color-and-image-sequences.md)
- [Audio Stream과 Channel](./audio-streams-and-channels.md)
- [Caption, Subtitle과 Cue](./captions-subtitles-and-cues.md)
- [Audio Description과 대체 Media](./audio-description-and-alternatives.md)
- [Localization과 언어 Version](./localization-and-language-versions.md)
- [Package, Manifest와 Dependency](./packages-manifests-and-dependencies.md)
- [Integrity, Provenance와 Authenticity](./integrity-provenance-and-authenticity.md)
- [Publication과 Retention](./publication-and-retention.md)
- [최종 Delivery 검증](./validation.md)
