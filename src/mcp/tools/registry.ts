import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NatsService } from "../../services/nats.ts";
import type { AgentService } from "../../services/agent.ts";

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

interface PresenceEntry {
  role?: string;
  capabilities?: string[];
  working_on?: string;
  timestamp?: string;
}

export function registerRegistryTools(
  server: McpServer,
  nats: NatsService,
  agents: AgentService,
  agentName: string,
): void {
  // ── mesh_status ───────────────────────────────────────────────
  server.tool(
    "mesh_status",
    "See which agents are online and what they are working on. No parameters needed.",
    {},
    { readOnlyHint: true },
    async () => {
      const allAgents = agents.list();
      const presence = await nats.getPresence();

      const agentList = allAgents.map((agent) => {
        const p = presence.get(agent.name) as PresenceEntry | undefined;
        return {
          name: agent.name,
          avatar: agent.avatar ?? null,
          role: p?.role ?? agent.role ?? null,
          capabilities: p?.capabilities ?? (agent.capabilities ? JSON.parse(agent.capabilities) : null),
          is_active: agent.is_active === 1,
          online: presence.has(agent.name),
          working_on: p?.working_on ?? agent.working_on ?? null,
          last_seen_at: p?.timestamp ?? agent.last_seen_at ?? null,
        };
      });

      return ok({ agents: agentList, count: agentList.length });
    },
  );

  // ── mesh_register ─────────────────────────────────────────────
  server.tool(
    "mesh_register",
    "Announce your role, capabilities, and current task so other agents can discover you.",
    {
      role: z.string().optional().describe("Your role (e.g. 'deploy-agent', 'code-reviewer')"),
      capabilities: z.array(z.string()).optional().describe("List of capabilities (e.g. ['deploy', 'rollback', 'monitor'])"),
      working_on: z.string().optional().describe("What you are currently working on"),
    },
    async (params) => {
      // Update agent presence in DB
      agents.updatePresence(agentName, {
        role: params.role,
        capabilities: params.capabilities ? JSON.stringify(params.capabilities) : undefined,
        working_on: params.working_on,
      });

      // Update NATS presence
      await nats.updatePresence(agentName, {
        role: params.role,
        capabilities: params.capabilities,
        working_on: params.working_on,
      });

      return ok({
        agent: agentName,
        registered: true,
        role: params.role ?? null,
        capabilities: params.capabilities ?? null,
        working_on: params.working_on ?? null,
      });
    },
  );
}
