/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  generateSyntheticWfmDataset, 
  INITIAL_ACTION_ITEMS, 
  HourlyWfmRecord, 
  WfmActionItem 
} from './utils/wfmMath';
import { SimulatedBanner } from './components/SimulatedBanner';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { DemandForecasting } from './components/DemandForecasting';
import { CapacityPlanning } from './components/CapacityPlanning';
import { SlaAnalytics } from './components/SlaAnalytics';
import { VarianceRiskAnalysis } from './components/VarianceRiskAnalysis';
import { ActionTracker } from './components/ActionTracker';
import { ProgramManagement } from './components/ProgramManagement';
import { ReportingSummary } from './components/ReportingSummary';
import { AutomatedTestSuite } from './components/AutomatedTestSuite';
import { DataManagementModal } from './components/DataManagementModal';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  ShieldAlert, 
  Layers, 
  CheckSquare, 
  Download, 
  Cpu, 
  Upload,
  Plus,
  Trash2,
  FileCheck,
  Briefcase
} from 'lucide-react';

const LOCAL_STORAGE_RECORDS_KEY = 'wfm_production_records_v2';
const LOCAL_STORAGE_ACTIONS_KEY = 'wfm_portfolio_actions_v2';
const LOCAL_STORAGE_MODE_KEY = 'wfm_dataset_mode_v2';

