import { useState } from "react";

const workflows = [
  {
    id: "swarm",
    rank: 1,
    label: "Subagent Swarm",
    subtitle: "Parallel Autonomous Agents",
    tokenCost: 5,
    latency: 5,
    control: 1,
    color: "#EF4444",
    tagColor: "#FEE2E2",
    tagText: "#991B1B",
    when: "Tasks are truly independent and parallelizable",
    tradeoff: "Token cost is brutal — N agents × full context each",
    bloatWhere: "At fan-out. Every agent instantiates the FULL context, so total spend = N × everything, all at once.",
    breaks: "No shared memory between agents. They duplicate work and return conflicting edits the orchestrator has to reconcile.",
    diagram: "swarm",
  },
  {
    id: "orchestrator",
    rank: 2,
    label: "Orchestrator + Subagents",
    subtitle: "Manager / Worker Pattern",
    tokenCost: 4,
    latency: 4,
    control: 2,
    color: "#F97316",
    tagColor: "#FFEDD5",
    tagText: "#9A3412",
    when: "Tasks need specialization across distinct roles",
    tradeoff: "Orchestrator history re-sent every turn — context bleed",
    bloatWhere: "In the orchestrator's turn loop. Its running history is re-sent every turn, so the window grows turn over turn.",
    breaks: "Early instructions get diluted or evicted (context bleed). Worker summaries pile up and blur the original goal.",
    diagram: "orchestrator",
  },
  {
    id: "react",
    rank: 3,
    label: "Single Agent Loop",
    subtitle: "ReAct / Tool Loop",
    tokenCost: 3,
    latency: 3,
    control: 3,
    color: "#EAB308",
    tagColor: "#FEF9C3",
    tagText: "#713F12",
    when: "Complex tasks, undefined steps, needs autonomy",
    tradeoff: "Context window fills mid-task, early reasoning lost",
    bloatWhere: "Mid-loop. Every tool call's full output is appended to the one shared context, so long loops fill the window.",
    breaks: "The original goal and early reasoning get summarized away. The agent drifts and forgets what it set out to do.",
    diagram: "react",
  },
  {
    id: "chain",
    rank: 4,
    label: "Chained Prompts",
    subtitle: "Explicit Pipeline",
    tokenCost: 2,
    latency: 2,
    control: 4,
    color: "#3B82F6",
    tagColor: "#DBEAFE",
    tagText: "#1E3A8A",
    when: "Well-defined workflows — ETL, compose, publish flows",
    tradeoff: "You own the handoffs; prune tokens between steps",
    bloatWhere: "At each handoff, if you pass whole outputs forward. Step N carries steps 1..N-1 and tokens compound down the pipe.",
    breaks: "Nothing automatic — you own the handoffs. Forget to prune between steps and cost balloons silently.",
    diagram: "chain",
  },
  {
    id: "structured",
    rank: 5,
    label: "Structured Output + Code",
    subtitle: "LLM as Function",
    tokenCost: 1,
    latency: 1,
    control: 5,
    color: "#10B981",
    tagColor: "#D1FAE5",
    tagText: "#064E3B",
    when: "Classify, extract, decide — deterministic rest",
    tradeoff: "Cheapest. LLM does one job, code does everything else",
    bloatWhere: "Nowhere meaningful. One call, fixed input, schema-bounded output. Context can't accumulate.",
    breaks: "Very little. Only risks: input too big for a single call, or the model returns off-schema JSON.",
    diagram: "structured",
  },
];

const Dots = ({ value, color, max = 5 }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: i < value ? color : "#374151" }} />
    ))}
  </div>
);

