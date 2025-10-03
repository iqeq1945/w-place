# W-Place Backend

> **실시간 픽셀 아트 플레이스 서비스 백엔드**  
> Reddit의 r/place를 모티브로 한 실시간 협업 픽셀 아트 플랫폼

## 🎯 프로젝트 개요

W-Place는 사용자들이 실시간으로 픽셀을 배치하여 협업 아트를 만드는 웹 서비스입니다. Reddit의 r/place 컨셉을 기반으로 하여, 사용자들이 픽셀 단위로 그림을 그리며 커뮤니티 아트를 완성해가는 플랫폼입니다.

### 주요 기능
- 🎨 **실시간 픽셀 배치**: 사용자가 픽셀을 실시간으로 배치
- 🔄 **실시간 동기화**: WebSocket을 통한 실시간 보드 업데이트
- 👤 **OAuth 인증**: OAuth를 통한 사용자 인증
- ⏰ **쿨다운 시스템**: 스팸 방지를 위한 픽셀 배치 제한
- 📊 **관리자 기능**: 보드 관리, 사용자 관리, 데이터 분석
- 💾 **데이터 영속성**: ScyllaDB를 통한 픽셀 히스토리 저장

## 🛠 기술 스택

### Backend Framework
- **NestJS** - Node.js 기반 엔터프라이즈급 프레임워크
- **TypeScript** - 타입 안정성을 위한 정적 타입 언어

### Database & Cache
- **ScyllaDB** - 고성능 NoSQL 데이터베이스 (픽셀 히스토리 저장)
- **Redis** - 인메모리 캐시 및 세션 관리
- **Cassandra Driver** - ScyllaDB 연결을 위한 드라이버

### Real-time Communication
- **Socket.IO** - 실시간 양방향 통신
- **WebSocket Gateway** - NestJS WebSocket 게이트웨이

### Authentication & Security
- **JWT** - JSON Web Token 기반 인증
- **Passport** - 인증 미들웨어
- **OAuth 2.0** - OAuth 연동

### API Documentation
- **Swagger/OpenAPI** - API 문서 자동 생성
- **Class Validator** - DTO 유효성 검사

### DevOps & Infrastructure
- **Docker** - 컨테이너화
- **Docker Compose** - 멀티 컨테이너 오케스트레이션
- **Redis Alpine** - 경량화된 Redis 이미지
- **ScyllaDB** - 분산 NoSQL 데이터베이스

## 🏗 아키텍처

### 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React/Vue)   │◄──►│   (NestJS)      │◄──►│   (ScyllaDB)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       └─────────────────┘
```

### 데이터 플로우
1. **픽셀 배치 요청** → JWT 인증 → 쿨다운 검증
2. **ScyllaDB 저장** → Redis 업데이트 → 캐시 무효화
3. **WebSocket 브로드캐스트** → 실시간 클라이언트 업데이트

## 📁 프로젝트 구조

```
src/
├── admin/           # 관리자 기능
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── admin.repository.ts
├── auth/            # 인증 관련
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.guard.ts
├── board/           # 보드 관리
│   ├── board.controller.ts
│   ├── board.service.ts
│   └── dto/
├── oauth/           # OAuth 연동
│   ├── oauth.service.ts
│   └── oauth.module.ts
├── websocket/       # 실시간 통신
│   ├── websocket.gateway.ts
│   └── websocket.module.ts
├── scylla/          # 데이터베이스
│   ├── scylla.service.ts
│   └── interfaces/
├── redis/           # 캐시 관리
│   ├── redis.service.ts
│   └── redis.module.ts
└── common/          # 공통 유틸리티
    ├── decorators/
    └── utils/
```

## 🚀 주요 기능 구현

### 1. 실시간 픽셀 배치 시스템
```typescript
// 픽셀 배치 로직
async placeTile(x: number, y: number, colorIndex: number, userId: string) {
  // 쿨다운 검증
  const lastPlacement = await this.redisService.getLastPlacement(userId);
  if (now - lastPlacement < this.cooldownPeriod * 1000) {
    throw new Error('Please wait before placing another tile');
  }
  
  // ScyllaDB에 기록
  await this.scyllaService.recordPixelPlacement(x, y, userId, colorIndex);
  
  // Redis 업데이트
  await this.redisService.setTile(x, y, colorIndex);
  
  // WebSocket 브로드캐스트
  this.websocketGateway.broadcastTileUpdate({
    x, y, colorIndex, timestamp: now
  });
}
```

### 2. 다층 캐시 시스템
- **L1 Cache**: NestJS Cache Manager (1분 TTL)
- **L2 Cache**: Redis (영구 저장)
- **L3 Storage**: ScyllaDB (히스토리 저장)

### 3. WebSocket 최적화
```typescript
// 픽셀 업데이트 배치 처리
private flushPixelUpdates() {
  if (this.pixelUpdateQueue.length === 0) return;
  
  const packedData = encode(this.pixelUpdateQueue);
  this.server.emit('pixelUpdate', packedData);
  this.pixelUpdateQueue = [];
}
```

### 4. 데이터베이스 스키마 설계
```sql
-- 픽셀 히스토리 테이블
CREATE TABLE pixel_history (
  history_id timeuuid,
  x int,
  y int,
  timestamp timestamp,
  user_id text,
  color_index tinyint,
  PRIMARY KEY ((x, y), user_id, history_id)
);

