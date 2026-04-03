# Agent Mesh V1 — Test Report

**Datum:** 2026-04-03T14:34Z
**Umgebung:** mesh.enki.run (Coolify, kai/152.53.84.172)
**Version:** 1.0.0

## Ergebnis: 29/29 bestanden

## 1. Health Endpoint (3/3)

| Test | Ergebnis |
|------|----------|
| GET /health returns ok | PASS |
| NATS connected | PASS |
| DB ok | PASS |

## 2. Authentication (4/4)

| Test | Ergebnis |
|------|----------|
| Request ohne Token → 401 | PASS |
| Falscher Token → 401 | PASS |
| Admin Token → Agents-Liste | PASS |
| Agent Token → Agents-Liste | PASS |

## 3. mesh_register (3/3)

| Test | Ergebnis |
|------|----------|
| Register gibt registered:true | PASS |
| Role wird gesetzt | PASS |
| working_on wird gesetzt | PASS |

## 4. mesh_status (6/6)

| Test | Ergebnis |
|------|----------|
| Zeigt Agent-Liste | PASS |
| Zeigt count | PASS |
| Zeigt online Feld | PASS |
| Zeigt is_active Feld | PASS |
| Zeigt registrierten Agent "Lorri" | PASS |
| Zeigt registrierten Agent "Ronny" | PASS |

## 5. mesh_send (5/5)

| Test | Ergebnis |
|------|----------|
| Direct Message → msg_id zurueck | PASS |
| Broadcast → msg_id zurueck | PASS |
| Non-existent Agent → Fehlermeldung | PASS |
| Priority high funktioniert | PASS |
| correlation_id wird akzeptiert | PASS |

## 6. mesh_receive (2/2)

| Test | Ergebnis |
|------|----------|
| Receive gibt messages Array | PASS |
| Leere Inbox → "No new messages." hint | PASS |

## 7. mesh_reply (2/2)

| Test | Ergebnis |
|------|----------|
| Reply auf existierende Message → msg_id | PASS |
| Reply auf nicht-existente Message → Fehler | PASS |

## 8. mesh_history (3/3)

| Test | Ergebnis |
|------|----------|
| History gibt messages Array | PASS |
| Thread zeigt 2 Messages (Ping + Pong) | PASS |
| Leerer Thread → leere Liste | PASS |

## 9. Payload Limit (1/1)

| Test | Ergebnis |
|------|----------|
| Payload >64KB wird von Zod abgelehnt (too_big) | PASS |

## Getestete Agents

| Agent | Role | Online | Erstellt ueber |
|-------|------|--------|---------------|
| Ronny | tester | ja | Dashboard |
| Lorri | developer | ja | Dashboard |

## Threading-Verifikation

Thread-Root msg_01KN... mit mesh_reply beantwortet:
- Originalnachricht: Ronny → Ronny, type: question, "Ping?"
- Reply: Ronny → Ronny, type: reply, "Pong!", correlation_id zeigt auf Root
- mesh_history(correlation_id) liefert beide Messages chronologisch

## Bekannte Einschraenkungen (V1, kein Bug)

- mesh_receive ist Pull-basiert (MCP hat kein Server-Push)
- NATS Presence TTL 300s — Agent erscheint offline nach 5min ohne MCP-Interaktion
- Kein Rate-Limit-Test durchgefuehrt (braeuchte 60+ Requests/Minute)
