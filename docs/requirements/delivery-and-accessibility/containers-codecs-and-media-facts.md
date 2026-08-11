# Container, Codec과 Media Facts

## Planned Setting과 Actual Stream의 일치 {#delivery-container-codec-facts}

Container와 각 video, audio, subtitle 또는 data stream의 codec, profile-like setting, duration, rate, dimensions, channel, language와 metadata를 계획하고 actual published bytes에서 probe해야 한다. Filename extension이나 encoder request를 actual media fact로 사용해서는 안 된다.

### Stream Identity {#delivery-stream-identity}

각 stream은 stable role, stream id 또는 deterministic ordering, language, source artifact identity, encode receipt와 byte 또는 content digest를 가져야 한다. Probe index가 실행마다 달라질 수 있으면 index만으로 role을 식별해서는 안 된다.

### Supported Combination {#delivery-supported-combinations}

Container, video codec, pixel format, audio codec, sample format, channel layout, subtitle representation과 metadata 조합의 supported subset을 profile에 명시해야 한다. Unsupported stream을 조용히 drop하거나 다른 codec으로 바꾸지 말고 explicit alternative request를 요구해야 한다.

### Stream Duration과 Interleave {#delivery-stream-duration-interleave}

각 stream의 start, duration, timebase와 presentation end를 확인하고 허용된 lead, tail 또는 priming-like offset을 profile에 기록해야 한다. Multiplex 순서나 chunk boundary가 playback sync와 seek 결과를 바꾸어서는 안 된다.

### Metadata Facts {#delivery-container-metadata}

Language, title, role, color, rotation 또는 orientation, timecode-like relation과 accessibility designation처럼 playback에 영향을 주는 metadata는 planned와 observed 값으로 비교해야 한다. Free-form tag는 required stream fact나 manifest identity를 대신해서는 안 된다.

### Tool Identity {#delivery-encoding-tool-identity}

Encoder와 muxer 이름, version, platform, normalized effective settings와 execution result를 receipt에 기록해야 한다. 다른 tool identity에서 만든 output은 새 verification을 거쳐야 하며 command text만으로 bytes의 진위를 증명해서는 안 된다.

### Partial Container {#delivery-partial-container}

Container가 열리고 일부 stream을 decode할 수 있어도 required stream, duration 또는 metadata가 빠지면 partial 또는 failed여야 한다. Valid stream은 diagnostic과 recovery에 사용할 수 있지만 public success로 승격해서는 안 된다.

### Media Fact Refusal {#delivery-media-fact-refusal}

Probe failure, zero stream, unexpected codec, missing required metadata, duration drift, duplicate role, undecodable stream과 planned-actual mismatch는 거절해야 한다. Diagnostic은 expected와 actual fact를 stream별로 제공해야 한다.
