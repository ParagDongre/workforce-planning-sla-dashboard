import React, { useState } from 'react';
import { HourlyWfmRecord, WfmActionItem, calculateWAPE } from '../utils/wfmMath';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Copy, 
  Check, 
  Layers, 
  Users, 
  ShieldAlert,
  Calendar
} from 'lucide-react';

interface ProgramManagementProps {
  data: HourlyWfmRecord[];
  actions: WfmActionItem[];
}

export const ProgramManagement: React.FC<ProgramManagementProps> = ({ data, actions }) => {
  const [copied, setCopied] = useState<boolean>(false);

  // Compute live metrics for report generator
  const totalForecastVol = data.reduce((s, r) => s + r.forecastVolume, 0);
  const totalActualVol = data.reduce((s, r) => s + r.actualVolume, 0);
  const volVariancePct = totalForecastVol > 0
    ? (((totalActualVol - totalForecastVol) / totalForecastVol) * 100).toFixed(1)
    : '0.0';
  const weightedSla = totalActualVol > 0
    ? ((data.reduce((s, r) => s + (r.actualVolume * r.slaAttainment), 0) / totalActualVol) * 100).toFixed(1)
    : '0.0';
  const wape = (calculateWAPE(data.map(d => d.actualVolume), data.map(d => d.forecastVolume)) * 100).toFixed(1);
  const avgReqFte = (data.reduce((s, r) => s + r.requiredGrossFte, 0) / (data.length || 1)).toFixed(1);
  const avgAvailFte = (data.reduce((s, r) => s + r.availableGrossFte, 0) / (data.length || 1)).toFixed(1);
  const netGap = (Number(avgAvailFte) - Number(avgReqFte)).toFixed(1);

  const openP1Actions = actions.filter(a => a.priority.includes('P1') && a.status !== 'Closed' && a.status !== 'Mitigated');
  const openP2Actions = actions.filter(a => a.priority.includes('P2') && a.status !== 'Closed' && a.status !== 'Mitigated');

  // Milestones Data
  const milestones = [
    { name: 'M1: Erlang-C Capacity Sizing & Baseline Validation', targetDate: '2026-09-20', status: 'Complete', progress: 100, owner: 'PM I / WFM Lead' },
    { name: 'M2: Intraday Shrinkage Decomposition Model Deployed', targetDate: '2026-09-30', status: 'Complete', progress: 100, owner: 'Operations Analyst' },
    { name: 'M3: Monday Morning Peak Overtime Rebalancing Pilot', targetDate: '2026-10-18', status: 'On Track', progress: 85, owner: 'Workforce Scheduler' },
    { name: 'M4: Cross-Skilling 24 Voice Agents for Email Backlog', targetDate: '2026-10-25', status: 'On Track', progress: 60, owner: 'Training Lead / PM I' },
    { name: 'M5: Bi-directional SQLite Action Governance Sync', targetDate: '2026-11-05', status: 'On Track', progress: 40, owner: 'PM I / Systems' }
  ];

  // RAID Log (Risks, Assumptions, Issues, Dependencies)
  const raidItems = [
    { type: 'Risk', impact: 'High', description: 'Unplanned shrinkage exceeds modeled 12% during seasonal flu periods', mitigation: 'Institute tiered reserve rosters and standby flex contracts' },
    { type: 'Issue', impact: 'High', description: 'Monday 09:00 - 11:00 UTC Voice queue SLA dips to 74.2% due to weekend backlog', mitigation: 'Pre-authorized 45 hours overtime shift start at 08:30 UTC' },
    { type: 'Dependency', impact: 'Medium', description: 'Finance sign-off on variable overtime budget for Q4 peak periods', mitigation: 'Weekly ROI briefing highlighting SLA penalty avoidance' },
    { type: 'Assumption', impact: 'Medium', description: 'Average Handling Time stays within +/- 15 seconds of 330s historical baseline', mitigation: 'Automated AHT variance alerts in module 5 with threshold triggers' }
  ];

  // RACI Matrix
  const raciData = [
    { deliverable: 'Demand Forecast Generation', ops: 'I', wfm: 'A', analyst: 'R', leads: 'C', pm: 'C' },
    { deliverable: 'Erlang-C Sizing & Shift Schedules', ops: 'I', wfm: 'A', analyst: 'C', leads: 'C', pm: 'R' },
    { deliverable: 'Overtime & Staffing Gap Mitigation', ops: 'A', wfm: 'R', analyst: 'I', leads: 'R', pm: 'R' },
    { deliverable: 'Real-Time Schedule Adherence (RTA)', ops: 'I', wfm: 'C', analyst: 'I', leads: 'A/R', pm: 'I' },
    { deliverable: 'Executive SLA Governance & Reporting', ops: 'I', wfm: 'C', analyst: 'C', leads: 'I', pm: 'A/R' }
  ];

  const generatedReport = `# WEEKLY WORKFORCE MANAGEMENT & SLA GOVERNANCE BRIEFING
**Program:** Workforce Capacity Planning & SLA Intelligence
**Reporting Period:** Fiscal Cycle 2026-W41 | **Program Manager:** Program Manager I (Workforce Optimization)
**Overall Program Health:** 🟡 AMBER (Mitigations Active for Peak Deficits)

---

## 1. Executive Summary
During the past cycle, contact center operations processed **${totalActualVol.toLocaleString()} total interactions** (${volVariancePct > '0' ? `+${volVariancePct}%` : `${volVariancePct}%`} vs. planned baseline of ${totalForecastVol.toLocaleString()}). Weighted SLA attainment closed at **${weightedSla}%**, tracking slightly beneath the 80.0% benchmark due to Monday morning arrival spikes. Forecast accuracy remained strong at **${(100 - Number(wape)).toFixed(1)}% (WAPE ${wape}%)**.

## 2. Workforce & Capacity Metrics
- **Workload Volume:** ${totalActualVol.toLocaleString()} actual vs. ${totalForecastVol.toLocaleString()} forecast (${volVariancePct}%)
- **Required Gross Staffing (Erlang-C):** ${avgReqFte} FTE
- **Available Logged-in Staffing:** ${avgAvailFte} FTE
- **Net Staffing Balance:** ${netGap} FTE average variance
- **Service Level Agreement:** ${weightedSla}% attainment (Target: 80.0% within 20s)
- **Forecast Model Error:** WAPE = ${wape}% (Target < 10.0%)

## 3. Top Operational Blockers & Mitigation Status
${openP1Actions.length > 0 ? openP1Actions.map(a => `- **[${a.priority}] ${a.id}:** ${a.issueDescription} (Owner: ${a.owner}, Due: ${a.dueDate})`).join('\n') : '- No active P1 critical blockers currently escalated.'}
${openP2Actions.map(a => `- **[${a.priority}] ${a.id}:** ${a.issueDescription} (Owner: ${a.owner}, Status: ${a.status})`).join('\n')}

## 4. Key Milestones & Next Steps
- Finalize evaluation of the 45-hour voluntary overtime adjustment for Monday Voice queue.
- Complete certification of 24 blended Voice agents for Email queue backlog burning.
- Review knowledge-base troubleshooting macro deployment to reverse +45s AHT drift.
`;

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generatedReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Program Management & Operational Governance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Program Manager I portfolio governance framework: Project Charter, Milestones, RACI Matrix, and Weekly Executive Briefing.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-md">
            Status: Amber (Mitigations Active)
          </span>
        </div>
      </div>

      {/* 1. PROJECT CHARTER */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-4">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            1. Project Charter: Contact Center Workforce Optimization
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-slate-900 block mb-0.5">Problem Statement:</span>
              <p className="text-slate-600 leading-relaxed">
                Historical shift rosters exhibited a systematic -18 FTE staffing deficit during Monday 09:00 - 11:00 UTC peak windows. Concurrently, unplanned shrinkage surged by +7.4% above modeled assumptions, causing periodic SLA collapse to 74.2% and backlog accumulation of &gt;1,800 tickets.
              </p>
            </div>

            <div>
              <span className="font-semibold text-slate-900 block mb-0.5">Program Objectives:</span>
              <p className="text-slate-600 leading-relaxed">
                Deploy deterministic Erlang-C capacity modeling, establish transparent shrinkage budgeting (30% gross allocation), and institute a closed-loop SQLite action mitigation mechanism to maintain &gt;80% SLA while stabilizing agent utilization within 78% – 85%.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="font-semibold text-slate-900 block mb-0.5">Scope Boundaries:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                <li><strong>In-Scope:</strong> Erlang-C multi-channel sizing, shrinkage decomposition, variance thresholds, action governance, weekly briefing automation.</li>
                <li><strong>Out-of-Scope:</strong> Direct telephony PBX infrastructure routing changes, compensation structures, vendor contract negotiations.</li>
              </ul>
            </div>

            <div>
              <span className="font-semibold text-slate-900 block mb-0.5">Key Program Success Metrics (KPIs):</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">SLA: &ge; 80.0% in 20s</div>
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">Forecast WAPE: &lt; 10.0%</div>
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">Utilization: 78% – 85%</div>
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">P1 Closure: &lt; 5 Days</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PROGRAM MILESTONES ROADMAP */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              2. Key Deliverables & Milestone Roadmap
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Q3/Q4 2026 Roadmap</span>
        </div>

        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${m.status === 'Complete' ? 'bg-emerald-600' : 'bg-blue-600'}`} />
                  {m.name}
                </div>
                <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                  <span>Due: {m.targetDate}</span>
                  <span aria-hidden="true">·</span>
                  <span>Owner: {m.owner}</span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold ${m.status === 'Complete' ? 'text-emerald-700' : 'text-blue-700'}`}>{m.status}</span>
                </div>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${m.status === 'Complete' ? 'bg-emerald-600' : 'bg-blue-600'}`}
                  style={{ width: `${m.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. RAID LOG & RACI MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RAID Log */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-slate-900">RAID Governance Log</h3>
          </div>
          <div className="space-y-2">
            {raidItems.map((item, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">
                    [{item.type}] Impact: {item.impact}
                  </span>
                </div>
                <div className="text-slate-800 font-medium mb-1">{item.description}</div>
                <div className="text-slate-500 text-[11px]">
                  <strong>Mitigation:</strong> {item.mitigation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RACI Matrix */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">RACI Responsibility Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 font-semibold">Workflow Deliverable</th>
                  <th className="py-2 px-1.5 text-center font-semibold">Ops Dir</th>
                  <th className="py-2 px-1.5 text-center font-semibold">WFM Lead</th>
                  <th className="py-2 px-1.5 text-center font-semibold">Analyst</th>
                  <th className="py-2 px-1.5 text-center font-semibold">Team Leads</th>
                  <th className="py-2 px-1.5 text-center font-semibold">PM I</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {raciData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-2 px-2.5 font-sans font-medium text-slate-900">{row.deliverable}</td>
                    <td className="py-2 px-1.5 text-center text-slate-500">{row.ops}</td>
                    <td className="py-2 px-1.5 text-center font-bold text-purple-700">{row.wfm}</td>
                    <td className="py-2 px-1.5 text-center text-slate-600">{row.analyst}</td>
                    <td className="py-2 px-1.5 text-center text-slate-600">{row.leads}</td>
                    <td className="py-2 px-1.5 text-center font-bold text-blue-700">{row.pm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
            <span>R = Responsible · A = Accountable</span>
            <span>C = Consulted · I = Informed</span>
          </div>
        </div>
      </div>

      {/* 4. WEEKLY STATUS-REPORT GENERATOR */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Weekly Executive Status-Report Generator
            </h3>
          </div>
          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Markdown Report'}
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Automated executive summary synthesized directly from active operational metrics and SQLite action status.
        </p>

        <pre className="bg-slate-950 text-slate-200 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80 border border-slate-800">
          {generatedReport}
        </pre>
      </div>
    </div>
  );
};
