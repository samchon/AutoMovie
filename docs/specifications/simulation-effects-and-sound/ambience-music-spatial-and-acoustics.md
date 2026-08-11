# Ambience, Music, Spatialization, and Acoustics

## Ambience population과 지속 상태 {#ambience-population-and-sustained-state}
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-sustained 이 절은 장소와 상태가 계속 내는 sound를 lifecycle로 표현한다. -->
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-bed-population 이 절은 bed와 discrete emitter population을 구분한다. -->

Ambience input은 space 또는 exterior region identity, bed sources, bounded emitter population, activation predicates, start/stop/tail과 environment dependency다. Bed는 영역 전체의 non-spatial 또는 diffuse layer이고 emitter는 stable world path를 가진 discrete source다. Output은 target sample에서 활성인 source states와 presentation routes이며 population은 admission limit를 넘을 수 없다.

### Loop seam과 arbitrary seek {#ambience-loop-seam-and-seek}
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-loop-seam 이 절은 loop period와 seam 처리를 측정 가능하게 한다. -->
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-seek-state 이 절은 playback history 없이 지속 source state를 복원한다. -->

Loop는 source sample range, phase origin, integer period, crossfade 또는 exact seam rule을 선언한다. Seek는 target presentation sample과 source identity로 phase, active state와 envelope를 직접 계산하며 이전 cursor를 사용하지 않는다. Seam evidence는 경계 전후 sample difference와 declared tolerance를 기록한다.

### Environment revision과 refusal {#ambience-environment-revision-and-refusal}
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-environment-state 이 절은 ambience 활성과 변화가 world state를 읽게 한다. -->
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-environment-revision 이 절은 shared environment 변경이 ambience cache를 무효화하게 한다. -->
<!-- @evidence requirements/sound/ambience-and-sustained-sources.md#sound-ambience-refusal 이 절은 unbounded 또는 미해결 ambience를 거절한다. -->

Wind, rain, machinery, opening과 occupancy 같은 state는 하나의 world snapshot revision으로 읽는다. Dependency revision이 바뀌면 active set, modulation, spatial/acoustic result와 mix cache가 stale이다. Unbounded emitter creation, period 없는 loop, unresolved region, cyclic activation, missing source는 state identity를 지목한 실패다.

## Music과 silence state {#music-and-silence-state}
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-silence 이 절은 music과 silence를 dramatic timeline의 명시 상태로 만든다. -->
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-diegetic-distinction 이 절은 diegetic source와 non-diegetic score의 world binding을 구분한다. -->
<!-- @evidence requirements/sound/music-and-silence.md#sound-silence-state 이 절은 의도된 music 부재를 추적 가능한 상태로 보존한다. -->

Music input은 cue identity, adopted source, dramatic range, diegetic/non-diegetic role, source or world binding과 authored silence ranges다. Diegetic music은 emitter, arrival와 spatial/acoustic path를 갖고 score는 presentation timeline에 직접 놓인다. Silence는 range와 reason을 가진 상태이며 source 누락과 구분한다.

### Tempo, edit, conform {#music-tempo-edit-and-conform}
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-tempo-edit 이 절은 beat grid와 picture edit 관계를 유리 시간으로 기록한다. -->
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-conform 이 절은 picture revision 뒤 music timing을 다시 판정하게 한다. -->

선택적 tempo map은 beat identity와 유리 film-time 또는 integer sample position을 연결하고 edit point와의 관계를 receipt에 기록한다. Picture conform은 source range, trim, offset, transition, tail과 authored sync point를 하나의 새 revision으로 계산한다. 무음 구간을 자동으로 채우거나 tempo를 묵시적으로 늘이지 않는다.

### Music source, rights, provider neutrality {#music-source-rights-and-provider-neutrality}
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-rights-source 이 절은 사용 권한과 source provenance를 delivery 전제에 포함한다. -->
<!-- @evidence requirements/sound/music-and-silence.md#sound-music-provider-neutrality 이 절은 생성 provider가 아닌 adopted artifact를 music authority로 삼는다. -->

Music source는 bytes digest, media facts, origin, rights scope, territory 또는 usage limitation과 receipt를 가진다. Generated music도 같은 artifact contract로 들어오며 provider project ID나 remote model availability는 evaluation 입력이 아니다. Rights가 delivery profile을 허용하지 않거나 receipt가 없으면 그 profile의 delivery는 refused다.

## Spatial path와 listener {#spatial-source-path-and-listener}
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-spatialization-propagation 이 절은 world source에서 listener까지의 경로를 추적한다. -->
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-moving-path-sampling 이 절은 moving emitter와 listener를 fixed audio clock에서 sample한다. -->
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-listener-identity 이 절은 presentation마다 정확한 listener를 선택하게 한다. -->

