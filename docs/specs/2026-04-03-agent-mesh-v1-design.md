# Agent Mesh V1 — Design Spec

**Datum:** 2026-04-03
**Status:** Draft
**Repo:** enki-run/agent-mesh

## 1. Zweck

Agent Mesh ist ein MCP-Server, der AI-Agents (Claude Code, Claude Desktop, Gemini CLI, etc.) ermoeglicht, asynchron miteinander zu kommunizieren — ueber Maschinengrenzen hinweg.

**Was es ist:** Ein zentraler Kommunikations-Hub, der MCP-Tools bereitstellt. Agents verbinden sich wie bei buddy, bekommen Kommunikations-Tools: Nachrichten senden, empfangen, auf Antworten warten, andere Agents entdecken.

**Was es nicht ist:** Kein Agent-Framework, kein Orchestrator. Die Intelligenz bleibt bei den AI-Agents. Agent Mesh ist die Infrastruktur — das Nervensystem.

### Einordnung im Oekosystem

- **buddy** = Gedaechtnis (gemeinsames Wissen via MCP)
- **Agent Mesh** = Nervensystem (gezielte Kommunikation via NATS)
- **Shepherd** = Evolution (autonome Selbstverbesserung)

### Beispiel-Flow

```
Agent A (Developer, lokal)     Agent B (Ops, Server)     Agent C (Sec, CI)
        |                              |                        |
        |-- mesh_send("feature ready") |                        |
        |                     mesh_receive()                    |
        |                     "deploy failed: error X"          |
        |                              |-- mesh_send(to:A) ---->|
        |<---- mesh_receive() ---------|                        |
        |                                                       |
        |-- mesh_send(to:C, "review this fix") --------------->|
        |                                              mesh_receive()
        |                                              "LGTM, no vulns"
        |<---------------------------------------------|
        |-- mesh_send(to:B, "fix v2 ready") -->|
```

## 2. Tech-Stack

| Schicht | Technologie | Begruendung |
|---------|-------------|-------------|
| Runtime | Node.js Container | Persistente NATS-Verbindung (nicht moeglich auf Cloudflare Workers) |
| Framework | Hono | Gleicher Stack wie buddy/ernie, bewahrt |
| MCP | @modelcontextprotocol/sdk | Standard MCP-Implementierung |
| Message Broker | NATS JetStream | Persistent Streams, At-Least-Once Delivery, KV Store |
| Persistenz | SQLite (better-sqlite3) | Agent-Registry, Tokens, Config |
| Runtime State | NATS KV + Streams | Messages, Presence |
| Sprache | TypeScript | Gleicher Stack wie buddy/ernie |

### Architektur: Monolith mit sauberen Layern

Ein Prozess, drei Schichten:
1. **MCP-Layer** — Tools, Auth, OAuth, Dashboard
2. **NATS-Layer** — Pub/Sub, KV, Stream-Management
3. **Storage-Layer** — SQLite fuer Agent-Management

Intern klar getrennt, spaeter aufbrechbar. Fuer V1 ein Container.

## 3. MCP-Tools

### mesh_send

Nachricht an einen Agent oder Broadcast senden.

Parameter:
- `to` (string, required) — Agent-Name oder `"broadcast"`
- `type` (string, required) — Nachrichtentyp (siehe empfohlene Typen unten)
- `payload` (string, required) — Der eigentliche Inhalt. Max 64 KB.
- `context` (string, required) — Kurzbeschreibung: Projekt, Status, Aufgabe des Senders. Empfaenger muss dies auswerten bevor er handelt.
- `correlation_id` (string, optional) — Thread-Root-ID fuer Konversationen. Bei Antworten immer die ID der ersten Nachricht im Thread verwenden.
- `priority` (enum, optional) — `low`, `normal`, `high`. Default: `normal`
- `ttl_seconds` (number, optional) — Nachricht verfaellt nach N Sekunden. Default: 86400 (24h)

Validierung:
- `to` muss ein registrierter, aktiver Agent sein (oder `"broadcast"`). Fehler wenn Agent nicht existiert oder deaktiviert ist.
- `payload` darf 64 KB nicht ueberschreiten.
- Aktualisiert `last_seen_at` des sendenden Agents.

