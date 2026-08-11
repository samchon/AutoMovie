# Audio Stream과 Channel

## Delivery Profile의 Audible Output {#delivery-audio-streams-channels}

Audio stream은 role, language, sample rate, channel layout, sample format, duration, loudness target, peak policy와 source mix identity를 가져야 한다.

### Channel Layout {#delivery-channel-layout}

Mono, stereo, surround-like bed, object-like metadata와 project-defined layout을 channel order, label, position와 downmix policy와 함께 표현할 수 있어야 한다.

### Mix Version {#delivery-audio-mix-versions}

Full mix, dialogue-only, music-and-effects, clean audio, audio description와 alternate language mix를 별도 stream 또는 product identity로 보존해야 한다.

### Loudness Profile {#delivery-loudness-profile}

Integrated loudness, loudness range와 peak target은 destination profile이 소유하고 measured actual value와 구분해야 한다.

### Audio Refusal {#delivery-audio-refusal}

Missing required channel, wrong order, duration drift, clipping, silence where prohibited와 stale mix digest를 거부해야 한다.
