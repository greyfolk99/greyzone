# Greyzone CLI

봇/에이전트용 CLI 도구

## 설치
```bash
npm install -g greyzone-cli
# 또는
npx greyzone <command>
```

## 명령어

### 환경변수 주입
```bash
# 환경변수 주입해서 명령어 실행 (doppler run 스타일)
greyzone run -- npm run dev
greyzone run --project friend-picks --config dev -- npm start

# 환경변수 출력
greyzone secrets
greyzone secrets --format env
greyzone secrets --format json
```

### 토큰 요청
```bash
# 토큰 요청 (웹에서 오빠가 승인/입력)
greyzone request-token supabase --project friend-picks --description "Supabase anon key"

# 요청 상태 확인
greyzone requests
greyzone requests --pending
```

### sudo 요청
```bash
# sudo 승인 요청
greyzone sudo "rm -rf /tmp/test"

# 요청 상태 확인
greyzone sudo --status <request-id>
```

### 설정
```bash
# 저장소 설정
greyzone config set storage local
greyzone config set storage doppler

# Doppler 연결
greyzone config set doppler.project friend-picks
greyzone config set doppler.config dev
```

## 환경변수 주입 로직

### 우선순위
1. CLI 인자 (`--env KEY=VALUE`)
2. Greyzone 저장소 (local DB 또는 Doppler)
3. 시스템 환경변수
4. .env 파일

### 엣지 케이스 처리
- 특수문자 이스케이프 (`$`, `"`, `\n` 등)
- 멀티라인 값 지원
- 빈 값 vs undefined 구분
- 타임아웃/네트워크 에러 시 fallback
