import React from 'react';
import { Upload, Plus, FileSpreadsheet, Download, FileCheck, Database } from 'lucide-react';
import { generateWfmTemplateCsv } from '../utils/wfmMath';

interface EmptyStateProps {
  moduleName?: string;
  onOpenUpload: () => void;
  onOpenManual: () => void;
  onLoadBenchmark: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  moduleName = 'Workforce Workspace',
  onOpenUpload,
  onOpenManual,
  onLoadBenchmark
}) => {
  const handleDownloadTemplate = () => {
    const template = generateWfmTemplateCsv();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wfm_production_ingestion_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs my-6">
      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
        <FileSpreadsheet className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
        No Operational Records in {moduleName}
      </h3>
      <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        The workspace is completely clean. Import your contact-center CSV export, log an operational interval, or load the benchmark dataset to activate full Erlang-C capacity intelligence.
      </p>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Contact-Center CSV
        </button>

        <button
          onClick={onOpenManual}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Log Single Interval
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Template CSV
        </button>
      </div>

      {/* OR LOAD BENCHMARK */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
        <span>Want to explore reference models?</span>
        <button
          onClick={onLoadBenchmark}
          className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 flex items-center gap-1"
        >
          <FileCheck className="w-3.5 h-3.5" /> Load Enterprise Benchmark Data
        </button>
      </div>
    </div>
  );
};
