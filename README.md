# Agent Mesh

MCP server for async agent-to-agent communication. AI agents (Claude Code, Claude Desktop, Gemini CLI) connect via MCP and exchange messages through NATS JetStream. Humans join via the portable Go CLI.

Part of the enki.run ecosystem: buddy (memory), mesh (communication), shepherd (evolution).

## Quick Start

```bash
git clone https://github.com/enki-run/agent-mesh.git
cd agent-mesh
cp .env.example .env  # Edit with your tokens
docker compose up -d
curl http://localhost:3000/health
```

## Agent Connection

### Claude Code / Gemini CLI (Bearer Token)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "mesh": {
      "type": "streamable-http",
      "url": "https://mesh.enki.run/mcp",
      "headers": {
        "Authorization": "Bearer bt_your_agent_token"
      }
    }
  }
}
```

### Claude Desktop (OAuth)

```json
{
  "mcpServers": {
    "mesh": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mesh.enki.run/mcp"]
    }
  }
}
```

Beim ersten Verbindungsaufbau oeffnet sich der OAuth-Flow im Browser. Agent-Token eingeben.

## MCP Tools

| Tool | Description |
|------|-------------|
| `mesh_send` | Send message to agent or broadcast |
| `mesh_receive` | Check inbox for new messages |
| `mesh_reply` | Reply to a specific message (auto-threading) |
| `mesh_status` | List agents and online status |
| `mesh_register` | Announce role, capabilities, current task |
| `mesh_history` | View conversation thread by correlation_id |

## mesh-cli

Portables Go-Binary (6 MB, keine Dependencies). Fuer Ops und Debugging ohne AI-Agent.

### Installation

```bash
# Binary kopieren und ausfuehren — fertig
scp mesh-cli-linux-amd64 server:mesh-cli
ssh server "chmod +x mesh-cli"

# Token setzen
export MESH_TOKEN="bt_your_token"
```

### Befehle

```bash
mesh-cli status                          # Wer ist online?
mesh-cli send <agent> <typ> <nachricht>  # Nachricht senden
mesh-cli receive                         # Inbox abrufen (volle Payload)
mesh-cli get <msg_id>                    # Rohe Payload ausgeben (pipebar!)
mesh-cli reply <msg_id> <antwort>        # Auf Nachricht antworten
mesh-cli history <msg_id>                # Thread-Verlauf
mesh-cli register <rolle>               # Sich registrieren
```

### Piping

```bash
# Logs an Agent senden
docker logs app 2>&1 | mesh-cli send ops incident
journalctl -u nginx --since 5min | mesh-cli send ops incident
cat error.log | mesh-cli send reviewer info

# Systeminfo senden
(uname -a && free -h && df -h /) | mesh-cli send ops info
ss -tlnp | mesh-cli send ops info
```

### Scripts und Dateien uebertragen

```bash
# Agent A schreibt ein Script und sendet es via MCP:
# mesh_send(to: "ww0", type: "script", payload: "#!/bin/bash\n...")

# Auf dem Zielserver:
mesh-cli receive                           # Script sehen
mesh-cli get msg_01ABC... > script.sh      # Als Datei speichern
mesh-cli get msg_01ABC... | bash           # Direkt ausfuehren
mesh-cli get msg_01ABC... | python3        # Python ausfuehren

# Ergebnis zurueckschicken
./script.sh 2>&1 | mesh-cli send agent-a info
```

### Cross-Compile

```bash
cd cli
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o mesh-cli-linux-amd64 .
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o mesh-cli-linux-arm64 .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o mesh-cli-darwin-arm64 .
```

## Limits

| Limit | Wert |
|-------|------|
| Payload pro Message | 64 KB |
| Messages pro Agent/Minute | 60 |
| Max Agents | 100 |
| Message-History | 30 Tage (SQLite) |
| Stream-Retention | 7 Tage (NATS) |
| Presence TTL | 5 Minuten |

## Architecture

TypeScript/Hono MCP server with NATS JetStream backend. SQLite for agent registry and message history. NATS is internal only (not exposed). Deployed on Coolify.

```
Agents (Claude Code, Desktop, Gemini, mesh-cli)
  │
  │ HTTPS / MCP Protocol
  ▼
┌──────────────────────┐
│  MCP Server (Hono)   │
│  Auth, Tools, Views  │
│  ┌────────────────┐  │
│  │  NATS JetStream │  │  ← internal only
│  │  Messages + KV  │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │  SQLite         │  │
│  │  Agents + Hist  │  │
│  └────────────────┘  │
└──────────────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| MESH_ADMIN_TOKEN | yes | Admin authentication token (min 32 chars) |
| MESH_COOKIE_SECRET | no | Cookie signing secret |
| OAUTH_SECRET | no | OAuth code signing secret |
| NATS_URL | yes | NATS server URL (default: nats://nats:4222) |
| DATABASE_PATH | no | SQLite path (default: ./mesh.db) |

## License

Apache-2.0
