# Docker 런타임 힌트 (선택 참고)

Testcontainers 통합·e2e 테스트가 "데몬을 못 찾는다"·"DB 컨테이너가 안 뜬다"로 실패할 때 본다. Docker Desktop이나 리눅스 기본 도커, CI에서는 보통 필요 없다. 규칙이 아니라 환경 안내다. 리뷰 엔진은 이 문서를 읽지 않는다.

## 1. 소켓 위치 알려 주기

Docker Desktop이 아닌 런타임은 소켓이 다른 곳에 있다. `DOCKER_HOST`가 비어 있으면 Testcontainers가 데몬을 못 찾는다.

```bash
docker context ls                                                 # 지금 쓰는 엔드포인트 확인
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"   # colima
export DOCKER_HOST="unix://$HOME/.rd/docker.sock"               # rancher-desktop
# podman: `podman machine inspect` 가 알려 주는 소켓
```

## 2. Ryuk 끄기

```bash
export TESTCONTAINERS_RYUK_DISABLED=true   # Ryuk 컨테이너가 못 뜰 때만
```

Ryuk은 테스트가 끝난 뒤 남은 컨테이너를 치우는 보조 컨테이너다. 이것이 못 뜨면 Ryuk 이름의 오류가 나지 않는다. 대신 **DB 컨테이너 대기 시간 초과로 보인다**(실측). "DB가 안 뜬다"로 보이면 먼저 소켓과 Ryuk을 의심한다. 끄면 컨테이너 정리를 직접 해야 하므로 `afterAll`의 `.stop()`을 빠뜨리지 않는다(`testcontainers-lifecycle` 규칙).