Rate Limit: 60 Nachrichten pro Minute pro Agent (Token-Bucket). Ueberschreitung liefert Fehler mit explizitem Retry-After Hinweis (z.B. `"Rate limit exceeded. Wait 15 seconds before retrying."`). Der Retry-After Text ist essentiell, damit LLMs in Fehler-Loops lernen zu pausieren statt sofort zu retrien.

Returniert: `{ id, to, type, created_at }` — Bestaetigung dass die Nachricht zugestellt wurde.

### mesh_receive

Eigene neue Nachrichten abholen (Pull-basiert).

Parameter:
- `limit` (number, optional) — Max Anzahl. Default: 10
- `since` (string, optional) — Zeitfilter, z.B. `"5min"`, `"1h"`, `"2026-04-03T14:00:00Z"`
- `type` (string, optional) — Nur Nachrichten dieses Typs

Verhalten:
- Returniert Liste von Messages mit allen Feldern.
- Markiert abgeholte Nachrichten als gelesen (NATS Consumer Ack).
- Prueft TTL: Nachrichten mit `created_at + ttl_seconds < now` werden verworfen (ack ohne Zustellung).
- Aktualisiert `last_seen_at` des empfangenden Agents.
- Wenn keine neuen Nachrichten: Returniert `{ messages: [], hint: "No new messages." }` — klarer Rueckgabewert damit das LLM nicht halluziniert.

### mesh_reply

Auf eine bestimmte Nachricht antworten.

Parameter:
- `message_id` (string, required) — ID der Nachricht auf die geantwortet wird
- `payload` (string, required) — Antwortinhalt. Max 64 KB.
- `context` (string, required) — Aktueller Arbeitskontext des Antwortenden

Verhalten:
- Setzt `correlation_id` auf die **Thread-Root-ID**: Wenn die Originalnachricht bereits eine `correlation_id` hat, wird diese uebernommen. Wenn nicht, wird die `message_id` der Originalnachricht zur Thread-Root.
- Damit zeigt `correlation_id` immer auf die erste Nachricht im Thread, nicht auf den direkten Parent.
- `reply_to` wird automatisch auf die `message_id` gesetzt (direkter Bezug).
- Aktualisiert `last_seen_at` des sendenden Agents.

Rate Limit: Gleich wie mesh_send (60/min pro Agent, geteiltes Budget).

### mesh_status

Agent-Registry und Online-Status abrufen.

Parameter: keine

Returniert Liste aller registrierten Agents mit: name, role, capabilities, is_active, last_seen_at, working_on. Online-Status wird aus der NATS KV Presence abgeleitet (online wenn Key existiert und nicht abgelaufen).

### mesh_history

Nachrichtenverlauf fuer eine Konversation abrufen.

Parameter:
- `correlation_id` (string, required) — Die Thread-Root-ID der Konversation
- `limit` (number, optional) — Max Anzahl. Default: 50

Returniert alle Nachrichten mit dieser `correlation_id` (= gleicher Thread), chronologisch sortiert. Inkl. der Root-Nachricht selbst.

### mesh_register

Agent meldet oder aktualisiert seine Praesenz.

Parameter:
- `role` (string, optional) — Aktuelle Rolle, z.B. `"developer"`, `"ops"`
- `capabilities` (string[], optional) — Verfuegbare Tools/Faehigkeiten
- `working_on` (string, optional) — Aktuelle Aufgabe/Projekt

Aktualisiert den `last_seen_at` Timestamp und den NATS KV Presence-Key. Kann als Heartbeat genutzt werden.

### Empfohlene Message-Typen (Convention, nicht erzwungen)

| Typ | Verwendung |
|-----|-----------|
| `deploy_request` | Bitte um Deployment |
| `deploy_status` | Deployment-Ergebnis (success/failure) |
| `review_request` | Bitte um Code/Security Review |
| `review_result` | Review-Ergebnis |
| `task_update` | Status-Update zu einer Aufgabe |
| `incident` | Fehler/Problem melden |
| `info` | Allgemeine Information |
| `question` | Frage an anderen Agent |

Agents koennen eigene Typen verwenden. Die Liste dient als Orientierung fuer konsistente Kommunikation.

