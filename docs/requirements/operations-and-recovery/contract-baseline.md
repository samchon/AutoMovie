# 생성 프로젝트 계약 Baseline

## 기록된 계약 세대 {#operations-contract-baseline}

### Baseline identity와 compatibility {#operations-contract-baseline-identity}

생성 프로젝트는 설치된 template contract의 exact generation, 선택한 제작 언어와 각 governed target의 canonical path, anchor 및 byte digest를 tracked baseline으로 보존해야 한다. Version range, 현재 package의 추정값 또는 무시되는 cache 파일은 세대 identity가 될 수 없다.

Reader는 baseline의 protocol, language, path와 digest를 strict하게 검증하고 unknown generation, project 밖 경로, duplicate path와 현재 선택 언어의 inventory 불일치를 compatible로 추정하지 않아야 한다.
