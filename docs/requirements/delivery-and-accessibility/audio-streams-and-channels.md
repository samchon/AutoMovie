# Audio Stream과 Channel

## Delivery Profile의 Audible Output {#delivery-audio-streams-channels}

Audio stream은 stable identity, role, language, source mix revision, exact start와 duration, sample rate, sample format, channel layout, loudness target, peak policy와 measured facts를 가져야 한다. Picture와의 common presentation origin을 유지해야 한다.

### Channel Layout {#delivery-channel-layout}

Mono, stereo, surround-like bed와 supported object-like representation은 channel count, order, label, intended position과 silent-channel policy를 함께 명시해야 한다. Channel 수만 같다는 이유로 다른 order나 semantic을 호환된 것으로 보아서는 안 된다.

### Mix Version {#delivery-audio-mix-versions}

Full mix, dialogue-only, music-and-effects, clean audio, audio description, commentary-like optional mix와 alternate language mix는 별도 stream 또는 product identity를 가져야 한다. 임시 monitor mix와 published master를 구분해야 한다.

### Downmix와 Adaptation {#delivery-audio-downmix}

Channel reduction, gain adjustment, normalization 또는 sample-rate conversion이 필요한 profile은 mapping, coefficients 또는 effective policy와 lineage를 기록해야 한다. Missing channel을 duplicate하거나 clipping을 피하려고 전체 mix를 임의로 바꾸어서는 안 된다.

### Loudness Profile {#delivery-loudness-profile}

Integrated loudness, range-like measure, peak target, measurement gate와 permitted tolerance는 destination profile이 소유해야 한다. Target과 measured actual을 구분하고 gain request만으로 compliance를 주장해서는 안 된다.

### Sample Accuracy와 Tail {#delivery-audio-sample-boundary}

First sample, program start, final audible event, intended tail와 padding을 exact sample count 및 presentation time으로 검증해야 한다. Encode delay나 priming-like behavior가 있으면 observed offset과 compensation을 receipt에 기록해야 한다.

### Silence와 Missing Sound {#delivery-audio-silence}

Authored silence, muted region, empty channel, missing source, failed decode와 not-run mix를 구분해야 한다. Required programme에 silence가 허용되지 않으면 energy existence뿐 아니라 expected event와 language가 맞는지 확인해야 한다.

### Audio Refusal {#delivery-audio-refusal}

Missing required channel, wrong order, sample-rate mismatch, duration drift, clipping, prohibited silence, stale mix digest, wrong language와 undecodable stream은 거절해야 한다. Independent valid mix는 유지할 수 있지만 requested accessibility 또는 language set 전체를 complete로 표시해서는 안 된다.