const Metric = ({ label, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    <Dots value={value} color={color} />
  </div>
);

// Reusable "hotspot" marker drawn on the diagram at the point context bloats/breaks
const Hotspot = ({ x, y, label, color = "#EF4444" }) => (
  <g>
    <circle cx={x} cy={y} r="9" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5">
      <animate attributeName="r" values="6;11;6" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite" />
    </circle>
    <circle cx={x} cy={y} r="4" fill={color} />
    <text x={x} y={y - 12} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={color} fontFamily="monospace">{label}</text>
  </g>
);

const SwarmDiagram = ({ color }) => (
  <svg viewBox="0 0 200 110" style={{ width: "100%", height: 100 }}>
    <rect x="80" y="5" width="40" height="22" rx="4" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
    <text x="100" y="20" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace" fontWeight="700">ORCH</text>
    {[20, 60, 100, 140, 170].map((x, i) => (
      <g key={i}>
        <line x1="100" y1="27" x2={x + 15} y2="55" stroke={color} strokeWidth="1" strokeDasharray="3,2" opacity="0.6" />
        <rect x={x} y="55" width="30" height="20" rx="3" fill={color} opacity="0.1" stroke={color} strokeWidth="1" />
        <text x={x + 15} y="68" textAnchor="middle" fontSize="7.5" fill={color} fontFamily="monospace">A{i + 1}</text>
      </g>
    ))}
    <Hotspot x={100} y={41} label="×N CONTEXT" />
    <text x="100" y="105" textAnchor="middle" fontSize="8" fill="#EF4444" fontFamily="monospace">N agents × full context — simultaneous</text>
  </svg>
);

const OrchestratorDiagram = ({ color }) => (
  <svg viewBox="0 0 200 110" style={{ width: "100%", height: 100 }}>
    <rect x="75" y="8" width="50" height="22" rx="4" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
    <text x="100" y="23" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace" fontWeight="700">ORCH</text>
    <path d="M 128 12 C 150 4 150 30 128 24" stroke="#EF4444" strokeWidth="1.3" fill="none" opacity="0.8" />
    <polygon points="128,21 132,26 124,26" fill="#EF4444" opacity="0.8" />
    {[35, 100, 165].map((x, i) => (
      <g key={i}>
        <line x1="100" y1="30" x2={x} y2="58" stroke={color} strokeWidth="1.2" opacity="0.7" />
        <rect x={x - 20} y="58" width="40" height="22" rx="3" fill={color} opacity="0.1" stroke={color} strokeWidth="1" />
        <text x={x} y="67" textAnchor="middle" fontSize="7" fill={color} fontFamily="monospace">{["Retrieve", "Execute", "Synth"][i]}</text>
        <text x={x} y="76" textAnchor="middle" fontSize="6.5" fill={color} fontFamily="monospace" opacity="0.7">agent</text>
      </g>
    ))}
    <Hotspot x={100} y={19} label="HISTORY RE-SENT" />
    <text x="100" y="105" textAnchor="middle" fontSize="8" fill="#EF4444" fontFamily="monospace">sequential — history re-sent every turn</text>
  </svg>
);

const ReactDiagram = ({ color }) => (
  <svg viewBox="0 0 200 110" style={{ width: "100%", height: 100 }}>
    <rect x="65" y="12" width="70" height="30" rx="5" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" />
    <text x="100" y="24" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace" fontWeight="700">AGENT</text>
    <text x="100" y="36" textAnchor="middle" fontSize="7.5" fill={color} fontFamily="monospace" opacity="0.8">Reason → Act</text>
    <path d="M 158 27 C 188 27 188 67 158 67" stroke="#EF4444" strokeWidth="1.3" fill="none" strokeDasharray="4,2" opacity="0.8" />
    <polygon points="158,64 152,70 162,70" fill="#EF4444" opacity="0.8" />
    <rect x="65" y="57" width="70" height="20" rx="3" fill={color} opacity="0.08" stroke={color} strokeWidth="1" />
    <text x="100" y="70" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">tool calls</text>
    <Hotspot x={182} y={47} label="FILLS EACH LOOP" />
    <text x="100" y="105" textAnchor="middle" fontSize="8" fill="#EF4444" fontFamily="monospace">one context — every tool result piles in</text>
  </svg>
);

const ChainDiagram = ({ color }) => (
  <svg viewBox="0 0 200 110" style={{ width: "100%", height: 100 }}>
    {["Step 1", "Step 2", "Step 3", "Step 4"].map((label, i) => (
      <g key={i}>
        <rect x={10 + i * 48} y="28" width="38" height="28" rx="4" fill={color} opacity="0.1" stroke={color} strokeWidth="1.2" />
        <text x={29 + i * 48} y="40" textAnchor="middle" fontSize="7.5" fill={color} fontFamily="monospace" fontWeight="700">{label}</text>
        <text x={29 + i * 48} y="50" textAnchor="middle" fontSize="6" fill={color} fontFamily="monospace" opacity="0.7">LLM call</text>
        {i < 3 && (
          <>
            <line x1={48 + i * 48} y1="42" x2={58 + i * 48} y2="42" stroke={color} strokeWidth="1.5" opacity="0.7" />
            <polygon points={`${56 + i * 48},39 ${62 + i * 48},42 ${56 + i * 48},45`} fill={color} opacity="0.7" />
          </>
        )}
        <rect x={10 + i * 48} y="63" width="38" height="14" rx="2" fill="#10B981" opacity="0.12" stroke="#10B981" strokeWidth="0.8" strokeDasharray="2,2" />
        <text x={29 + i * 48} y="73" textAnchor="middle" fontSize="6" fill="#10B981" fontFamily="monospace">prune ✓</text>
      </g>
    ))}
    <Hotspot x={82} y={42} label="PRUNE HERE" color="#3B82F6" />
    <text x="100" y="105" textAnchor="middle" fontSize="8" fill="#3B82F6" fontFamily="monospace">you decide what carries forward at each handoff</text>
  </svg>
);

const StructuredDiagram = ({ color }) => (
  <svg viewBox="0 0 200 110" style={{ width: "100%", height: 100 }}>
    <rect x="20" y="22" width="60" height="30" rx="4" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" />
    <text x="50" y="35" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace" fontWeight="700">LLM</text>
    <text x="50" y="46" textAnchor="middle" fontSize="7" fill={color} fontFamily="monospace" opacity="0.8">one call</text>
    <line x1="80" y1="37" x2="110" y2="37" stroke={color} strokeWidth="1.5" opacity="0.7" />
    <polygon points="108,34 114,37 108,40" fill={color} opacity="0.7" />
    <rect x="114" y="22" width="66" height="30" rx="4" fill="#1F2937" stroke={color} strokeWidth="1.2" opacity="0.9" />
    <text x="147" y="33" textAnchor="middle" fontSize="7.5" fill={color} fontFamily="monospace" fontWeight="700">{"{ json }"}</text>
    <text x="147" y="44" textAnchor="middle" fontSize="6.5" fill="#9CA3AF" fontFamily="monospace">deterministic</text>
    <rect x="114" y="60" width="66" height="20" rx="3" fill={color} opacity="0.08" stroke={color} strokeWidth="1" />
    <text x="147" y="73" textAnchor="middle" fontSize="7.5" fill={color} fontFamily="monospace">code handles rest</text>
    <line x1="147" y1="52" x2="147" y2="60" stroke={color} strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
    <Hotspot x={50} y={37} label="BOUNDED" color="#10B981" />
    <text x="100" y="105" textAnchor="middle" fontSize="8" fill="#10B981" fontFamily="monospace">LLM is a function — context can't accumulate</text>
  </svg>
);

const DiagramMap = { swarm: SwarmDiagram, orchestrator: OrchestratorDiagram, react: ReactDiagram, chain: ChainDiagram, structured: StructuredDiagram };

const Callout = ({ kind, text }) => {
  const bloat = kind === "bloat";
  const c = bloat ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ borderLeft: `3px solid ${c}`, background: `${c}14`, borderRadius: "0 6px 6px 0", padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontFamily: "monospace", color: c, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 3 }}>
        {bloat ? "▲ Where context bloats" : "✕ What breaks"}
      </div>
      <div style={{ fontSize: 12.5, color: "#E5E7EB", lineHeight: 1.45 }}>{text}</div>
    </div>
  );
};

