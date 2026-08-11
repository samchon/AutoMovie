# Audio Source와 외부 자산

## Project가 채택하는 Audio Bytes {#sound-sources-external-assets}

Recorded, synthesized, generated, procedural와 external audio를 작품 source로 채택하고 decoded sample format, channel, sample rate, duration, loudness-like facts와 digest를 고정할 수 있어야 한다.

### Provenance와 License {#sound-source-provenance}

Source URL 또는 provider, model과 version, prompt와 controls, license, original·processed digest, processing recipe와 consumer를 추적해야 한다.

### Decode Contract {#sound-decode-contract}

Supported container, codec, channel, rate, bit depth, duration, metadata와 expanded sample bound를 명시하고 file extension과 declared MIME만 믿지 않아야 한다.

### Source Choice {#sound-source-choice}

직접 recording, library asset, third-party generation, synthesis와 placeholder 중 선택은 사용자와 저작 에이전트가 소유하고 Engine과 MCP가 공급자를 대신 정하지 않아야 한다.

### Secret와 Remote Boundary {#sound-source-secret-remote-boundary}

API key와 credential을 provenance에 저장하지 않고 runtime이 undeclared remote URL을 surprise fetch하지 않아야 한다.
