import { ulid } from "ulidx";
import type { Message, MessagePriority } from "../types";
import { MAX_PAYLOAD_BYTES, MAX_CONTEXT_LENGTH, DEFAULT_TTL_SECONDS } from "../types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createMessage(params: {
  from: string;
  to: string;
  type: string;
  payload: string;
  context: string;
  correlation_id?: string;
  reply_to?: string;
  priority?: MessagePriority;
  ttl_seconds?: number;
}): Message {
  if (params.context.length > MAX_CONTEXT_LENGTH) {
    throw new Error(
      `Context exceeds maximum length of ${MAX_CONTEXT_LENGTH} chars (got ${params.context.length})`,
    );
  }

  const payloadBytes = encoder.encode(params.payload);
  if (payloadBytes.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Payload exceeds maximum size of ${MAX_PAYLOAD_BYTES} bytes (got ${payloadBytes.byteLength})`,
    );
  }

  return {
    id: `msg_${ulid()}`,
    from: params.from,
    to: params.to,
    type: params.type,
    payload: params.payload,
    context: params.context,
    correlation_id: params.correlation_id ?? null,
    reply_to: params.reply_to ?? null,
    priority: params.priority ?? "normal",
    ttl_seconds: params.ttl_seconds ?? DEFAULT_TTL_SECONDS,
    created_at: new Date().toISOString(),
  };
}

/**
 * Checks whether a message has passed its delivery deadline.
 *
 * `ttl_seconds` is a **delivery deadline**, not a data-lifetime guarantee:
 *
 * - After expiry, `mesh_receive` silently acks and drops the message
 *   (see src/mcp/tools/messaging.ts:156) — an expired message will never
 *   be delivered to a recipient that wasn't polling fast enough.
 * - Expired messages **remain in SQLite** until the retention-based
 *   rotation (`rotateMessages(MESSAGE_RETENTION_DAYS)`, default 30 days)
 *   sweeps them away. They are visible via `mesh_history` until then.
 * - NATS JetStream enforces an independent 7-day MAX_AGE on the underlying
 *   stream (see src/services/nats.ts:18), which is a hard upper bound
 *   regardless of any per-message ttl_seconds.
 *
 * This separation is intentional: the bus semantics (delivery) and the
 * audit-trail semantics (history/compliance) are decoupled.
 */
export function isMessageExpired(msg: Message): boolean {
  const createdMs = new Date(msg.created_at).getTime();
  const expiresMs = createdMs + msg.ttl_seconds * 1000;
  return Date.now() > expiresMs;
}

export function serializeMessage(msg: Message): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

export function deserializeMessage(data: Uint8Array): Message {
  return JSON.parse(decoder.decode(data)) as Message;
}
