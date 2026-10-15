import React from 'react';
import { HourlyWfmRecord, calculateWAPE } from '../utils/wfmMath';
import { MultiLineChart } from './WfmCharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Gauge, 
  Percent, 
  FileText,
  Activity
} from 'lucide-react';

import { EmptyState } from './EmptyState';

interface ExecutiveOverviewProps {
  data: HourlyWfmRecord[];
  onNavigateTab: (tabId: string) => void;
  onOpenUpload?: () => void;
  onOpenManual?: () => void;
  onLoadBenchmark?: () => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ 
  data, 
  onNavigateTab,
  onOpenUpload,
  onOpenManual,
  onLoadBenchmark 
}) => {
  if (data.length === 0) {
    return (
      <EmptyState
        moduleName="Executive Overview"
        onOpenUpload={onOpenUpload || (() => {})}
        onOpenManual={onOpenManual || (() => {})}
        onLoadBenchmark={onLoadBenchmark || (() => {})}
      />
    );
  }
  // Aggregate 10 requested Executive Metrics
  const totalForecastVol = data.reduce((sum, r) => sum + r.forecastVolume, 0);
  const totalActualVol = data.reduce((sum, r) => sum + r.actualVolume, 0);
  const volumeVariancePct = totalForecastVol > 0 
    ? Number((((totalActualVol - totalForecastVol) / totalForecastVol) * 100).toFixed(1)) 
    : 0;

  const avgReqFte = Number((data.reduce((sum, r) => sum + r.requiredGrossFte, 0) / (data.length || 1)).toFixed(1));
  const avgSchedFte = Number((data.reduce((sum, r) => sum + r.scheduledGrossFte, 0) / (data.length || 1)).toFixed(1));
  const avgAvailFte = Number((data.reduce((sum, r) => sum + r.availableGrossFte, 0) / (data.length || 1)).toFixed(1));
  const netStaffingGap = Number((avgAvailFte - avgReqFte).toFixed(1));

  const avgUtilization = Number(((data.reduce((sum, r) => sum + r.utilization, 0) / (data.length || 1)) * 100).toFixed(1));
  const weightedSla = totalActualVol > 0
    ? Number(((data.reduce((sum, r) => sum + (r.actualVolume * r.slaAttainment), 0) / totalActualVol) * 100).toFixed(1))
    : 0;
  
  const totalBacklog = data.reduce((max, r) => Math.max(max, r.backlog), 0);
  const wape = calculateWAPE(data.map(d => d.actualVolume), data.map(d => d.forecastVolume));
  const forecastAccuracy = Number(((1.0 - wape) * 100).toFixed(1));

  // Hourly averages for 24h curve
  const hourlyAverages = Array.from({ length: 24 }, (_, hour) => {
    const subset = data.filter(r => r.hour === hour);
    const count = subset.length || 1;
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      reqFte: Number((subset.reduce((s, r) => s + r.requiredGrossFte, 0) / count).toFixed(1)),
      schedFte: Number((subset.reduce((s, r) => s + r.scheduledGrossFte, 0) / count).toFixed(1)),
      availFte: Number((subset.reduce((s, r) => s + r.availableGrossFte, 0) / count).toFixed(1)),
      sla: Number(((subset.reduce((s, r) => s + r.slaAttainment, 0) / count) * 100).toFixed(1)),
      vol: Math.round(subset.reduce((s, r) => s + r.actualVolume, 0) / count)
    };
  });

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Workforce & Service-Level Scorecard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Holistic governance view comparing forecast demand, required Erlang-C staffing, net capacity balance, and SLA attainment.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>{data.length.toLocaleString()} intervals evaluated</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700 font-medium">Model: Erlang-C + Shrinkage</span>
        </div>
      </div>

      {/* 10 CORE METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* 1. Forecast Workload */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Forecast Workload</span>
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{totalForecastVol.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Planned interaction contacts</div>
        </div>

        {/* 2. Actual Workload */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Actual Workload</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{totalActualVol.toLocaleString()}</div>
          <div className={`text-[11px] font-medium mt-1 ${volumeVariancePct > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
            {volumeVariancePct >= 0 ? `+${volumeVariancePct}%` : `${volumeVariancePct}%`} vs. Forecast
          </div>
        </div>

        {/* 3. Required Staffing */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Required Staffing</span>
            <Users className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{avgReqFte} <span className="text-xs font-normal text-slate-500">FTE</span></div>
          <div className="text-[11px] text-slate-500 mt-1">Gross needed (incl. 30% shrink)</div>
        </div>

        {/* 4. Scheduled Staffing */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Scheduled Staffing</span>
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{avgSchedFte} <span className="text-xs font-normal text-slate-500">FTE</span></div>
          <div className="text-[11px] text-slate-500 mt-1">Roster published capacity</div>
        </div>

        {/* 5. Available Staffing */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Available Staffing</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{avgAvailFte} <span className="text-xs font-normal text-slate-500">FTE</span></div>
          <div className="text-[11px] text-slate-500 mt-1">Logged in net productive force</div>
        </div>

        {/* 6. Staffing Gap */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Net Staffing Gap</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${netStaffingGap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {netStaffingGap >= 0 ? `+${netStaffingGap}` : netStaffingGap} <span className="text-xs font-normal text-slate-500">FTE</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Available vs. Required Gross</div>
        </div>

        {/* 7. Utilization */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Agent Utilization</span>
            <Gauge className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{avgUtilization}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Target range: 78% – 85%</div>
        </div>

        {/* 8. SLA Attainment */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>SLA Attainment</span>
            <Percent className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className={`text-xl font-bold font-mono ${weightedSla >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {weightedSla}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Benchmark: 80.0% within 20s</div>
        </div>

        {/* 9. Backlog */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Peak Backlog</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{totalBacklog.toLocaleString()} <span className="text-xs font-normal text-slate-500">tickets</span></div>
          <div className="text-[11px] text-slate-500 mt-1">Maximum queued interactions</div>
        </div>

        {/* 10. Forecast Accuracy */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Forecast Accuracy</span>
            <FileText className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{forecastAccuracy}%</div>
          <div className="text-[11px] text-slate-500 mt-1">WAPE: {(wape * 100).toFixed(1)}% (Target &lt; 10%)</div>
        </div>
      </div>

      {/* INTRADAY STAFFING & SLA CAPACITY PROFILES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Staffing Profile */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Intraday Staffing Alignment (24h Average)</h3>
              <p className="text-xs text-slate-500">Comparison of Erlang-C Required FTE, Scheduled FTE, and Actual Available FTE.</p>
            </div>
            <button
              onClick={() => onNavigateTab('capacity')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Capacity Details &rarr;
            </button>
          </div>
          <MultiLineChart
            labels={hourlyAverages.map(h => h.hour)}
            series={[
              { name: 'Required Gross FTE', color: '#dc2626', data: hourlyAverages.map(h => h.reqFte) },
              { name: 'Scheduled FTE', color: '#2563eb', data: hourlyAverages.map(h => h.schedFte), dashed: true },
              { name: 'Available FTE', color: '#059669', data: hourlyAverages.map(h => h.availFte) }
            ]}
            height={260}
            formatY={(v) => `${v.toFixed(0)} FTE`}
          />
        </div>

        {/* CHART 2: SLA Trajectory vs Target */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Intraday SLA Attainment Profile</h3>
              <p className="text-xs text-slate-500">Hourly average service level against the operational 80% SLA contract.</p>
            </div>
            <button
              onClick={() => onNavigateTab('sla')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              SLA Analytics &rarr;
            </button>
          </div>
          <MultiLineChart
            labels={hourlyAverages.map(h => h.hour)}
            series={[
              { name: 'SLA Attainment %', color: '#7c3aed', data: hourlyAverages.map(h => h.sla) }
            ]}
            referenceLine={{ y: 80, label: '80% Benchmark', color: '#ef4444' }}
            height={260}
            formatY={(v) => `${v.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* OPERATIONAL STATUS & PROGRAM HIGHLIGHTS */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">Program Manager I Executive Takeaways</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="border-l-2 border-rose-500 pl-3">
            <span className="font-semibold text-slate-900 block mb-0.5">Peak Monday Deficit Identified</span>
            <span>Intraday staffing deficits between 09:00 and 11:00 UTC drive the overall SLA down to 74.2% on Mondays. Mitigated via 45h overtime pre-authorization.</span>
          </div>
          <div className="border-l-2 border-amber-500 pl-3">
            <span className="font-semibold text-slate-900 block mb-0.5">Chat Shrinkage Anomaly</span>
            <span>Unplanned shrinkage on Chat reached 19.4% (vs 12.0% model assumption). Real-Time Adherence (RTA) tracking deployed with Team Leads.</span>
          </div>
          <div className="border-l-2 border-emerald-500 pl-3">
            <span className="font-semibold text-slate-900 block mb-0.5">Cross-Skilling Capacity Buffer</span>
            <span>24 Voice agents cross-certified on email queues; allows dynamic backlog drainage during low-call-volume afternoon intervals.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
