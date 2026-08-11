# 외부 조명과 광학

## 건물 외관의 빛과 반사 {#building-exterior-lighting-optics}

Sun, sky, map light, building-mounted light와 emissive facade가 mass, projection, opening, material, shadow, reflection, silhouette와 linked interior light transfer에 미치는 결과를 같은 geometry, representation와 temporal state에서 검토할 수 있어야 한다.

### 자연광과 그림자 {#building-exterior-natural-light}

Time, season, sun direction, sky와 surrounding map geometry에 따라 facade, roof, shade와 opening의 direct light, diffuse light와 shadow를 재현할 수 있어야 한다. Exterior-only set가 map context를 갖지 않으면 declared light rig의 결과와 실제 site daylight를 구분해야 한다.

### 건물 부착형 조명 {#building-exterior-mounted-light}

Facade light, canopy light, sign, beacon, stair light와 landscape-adjacent building light는 source geometry, attachment, service port, direction, intensity, distribution, color, shadow와 state를 가져야 한다.

### 외피 광학 {#building-exterior-optical-envelope}

Glass, polished metal, stone, water와 emissive surface의 reflection, transmission, refraction, scattering과 roughness가 linked interior view, opening state와 같은 material·geometry state를 사용해야 한다. 원거리 proxy가 반사나 shadow consumer에 필요한 silhouette를 제거하지 않아야 한다.

### 결과 검토 {#building-exterior-lighting-review}

Glare, unwanted reflection, dark region, light leak, silhouette, facade composition과 opening depth의 readability를 supported measurement, form-revealing light와 current render로 확인할 수 있어야 한다. Beauty render를 illuminance, daylight나 glare 계산 결과로 대신하지 않아야 한다.
