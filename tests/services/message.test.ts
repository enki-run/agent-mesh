import { describe, it, expect } from "vitest";
import {
  createMessage,
  isMessageExpired,
  serializeMessage,
  deserializeMessage,
} from "../../src/services/message";

describe("Message Service", () => {
  it("creates message with valid data", () => {
    const msg = createMessage({
      from: "agent-a",
      to: "agent-b",
      type: "task_update",
      payload: JSON.stringify({ status: "done" }),
      context: "Working on feature X",
    });

    expect(msg.id).toMatch(/^msg_/);
    expect(msg.from).toBe("agent-a");
    expect(msg.to).toBe("agent-b");
    expect(msg.type).toBe("task_update");
    expect(msg.priority).toBe("normal");
    expect(msg.ttl_seconds).toBe(86400);
    expect(msg.correlation_id).toBeNull();
    expect(msg.reply_to).toBeNull();
    expect(msg.created_at).toBeTruthy();
  });

  it("applies custom priority, ttl, and correlation_id", () => {
    const msg = createMessage({
      from: "agent-a",
      to: "agent-b",
      type: "incident",
      payload: "alert",
      context: "monitoring",
      priority: "high",
      ttl_seconds: 3600,
      correlation_id: "corr-123",
      reply_to: "msg_prev",
    });

    expect(msg.priority).toBe("high");
    expect(msg.ttl_seconds).toBe(3600);
    expect(msg.correlation_id).toBe("corr-123");
    expect(msg.reply_to).toBe("msg_prev");
  });

  it("throws when payload exceeds 64 KB", () => {
    const largePayload = "x".repeat(65537);
    expect(() =>
      createMessage({
        from: "a",
        to: "b",
        type: "info",
        payload: largePayload,
        context: "test",
      }),
    ).toThrow(/exceeds maximum size/);
  });

  it("allows payload at exactly 64 KB", () => {
    // 65536 bytes of ASCII = 65536 chars
    const exactPayload = "x".repeat(65536);
    const msg = createMessage({
      from: "a",
      to: "b",
      type: "info",
      payload: exactPayload,
      context: "test",
    });
    expect(msg.payload).toHaveLength(65536);
  });

  it("detects expired message", () => {
    const msg = createMessage({
      from: "a",
      to: "b",
      type: "info",
      payload: "hi",
      context: "test",
      ttl_seconds: 1,
    });

    // Manually set created_at to 2 seconds ago
    msg.created_at = new Date(Date.now() - 2000).toISOString();
    expect(isMessageExpired(msg)).toBe(true);
  });

  it("detects non-expired message", () => {
    const msg = createMessage({
      from: "a",
      to: "b",
      type: "info",
      payload: "hi",
      context: "test",
      ttl_seconds: 3600,
    });

    expect(isMessageExpired(msg)).toBe(false);
  });

  it("serialization roundtrip preserves message", () => {
    const msg = createMessage({
      from: "agent-a",
      to: "agent-b",
      type: "deploy_request",
      payload: JSON.stringify({ repo: "foo/bar" }),
      context: "deploying",
      correlation_id: "corr-1",
      priority: "high",
    });

    const bytes = serializeMessage(msg);
    const restored = deserializeMessage(bytes);

    expect(restored).toEqual(msg);
  });
});
