<!-- Generated: 2025-06-21 10:28:45 UTC -->
# VibeTunnel Architecture

VibeTunnel is a modern terminal multiplexer featuring a Node.js/Bun-powered server backend and real-time web interface. The architecture prioritizes performance, security, and seamless experience through WebSocket-based communication.

The system consists of two main components: a Node.js/Bun server handling terminal sessions, and a web frontend for browser-based interaction. These components communicate through a well-defined REST API and WebSocket protocol for real-time terminal I/O streaming.

## Component Map

**Node.js/Bun Server** - JavaScript backend in web/src/server/
- app.ts - Express application setup and configuration
- server.ts - HTTP server initialization and shutdown handling
- pty/pty-manager.ts - Native PTY process management
- pty/session-manager.ts - Terminal session lifecycle
- services/terminal-manager.ts - High-level terminal operations
- services/ws-v3-hub.ts - Unified `/ws` WebSocket v3 hub (multiplexed)
- routes/sessions.ts - REST API endpoints for session management

**Web Frontend** - TypeScript/React app in web/src/client/
- Terminal rendering using ghostty-web
- WebSocket client for real-time updates
- Session management UI

## Key Files

**Session Models**
- web/src/server/pty/types.ts - TypeScript session types

**Binary Integration**
- web/build-native.js - Native module compilation for pty.node

**Configuration**
- web/src/server/app.ts (lines 20-31) - Server configuration interface

## Data Flow

**Session Creation Flow**
1. Client request → POST /api/sessions (web/src/server/routes/sessions.ts:createSessionRoutes)
2. TerminalManager.createTerminal() (web/src/server/services/terminal-manager.ts) 
3. PtyManager.spawn() (web/src/server/pty/pty-manager.ts) - Spawns native PTY process
4. Session stored in manager, WebSocket upgrade prepared
5. Response with `sessionId` (client connects to `/ws` and subscribes)

**Terminal I/O Stream**
1. Client connects → WebSocket upgrade to `/ws` (v3 framing)
2. Client subscribes → `SUBSCRIBE(sessionId, flags)` frames
3. Client input/resize → `INPUT_*` / `RESIZE` frames
4. Server routes frames → `WsV3Hub` (web/src/server/services/ws-v3-hub.ts)
5. PTY output → cast tail (`CastOutputHub`) → `STDOUT` frames
6. Server-side Ghostty → `SNAPSHOT_VT` frames for previews/resync
7. Client renders:
   - interactive: `ghostty-web` (`vibe-terminal`)
   - previews: VT snapshots (`vibe-terminal-buffer`)

**Buffer Optimization Protocol**
- WS v3 framing uses `VT` magic + version `3` (see docs/websocket.md)
- Full VT snapshots (`SNAPSHOT_VT`) for previews/resync
- Stdout streaming (`STDOUT`) for interactive terminals

**Server Lifecycle Management**
1. ServerManager.start() (mac/VibeTunnel/Core/Services/ServerManager.swift)
2. Creates BunServer instance
3. BaseProcessServer.start() spawns server process
4. Health checks via HTTP /health endpoint
5. Log streaming through Process.standardOutput pipe
6. Graceful shutdown on stop() with SIGTERM

**Remote Access Architecture**
- NgrokService (mac/VibeTunnel/Core/Services/NgrokService.swift) - Secure tunnel creation
- HQClient (web/src/server/services/hq-client.ts) - Headquarters mode for multi-server
- RemoteRegistry (web/src/server/services/remote-registry.ts) - Remote server discovery

**Authentication Flow**
- Basic Auth middleware (web/src/server/middleware/auth.ts)
- Credentials stored securely via environment variables or PAM
- Optional password protection for network access