## 4. Message Envelope

```json
{
  "id": "msg_01ABCDEF...",
  "from": "agent-a",
  "to": "agent-b",
  "type": "deploy_request",
  "payload": "Fix v2 pushed to main...",
  "context": "Projekt: log-cluster | Task: fix/redis-timeout | Status: Fix ready",
  "correlation_id": "msg_01ROOT...",
  "reply_to": "msg_01PARENT...",
  "priority": "normal",
  "ttl_seconds": 86400,
  "created_at": "2026-04-03T14:30:00Z"
}
```

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `id` | auto | ULID, vom Server generiert. Wird als NATS Msg-ID fuer Deduplizierung genutzt. |
| `from` | auto | Resolved aus Auth-Token, serverseitig gesetzt |
| `to` | ja | Agent-Name oder `"broadcast"` |
| `type` | ja | Nachrichtentyp (frei, empfohlene Liste siehe oben) |
| `payload` | ja | Der eigentliche Inhalt (Freitext, max 64 KB) |
| `context` | ja | Arbeitskontext des Senders (Projekt, Aufgabe, Status) |
| `correlation_id` | nein | Thread-Root-ID — zeigt immer auf die erste Nachricht im Thread |
| `reply_to` | nein | Direkte Parent-Message-ID (fuer Bezug innerhalb eines Threads) |
| `priority` | nein | `low`, `normal`, `high`. Default: `normal` |
| `ttl_seconds` | nein | Verfallszeit. Default: 86400 (24h) |
| `created_at` | auto | ISO 8601 Timestamp |

### Context-Feld

Das `context`-Feld ist Pflicht und dient als Arbeitsbeschreibung des Senders. Empfangende Agents muessen den Context auswerten bevor sie handeln, um sicherzustellen, dass sie im richtigen Arbeitskontext operieren.

Die MCP-Tool-Beschreibungen instruieren Agents entsprechend:
- `mesh_send`: "context ist Pflicht. Beschreibe kurz woran du arbeitest: Projekt, aktuelle Aufgabe, Status."
- `mesh_receive`: "Werte den context jeder Nachricht aus bevor du handelst. Stelle sicher, dass du im richtigen Arbeitskontext bist."

### Threading-Modell

```
msg_01ROOT  (A→B, correlation_id: null)
  msg_02    (B→A, correlation_id: msg_01ROOT, reply_to: msg_01ROOT)
  msg_03    (A→C, correlation_id: msg_01ROOT, reply_to: msg_02)
  msg_04    (C→A, correlation_id: msg_01ROOT, reply_to: msg_03)
```

`mesh_history(correlation_id: "msg_01ROOT")` liefert alle 4 Nachrichten.

### Deduplizierung

NATS JetStream Deduplizierung anhand der `id` (ULID). Verhindert doppelte Nachrichten bei Netzwerk-Retries.

## 5. Agent-Identity & Auth

### Zwei Auth-Wege

| Client-Typ | Auth-Methode | Beispiel |
|------------|-------------|----------|
| Interaktiv (Claude Desktop, Browser) | OAuth 2.1 + PKCE | User autorisiert im Browser |
| Headless (Claude Code, Gemini CLI) | Bearer Token | Token bei Agent-Registrierung generiert |

### Agent-Registry (SQLite)

```sql
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role        TEXT,
  capabilities TEXT,
  token_hash  TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  working_on  TEXT,
  last_seen_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE activity_log (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  summary     TEXT,
  agent_name  TEXT,
  created_at  TEXT NOT NULL
);
```

### Sicherheitsgarantien

- `from`-Feld wird serverseitig aus dem Auth-Token resolved — kein Agent kann sich als anderer ausgeben
- Agents koennen nur ihre eigene Inbox lesen (NATS Subject: `mesh.agents.{own_name}.inbox`)
- Broadcasts gehen an alle (`mesh.broadcast`)
- Agent-Verwaltung (erstellen, deaktivieren, Token-Reset) nur fuer Admin
- Tokens werden SHA-256 gehasht gespeichert, Klartext nur einmal bei Erstellung angezeigt
- Rate Limiting: 60 Nachrichten pro Minute pro Agent (Token-Bucket)
- Payload-Limit: 64 KB pro Nachricht

