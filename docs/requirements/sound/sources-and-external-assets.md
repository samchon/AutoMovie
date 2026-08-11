# Audio Source와 외부 자산

## Project가 채택하는 Audio Bytes {#sound-sources-external-assets}

Recorded, synthesized, generated, procedural와 external audio를 작품 source로 채택하고 decoded sample format, channel, sample rate, duration, loudness-like facts와 digest를 고정할 수 있어야 한다.

### Immutable Adoption {#sound-source-immutable-adoption}

Remote response, mutable library alias와 synthesis result는 작품이 채택한 immutable original bytes와 digest로 닫혀야 하며 같은 URL, prompt 또는 model name을 다시 호출한 결과를 기존 source identity로 덮어쓰지 않아야 한다.

### Provenance와 License {#sound-source-provenance}

Source URL 또는 provider, model과 version, prompt와 controls, license, original·processed digest, processing recipe와 consumer를 추적해야 한다.

### Decode Contract {#sound-decode-contract}

Supported container, codec, channel, rate, bit depth, duration, metadata와 expanded sample bound를 명시하고 file extension과 declared MIME만 믿지 않아야 한다.

### Source Choice {#sound-source-choice}

직접 recording, library asset, third-party generation, synthesis와 placeholder 중 선택은 사용자와 저작 에이전트가 소유하고 AutoMovie가 공급자를 대신 정하지 않아야 한다.

### Provider Metadata 경계 {#sound-source-provider-adapter-boundary}

Provider-specific request, receipt와 model metadata는 provenance로 보존할 수 있으나 cue, timing, spatialization와 mix는 채택된 bytes와 provider-neutral technical facts를 소비해야 한다. Provider가 없거나 바뀌어도 이미 채택한 local source를 재생하고 검증할 수 있어야 한다.

### Derived Source Closure {#sound-derived-source-closure}

Trim, resample, channel conversion, denoise, normalization와 다른 processing이 source bytes를 만들면 input digest, ordered recipe, processor identity, output digest와 consumer를 기록하고 original과 derived bytes를 혼동하지 않아야 한다.

### Secret와 Remote Boundary {#sound-source-secret-remote-boundary}

API key와 credential을 provenance에 저장하지 않고 runtime이 undeclared remote URL을 surprise fetch하지 않아야 한다.
