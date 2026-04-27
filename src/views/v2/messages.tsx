// V2 Messages — Light-Brutalist message log with filter chips and sticky table.

import type { FC } from "hono/jsx";
import type { MessageView } from "../../services/message-queries.js";
import type { PaginatedResult } from "../../types.js";
import { V2Layout } from "./layout.js";
import { V2Card, V2Btn, V2Tag, V2Avatar } from "./components.js";
import { V2_TOKENS } from "./tokens.js";

export interface V2MessagesProps {
  result: PaginatedResult<MessageView>;
  filterAgent?: string;
  filterType?: string;
  query?: string;
  agentRoles: Record<string, string | null>;
  agentIds: Record<string, string>;
  userRole?: string;
  csrfToken?: string;
}

const TYPE_FILTERS: ReadonlyArray<readonly [string, string, string]> = [
  ["",                      "All",      ""],
  ["answer",                "Answer",   V2_TOKENS.accent2],
  ["question",              "Question", V2_TOKENS.info],
  ["info",                  "Info",     V2_TOKENS.textDim],
  ["alert",                 "Alert",    V2_TOKENS.danger],
  ["incident_response",     "Incident", V2_TOKENS.warn],
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

function fmtDayHM(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toTimeString().slice(0, 5);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + fmtTime(iso);
}

function typeColor(type: string): string {
  switch (type) {
    case "answer": return V2_TOKENS.accent2;
    case "question": return V2_TOKENS.info;
    case "info": return V2_TOKENS.textDim;
    case "alert":
    case "incident_response": return V2_TOKENS.danger;
    case "incident_acknowledged": return V2_TOKENS.warn;
    case "review_request": return V2_TOKENS.warn;
    default: return V2_TOKENS.text;
  }
}

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const qs = u.toString();
  return qs ? `${base}?${qs}` : base;
}

const TypeChip: FC<{ type: string; label: string; color: string; active: boolean; agentFilter?: string; query?: string }> = ({ type, label, color, active, agentFilter, query }) => {
  const href = buildUrl("/messages", { type: type || undefined, agent: agentFilter, q: query });
  return (
    <a href={href} style={`padding:6px 12px;border-radius:999px;font-size:12px;border:1px solid ${V2_TOKENS.line2};background:${active ? "rgba(255,255,255,0.7)" : "transparent"};color:${active ? V2_TOKENS.text : V2_TOKENS.textDim};display:flex;align-items:center;gap:6px;text-decoration:none`}>
      {color && <span style={`width:6px;height:6px;background:${color};display:inline-block`} />}
      {label}
    </a>
  );
};

export const V2MessagesPage: FC<V2MessagesProps> = ({
  result, filterAgent, filterType, query, agentIds, agentRoles, userRole, csrfToken,
}) => {
  const { data: messages, total, has_more, offset, limit } = result;
  const filtered = (filterType
    ? messages.filter((m) => m.type === filterType || (filterType === "incident_response" && m.type.startsWith("incident_")))
    : messages)
    .filter((m) => !query || m.context.toLowerCase().includes(query.toLowerCase()));
  const prevOff = Math.max(0, offset - limit);
  const nextOff = offset + limit;

  return (
    <V2Layout title="Messages" active="MESSAGES" userRole={userRole} csrfToken={csrfToken}>
      <div style="padding:24px 32px">
        <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:16px">
          <h1 class="v2-h1">Messages</h1>
          <span style={`color:${V2_TOKENS.textMute};font-family:${V2_TOKENS.text}`}>{total}</span>
          <div style="flex:1" />
          <V2Btn href="/conversations">Threads</V2Btn>
        </div>

        <form method="get" action="/messages" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
          <input class="v2-input" type="text" name="q" placeholder="Search context…" value={query ?? ""} style="width:280px" />
          <input class="v2-input v2-input--mono" type="text" name="agent" placeholder="from/to filter" value={filterAgent ?? ""} style="width:180px" />
          {filterType && <input type="hidden" name="type" value={filterType} />}
          <V2Btn type="submit">Apply</V2Btn>
          {(filterAgent || query) && <V2Btn href={buildUrl("/messages", { type: filterType })} kind="ghost">clear</V2Btn>}
          <div style="flex:1" />
          {TYPE_FILTERS.map(([key, label, col]) => (
            <TypeChip type={key} label={label} color={col} active={(filterType ?? "") === key} agentFilter={filterAgent} query={query} />
          ))}
        </form>

        <V2Card>
          <div style={`display:grid;grid-template-columns:90px 1.2fr 24px 1.2fr 110px 70px 2fr;padding:10px 16px;font-size:10.5px;color:${V2_TOKENS.textMute};letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${V2_TOKENS.line};gap:12px`}>
            <span>Time</span><span>From</span><span></span><span>To</span><span>Type</span><span>Prio</span><span>Context</span>
          </div>
          {filtered.length === 0 ? (
            <div style={`padding:40px;text-align:center;color:${V2_TOKENS.textMute};font-size:13px`}>
              No messages match the current filter.
            </div>
          ) : filtered.map((m, i) => {
            const isBroadcast = m.to === "broadcast";
            return (
              <div style={`display:grid;grid-template-columns:90px 1.2fr 24px 1.2fr 110px 70px 2fr;padding:10px 16px;align-items:center;gap:12px;font-size:13px;${i < filtered.length - 1 ? `border-bottom:1px solid ${V2_TOKENS.line};` : ""}`}>
                <span style={`color:${V2_TOKENS.textMute};font-size:12px;font-family:${V2_TOKENS.text}`}>{fmtDayHM(m.created_at)}</span>
                <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
                  <V2Avatar agentId={agentIds[m.from] ?? m.from} role={agentRoles[m.from] ?? undefined} size={18} />
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{m.from}</span>
                </div>
                <span style={`color:${V2_TOKENS.textMute};text-align:center`}>→</span>
                {isBroadcast ? (
                  <span style={`color:${V2_TOKENS.warn};font-size:11px;font-family:${V2_TOKENS.text};letter-spacing:0.05em;text-transform:uppercase`}>※ broadcast</span>
                ) : (
                  <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
                    <V2Avatar agentId={agentIds[m.to] ?? m.to} role={agentRoles[m.to] ?? undefined} size={18} />
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{m.to}</span>
                  </div>
                )}
                <V2Tag color={typeColor(m.type)}>{m.type}</V2Tag>
                <span style={`font-size:10.5px;color:${m.priority === "high" ? V2_TOKENS.danger : V2_TOKENS.textMute};letter-spacing:0.08em;text-transform:uppercase;font-family:${V2_TOKENS.text}`}>{m.priority}</span>
                <span style={`color:${V2_TOKENS.textDim};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px`}>{m.context}</span>
              </div>
            );
          })}
        </V2Card>

        {(offset > 0 || has_more) && (
          <div style={`display:flex;align-items:center;gap:14px;padding:18px 4px;font-size:12.5px;color:${V2_TOKENS.textMute}`}>
            {offset > 0
              ? <V2Btn href={buildUrl("/messages", { agent: filterAgent, type: filterType, q: query, offset: String(prevOff) })}>← Newer</V2Btn>
              : <span style={`color:${V2_TOKENS.line2}`}>← Newer</span>}
            <span style={`font-family:${V2_TOKENS.text}`}>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            {has_more
              ? <V2Btn href={buildUrl("/messages", { agent: filterAgent, type: filterType, q: query, offset: String(nextOff) })}>Older →</V2Btn>
              : <span style={`color:${V2_TOKENS.line2}`}>Older →</span>}
          </div>
        )}
      </div>
    </V2Layout>
  );
};