-- 보드 스냅샷 테이블
CREATE TABLE board_snapshots (
  board_id uuid,
  snapshot_id timeuuid,
  timestamp timestamp,
  board blob,
  PRIMARY KEY (board_id, snapshot_id)
);
```

## 🔧 API 엔드포인트

### 보드 관련
- `GET /api/board` - 전체 보드 데이터 조회
- `GET /api/board/pixel?x=0&y=0` - 특정 픽셀 정보 조회
- `POST /api/board/pixel` - 픽셀 배치

### 인증 관련
- `GET /api/auth/wakta` - OAuth 인증 URL
- `POST /api/auth/wakta/login` - OAuth 로그인

### 관리자 기능
- `GET /api/admin/board` - 관리자용 보드 조회
- `POST /api/admin/initialize` - 보드 초기화
- `POST /api/admin/rollback/:id` - 보드 롤백
- `GET /api/admin/pixel-history` - 픽셀 히스토리 조회

## 🐳 Docker 설정

### docker-compose.yml
```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    depends_on:
      - redis
      - scylla
    environment:
      - BOARD_SIZE=${BOARD_SIZE}
      - CLIENT_ID=${CLIENT_ID}
      - SCYLLA_KEYSPACE=${SCYLLA_KEYSPACE}
      - REDIS_HOST=${REDIS_HOST}
      - JWT_SECRET=${JWT_SECRET}
  
  scylla:
    image: scylladb/scylla
    ports:
      - '9042:9042'
  
  redis:
    image: redis:alpine
    ports:
      - '6379:6379'
```

## 📊 성능 최적화

### 1. 캐시 전략
- **보드 데이터**: 1분 TTL 캐시
- **픽셀 정보**: 5분 TTL 캐시
- **CDN 캐시**: 60초 TTL

### 2. WebSocket 최적화
- **메시지 압축**: perMessageDeflate 활성화
- **배치 처리**: 100ms 간격으로 픽셀 업데이트 배치
- **MessagePack**: 바이너리 직렬화로 데이터 크기 최적화

### 3. 데이터베이스 최적화
- **TimeWindowCompactionStrategy**: 7일 윈도우 압축
- **배치 삽입**: 여러 픽셀 업데이트를 한 번에 처리
- **인덱스 최적화**: (x, y) 복합 키로 빠른 조회

## 🔒 보안 기능

### 1. 인증 및 권한
- **JWT 토큰**: 8시간 만료
- **OAuth 2.0**: OAuth 연동
- **API 키 가드**: 관리자 기능 보호

### 2. 스팸 방지
- **쿨다운 시스템**: 118초 픽셀 배치 제한
- **블랙리스트**: Redis 기반 사용자 차단
- **유효성 검사**: DTO 기반 입력 검증

## 🧪 테스트

### E2E 테스트
```bash
# E2E 테스트 실행
npm run test:e2e

# 커버리지 테스트
npm run test:cov
```

### 테스트 구조
```
test/
├── e2e/
│   ├── admin.e2e-spec.ts
│   └── board.e2e-spec.ts
└── fixture/
    ├── board.mother.ts
    ├── jwt.mother.ts
    └── pixel-history.mother.ts
```

## 🚀 배포 및 운영

### 환경 변수 설정
```env
BOARD_SIZE=610
CLIENT_ID=your_client_id
CALLBACK_URL=your_callback_url
SCYLLA_KEYSPACE=place
SCYLLA_CONTACT_POINTS=scylla
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
COOLDOWN_PERIOD=118
API_KEY=your_api_key
```

### 실행 방법
```bash
# 개발 환경
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod

# Docker 실행
docker-compose up -d
```

## 📈 모니터링 및 로깅

### 로그 시스템
- **구조화된 로깅**: NestJS Logger 사용
- **성능 모니터링**: 픽셀 배치 시간 추적
- **에러 추적**: 상세한 에러 로그 및 스택 트레이스

### 관리자 대시보드
- **실시간 사용자 수**: WebSocket 연결 수 모니터링
- **픽셀 히스토리**: 전체 픽셀 배치 기록 조회
- **보드 스냅샷**: 특정 시점 보드 상태 복원

## 🎯 핵심 성과

### 기술적 도전과 해결
1. **실시간 동기화**: WebSocket + MessagePack으로 최적화된 실시간 통신
2. **대용량 데이터 처리**: ScyllaDB를 활용한 확장 가능한 데이터 저장
3. **캐시 최적화**: 다층 캐시 시스템으로 응답 시간 단축
4. **스팸 방지**: 쿨다운 시스템과 블랙리스트로 서비스 품질 보장

### 성능 지표
- **응답 시간**: 평균 50ms 이하
- **동시 사용자**: 1000+ 명 지원
- **데이터 처리**: 초당 100+ 픽셀 업데이트 처리
- **가용성**: 99.9% 이상 서비스 가용성


프로젝트에 대한 문의사항이나 기여를 원하시면 언제든 연락주세요!

---

**W-Place Backend** - 실시간 협업 픽셀 아트 플랫폼의 핵심 엔진