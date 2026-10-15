import React from 'react';
import { ShieldCheck, Database, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface SimulatedBannerProps {
  mode: 'empty' | 'custom' | 'benchmark';
  recordCount: number;
}

export const SimulatedBanner: React.FC<SimulatedBannerProps> = ({ mode, recordCount }) => {
  return (
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-700">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {mode === 'empty' ? (
            <>
              <span className="font-semibold text-slate-700 uppercase tracking-wide text-[11px] bg-slate-200 px-1.5 py-0.5 rounded">
                Clean Slate Mode
              </span>
              <span className="text-slate-600">
                All dummy data cleared. Upload your real contact-center CSV export or log intervals manually.
              </span>
            </>
          ) : mode === 'custom' ? (
            <>
              <span className="font-semibold text-emerald-800 uppercase tracking-wide text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Active Custom Dataset
              </span>
              <span className="text-slate-700">
                {recordCount.toLocaleString()} real operational intervals ingested. Deterministic Erlang-C & SLA modeling active.
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-blue-700 uppercase tracking-wide text-[11px] bg-blue-100/70 px-1.5 py-0.5 rounded">
                Benchmark Calibration Dataset
              </span>
              <span className="text-slate-600">
                {recordCount.toLocaleString()} benchmark contact-center intervals loaded for mathematical model verification.
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            Independent WFM Architecture
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            SQLite & Erlang-C Engine
          </span>
        </div>
      </div>
    </div>
  );
};