### Dashboard

Server-rendered (Hono JSX), gleicher Aufbau wie ernie:
- Agent-Verwaltung (CRUD, Token-Reset, Aktivieren/Deaktivieren)
- Mesh-Status (Online-Agents, letzte Aktivitaet)
- Message-Log (letzte Nachrichten, filterbar nach Agent/Typ)
- Login via OAuth oder Admin-Token

## 6. NATS-Architektur

### Internes Setup

NATS ist nicht oeffentlich exponiert. Nur der MCP-Server kommuniziert mit NATS, innerhalb des Docker-Netzwerks.

### JetStream Stream

```
Stream: MESH_MESSAGES
  Subjects: mesh.agents.>, mesh.broadcast
  Retention: Limits (MaxAge: 7 Tage, MaxBytes: 1GB)
  Storage: File
  Replicas: 1 (V1, Single Node)
  Deduplizierung: Window 5min (anhand Msg-ID = ULID)
```

### Consumer pro Agent

Jeder Agent bekommt einen durable Consumer:
```
Consumer: agent-{name}
  FilterSubject: mesh.agents.{name}.inbox
  AckPolicy: Explicit
  MaxDeliver: 5
  AckWait: 30s
```

Plus einen shared Consumer fuer Broadcasts:
```
Consumer: agent-{name}-broadcast
  FilterSubject: mesh.broadcast
  AckPolicy: Explicit
```

**Dead Letter Handling:** Nach MaxDeliver (5) Fehlversuchen wird die Nachricht vom Consumer verworfen. Der MCP-Server loggt dies **asynchron** im Activity Log: `message_dropped` mit Message-ID, Agent-Name und Grund. Der Log-Write darf den NATS-Ack-Prozess nicht blockieren. Kein separater Dead-Letter-Stream in V1.

### KV Bucket

```
Bucket: mesh-presence
  TTL: 300s (5 Minuten)
  Keys: agent.{name} → { role, capabilities, working_on, timestamp }
```

Presence wird automatisch aktualisiert bei: `mesh_send`, `mesh_receive`, `mesh_reply`, `mesh_register`. Nach 5 Minuten ohne MCP-Interaktion gilt der Agent als offline.

### Subject-Mapping

| Aktion | NATS Subject |
|--------|-------------|
| Nachricht an agent-b | `mesh.agents.agent-b.inbox` |
| Broadcast | `mesh.broadcast` |

### TTL-Handling

NATS JetStream hat keine per-Message-TTL. Die TTL wird im Message Envelope gespeichert und vom MCP-Server bei `mesh_receive` geprueft:
- `created_at + ttl_seconds < now` → Nachricht wird verworfen (NATS Ack ohne Zustellung)
- Stream-Level MaxAge (7 Tage) dient als hartes Limit

### Offline-Agent Backpressure

Wenn ein Agent deaktiviert wird, wird sein durable Consumer geloescht. Unzugestellte Nachrichten verfallen ueber das Stream MaxAge (7 Tage). Bei Reaktivierung wird ein neuer Consumer erstellt — alte Nachrichten sind dann bereits verfallen.

## 7. Infrastruktur & Deployment

### Coolify Setup

Zwei Container via docker-compose:

```yaml
services:
  mesh:
    build: .
    environment:
      - NATS_URL=nats://nats:4222
      - MESH_ADMIN_TOKEN=${MESH_ADMIN_TOKEN}
      - MESH_COOKIE_SECRET=${MESH_COOKIE_SECRET}
      - OAUTH_SECRET=${OAUTH_SECRET}
      - DATABASE_PATH=/data/mesh.db
    volumes:
      - mesh-data:/data
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  nats:
    image: nats:2-alpine
    command: ["-js", "-sd", "/data", "-m", "8222"]
    volumes:
      - nats-data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8222/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  mesh-data:
  nats-data:
```

### Health Check Endpoint

`GET /health` — Prueft:
- NATS-Connectivity (Ping)
- SQLite lesbar (SELECT 1)
- Returniert `200 OK` mit `{ status: "ok", nats: "connected", db: "ok" }` oder `503` bei Fehler.

### Domain

`mesh.enki.run` — Coolify managed TLS.

