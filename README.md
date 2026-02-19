# Greyzone 🔐

민감한 작업 승인 & 시크릿 관리 시스템

## 기능

### 1. Sudo Approval
- CLI에서 sudo 명령 요청
- Web에서 WebAuthn으로 승인
- 결과 반환

### 2. Token/Secret 관리
- 토큰 등록 (서비스/프로젝트/프로필/설명)
- 환경변수 주입 방식 지원
- Local DB 또는 Doppler 백엔드 선택 가능

### 3. 환경변수 주입
```bash
# Doppler 스타일
greyzone run -- npm run dev

# 특정 프로필
greyzone run --profile dev -- npm run dev
```

## 구조

```
greyzone/
├── cli/                 # CLI 도구
│   └── greyzone.js
├── server/              # 백엔드 API
│   └── index.js
├── web/                 # React 프론트엔드
│   ├── src/
│   └── package.json
├── config.yaml          # 설정 파일
└── README.md
```

## 설정

```yaml
# config.yaml
storage: local  # local | doppler

doppler:
  project: friend-picks
  config: dev

server:
  port: 8080
  https: true
```
