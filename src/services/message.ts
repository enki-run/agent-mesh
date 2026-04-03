import { ulid } from "ulidx";
import type { Message, MessagePriority } from "../types";
import { MAX_PAYLOAD_BYTES, DEFAULT_TTL_SECONDS } from "../types";

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