export default function WorkflowDiagram() {
  const [selected, setSelected] = useState("react");

  return (
    <div style={{ backgroundColor: "#0F1117", minHeight: "100vh", padding: "32px 24px", fontFamily: "'Inter', system-ui, sans-serif", color: "#F9FAFB" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            Multi-Step Workflow Patterns
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Where context bloats &amp; what breaks</h1>
          <p style={{ color: "#6B7280", marginTop: 6, fontSize: 13 }}>
            Ranked most → least token heavy. Each pattern spends context somewhere specific — and fails there first. Click to expand.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 18, marginBottom: 14, fontSize: 11, fontFamily: "monospace", color: "#6B7280", flexWrap: "wrap" }}>
          <span style={{ color: "#EF4444" }}>● break / bloat point</span>
          <span style={{ color: "#F59E0B" }}>▲ where tokens pile up</span>
          <span style={{ color: "#10B981" }}>✓ bounded / pruned</span>
        </div>

        {/* Axis labels */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4B5563", fontFamily: "monospace", marginBottom: 8, padding: "0 4px" }}>
          <span>◀ HIGH TOKENS / LOW CONTROL</span>
          <span>HIGH CONTROL / LOW TOKENS ▶</span>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {workflows.map((w) => {
            const DiagramComp = DiagramMap[w.diagram];
            const isSelected = selected === w.id;
            return (
              <div
                key={w.id}
                onClick={() => setSelected(isSelected ? null : w.id)}
                style={{
                  background: isSelected ? "#1A1D27" : "#13161F",
                  border: `1px solid ${isSelected ? w.color : "#1F2937"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? `0 0 0 1px ${w.color}22` : "none",
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${w.color}22`, border: `1px solid ${w.color}`, color: w.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {w.rank}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{w.label}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>{w.subtitle}</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    {/* context footprint bar */}
                    <div style={{ width: 90 }}>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, textAlign: "right" }}>
                        context load
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "#1F2937", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${w.tokenCost * 20}%`, background: w.color, borderRadius: 3 }} />
                      </div>
                    </div>
                    <Dots value={w.tokenCost} color={w.color} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1F2937", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 20 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ background: "#0F1117", border: "1px solid #1F2937", borderRadius: 8, padding: "8px 10px" }}>
                        <DiagramComp color={w.color} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <Metric label="Token cost" value={w.tokenCost} color={w.color} />
                        <Metric label="Latency" value={w.latency} color={w.color} />
                        <Metric label="Control" value={w.control} color={w.color} />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>When to use</div>
                        <div style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.45 }}>{w.when}</div>
                      </div>
                      <Callout kind="bloat" text={w.bloatWhere} />
                      <Callout kind="breaks" text={w.breaks} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ color: "#4B5563", fontSize: 11.5, fontFamily: "monospace", marginTop: 18, textAlign: "center" }}>
          The fix is the same everywhere: subagents to offload reading, /compact + /clear to reclaim the window, and a verification gate to catch drift.
        </p>
      </div>
    </div>
  );
}
