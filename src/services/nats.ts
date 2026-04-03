import {
  connect,
  AckPolicy,
  RetentionPolicy,
  StorageType,
} from "nats";
import type {
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  KV,
} from "nats";

const STREAM_NAME = "MESH_MESSAGES";
const KV_BUCKET = "mesh-presence";

// 7 days in nanoseconds
const MAX_AGE_NS = 7 * 24 * 60 * 60 * 1_000_000_000;
// 5 min duplicate window in nanoseconds
const DUPLICATE_WINDOW_NS = 300_000_000_000;
// 1 GB
const MAX_BYTES = 1_073_741_824;
// KV presence TTL: 300s in milliseconds
const KV_TTL_MS = 300_000;
// 30s ack wait in nanoseconds
const ACK_WAIT_NS = 30 * 1_000_000_000;

export interface PulledMessage {
  data: Uint8Array;
  ack: () => void;
}

export class NatsService {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private jsm!: JetStreamManager;
  private kv!: KV;

  constructor(private url: string) {}

  async connect(): Promise<void> {
    this.nc = await connect({ servers: this.url });
    this.jsm = await this.nc.jetstreamManager();
    this.js = this.nc.jetstream();

    // Ensure stream exists
    try {
      await this.jsm.streams.info(STREAM_NAME);
    } catch {
      // Stream doesn't exist — create it
      await this.jsm.streams.add({
        name: STREAM_NAME,
        subjects: ["mesh.agents.>", "mesh.broadcast"],
        retention: RetentionPolicy.Limits,
        max_age: MAX_AGE_NS,
        max_bytes: MAX_BYTES,
        storage: StorageType.File,
        num_replicas: 1,
        duplicate_window: DUPLICATE_WINDOW_NS,
      });
    }

    // Ensure KV bucket exists (creates if not present)
    this.kv = await this.js.views.kv(KV_BUCKET, { ttl: KV_TTL_MS });
  }

  async publish(
    subject: string,
    data: Uint8Array,
    msgId: string,
  ): Promise<void> {
    await this.js.publish(subject, data, { msgID: msgId });
  }

  async ensureConsumer(agentName: string): Promise<void> {
    const inboxConsumer = `agent-${agentName}`;
    const broadcastConsumer = `agent-${agentName}-broadcast`;

    // Inbox consumer
    try {
      await this.jsm.consumers.info(STREAM_NAME, inboxConsumer);
    } catch {
      await this.jsm.consumers.add(STREAM_NAME, {
        durable_name: inboxConsumer,
        filter_subject: `mesh.agents.${agentName}.inbox`,
        ack_policy: AckPolicy.Explicit,
        max_deliver: 5,
        ack_wait: ACK_WAIT_NS,
      });
    }

    // Broadcast consumer
    try {
      await this.jsm.consumers.info(STREAM_NAME, broadcastConsumer);
    } catch {
      await this.jsm.consumers.add(STREAM_NAME, {
        durable_name: broadcastConsumer,
        filter_subject: "mesh.broadcast",
        ack_policy: AckPolicy.Explicit,
        max_deliver: 5,
        ack_wait: ACK_WAIT_NS,
      });
    }
  }

  async deleteConsumer(agentName: string): Promise<void> {
    const inboxConsumer = `agent-${agentName}`;
    const broadcastConsumer = `agent-${agentName}-broadcast`;

    try {
      await this.jsm.consumers.delete(STREAM_NAME, inboxConsumer);
    } catch {
      // Ignore — consumer may not exist
    }

    try {
      await this.jsm.consumers.delete(STREAM_NAME, broadcastConsumer);
    } catch {
      // Ignore — consumer may not exist
    }
  }

  async pullMessages(
    agentName: string,
    limit: number,
  ): Promise<PulledMessage[]> {
    const results: PulledMessage[] = [];

    // Pull from inbox consumer
    try {
      const inboxConsumer = await this.js.consumers.get(
        STREAM_NAME,
        `agent-${agentName}`,
      );
      const inboxMessages = await inboxConsumer.fetch({
        max_messages: limit,
        expires: 2000,
      });
      for await (const msg of inboxMessages) {
        results.push({
          data: msg.data,
          ack: () => msg.ack(),
        });
      }
    } catch {
      // Consumer may not exist yet — skip
    }

    // Pull from broadcast consumer
    try {
      const broadcastConsumer = await this.js.consumers.get(
        STREAM_NAME,
        `agent-${agentName}-broadcast`,
      );
      const broadcastMessages = await broadcastConsumer.fetch({
        max_messages: limit,
        expires: 1000,
      });
      for await (const msg of broadcastMessages) {
        results.push({
          data: msg.data,
          ack: () => msg.ack(),
        });
      }
    } catch {
      // Consumer may not exist yet — skip
    }

    return results;
  }

  async updatePresence(
    agentName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const value = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
    await this.kv.put(`agent.${agentName}`, value);
  }

  async getPresence(): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>();

    const keys = await this.kv.keys();
    for await (const key of keys) {
      try {
        const entry = await this.kv.get(key);
        if (entry && entry.value.length > 0) {
          const decoded = new TextDecoder().decode(entry.value);
          const parsed = JSON.parse(decoded);
          // Strip "agent." prefix from key to get agentName
          const agentName = key.startsWith("agent.") ? key.slice(6) : key;
          result.set(agentName, parsed);
        }
      } catch {
        // Skip unparseable entries
      }
    }

    return result;
  }

  async ping(): Promise<boolean> {
    try {
      await this.nc.flush();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.nc.drain();
  }
}
