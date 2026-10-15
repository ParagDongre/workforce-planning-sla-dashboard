import React, { useState } from 'react';
import { WfmActionItem } from '../utils/wfmMath';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Database,
  ExternalLink
} from 'lucide-react';

interface ActionTrackerProps {
  actions: WfmActionItem[];
  onAddAction: (action: WfmActionItem) => void;
  onUpdateAction: (id: string, updates: Partial<WfmActionItem>) => void;
  onDeleteAction: (id: string) => void;
  onImportActions: (actions: WfmActionItem[]) => void;
}

export const ActionTracker: React.FC<ActionTrackerProps> = ({
  actions,
  onAddAction,
  onUpdateAction,
  onDeleteAction,
  onImportActions
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');

  // New action form state
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPriority, setNewPriority] = useState<WfmActionItem['priority']>('P2 - High');
  const [newOwner, setNewOwner] = useState<string>('Sarah Jenkins (PM I - Workforce)');
  const [newDueDate, setNewDueDate] = useState<string>('2026-10-25');
  const [newCategory, setNewCategory] = useState<string>('Shift Scheduling & Overtime');
  const [newDependencies, setNewDependencies] = useState<string>('');
  const [newVerificationNotes, setNewVerificationNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Stats
  const openCount = actions.filter(a => a.status === 'Open').length;
  const inProgressCount = actions.filter(a => a.status === 'In Progress').length;
  const blockedCount = actions.filter(a => a.status === 'Blocked').length;
  const mitigatedCount = actions.filter(a => a.status === 'Mitigated' || a.status === 'Closed').length;

  // Filter actions
  const filteredActions = actions.filter(a => {
    if (statusFilter !== 'All' && a.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && a.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = a.issueDescription.toLowerCase().includes(q) ||
                    a.owner.toLowerCase().includes(q) ||
                    a.id.toLowerCase().includes(q) ||
                    a.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) {
      setFormError('Issue description is required.');
      return;
    }

    const nextId = `ACT-WFM-${actions.length + 101}`;
    const now = new Date().toISOString();
    const newItem: WfmActionItem = {
      id: nextId,
      issueDescription: newDesc.trim(),
      priority: newPriority,
      owner: newOwner.trim(),
      dueDate: newDueDate,
      status: 'Open',
      category: newCategory,
      dependencies: newDependencies.trim(),
      verificationNotes: newVerificationNotes.trim(),
      createdAt: now,
      updatedAt: now
    };

    onAddAction(newItem);
    setIsAddModalOpen(false);
    setNewDesc('');
    setNewDependencies('');
    setNewVerificationNotes('');
    setFormError('');
  };

  const handleExportCsv = () => {
    const headers = ['id', 'issueDescription', 'priority', 'owner', 'dueDate', 'status', 'category', 'dependencies', 'verificationNotes'];
    const rows = actions.map(a => [
      a.id,
      `"${a.issueDescription.replace(/"/g, '""')}"`,
      a.priority,
      `"${a.owner}"`,
      a.dueDate,
      a.status,
      `"${a.category}"`,
      `"${(a.dependencies || '').replace(/"/g, '""')}"`,
      `"${(a.verificationNotes || '').replace(/"/g, '""')}"`
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wfm_actions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Workforce Management Action Tracker</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Log, assign, prioritize, and track mitigation programs for capacity deficits, shrinkage spikes, and SLA risks.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Log Mitigation Action
          </button>
        </div>
      </div>

      {/* STATS TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Open Backlog</span>
            <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{openCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting assignment / kickoff</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>In Progress</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{inProgressCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active operational execution</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Blocked / Escalated</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{blockedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pending approvals or dependencies</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Mitigated & Closed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{mitigatedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Verified service recovery</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search actions by issue, owner, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="P1 - Critical">P1 - Critical</option>
              <option value="P2 - High">P2 - High</option>
              <option value="P3 - Medium">P3 - Medium</option>
              <option value="P4 - Low">P4 - Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* ACTIONS TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">ID</th>
                <th className="py-2.5 px-2 font-semibold">Priority</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Issue Description & Impact</th>
                <th className="py-2.5 px-3 font-semibold">Owner</th>
                <th className="py-2.5 px-2 font-semibold">Due Date</th>
                <th className="py-2.5 px-3 font-semibold">Dependencies</th>
                <th className="py-2.5 px-3 font-semibold">Verification Notes</th>
                <th className="py-2.5 px-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    No mitigation actions match the current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredActions.map((action) => {
                  const priorityClass =
                    action.priority.includes('P1') ? 'text-rose-700 font-bold' :
                    action.priority.includes('P2') ? 'text-amber-700 font-semibold' :
                    'text-slate-600';

                  return (
                    <tr key={action.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {action.id}
                      </td>

                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className={`text-[11px] ${priorityClass}`}>
                          {action.priority}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={action.status}
                          onChange={(e) => onUpdateAction(action.id, { status: e.target.value as any })}
                          className={`text-[11px] font-medium rounded px-2 py-0.5 border ${
                            action.status === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            action.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            action.status === 'Blocked' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Mitigated">Mitigated</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-900 max-w-xs">
                        <div className="font-medium">{action.issueDescription}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{action.category}</div>
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-700 whitespace-nowrap">
                        {action.owner}
                      </td>

                      <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap">
                        {action.dueDate}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate text-[11px]">
                        {action.dependencies || 'None'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 max-w-xs text-[11px]">
                        {editingNotesId === action.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 w-full"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                onUpdateAction(action.id, { verificationNotes: notesDraft });
                                setEditingNotesId(null);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesId(action.id);
                              setNotesDraft(action.verificationNotes || '');
                            }}
                            className="cursor-pointer hover:text-blue-600 truncate flex items-center justify-between group"
                            title="Click to edit verification notes"
                          >
                            <span>{action.verificationNotes || 'Add verification notes...'}</span>
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 ml-1" />
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => onDeleteAction(action.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Delete action item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQLITE PERSISTENCE FOOTER */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <span>SQLite Database Integration: Tables schema <code>actions(id, issue_description, priority, owner, due_date, status, category, dependencies, verification_notes)</code>.</span>
        </div>
        <div className="text-slate-500 text-[11px] font-mono">
          <span>Synced locally & via python_app/wfm_portfolio.db</span>
        </div>
      </div>

      {/* ADD ACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">Log New Workforce Mitigation Action</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Issue Description & Root Cause *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Monday peak interval staffing deficit of -18 FTE on Voice channel..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                  >
                    <option value="P1 - Critical">P1 - Critical</option>
                    <option value="P2 - High">P2 - High</option>
                    <option value="P3 - Medium">P3 - Medium</option>
                    <option value="P4 - Low">P4 - Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Action Owner</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Root Cause Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                  >
                    <option value="Shift Scheduling & Overtime">Shift Scheduling & Overtime</option>
                    <option value="Shrinkage & Adherence">Shrinkage & Adherence</option>
                    <option value="Cross-Skilling & Blended Routing">Cross-Skilling & Blended Routing</option>
                    <option value="Forecast Model Recalibration">Forecast Model Recalibration</option>
                    <option value="Process & AHT Optimization">Process & AHT Optimization</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Dependencies & Approvals</label>
                <input
                  type="text"
                  placeholder="e.g. Operations Manager sign-off for overtime budget"
                  value={newDependencies}
                  onChange={(e) => setNewDependencies(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Verification & Measurement Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule updated in WFM platform; verify SLA post-shift"
                  value={newVerificationNotes}
                  onChange={(e) => setNewVerificationNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs"
                >
                  Save Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
