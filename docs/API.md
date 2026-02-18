# Greyzone API 명세

## Base URL
- Local: `http://localhost:8080`
- Tailscale: `https://hjseo-macmini.tail4891e5.ts.net:8080`

---

## 시크릿 관리

### GET /api/secrets/:project/:config
특정 프로젝트/환경의 시크릿 조회

**Response:**
```json
{
  "project": "friend-picks",
  "config": "dev",
  "secrets": {
    "SUPABASE_URL": "https://xxx.supabase.co",
    "SUPABASE_ANON_KEY": "eyJ..."
  }
}
```

### POST /api/secrets/:project/:config
시크릿 추가/수정

**Request:**
```json
{
  "key": "SUPABASE_URL",
  "value": "https://xxx.supabase.co",
  "description": "Supabase 프로젝트 URL"
}
```

### DELETE /api/secrets/:project/:config/:key
시크릿 삭제

---

## 토큰 요청 (승인 필요)

### POST /api/requests
새 요청 생성

**Request:**
```json
{
  "type": "token",
  "service": "supabase",
  "project": "friend-picks",
  "description": "Supabase anon key 필요"
}
```

**Response:**
```json
{
  "id": "req_abc123",
  "status": "pending",
  "createdAt": "2026-02-19T08:30:00Z"
}
```

### GET /api/requests
요청 목록

### GET /api/requests/:id
요청 상세

### POST /api/requests/:id/approve
요청 승인 (WebAuthn 필요)

**Request:**
```json
{
  "value": "eyJ...",  // 토큰 값 (승인 시 입력)
  "credential": { ... }  // WebAuthn credential
}
```

### POST /api/requests/:id/reject
요청 거부

---

## 프로필

### GET /api/profile
현재 프로필 조회

### PUT /api/profile
프로필 수정

**Request:**
```json
{
  "name": "greyfolks99",
  "email": "user@example.com",
  "settings": {
    "defaultProject": "friend-picks",
    "defaultConfig": "dev"
  }
}
```

---

## 프로젝트

### GET /api/projects
프로젝트 목록

### POST /api/projects
프로젝트 생성

### GET /api/projects/:project/configs
프로젝트의 환경(config) 목록

### POST /api/projects/:project/configs
환경 생성
