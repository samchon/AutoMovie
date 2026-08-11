# 조명, 음향과 환경 분석

## Daylight, luminaire와 optical state {#interior-space-lighting-optical-state}

<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-lighting-daylight-optics Requires daylight and artificial lighting as authored, measurable systems. -->
<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-daylight-path Requires openings, obstructions, time, and exterior context in daylight evaluation. -->
<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-luminaire-distribution Requires luminaire distribution, support, and photometric facts. -->
<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-light-controls Requires circuits, groups, controls, and named states. -->
<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-optical-results Requires metrics and visual results to cite the same state. -->
<!-- @evidence requirements/interior/lighting-daylight-and-optics.md#interior-lighting-analysis-boundary Requires honest unsupported and not-run outcomes. -->

Lighting 입력은 exterior opening과 shading state, read-only north·ground·time·sky·sun·neighbour context, luminaire identity·geometry·distribution·spectrum·intensity, mount·support, circuit·control group와 named state를 가져야 한다. Material emission과 fixture light source를 구분하고 reflector, diffuser, glazing, transmission과 surface reflectance의 measured 또는 authored basis를 기록한다. 출력은 동일 design revision과 state를 읽은 render lighting, target별 illuminance·contrast·glare 등 지원 metric, sample field와 gap을 제공한다. Missing context, stale opening, unsupported photometry, disconnected control, floating fixture와 분석 미실행은 fabricated number 대신 `unsupported` 또는 `not-run`이며 beauty image만으로 정량 pass를 주장하지 않는다.

## Acoustic boundary와 sound scenario {#interior-space-acoustic-boundary-scenario}

<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-acoustics-sound-boundaries Requires sound boundaries and room scenarios. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-sound-transmission Requires openings, partitions, flanking paths, and state in transmission. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-absorption-reverberation Requires measured absorption and volume inputs. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-film-sound-alignment Requires film sound to reference the same spatial state. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-acoustic-analysis-boundary Requires measured analysis to remain distinct from rendered sound. -->
<!-- @evidence requirements/interior/acoustics-and-sound-boundaries.md#interior-acoustic-zones-scenarios Requires scenario-specific source, receiver, and zone state. -->

Acoustic 입력은 room·zone volume, boundary assembly와 opening state, surface absorption by frequency, partition transmission facts, source·receiver identity와 position, steady equipment noise, scenario clock와 target을 가져야 한다. Door가 열리거나 movable partition이 바뀌면 transmission path, reverberation와 film ambience가 같은 named state를 읽고 기존 결과는 stale이다. 출력은 지원되는 범위의 absorption area, reverberation time, level, transmission loss와 intelligibility metric 또는 bounded gap을 design revision과 함께 제공한다. Texture나 room label에서 음향값을 추정하거나 missing frequency data를 default로 채우지 않으며, 측정 결과는 실제 reverb rendering을 수행했다는 뜻이 아니고 미실행 solver는 `not-run`이다.
