# CHATR Real-Time Architecture — Decision Record

## Overview

CHATR's real-time layer uses a **dual-path hybrid model**:

| Path | Technology | Latency | Purpose |
|------|-----------|---------|---------|
| **Fast path** | Socket.IO | < 100ms | Instant message delivery |
| **Confirmation path** | Supabase Realtime (CDC) | 50–500ms | Persistence confirmation & fallback |

Both paths are active simultaneously. Messages are **deduplicated by UUID** so the UI only renders once.

---

## Architecture Diagram

```
Frontend (React + Capacitor)
  │
  ├─── Supabase Realtime ────────────────────────────────── Supabase PostgreSQL
  │     (postgres_changes, presence, broadcast)             (source of truth)
  │
  └─── Socket.IO Client ─── Socket.IO Server (Node.js) ─── Redis (pub/sub)
        (socket.io-client)   backend-mock/                  (Upstash or local)
        feature-flagged      server-enhanced.js
        VITE_ENABLE_SOCKET
```

---

## Component Map

### Backend (`backend-mock/`)

| File | Role |
|------|------|
| `server-enhanced.js` | Main server — extends original with JWT, Redis, rate limiting, batching |
| `middleware/jwtAuth.js` | Socket.IO auth middleware — validates Supabase JWT |
| `middleware/rateLimiter.js` | Token-bucket rate limiter (20 events/sec/user) |
| `redisAdapter.js` | Optional Redis adapter — no-op when REDIS_URL is absent |
| `nginx.conf` | NGINX config with sticky sessions for WebSocket |
| `Dockerfile.realtime` | Production container |

### Frontend (`src/`)

| File | Role |
|------|------|
| `services/socketService.ts` | **Singleton** — one socket for the entire app |
| `services/messaging/socketMessagingBridge.ts` | Dual-write after Supabase INSERT |
| `contexts/SocketContext.tsx` | React context — auth-driven connect/disconnect |
| `hooks/useSocketIO.tsx` | Component hook — room join/leave + subscribe |
| `hooks/useRealtimeMessages.tsx` | Additive messages — wraps useMessageSync + socket |
| `hooks/useSocketPresence.tsx` | Additive presence — wraps usePresenceTracking + socket |

---

## Message Flow (Dual-Path)

```
1. User presses Send
   │
2. Frontend: supabase.from('messages').insert(...)  ← Persistence guaranteed
   │
3. Frontend: socketMessagingBridge.emit(message)    ← Fast path starts
   │
   ├── 4a. Socket.IO → server → Redis pub → all nodes → recipient socket
   │         < 50ms total
   │         → recipient's useRealtimeMessages sees 'new_message' event
   │         → deduplication check: NOT in seenIds → adds to UI
   │
   └── 4b. Supabase CDC fires (50–500ms later)
             → recipient's useMessageSync sees postgres_changes INSERT
             → deduplication check: ALREADY in seenIds → dropped silently
```

---

## Scalability Guide

### Single-Node (no Redis)
- Omit `REDIS_URL` env var
- Handles 10k–50k concurrent connections per server
- Suitable for: development, beta, early production

### Multi-Node (with Redis)
- Set `REDIS_URL=rediss://...` (Upstash) or `redis://localhost:6379`
- Events broadcast across all nodes via Redis pub/sub
- Each node: stateless — any node handles any client
- Scale horizontally with `docker-compose ... up --scale realtime=N`

### Production (100k+ users)
- Redis Cluster or Upstash Pro
- Multiple Node pods behind NGINX (sticky sessions)
- Cloud Load Balancer (AWS ALB, GCP LB) in front of NGINX

---

## Environment Variables

### Backend (`backend-mock/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 3000) | Server port |
| `REDIS_URL` | No | Redis connection string. Absent = single-node mode |
| `SUPABASE_JWT_SECRET` | Production only | JWT verification secret from Supabase dashboard |
| `CORS_ORIGIN` | No (default: *) | Allowed CORS origins |

### Frontend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_SOCKET` | `false` | Master switch for Socket.IO layer |
| `VITE_SOCKET_URL` | `http://localhost:3000` | Backend WebSocket server URL |

---

## Rollback Plan

The Socket.IO layer is fully reversible:

1. Set `VITE_ENABLE_SOCKET=false` in frontend env → socket layer disabled, app uses Supabase Realtime only
2. All existing hooks (`useMessageSync`, `usePresenceTracking`, `useTypingIndicator`, `CallContext`) are unchanged
3. Remove `<SocketProvider>` from `App.tsx` (1-line revert) to completely remove from app

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Unauthenticated connections | JWT middleware rejects all connections without valid Supabase token |
| Unauthorized room access | `join_conversation` validates userId server-side (extend with DB check) |
| Abuse / flooding | Token-bucket rate limiter: 20 events/sec, 30 burst |
| Cross-origin | `CORS_ORIGIN` env var restricts allowed origins in production |
| Password in logs | Redis URL password masked in console output |

---

## Quick Start

### Development (no Redis)
```bash
cd backend-mock
cp .env.example .env
# Set SUPABASE_JWT_SECRET in .env (or leave blank for dev mode)
npm install
npm run dev
```

### With Redis (Docker)
```bash
# From project root
docker-compose -f docker-compose.realtime.yml up
```

### Enable on Frontend
```bash
# Add to .env (Vite)
VITE_ENABLE_SOCKET=true
VITE_SOCKET_URL=http://localhost:3000
```
