import React, { useState } from 'react';
import { 
  HourlyWfmRecord, 
  calculateWorkloadHours, 
  calculateTrafficIntensity, 
  calculateRequiredRawAgents, 
  applyShrinkage, 
  calculateServiceLevel 
} from '../utils/wfmMath';
import { MultiLineChart, BarChart } from './WfmCharts';
import { Sliders, Users, Percent, Clock, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface CapacityPlanningProps {
  data: HourlyWfmRecord[];
  onOpenUpload?: () => void;
  onOpenManual?: () => void;
  onLoadBenchmark?: () => void;
}

export const CapacityPlanning: React.FC<CapacityPlanningProps> = ({ 
  data,
  onOpenUpload,
  onOpenManual,
  onLoadBenchmark
}) => {
  if (data.length === 0) {
    return (
      <EmptyState
        moduleName="Workforce Capacity Planning"
        onOpenUpload={onOpenUpload || (() => {})}
        onOpenManual={onOpenManual || (() => {})}
        onLoadBenchmark={onLoadBenchmark || (() => {})}
      />
    );
  }
  // Scenario Simulator interactive parameters
  const [simAht, setSimAht] = useState<number>(330);
  const [simShrinkage, setSimShrinkage] = useState<number>(30);
  const [simSlaTarget, setSimSlaTarget] = useState<number>(80);
  const [simTargetSec, setSimTargetSec] = useState<number>(20);
  const [simVolume, setSimVolume] = useState<number>(450);

  // Calculate simulated scenario results
  const simTraffic = calculateTrafficIntensity(simVolume, simAht);
  const simNetAgents = calculateRequiredRawAgents(simVolume, simAht, simSlaTarget / 100.0, simTargetSec);
  const simGrossFte = applyShrinkage(simNetAgents, simShrinkage / 100.0);
  const simServiceLevel = calculateServiceLevel(simTraffic, simNetAgents, simAht, simTargetSec);

  // Baseline comparison for scenario (330s AHT, 30% shrink, 80% SLA)
  const baseNetAgents = calculateRequiredRawAgents(simVolume, 330, 0.80, 20);
  const baseGrossFte = applyShrinkage(baseNetAgents, 0.30);
  const fteDelta = Number((simGrossFte - baseGrossFte).toFixed(1));

  // Hourly capacity aggregation (24 hours)
  const hourlyCap = Array.from({ length: 24 }, (_, hour) => {
    const subset = data.filter(r => r.hour === hour);
    const count = subset.length || 1;
    const reqFte = Number((subset.reduce((s, r) => s + r.requiredGrossFte, 0) / count).toFixed(1));
    const schedFte = Number((subset.reduce((s, r) => s + r.scheduledGrossFte, 0) / count).toFixed(1));
    const availFte = Number((subset.reduce((s, r) => s + r.availableGrossFte, 0) / count).toFixed(1));
    const gap = Number((availFte - reqFte).toFixed(1));
    return {
      hourLabel: `${hour.toString().padStart(2, '0')}:00`,
      reqFte,
      schedFte,
      availFte,
      gap,
      workloadHours: Number((subset.reduce((s, r) => s + r.workloadHours, 0) / count).toFixed(1))
    };
  });

  // Identify undercapacity (< -5 FTE) and overcapacity (> +5 FTE) intervals
  const undercapacityHours = hourlyCap.filter(h => h.gap < -5);
  const overcapacityHours = hourlyCap.filter(h => h.gap > 5);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Workforce Capacity Planning & Erlang-C Sizing</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Model required productive headcount, gross roster sizing, shrinkage buffers, and intraday over/undercapacity.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2 text-xs font-mono text-slate-600">
          <span>Gross FTE = Net Agents / (1 - Shrinkage)</span>
        </div>
      </div>

      {/* WHAT-IF SCENARIO MODELING SIMULATOR */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
              Interactive What-If Capacity Scenario Simulator
            </h3>
          </div>
          <span className="text-xs text-slate-400">Deterministic Erlang-C Engine</span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-5 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>Hourly Contacts:</span>
              <span className="font-mono font-semibold text-blue-400">{simVolume} calls</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="25"
              value={simVolume}
              onChange={(e) => setSimVolume(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>100</span>
              <span>1,000</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>AHT (seconds):</span>
              <span className="font-mono font-semibold text-blue-400">{simAht}s ({(simAht / 60).toFixed(1)}m)</span>
            </div>
            <input
              type="range"
              min="180"
              max="600"
              step="15"
              value={simAht}
              onChange={(e) => setSimAht(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>180s (3m)</span>
              <span>600s (10m)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>Total Shrinkage %:</span>
              <span className="font-mono font-semibold text-blue-400">{simShrinkage}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="45"
              step="1"
              value={simShrinkage}
              onChange={(e) => setSimShrinkage(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>15%</span>
              <span>45%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>Target SLA %:</span>
              <span className="font-mono font-semibold text-blue-400">{simSlaTarget}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              step="5"
              value={simSlaTarget}
              onChange={(e) => setSimSlaTarget(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>60%</span>
              <span>95%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>SLA Target Time:</span>
              <span className="font-mono font-semibold text-blue-400">{simTargetSec} seconds</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={simTargetSec}
              onChange={(e) => setSimTargetSec(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>10s</span>
              <span>60s</span>
            </div>
          </div>
        </div>

        {/* Simulator Outputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/80 rounded-lg p-2.5">
            <span className="text-slate-400 block text-[11px]">Traffic Intensity:</span>
            <span className="font-mono font-bold text-lg text-slate-100">{simTraffic.toFixed(1)} Erlangs</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">({simVolume} * {simAht}s / 3600)</span>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-2.5">
            <span className="text-slate-400 block text-[11px]">Net Productive Agents:</span>
            <span className="font-mono font-bold text-lg text-emerald-400">{simNetAgents} Agents</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Attains {(simServiceLevel * 100).toFixed(1)}% SLA</span>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-2.5">
            <span className="text-slate-400 block text-[11px]">Required Gross FTE:</span>
            <span className="font-mono font-bold text-lg text-blue-400">{simGrossFte} FTE</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">Sized for {simShrinkage}% shrinkage</span>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-2.5">
            <span className="text-slate-400 block text-[11px]">Variance vs Baseline:</span>
            <div className="flex items-center gap-1">
              <span className={`font-mono font-bold text-lg ${fteDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fteDelta > 0 ? `+${fteDelta}` : fteDelta} FTE
              </span>
              {fteDelta > 0 ? <ArrowUpRight className="w-4 h-4 text-amber-400" /> : <ArrowDownRight className="w-4 h-4 text-emerald-400" />}
            </div>
            <span className="block text-[10px] text-slate-400 mt-0.5">Baseline: {baseGrossFte} FTE</span>
          </div>
        </div>
      </div>

      {/* CAPACITY BREAKDOWN: REQUIRED VS SCHEDULED VS AVAILABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Intraday Staffing Curves (Required vs Scheduled vs Available)</h3>
              <p className="text-xs text-slate-500">24-hour aggregate across selected dates & channels.</p>
            </div>
          </div>
          <MultiLineChart
            labels={hourlyCap.map(h => h.hourLabel)}
            series={[
              { name: 'Required Gross FTE', color: '#dc2626', data: hourlyCap.map(h => h.reqFte) },
              { name: 'Scheduled FTE', color: '#2563eb', data: hourlyCap.map(h => h.schedFte), dashed: true },
              { name: 'Available FTE', color: '#059669', data: hourlyCap.map(h => h.availFte) }
            ]}
            height={260}
            formatY={(v) => `${v.toFixed(0)} FTE`}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Net Staffing Gap by Hour of Day</h3>
              <p className="text-xs text-slate-500">Available FTE minus Required Gross FTE (Surplus vs Deficit).</p>
            </div>
          </div>
          <BarChart
            labels={hourlyCap.map(h => h.hourLabel)}
            values={hourlyCap.map(h => h.gap)}
            height={260}
            formatY={(v) => `${v > 0 ? `+${v}` : v} FTE`}
            colorCondition={(v) => (v >= 0 ? '#059669' : '#dc2626')}
          />
        </div>
      </div>

      {/* UNDERCAPACITY & OVERCAPACITY DETECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Undercapacity Card */}
        <div className="bg-white border border-rose-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
              Undercapacity Risk Intervals (Gap &lt; -5 FTE)
            </span>
            <span className="text-xs font-mono font-bold text-rose-700">{undercapacityHours.length} hours</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Intervals where available productive agents fall below Erlang-C service level threshold.
          </p>
          <div className="space-y-1.5">
            {undercapacityHours.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-rose-50 rounded border border-rose-100 font-mono">
                <span className="font-sans text-slate-800 font-medium">{h.hourLabel} UTC</span>
                <span className="text-slate-600">Req: {h.reqFte} | Avail: {h.availFte}</span>
                <span className="font-bold text-rose-700">{h.gap} FTE Deficit</span>
              </div>
            ))}
          </div>
        </div>

        {/* Overcapacity Card */}
        <div className="bg-white border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              Overcapacity Intervals (Gap &gt; +5 FTE)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">{overcapacityHours.length} hours</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Opportunities for off-queue learning, asynchronous backlog burning, or offline coaching.
          </p>
          <div className="space-y-1.5">
            {overcapacityHours.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-emerald-50 rounded border border-emerald-100 font-mono">
                <span className="font-sans text-slate-800 font-medium">{h.hourLabel} UTC</span>
                <span className="text-slate-600">Req: {h.reqFte} | Avail: {h.availFte}</span>
                <span className="font-bold text-emerald-700">+{h.gap} FTE Surplus</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DOCUMENTED CAPACITY ASSUMPTIONS & SHRINKAGE TAXONOMY */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
          Workforce Management Capacity Taxonomy & Formulas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
          <div>
            <h4 className="font-semibold text-slate-900 mb-1">Shrinkage Factor Decomposition (30.0% Total)</h4>
            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>Planned Shrinkage (18.0%):</span>
                <span className="font-mono font-medium">Meal & breaks (8.5%), Coaching (4.5%), Compliance Training (5.0%)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>Unplanned Shrinkage (12.0%):</span>
                <span className="font-mono font-medium">Sick leave / PTO (8.0%), Tardiness & System Downtime (4.0%)</span>
              </div>
              <div className="flex justify-between font-semibold pt-0.5 text-slate-900">
                <span>Total Roster Inflation Multiplier:</span>
                <span className="font-mono text-blue-700">1 / (1 - 0.30) = 1.428x Gross Sizing</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-1">Erlang-C Queuing Formulas</h4>
            <div className="space-y-1 text-slate-600">
              <p>• <strong>Workload Hours:</strong> W = (Volume &times; AHT) / 3600</p>
              <p>• <strong>Traffic Intensity (A Erlangs):</strong> A = (Volume / 3600) &times; AHT</p>
              <p>• <strong>Probability of Waiting (P_w):</strong> Solved via Erlang-C formulation with stability condition N &gt; A.</p>
              <p>• <strong>Service Level (SLA):</strong> SL = 1 - P_w &middot; exp(-(N - A) &middot; (T / AHT)), target SL &ge; 80% within T=20 seconds.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
