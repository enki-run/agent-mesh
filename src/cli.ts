#!/usr/bin/env npx tsx

// mesh-cli — thin CLI client for human interaction with the Agent Mesh

// --- ANSI colors (only when TTY) ---
const isTTY = process.stdout.isTTY ?? false;
const c = {
  green: (s: string) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  bold: (s: string) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
};

// --- Flag parsing ---
function parseFlags(args: string[]): {
  flags: Record<string, string>;
  positional: string[];
} {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--") && i + 1 < args.length) {
      const key = arg.slice(2);
      flags[key] = args[i + 1];
      i += 2;
    } else {
      positional.push(arg);
      i++;
    }
  }
  return { flags, positional };
}

// --- MCP call ---
async function mcpCall(
  toolName: string,
  args: Record<string, unknown>,
  url: string,
  token: string
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const data = (await response.json()) as {
    error?: { message: string };
    result?: { content: Array<{ text: string }> };
  };

  if (data.error) {
    console.error(`Error: ${data.error.message}`);
    process.exit(1);
  }

  return JSON.parse(data.result!.content[0].text);
}

// --- Column formatting ---
function padRight(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len);
  return s + " ".repeat(len - s.length);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// --- Commands ---

interface AgentInfo {
  name: string;
  role: string | null;
  online: boolean;
  working_on: string | null;
  last_seen_at: string | null;
}

async function cmdStatus(url: string, token: string): Promise<void> {
  const result = (await mcpCall("mesh_status", {}, url, token)) as {
    agents: AgentInfo[];
  };
  const agents = result.agents;

  console.log(
    c.bold(
      `${padRight("AGENT", 15)}${padRight("ROLE", 15)}${padRight("STATUS", 10)}WORKING ON`
    )
  );

  for (const a of agents) {
    const status = a.online
      ? c.green("ONLINE")
      : c.red("offline");
    const statusPad = a.online
      ? padRight("ONLINE", 10)
      : padRight("offline", 10);
    const statusStr = isTTY ? status + " ".repeat(Math.max(0, 10 - (a.online ? 6 : 7))) : statusPad;

    console.log(
      `${padRight(a.name, 15)}${padRight(a.role ?? "—", 15)}${statusStr}${a.working_on ?? "—"}`
    );
  }
}

interface SendResult {
  id: string;
  to: string;
  type: string;
}

async function cmdSend(
  positional: string[],
  flags: Record<string, string>,
  url: string,
  token: string
): Promise<void> {
  if (positional.length < 3) {
    console.error("Usage: mesh-cli send <to> <type> <payload>");
    process.exit(1);
  }

  const [to, type, payload] = positional;
  const context = flags["context"] ?? "mesh-cli";

  const result = (await mcpCall(
    "mesh_send",
    { to, type, payload, context },
    url,
    token
  )) as SendResult;

  console.log(
    `Sent ${c.dim(result.id)} to ${c.bold(result.to)} [${c.yellow(result.type)}]`
  );
}

interface InboxMessage {
  id: string;
  from: string;
  type: string;
  payload: string;
  created_at: string;
}

async function cmdReceive(
  flags: Record<string, string>,
  url: string,
  token: string
): Promise<void> {
  const args: Record<string, unknown> = {};
  if (flags["limit"]) args.limit = parseInt(flags["limit"], 10);
  if (flags["type"]) args.type = flags["type"];

  const result = (await mcpCall("mesh_receive", args, url, token)) as {
    messages: InboxMessage[];
  };
  const messages = result.messages;

  if (messages.length === 0) {
    console.log(c.dim("No messages."));
    return;
  }

  console.log(
    c.bold(
      `${padRight("FROM", 15)}${padRight("TYPE", 15)}${padRight("CREATED", 19)}PAYLOAD`
    )
  );

  for (const m of messages) {
    const time = formatTime(m.created_at);
    const preview =
      m.payload.length > 60 ? m.payload.slice(0, 57) + "..." : m.payload;
    console.log(
      `${padRight(m.from, 15)}${padRight(m.type, 15)}${padRight(time, 19)}${preview}`
    );
  }
}

interface ReplyResult {
  id: string;
}