export default function App() {
  // Active Tab navigation
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Modal State
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);
  const [dataModalInitialTab, setDataModalInitialTab] = useState<'upload' | 'manual' | 'manage'>('upload');

  // Dataset State (starts clean / empty unless previously stored by the user)
  const [records, setRecords] = useState<HourlyWfmRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved records', e);
    }
    // Clean slate by default as requested: "clear all the dummy data"
    return [];
  });

  const [datasetMode, setDatasetMode] = useState<'empty' | 'custom' | 'benchmark'>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_MODE_KEY);
    if (saved === 'custom' || saved === 'benchmark') return saved;
    return 'empty';
  });

  // Action Items state
  const [actions, setActions] = useState<WfmActionItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ACTIONS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse localStorage actions', e);
    }
    return INITIAL_ACTION_ITEMS;
  });

  // Global filters
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'Voice' | 'Chat' | 'Email'>('All');
  const [selectedShift, setSelectedShift] = useState<string>('All');

  // Persistence effects
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(records));
      localStorage.setItem(LOCAL_STORAGE_MODE_KEY, datasetMode);
    } catch (e) {
      console.error('Failed to persist records', e);
    }
  }, [records, datasetMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ACTIONS_KEY, JSON.stringify(actions));
    } catch (e) {
      console.error('Failed to save actions to localStorage', e);
    }
  }, [actions]);

  // Filtered active dataset
  const filteredData = useMemo(() => {
    return records.filter(r => {
      // Channel filter
      if (selectedChannel !== 'All' && r.channel !== selectedChannel) return false;

      // Shift filter
      if (selectedShift === 'Morning' && (r.hour < 6 || r.hour >= 14)) return false;
      if (selectedShift === 'Afternoon' && (r.hour < 14 || r.hour >= 22)) return false;
      if (selectedShift === 'Night' && (r.hour >= 6 && r.hour < 22)) return false;

      return true;
    });
  }, [records, selectedChannel, selectedShift]);

  // Data Ingestion Handlers
  const handleLoadCustomData = (newRecords: HourlyWfmRecord[]) => {
    setRecords(newRecords);
    setDatasetMode('custom');
  };

  const handleAddSingleRecord = (record: HourlyWfmRecord) => {
    setRecords(prev => [record, ...prev]);
    if (datasetMode === 'empty') {
      setDatasetMode('custom');
    }
  };

  const handleClearAllData = () => {
    setRecords([]);
    setDatasetMode('empty');
    try {
      localStorage.removeItem(LOCAL_STORAGE_RECORDS_KEY);
      localStorage.setItem(LOCAL_STORAGE_MODE_KEY, 'empty');
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadBenchmarkData = () => {
    const benchmark = generateSyntheticWfmDataset(28, 42);
    setRecords(benchmark);
    setDatasetMode('benchmark');
  };

  const openDataModal = (tab: 'upload' | 'manual' | 'manage') => {
    setDataModalInitialTab(tab);
    setIsDataModalOpen(true);
  };

  // Action Tracker Handlers
  const handleAddAction = (newAction: WfmActionItem) => {
    setActions(prev => [newAction, ...prev]);
  };

  const handleUpdateAction = (id: string, updates: Partial<WfmActionItem>) => {
    setActions(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, ...updates, updatedAt: new Date().toISOString() };
      }
      return a;
    }));
  };

  const handleDeleteAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const handleImportActions = (imported: WfmActionItem[]) => {
    setActions(imported);
  };

  const navTabs = [
    { id: 'overview', label: '1. Executive Overview', icon: BarChart3 },
    { id: 'forecasting', label: '2. Demand Forecasting', icon: TrendingUp },
    { id: 'capacity', label: '3. Capacity Planning', icon: Users },
    { id: 'sla', label: '4. SLA Analytics', icon: ShieldAlert },
    { id: 'variance', label: '5. Variance & Risk', icon: Layers },
    { id: 'actions', label: '6. Action Tracker', icon: CheckSquare },
    { id: 'program', label: '7. Program Governance', icon: Briefcase },
    { id: 'reporting', label: '8. Reporting & Briefing', icon: Download },
    { id: 'tests', label: 'Test Suite', icon: Cpu }
  ];

  return (
    <div className="min-h-screen bg-slate-100/60 font-sans text-slate-800 antialiased selection:bg-blue-500 selection:text-white flex flex-col">
      {/* 1. DATASET STATUS NOTICE */}
      <SimulatedBanner mode={datasetMode} recordCount={records.length} />

      {/* 2. GLOBAL EXECUTIVE HEADER */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
              WFM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
                  Workforce Planning & SLA Intelligence Dashboard
                </h1>
                <span className="text-[10px] font-semibold tracking-wider text-blue-300 uppercase bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
                  Production Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contact Center Capacity Planning, Intraday Staffing & Service Level Governance
              </p>
            </div>
          </div>

          {/* REAL DATA INGESTION & WORKSPACE ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => openDataModal('upload')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Ingest Real CSV
            </button>

            <button
              onClick={() => openDataModal('manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Log Interval
            </button>

            {records.length > 0 ? (
              <button
                onClick={() => {
                  if (confirm('Clear all operational data to return to a clean slate?')) {
                    handleClearAllData();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-lg transition-colors text-[11px]"
                title="Wipe active records to clean canvas"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All Data
              </button>
            ) : (
              <button
                onClick={handleLoadBenchmarkData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg transition-colors text-[11px]"
                title="Load 28-day reference benchmark data"
              >
                <FileCheck className="w-3.5 h-3.5" /> Load Benchmark
              </button>
            )}

            <div className="h-6 w-px bg-slate-700 hidden sm:block" />

            <div className="text-[11px] font-mono text-slate-400">
              {records.length > 0 ? (
                <span className="text-emerald-400 font-semibold">{records.length.toLocaleString()} records active</span>
              ) : (
                <span className="text-slate-400">0 records (Clean Canvas)</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3. GLOBAL FILTER CONTROLS BAR */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Channel filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Channel:</span>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Ingested Channels</option>
                <option value="Voice">Voice (Inbound Phone)</option>
                <option value="Chat">Chat (Digital Messaging)</option>
                <option value="Email">Email (Asynchronous Queue)</option>
              </select>
            </div>

            {/* Shift filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Roster Shift:</span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All 24 Hours</option>
                <option value="Morning">Morning Shift (06:00 - 14:00 UTC)</option>
                <option value="Afternoon">Afternoon Shift (14:00 - 22:00 UTC)</option>
                <option value="Night">Night Shift (22:00 - 06:00 UTC)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Workspace status:{' '}
              <strong className={records.length > 0 ? 'text-emerald-700' : 'text-slate-700'}>
                {records.length > 0 ? `${datasetMode === 'custom' ? 'Custom Real Data' : 'Benchmark Data'} Active` : 'Clean Slate (Awaiting Upload)'}
              </strong>
            </span>
            <button
              onClick={() => openDataModal('upload')}
              className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
            >
              Manage Data &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* 4. MODULE NAVIGATION TABS */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-none gap-1 py-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 5. MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'overview' && (
          <ExecutiveOverview 
            data={filteredData} 
            onNavigateTab={setActiveTab}
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'forecasting' && (
          <DemandForecasting 
            data={filteredData} 
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'capacity' && (
          <CapacityPlanning 
            data={filteredData} 
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'sla' && (
          <SlaAnalytics 
            data={filteredData} 
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'variance' && (
          <VarianceRiskAnalysis 
            data={filteredData} 
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'actions' && (
          <ActionTracker
            actions={actions}
            onAddAction={handleAddAction}
            onUpdateAction={handleUpdateAction}
            onDeleteAction={handleDeleteAction}
            onImportActions={handleImportActions}
          />
        )}
        {activeTab === 'program' && (
          <ProgramManagement data={filteredData} actions={actions} />
        )}
        {activeTab === 'reporting' && (
          <ReportingSummary 
            data={filteredData} 
            actions={actions} 
            onOpenUpload={() => openDataModal('upload')}
            onOpenManual={() => openDataModal('manual')}
            onLoadBenchmark={handleLoadBenchmarkData}
          />
        )}
        {activeTab === 'tests' && (
          <AutomatedTestSuite />
        )}
      </main>

      {/* 6. EXECUTIVE FOOTER */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-200">Workforce Planning & SLA Intelligence Dashboard</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">
              Production-ready workforce optimization platform with live CSV ingestion, deterministic Erlang-C math, and SQLite persistence.
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            <span>Deterministic Erlang-C · Real CSV Ingestion · Zero Hardcoded Mocks</span>
          </div>
        </div>
      </footer>

      {/* DATA MANAGEMENT MODAL */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onLoadData={handleLoadCustomData}
        onAddRecord={handleAddSingleRecord}
        onClearAll={handleClearAllData}
        onLoadBenchmark={handleLoadBenchmarkData}
        currentRecordCount={records.length}
      />
    </div>
  );
}