Spatial input은 emitter identity/path, listener identity/path, shared coordinate basis, presentation sample range와 world snapshot revisions다. Path pose는 sample 또는 declared control interval에서 결정적으로 평가하고 interpolation rule을 identity에 포함한다. Output은 sample/block별 relative direction, distance, radial velocity proxy와 path receipt다.

### Direct path와 output mapping {#spatial-direct-path-and-output-mapping}
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-direct-path 이 절은 distance, delay와 attenuation의 bounded direct model을 정한다. -->
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-spatial-output-mapping 이 절은 listener-relative result를 target channel layout으로 명시적으로 매핑한다. -->

Direct model은 nonnegative propagation delay, declared attenuation curve, optional bounded Doppler proxy와 minimum/maximum distance를 가진다. Spatial result는 target channel layout, pan/energy rule와 stable channel order에 따라 presentation samples로 매핑된다. Layout 변환은 channel을 조용히 버리지 않고 matrix와 normalization rule을 receipt에 남긴다.

### Occlusion과 propagation failure {#spatial-occlusion-and-propagation-failure}
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-occlusion-obstacle 이 절은 obstacle과 opening state를 shared world snapshot에서 읽게 한다. -->
<!-- @evidence requirements/sound/spatialization-and-propagation.md#sound-propagation-refusal 이 절은 불완전 path와 미지원 model을 명시적으로 실패시킨다. -->

Occlusion input은 same-revision obstacle proxies, spaces와 openings이고 output은 direct-path blocked fraction 또는 named coarse filter request다. Missing listener, incompatible basis, negative delay, unresolved path, unsupported output layout, unbounded ray/obstacle population은 refusal 또는 unsupported다. Coarse occlusion을 diffractionㆍwave propagation의 정확한 해로 주장하지 않는다.

## Interior acoustic response {#interior-acoustic-response-contract}
<!-- @evidence requirements/sound/interior-acoustics.md#sound-interior-acoustics 이 절은 room geometry와 sound response를 연결한다. -->
<!-- @evidence requirements/sound/interior-acoustics.md#sound-room-binding 이 절은 source와 listener가 속한 공간ㆍ개구부를 식별한다. -->
<!-- @evidence requirements/sound/interior-acoustics.md#sound-acoustic-input-revision 이 절은 geometry, material, opening revision을 response identity에 포함한다. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-film-sound-alignment 이 절은 interior analysis와 film sound가 같은 space revision을 사용하게 한다. -->

Acoustic input은 source/listener spaces, bounded room geometry proxy, material absorption proxy, opening states, sample rate와 response tier다. Output은 direct result와 분리된 early/reflection or reverberation proxy, response identity와 analysis receipt다. Geometryㆍmaterialㆍopening 중 하나라도 바뀌면 response와 이를 소비한 mix는 stale이다.

### Bounded response와 provider adoption {#bounded-acoustic-response-and-provider-adoption}
<!-- @evidence requirements/sound/interior-acoustics.md#sound-bounded-room-response 이 절은 acoustic solve의 rays, bounces, taps, duration과 work를 제한한다. -->
<!-- @evidence requirements/sound/interior-acoustics.md#sound-acoustic-provider-neutrality 이 절은 외부 response를 provider-neutral artifact로 채택한다. -->

Internal tier는 유한 rays/paths, reflection order, response taps와 tail duration을 admission 전에 제한한다. External response는 input snapshot digest, basis, sample rate, channel meaning, impulse bytes digest와 receipt를 가진 immutable artifact다. 양쪽 모두 같은 response state를 출력하며 provider 이름이나 remote handle은 mix 입력이 아니다.

### Mix consumption과 acoustic claim boundary {#acoustic-mix-consumption-and-claim-boundary}
<!-- @evidence requirements/sound/interior-acoustics.md#sound-acoustic-mix-consumption 이 절은 analysis와 audible processing이 같은 response revision을 사용하게 한다. -->
<!-- @evidence requirements/sound/interior-acoustics.md#sound-acoustic-claim-boundary 이 절은 bounded response를 measured room parity로 오인하지 않게 한다. -->

Mix는 response identity, wet/dry routing, stable convolution 또는 proxy-filter order와 tail policy를 명시한다. Analysis-only response는 audible chain에 적용됐다고 표시할 수 없다. Missing room, unsupported coupling, budget 초과는 explicit gap이며 성공은 staging용 공간 차이를 뜻할 뿐 measured RT, wave-accurate propagation, perceptual parity를 뜻하지 않는다.
