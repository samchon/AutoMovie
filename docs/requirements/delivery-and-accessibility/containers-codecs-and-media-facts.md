# Container, Codec와 Media Facts

## Planned Setting과 Actual Stream의 일치 {#delivery-container-codec-facts}

Container와 각 video, audio, subtitle 또는 data stream의 codec, profile-like setting, duration, rate, dimensions, channel와 metadata를 계획하고 actual bytes에서 probe할 수 있어야 한다.

### Stream Identity {#delivery-stream-identity}

각 stream은 stable role, index 또는 id, language, source artifact, encode receipt와 digest를 가져야 한다.

### Supported Combination {#delivery-supported-combinations}

Container, codec, pixel 또는 sample format, caption와 metadata 조합의 supported subset을 명시하고 unsupported stream을 몰래 drop하지 않아야 한다.

### Tool Identity {#delivery-encoding-tool-identity}

Encoder와 muxer 이름, version, command-like normalized settings와 platform을 receipt에 기록하여 output provenance를 재검토할 수 있어야 한다.

### Media Fact Refusal {#delivery-media-fact-refusal}

Probe failure, zero stream, unexpected codec, duration drift, missing metadata와 planned·actual mismatch를 final success로 보고하지 않아야 한다.
