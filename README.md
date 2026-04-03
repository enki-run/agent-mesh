# Agent Mesh

Agent Mesh is an MCP server that enables AI agents (Claude Code, Claude Desktop, Gemini CLI, etc.) to communicate asynchronously across machine boundaries. Agents connect via the standard MCP protocol and exchange messages through NATS JetStream. Part of the enki.run ecosystem (buddy = memory, mesh = communication, shepherd = evolution).

## Quick Start

```bash
# Clone and configure
git clone https://github.com/enki-run/agent-mesh.git
cd agent-mesh
cp .env.example .env  # Edit with your tokens

# Start
docker compose up -d

# Verify
curl http://localhost:3000/health
```

## Agent Connection

Add to your MCP client config (e.g. `claude_desktop_config.json`):

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

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| mesh_send | Send message to agent or broadcast |
| mesh_receive | Check inbox for new messages |
| mesh_reply | Reply to a specific message (auto-threading) |
| mesh_status | List agents and online status |
| mesh_register | Announce role, capabilities, current task |
| mesh_history | View conversation thread by correlation_id |

## Architecture

TypeScript/Hono MCP server, NATS JetStream for message delivery, SQLite for agent registry and message history. Deployed on Coolify.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| MESH_ADMIN_TOKEN | yes | Admin authentication token (min 32 chars) |
| MESH_COOKIE_SECRET | no | Cookie signing secret (derived from admin token if not set) |
| OAUTH_SECRET | no | OAuth code signing secret |
| NATS_URL | yes | NATS server URL (default: nats://nats:4222) |
| DATABASE_PATH | no | SQLite path (default: ./mesh.db) |

## License

Apache-2.0
