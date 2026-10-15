import React, { useState } from 'react';
import { HourlyWfmRecord } from '../utils/wfmMath';
import { AlertTriangle, Filter, ShieldAlert, CheckCircle, RefreshCw, Flame } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface VarianceRiskAnalysisProps {
  data: HourlyWfmRecord[];
  onOpenUpload?: () => void;
  onOpenManual?: () => void;
  onLoadBenchmark?: () => void;
}

export const VarianceRiskAnalysis: React.FC<VarianceRiskAnalysisProps> = ({ 
  data,
  onOpenUpload,
  onOpenManual,
  onLoadBenchmark
}) => {
  if (data.length === 0) {
    return (
      <EmptyState
        moduleName="Variance & Risk Analysis"
        onOpenUpload={onOpenUpload || (() => {})}
        onOpenManual={onOpenManual || (() => {})}
        onLoadBenchmark={onLoadBenchmark || (() => {})}
      />
    );
  }
  // Configurable thresholds
  const [slaRiskThresh, setSlaRiskThresh] = useState<number>(75); // SLA < 75%
  const [gapRiskThresh, setGapRiskThresh] = useState<number>(-12); // Staffing gap < -12 FTE
  const [volVarThresh, setVolVarThresh] = useState<number>(18); // Volume variance > 18%
  const [filterSeverity, setFilterSeverity] = useState<'All' | 'High' | 'Medium'>('All');

  // Aggregated Planned vs Actual
  const totalForecastVol = data.reduce((s, r) => s + r.forecastVolume, 0);
  const totalActualVol = data.reduce((s, r) => s + r.actualVolume, 0);
  const volVariance = totalActualVol - totalForecastVol;
  const volVariancePct = totalForecastVol > 0 ? (volVariance / totalForecastVol) * 100 : 0;

  const avgReqFte = data.reduce((s, r) => s + r.requiredGrossFte, 0) / (data.length || 1);
  const avgSchedFte = data.reduce((s, r) => s + r.scheduledGrossFte, 0) / (data.length || 1);
  const avgAvailFte = data.reduce((s, r) => s + r.availableGrossFte, 0) / (data.length || 1);
  const fteGap = avgAvailFte - avgReqFte;

  const avgForecastAht = data.reduce((s, r) => s + r.forecastAht, 0) / (data.length || 1);
  const avgActualAht = data.reduce((s, r) => s + r.actualAht, 0) / (data.length || 1);
  const ahtVariance = avgActualAht - avgForecastAht;

  const weightedSla = totalActualVol > 0
    ? (data.reduce((s, r) => s + (r.actualVolume * r.slaAttainment), 0) / totalActualVol) * 100
    : 0;

  // Filter operational exception intervals
  const exceptionRecords = data.map(r => {
    const isSlaBreach = (r.slaAttainment * 100) < slaRiskThresh;
    const isGapCritical = r.staffingGap < gapRiskThresh;
    const isVolSpike = Math.abs(r.volumeVariancePct) > volVarThresh;

    const issues: string[] = [];
    let severity: 'High' | 'Medium' | 'Normal' = 'Normal';
    let rootCause = 'Normal Variance';

    if (isSlaBreach && isGapCritical) {
      severity = 'High';
      rootCause = 'Severe Understaffing & Queuing Backlog';
      issues.push(`SLA ${(r.slaAttainment * 100).toFixed(0)}% (Goal: ${(r.slaTarget * 100).toFixed(0)}%)`);
      issues.push(`Gap ${r.staffingGap} FTE`);
    } else if (isVolSpike && isSlaBreach) {
      severity = 'High';
      rootCause = 'Unforecasted Inbound Demand Surge';
      issues.push(`Vol +${r.volumeVariancePct}%`);
      issues.push(`SLA ${(r.slaAttainment * 100).toFixed(0)}%`);
    } else if (isGapCritical) {
      severity = 'Medium';
      rootCause = 'Intraday Roster Adherence / Shrinkage Deficit';
      issues.push(`Gap ${r.staffingGap} FTE`);
    } else if (isSlaBreach) {
      severity = 'Medium';
      rootCause = 'AHT Extension / Queue Friction';
      issues.push(`SLA ${(r.slaAttainment * 100).toFixed(0)}%`);
    } else if (isVolSpike) {
      severity = 'Medium';
      rootCause = 'Volume Variance Outlier';
      issues.push(`Vol ${r.volumeVariancePct > 0 ? `+${r.volumeVariancePct}%` : `${r.volumeVariancePct}%`}`);
    }

    return {
      ...r,
      severity,
      rootCause,
      issues: issues.join(' · ')
    };
  }).filter(r => r.severity !== 'Normal');

  const displayedExceptions = filterSeverity === 'All'
    ? exceptionRecords
    : exceptionRecords.filter(r => r.severity === filterSeverity);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Variance & Operational Risk Analysis</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Compare planned vs. actual operational KPIs and configure dynamic alerting thresholds to detect recurring risks.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="text-rose-700 font-semibold">{exceptionRecords.length} Exceptions Detected</span>
        </div>
      </div>

      {/* PLANNED VS ACTUAL SCORECARD GRID */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-xs text-slate-800 uppercase tracking-wider">
          Planned vs. Actual Performance Matrix
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Metric Dimension</th>
                <th className="py-2.5 px-4 font-medium text-right">Planned / Baseline</th>
                <th className="py-2.5 px-4 font-medium text-right">Actual Outcome</th>
                <th className="py-2.5 px-4 font-medium text-right">Variance Delta</th>
                <th className="py-2.5 px-4 font-medium text-center">Status / Risk Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-sans font-medium text-slate-900">Total Inbound Interaction Volume</td>
                <td className="py-2.5 px-4 text-right text-slate-600">{totalForecastVol.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{totalActualVol.toLocaleString()}</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${volVariancePct > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                  {volVariance > 0 ? `+${volVariance.toLocaleString()}` : volVariance.toLocaleString()} ({volVariancePct > 0 ? `+${volVariancePct.toFixed(1)}%` : `${volVariancePct.toFixed(1)}%`})
                </td>
                <td className="py-2.5 px-4 text-center font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${Math.abs(volVariancePct) > 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {Math.abs(volVariancePct) > 10 ? 'Volume Volatility' : 'Within Bounds'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-sans font-medium text-slate-900">Average Handling Time (AHT)</td>
                <td className="py-2.5 px-4 text-right text-slate-600">{avgForecastAht.toFixed(0)}s</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{avgActualAht.toFixed(0)}s</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${ahtVariance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {ahtVariance > 0 ? `+${ahtVariance.toFixed(1)}s` : `${ahtVariance.toFixed(1)}s`}
                </td>
                <td className="py-2.5 px-4 text-center font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${ahtVariance > 15 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {ahtVariance > 15 ? 'AHT Inflation' : 'Normalized'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-sans font-medium text-slate-900">Required Staffing (Gross FTE)</td>
                <td className="py-2.5 px-4 text-right text-slate-600">{avgSchedFte.toFixed(1)} FTE (Sched)</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{avgReqFte.toFixed(1)} FTE</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${fteGap < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {fteGap > 0 ? `+${fteGap.toFixed(1)} FTE` : `${fteGap.toFixed(1)} FTE`} (Net Gap)
                </td>
                <td className="py-2.5 px-4 text-center font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${fteGap < -5 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {fteGap < -5 ? 'Under-resourced' : 'Balanced'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-sans font-medium text-slate-900">Service Level Attainment (SLA)</td>
                <td className="py-2.5 px-4 text-right text-slate-600">80.0% Target</td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{weightedSla.toFixed(1)}%</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${weightedSla >= 80 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {(weightedSla - 80).toFixed(1)}%
                </td>
                <td className="py-2.5 px-4 text-center font-sans">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${weightedSla < 80 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {weightedSla < 80 ? 'SLA Deficit' : 'SLA Met'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIGURABLE THRESHOLDS BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Configurable Risk Thresholds & Exception Criteria
            </h3>
          </div>
          <span className="text-xs text-slate-500">Adjust thresholds to alter exception sensitivity</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <div className="flex justify-between text-slate-700 mb-1">
              <span>Critical SLA Threshold:</span>
              <span className="font-mono font-semibold text-purple-700">&lt; {slaRiskThresh}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="90"
              step="5"
              value={slaRiskThresh}
              onChange={(e) => setSlaRiskThresh(Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>60%</span>
              <span>90%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-700 mb-1">
              <span>Staffing Deficit Alert:</span>
              <span className="font-mono font-semibold text-rose-700">&lt; {gapRiskThresh} FTE</span>
            </div>
            <input
              type="range"
              min="-25"
              max="-5"
              step="1"
              value={gapRiskThresh}
              onChange={(e) => setGapRiskThresh(Number(e.target.value))}
              className="w-full accent-rose-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>-25 FTE</span>
              <span>-5 FTE</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-700 mb-1">
              <span>Volume Variance Warning:</span>
              <span className="font-mono font-semibold text-amber-700">&gt; &plusmn;{volVarThresh}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="35"
              step="5"
              value={volVarThresh}
              onChange={(e) => setVolVarThresh(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>10%</span>
              <span>35%</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETECTED OPERATIONAL EXCEPTIONS LOG */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Operational Exceptions & Anomaly Log ({displayedExceptions.length} intervals)
            </h3>
            <p className="text-xs text-slate-500">
              Automated root-cause classification based on active risk thresholds.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Severity:</span>
            <button
              onClick={() => setFilterSeverity('All')}
              className={`px-2 py-0.5 rounded text-xs ${filterSeverity === 'All' ? 'bg-slate-900 text-white font-medium' : 'bg-slate-100 text-slate-600'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterSeverity('High')}
              className={`px-2 py-0.5 rounded text-xs ${filterSeverity === 'High' ? 'bg-rose-700 text-white font-medium' : 'bg-slate-100 text-slate-600'}`}
            >
              High
            </button>
            <button
              onClick={() => setFilterSeverity('Medium')}
              className={`px-2 py-0.5 rounded text-xs ${filterSeverity === 'Medium' ? 'bg-amber-700 text-white font-medium' : 'bg-slate-100 text-slate-600'}`}
            >
              Medium
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs text-left text-slate-700 border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3 font-medium">Timestamp</th>
                <th className="py-2 px-2 font-medium">Queue</th>
                <th className="py-2 px-2 font-medium">Severity</th>
                <th className="py-2 px-3 font-medium">Root-Cause Hypothesis</th>
                <th className="py-2 px-2 font-medium text-right">Actual Vol</th>
                <th className="py-2 px-2 font-medium text-right">Net Gap</th>
                <th className="py-2 px-2 font-medium text-right">SLA</th>
                <th className="py-2 px-3 font-medium">Active Violations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {displayedExceptions.slice(0, 15).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 font-sans font-medium text-slate-900">
                    {r.date} · {r.hour.toString().padStart(2, '0')}:00 UTC
                  </td>
                  <td className="py-2 px-2 font-sans">{r.channel}</td>
                  <td className="py-2 px-2 font-sans">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-800">{r.rootCause}</td>
                  <td className="py-2 px-2 text-right">{r.actualVolume}</td>
                  <td className={`py-2 px-2 text-right font-bold ${r.staffingGap < 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                    {r.staffingGap > 0 ? `+${r.staffingGap}` : r.staffingGap}
                  </td>
                  <td className={`py-2 px-2 text-right font-bold ${(r.slaAttainment * 100) < 80 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {(r.slaAttainment * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-500 text-[10px]">{r.issues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECURRING OPERATIONAL EXCEPTIONS SUMMARY */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
          Recurring Operational Exceptions Taxonomy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="bg-white p-3 rounded border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">1. Monday Morning Peak Surge</span>
            <p className="text-slate-600">
              Inbound volume increases by +18% between 09:00 - 11:00 UTC due to weekend inquiry accumulation, outpacing standard Erlang-C staffing allocations.
            </p>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">2. Lunch-Hour Adherence Dip</span>
            <p className="text-slate-600">
              Unplanned agent overlap between 12:00 - 14:00 UTC increases net shrinkage by +8%, creating a transient -14 FTE gap and elevating ASA from 18s to 52s.
            </p>
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">3. Friday Evening Release Spike</span>
            <p className="text-slate-600">
              System software deployments on Friday afternoons induce technical inquiries (+14% volume) while evening shift attrition lowers available headcount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