### Agent-Anbindung

MCP-Config fuer einen Agent (z.B. Claude Code):

```json
{
  "mcpServers": {
    "mesh": {
      "type": "streamable-http",
      "url": "https://mesh.enki.run/mcp",
      "headers": {
        "Authorization": "Bearer bt_xxxx..."
      }
    }
  }
}
```

## 8. Bekannte Limitierungen & Risiken (V1)

### Pull-Problem

MCP ist Request/Response — der Server kann nicht proaktiv an Clients pushen. Agents muessen aktiv `mesh_receive` aufrufen. Fuer interaktive Agents (Claude Desktop) funktioniert das ueber User-Prompts. Fuer Headless-Agents (dauerlaufende Prozesse) braucht es einen externen Loop der regelmaessig `mesh_receive` triggert. Dies ist eine bewusste V1-Limitierung — MCP bietet aktuell keine Server-Push-Mechanik.

### Broadcast-Stuerme

Bei `mesh_send(to: "broadcast")` reagieren potenziell alle Agents gleichzeitig. V1 hat keinen Claim/Lock-Mechanismus. Convention: Broadcasts fuer Info/Status-Updates nutzen, nicht fuer Tasks die nur ein Agent bearbeiten soll. Fuer gezielte Delegation `to: "agent-name"` verwenden. Locking/Claiming ist V2-Scope.

### Ack-bei-Abholung Risiko

`mesh_receive` ackt Nachrichten bei Abholung. Wenn der MCP-Response an den Client fehlschlaegt (Netzwerk, Timeout), ist die Nachricht trotzdem als gelesen markiert. Gleiche Kategorie wie das naechste Problem — fuer V1 akzeptabel, da NATS AckWait (30s) einen teilweisen Schutz bietet: Wenn der Ack nicht rechtzeitig bestaetigt wird, redelivert NATS automatisch.

### Kein Retry bei Agent-Fehler

Wenn ein Agent eine Nachricht empfaengt (`mesh_receive` + Ack) aber seine Verarbeitung fehlschlaegt, ist die Nachricht trotzdem als gelesen markiert. V1 hat kein Application-Level-Retry. Agents muessen selbst bei Bedarf eine neue Nachricht senden.

## 9. Nicht in V1

| Feature | Version |
|---------|---------|
| mesh-cli (CLI-Tool) | V1.1 |
| Vector → ClickHouse Audit Pipeline | V1.1 |
| Grafana Dashboard | V1.1 |
| Broadcast Claim/Lock-Mechanismus | V2 |
| NATS Auth/NKeys | V2 (NATS ist intern, nicht exponiert) |
| Closed-Loop Controller (auto-fix) | V2 |
| buddy Post-Write Hook | V2 |
| GitHub Webhook → NATS Bridge | V2 |
| MCP Sidecar (separate Bridge) | nicht noetig — ist der MCP-Server selbst |
| LLM-Analyse im Server | nie (bleibt bei den Agents) |

## 10. Repo-Struktur

```
agent-mesh/
  src/
    index.ts              — Hono App, Routes, Middleware
    auth.ts               — Token/Cookie Auth, CSRF, OAuth
    oauth.ts              — OAuth 2.1 + PKCE
    types.ts              — Interfaces, Enums, Validation
    mcp/
      server.ts           — MCP Server Setup
      tools/
        messaging.ts      — mesh_send, mesh_receive, mesh_reply
        registry.ts       — mesh_status, mesh_register
        history.ts        — mesh_history
    services/
      agent.ts            — Agent CRUD, Token Management
      nats.ts             — NATS Client, Pub/Sub, KV, Stream Init
      message.ts          — Message Envelope, Validation, TTL
      activity.ts         — Activity/Audit Log
      ratelimit.ts        — Token-Bucket Rate Limiter (per Agent)
    views/
      layout.tsx          — Base Layout
      home.tsx            — Dashboard
      agents.tsx          — Agent-Verwaltung
      messages.tsx        — Message-Log
      login.tsx           — OAuth Login
  migrations/
    0001_initial.sql      — Agents, Activity Log
  docker-compose.yml
  Dockerfile
  package.json
  tsconfig.json
  README.md
  CLAUDE.md
```