async function cmdReply(
  positional: string[],
  url: string,
  token: string
): Promise<void> {
  if (positional.length < 2) {
    console.error("Usage: mesh-cli reply <message_id> <payload>");
    process.exit(1);
  }

  const [messageId, payload] = positional;
  const result = (await mcpCall(
    "mesh_reply",
    { message_id: messageId, payload, context: "mesh-cli" },
    url,
    token
  )) as ReplyResult;

  console.log(`Reply sent: ${c.dim(result.id)}`);
}

interface HistoryMessage {
  from: string;
  to: string;
  type: string;
  payload: string;
  created_at: string;
}

async function cmdHistory(
  positional: string[],
  url: string,
  token: string
): Promise<void> {
  if (positional.length < 1) {
    console.error("Usage: mesh-cli history <correlation_id>");
    process.exit(1);
  }

  const correlationId = positional[0];
  const result = (await mcpCall(
    "mesh_history",
    { correlation_id: correlationId },
    url,
    token
  )) as { messages: HistoryMessage[] };
  const messages = result.messages;

  console.log(c.bold(`THREAD: ${correlationId}`));

  if (messages.length === 0) {
    console.log(c.dim("  No messages in this thread."));
    return;
  }

  for (const m of messages) {
    const time = formatTime(m.created_at);
    console.log(
      `  [${time}] ${c.bold(m.from)} → ${m.to} [${c.yellow(m.type)}]: ${m.payload}`
    );
  }
}

interface RegisterResult {
  role: string;
}

async function cmdRegister(
  positional: string[],
  flags: Record<string, string>,
  url: string,
  token: string
): Promise<void> {
  if (positional.length < 1) {
    console.error("Usage: mesh-cli register <role>");
    process.exit(1);
  }

  const role = positional[0];
  const args: Record<string, unknown> = { role };
  if (flags["capabilities"]) args.capabilities = flags["capabilities"];
  if (flags["working-on"]) args.working_on = flags["working-on"];

  const result = (await mcpCall(
    "mesh_register",
    args,
    url,
    token
  )) as RegisterResult;

  console.log(`Registered as ${c.bold(result.role)}`);
}

// --- Usage ---
function printUsage(): void {
  console.log(`${c.bold("mesh-cli")} — Agent Mesh CLI client

${c.bold("Usage:")}
  mesh-cli status                          List agents and online status
  mesh-cli send <to> <type> <payload>      Send a message
  mesh-cli receive                         Check inbox
  mesh-cli reply <message_id> <payload>    Reply to a message
  mesh-cli history <correlation_id>        View thread
  mesh-cli register <role>                 Register/update presence

${c.bold("Options:")}
  --url <url>          MCP endpoint (default: MESH_URL or https://mesh.enki.run/mcp)
  --token <token>      Bearer token (default: MESH_TOKEN env var)
  --context <ctx>      Context for send (default: "mesh-cli")
  --limit <n>          Limit for receive
  --type <type>        Filter for receive
  --capabilities <s>   Capabilities for register
  --working-on <s>     Working on for register

${c.bold("Environment:")}
  MESH_URL             MCP endpoint URL
  MESH_TOKEN           Bearer token (required)`);
}

// --- Main ---
async function main(): Promise<void> {
  const allArgs = process.argv.slice(2);
  const { flags, positional } = parseFlags(allArgs);

  const command = positional[0];
  const cmdArgs = positional.slice(1);

  const url = flags["url"] ?? process.env.MESH_URL ?? "https://mesh.enki.run/mcp";
  const token = flags["token"] ?? process.env.MESH_TOKEN;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (!token) {
    console.error(
      "Error: MESH_TOKEN environment variable or --token flag required"
    );
    process.exit(1);
  }

  switch (command) {
    case "status":
      await cmdStatus(url, token);
      break;
    case "send":
      await cmdSend(cmdArgs, flags, url, token);
      break;
    case "receive":
      await cmdReceive(flags, url, token);
      break;
    case "reply":
      await cmdReply(cmdArgs, url, token);
      break;
    case "history":
      await cmdHistory(cmdArgs, url, token);
      break;
    case "register":
      await cmdRegister(cmdArgs, flags, url, token);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
