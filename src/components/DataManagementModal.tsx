import React, { useState, useRef } from 'react';
import { 
  HourlyWfmRecord, 
  parseWfmCsv, 
  deriveWfmRecord, 
  generateWfmTemplateCsv, 
  CsvColumnMapping 
} from '../utils/wfmMath';
import { 
  Upload, 
  Plus, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Table, 
  X,
  FileCheck
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadData: (records: HourlyWfmRecord[]) => void;
  onAddRecord: (record: HourlyWfmRecord) => void;
  onClearAll: () => void;
  onLoadBenchmark: () => void;
  currentRecordCount: number;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  onLoadData,
  onAddRecord,
  onClearAll,
  onLoadBenchmark,
  currentRecordCount
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'manage'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<HourlyWfmRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Partial<CsvColumnMapping>>({});

  // Manual record form state
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualHour, setManualHour] = useState<number>(new Date().getHours());
  const [manualChannel, setManualChannel] = useState<'Voice' | 'Chat' | 'Email'>('Voice');
  const [manualActualVol, setManualActualVol] = useState<number>(350);
  const [manualForecastVol, setManualForecastVol] = useState<number>(330);
  const [manualAht, setManualAht] = useState<number>(330);
  const [manualSchedFte, setManualSchedFte] = useState<number>(45);
  const [manualAvailFte, setManualAvailFte] = useState<number>(42);
  const [manualShrinkage, setManualShrinkage] = useState<number>(30);
  const [manualSlaTarget, setManualSlaTarget] = useState<number>(80);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      processCsv(text, {});
    };
    reader.readAsText(file);
  };

  const processCsv = (text: string, mapping: Partial<CsvColumnMapping>) => {
    const result = parseWfmCsv(text, mapping);
    setDetectedHeaders(result.detectedHeaders);
    setParsedPreview(result.records);
    setParseErrors(result.errors);
  };

  const handleMappingChange = (field: keyof CsvColumnMapping, value: string) => {
    const updated = { ...columnMapping, [field]: value };
    setColumnMapping(updated);
    if (csvContent) {
      processCsv(csvContent, updated);
    }
  };

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

  const handleCommitUpload = () => {
    if (parsedPreview.length === 0) return;
    onLoadData(parsedPreview);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record = deriveWfmRecord({
      date: manualDate,
      hour: manualHour,
      channel: manualChannel,
      actualVolume: manualActualVol,
      forecastVolume: manualForecastVol,
      actualAht: manualAht,
      scheduledGrossFte: manualSchedFte,
      availableGrossFte: manualAvailFte,
      shrinkageRate: manualShrinkage / 100.0,
      slaTarget: manualSlaTarget / 100.0
    });

    onAddRecord(record);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Workforce Data Management & Ingestion Hub
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload real contact-center interval exports, add manual operational logs, or manage the active dataset.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SUB-TABS */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Import Real CSV Data
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Operational Interval
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Workspace State ({currentRecordCount} records)
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-700 space-y-4">
          {/* TAB 1: UPLOAD CSV */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg p-3">
                <div>
                  <span className="font-semibold text-blue-900 block">Production Ingestion Format</span>
                  <span className="text-[11px] text-blue-700">
                    Supports any standard CSV export with Date, Hour, Channel, and Inbound Volume. Erlang-C required FTE and SLA metrics are computed automatically.
                  </span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-semibold rounded-md shadow-2xs whitespace-nowrap"
                >
                  <Download className="w-3 h-3" /> Get Template CSV
                </button>
              </div>

              {/* DRAG AND DROP ZONE */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <span className="font-semibold text-slate-800 block text-sm">
                  {fileName ? fileName : 'Click to select or drag and drop contact center CSV'}
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Accepts telephony/CRM interval logs, WFM schedule reports, or custom CSV files
                </span>
              </div>

              {/* COLUMN MAPPING IF HEADERS DETECTED */}
              {detectedHeaders.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Column Mapping & Detection</span>
                    <span className="text-slate-500 text-[11px] font-mono">{detectedHeaders.length} headers detected</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                    <div>
                      <label className="block text-slate-600 mb-0.5">Date Column:</label>
                      <select
                        value={columnMapping.date || ''}
                        onChange={(e) => handleMappingChange('date', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1"
                      >
                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-0.5">Hour / Interval:</label>
                      <select
                        value={columnMapping.hour || ''}
                        onChange={(e) => handleMappingChange('hour', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1"
                      >
                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-0.5">Actual Volume:</label>
                      <select
                        value={columnMapping.actualVolume || ''}
                        onChange={(e) => handleMappingChange('actualVolume', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1"
                      >
                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-0.5">Channel / Queue:</label>
                      <select
                        value={columnMapping.channel || ''}
                        onChange={(e) => handleMappingChange('channel', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1"
                      >
                        <option value="">(Default: Voice)</option>
                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* PARSED PREVIEW */}
              {parsedPreview.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-800">
                      Parsed Preview ({parsedPreview.length.toLocaleString()} valid interval records)
                    </span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Validation Passed
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-40">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 font-medium">
                        <tr>
                          <th className="py-1 px-2">Date</th>
                          <th className="py-1 px-2">Hour</th>
                          <th className="py-1 px-2">Channel</th>
                          <th className="py-1 px-2 text-right">Volume</th>
                          <th className="py-1 px-2 text-right">Req Gross FTE</th>
                          <th className="py-1 px-2 text-right">Avail FTE</th>
                          <th className="py-1 px-2 text-right">Gap</th>
                          <th className="py-1 px-2 text-right">SLA %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {parsedPreview.slice(0, 5).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1 px-2 font-sans">{r.date}</td>
                            <td className="py-1 px-2">{r.hour}:00</td>
                            <td className="py-1 px-2 font-sans">{r.channel}</td>
                            <td className="py-1 px-2 text-right">{r.actualVolume}</td>
                            <td className="py-1 px-2 text-right text-blue-700">{r.requiredGrossFte}</td>
                            <td className="py-1 px-2 text-right">{r.availableGrossFte}</td>
                            <td className={`py-1 px-2 text-right ${r.staffingGap < 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'}`}>
                              {r.staffingGap > 0 ? `+${r.staffingGap}` : r.staffingGap}
                            </td>
                            <td className="py-1 px-2 text-right">{(r.slaAttainment * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Parsing Warnings ({parseErrors.length})
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {parseErrors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL RECORD ENTRY */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-slate-600">
                Log a single operational contact-center interval in real time. The mathematical model will compute traffic intensity (Erlangs), Erlang-C required staff, and net capacity gaps.
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Hour of Day (0–23) *</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    required
                    value={manualHour}
                    onChange={(e) => setManualHour(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Channel / Queue *</label>
                  <select
                    value={manualChannel}
                    onChange={(e) => setManualChannel(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  >
                    <option value="Voice">Voice (Inbound Phone)</option>
                    <option value="Chat">Chat (Digital Messaging)</option>
                    <option value="Email">Email (Asynchronous)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Actual Inbound Contacts *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={manualActualVol}
                    onChange={(e) => setManualActualVol(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Forecast Inbound Contacts</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForecastVol}
                    onChange={(e) => setManualForecastVol(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Actual AHT (Seconds) *</label>
                  <input
                    type="number"
                    min="30"
                    required
                    value={manualAht}
                    onChange={(e) => setManualAht(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Scheduled FTE</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={manualSchedFte}
                    onChange={(e) => setManualSchedFte(parseFloat(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Available Logged-in FTE</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={manualAvailFte}
                    onChange={(e) => setManualAvailFte(parseFloat(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Total Shrinkage %</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={manualShrinkage}
                    onChange={(e) => setManualShrinkage(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Target SLA %</label>
                  <input
                    type="number"
                    min="50"
                    max="99"
                    value={manualSlaTarget}
                    onChange={(e) => setManualSlaTarget(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs"
                >
                  Save & Insert Record
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: WORKSPACE STATE MANAGEMENT */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-sm">
                    Active Dataset: {currentRecordCount.toLocaleString()} Intervals Loaded
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {currentRecordCount === 0
                      ? 'The workspace is currently clean with zero records.'
                      : 'Records are active in local memory & browser persistence.'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-rose-200 bg-rose-50/40 rounded-lg flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-rose-900 block mb-1">Clear All Data (Clean Slate)</span>
                    <p className="text-slate-600 text-[11px] mb-3">
                      Completely remove all records to start fresh with a clean, empty workspace ready for real CSV uploads.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all active workforce data?')) {
                        onClearAll();
                        onClose();
                      }
                    }}
                    className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All Data Now
                  </button>
                </div>

                <div className="p-4 border border-slate-200 bg-white rounded-lg flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block mb-1">Load Enterprise Benchmark Dataset</span>
                    <p className="text-slate-600 text-[11px] mb-3">
                      Instantly load 28 days of standard contact-center benchmark data (2,016 hourly records across Voice, Chat, and Email).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onLoadBenchmark();
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5" /> Load Benchmark Dataset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            {activeTab === 'upload' && parsedPreview.length > 0 && `${parsedPreview.length} intervals ready to commit`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium"
            >
              Cancel
            </button>
            {activeTab === 'upload' && parsedPreview.length > 0 && (
              <button
                onClick={handleCommitUpload}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs"
              >
                Commit & Load {parsedPreview.length.toLocaleString()} Records
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
