/**
 * Deterministic Workforce Management (WFM) Mathematical Engine.
 * Implements Erlang-C, Shrinkage, Forecast Accuracy (WAPE, MAPE, Bias),
 * Capacity Modeling, SLA Queuing, and Synthetic Contact Center Data Generation.
 *
 * All datasets and results are synthetic and simulated for portfolio demonstration.
 */

export interface HourlyWfmRecord {
  date: string;
  dayName: string;
  hour: number;
  channel: 'Voice' | 'Chat' | 'Email';
  forecastVolume: number;
  actualVolume: number;
  volumeVariance: number;
  volumeVariancePct: number;
  forecastAht: number;
  actualAht: number;
  workloadHours: number;
  requiredNetFte: number;
  requiredGrossFte: number;
  scheduledGrossFte: number;
  availableGrossFte: number;
  staffingGap: number;
  shrinkageRate: number;
  utilization: number;
  slaAttainment: number;
  slaTarget: number;
  slaBreached: boolean;
  asaSeconds: number;
  backlog: number;
  isPeak: boolean;
}

export interface WfmActionItem {
  id: string;
  issueDescription: string;
  priority: 'P1 - Critical' | 'P2 - High' | 'P3 - Medium' | 'P4 - Low';
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Blocked' | 'Mitigated' | 'Closed';
  category: string;
  dependencies: string;
  verificationNotes: string;
  createdAt: string;
  updatedAt: string;
}

// --- CORE MATHEMATICAL CALCULATIONS ---

export function calculateWorkloadHours(volume: number, ahtSeconds: number): number {
  if (volume < 0 || ahtSeconds < 0) return 0;
  return Number(((volume * ahtSeconds) / 3600.0).toFixed(2));
}

export function calculateTrafficIntensity(
  volume: number,
  ahtSeconds: number,
  intervalSeconds: number = 3600.0
): number {
  if (intervalSeconds <= 0) return 0;
  return (volume / intervalSeconds) * ahtSeconds;
}

export function erlangCProbabilityWaiting(trafficIntensity: number, servers: number): number {
  if (servers <= 0) return 1.0;
  if (servers <= trafficIntensity) return 1.0;
  if (trafficIntensity <= 0) return 0.0;

  const a = trafficIntensity;
  const n = servers;

  let sumTerms = 1.0;
  let term = 1.0;
  for (let k = 1; k < n; k++) {
    term = term * (a / k);
    sumTerms += term;
  }

  const lastTerm = term * (a / n);
  const queueFactor = n / (n - a);
  const num = lastTerm * queueFactor;
  const denom = sumTerms + num;

  if (denom <= 0) return 1.0;
  return Math.max(0.0, Math.min(1.0, num / denom));
}

export function calculateServiceLevel(
  trafficIntensity: number,
  servers: number,
  ahtSeconds: number,
  targetTimeSeconds: number = 20.0
): number {
  if (servers <= 0 || servers <= trafficIntensity) return 0.0;
  if (trafficIntensity <= 0) return 1.0;

  const pWait = erlangCProbabilityWaiting(trafficIntensity, servers);
  const decayRate = (servers - trafficIntensity) * (targetTimeSeconds / ahtSeconds);
  const sl = 1.0 - pWait * Math.exp(-decayRate);
  return Math.max(0.0, Math.min(1.0, sl));
}

export function calculateASA(
  trafficIntensity: number,
  servers: number,
  ahtSeconds: number
): number {
  if (servers <= trafficIntensity || servers <= 0) return 999.0;
  const pWait = erlangCProbabilityWaiting(trafficIntensity, servers);
  return Number(((pWait * ahtSeconds) / (servers - trafficIntensity)).toFixed(1));
}

export function calculateRequiredRawAgents(
  volume: number,
  ahtSeconds: number,
  targetSlaPct: number = 0.80,
  targetSeconds: number = 20.0,
  intervalSeconds: number = 3600.0
): number {
  if (volume <= 0) return 0;
  const traffic = calculateTrafficIntensity(volume, ahtSeconds, intervalSeconds);
  let servers = Math.max(1, Math.ceil(traffic) + 1);
  const maxSearch = servers + 100;

  while (servers <= maxSearch) {
    const sl = calculateServiceLevel(traffic, servers, ahtSeconds, targetSeconds);
    if (sl >= targetSlaPct) {
      return servers;
    }
    servers++;
  }
  return servers;
}

export function applyShrinkage(netStaff: number, shrinkageRate: number): number {
  if (shrinkageRate >= 1.0 || shrinkageRate < 0.0) return netStaff;
  return Number((netStaff / (1.0 - shrinkageRate)).toFixed(1));
}

export function calculateStaffingGap(availableFte: number, requiredFte: number): number {
  return Number((availableFte - requiredFte).toFixed(1));
}

export function calculateUtilization(workloadHours: number, availableProductiveHours: number): number {
  if (availableProductiveHours <= 0) return 0;
  return Number(Math.min(1.0, workloadHours / availableProductiveHours).toFixed(3));
}

// --- FORECASTING METRICS ---

export function calculateWAPE(actuals: number[], forecasts: number[]): number {
  if (actuals.length !== forecasts.length || actuals.length === 0) return 0;
  const totalActual = actuals.reduce((a, b) => a + b, 0);
  if (totalActual === 0) return 0;
  const totalAbsError = actuals.reduce((sum, act, i) => sum + Math.abs(act - forecasts[i]), 0);
  return Number((totalAbsError / totalActual).toFixed(4));
}

export function calculateMAPE(actuals: number[], forecasts: number[]): number {
  if (actuals.length !== forecasts.length || actuals.length === 0) return 0;
  const validPairs = actuals
    .map((act, i) => ({ act, f: forecasts[i] }))
    .filter(p => p.act > 0);
  if (validPairs.length === 0) return 0;
  const sumPct = validPairs.reduce((sum, p) => sum + Math.abs(p.act - p.f) / p.act, 0);
  return Number((sumPct / validPairs.length).toFixed(4));
}

export function calculateForecastBias(actuals: number[], forecasts: number[]): number {
  if (actuals.length !== forecasts.length || actuals.length === 0) return 0;
  const totalActual = actuals.reduce((a, b) => a + b, 0);
  if (totalActual === 0) return 0;
  const totalError = actuals.reduce((sum, act, i) => sum + (forecasts[i] - act), 0);
  return Number((totalError / totalActual).toFixed(4));
}

export function baselineMovingAverage(history: number[], window: number = 7): number {
  if (history.length === 0) return 0;
  const slice = history.slice(-window);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / slice.length).toFixed(1));
}

export function baselineExponentialSmoothing(history: number[], alpha: number = 0.3): number {
  if (history.length === 0) return 0;
  let s = history[0];
  for (let i = 1; i < history.length; i++) {
    s = alpha * history[i] + (1 - alpha) * s;
  }
  return Number(s.toFixed(1));
}

// --- SYNTHETIC DATASET GENERATION (28 DAYS, HOURLY) ---

export function generateSyntheticWfmDataset(days: number = 28, seed: number = 42): HourlyWfmRecord[] {
  let state = seed;
  const pseudoRand = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 2147483648.0;
  };

  const hourlyCurve = [
    0.015, 0.010, 0.008, 0.008, 0.012, 0.025,
    0.045, 0.070, 0.085, 0.095, 0.090, 0.085,
    0.080, 0.082, 0.085, 0.080, 0.070, 0.060,
    0.050, 0.040, 0.030, 0.024, 0.018, 0.016
  ];
  const dowWeights = [1.18, 1.10, 1.05, 1.02, 1.00, 0.85, 0.80];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const channels: Array<{
    name: 'Voice' | 'Chat' | 'Email';
    baseDaily: number;
    baseAht: number;
    targetSlaSec: number;
    targetSlaPct: number;
    shrinkage: number;
  }> = [
    { name: 'Voice', baseDaily: 3200, baseAht: 330, targetSlaSec: 20, targetSlaPct: 0.80, shrinkage: 0.32 },
    { name: 'Chat', baseDaily: 2400, baseAht: 420, targetSlaSec: 30, targetSlaPct: 0.85, shrinkage: 0.28 },
    { name: 'Email', baseDaily: 1800, baseAht: 600, targetSlaSec: 14400, targetSlaPct: 0.95, shrinkage: 0.25 }
  ];

  const startDate = new Date(2026, 8, 14); // Sep 14, 2026 (Monday)
  const records: HourlyWfmRecord[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayOffset);
    const dow = (currentDate.getDay() + 6) % 7; // Monday = 0
    const dowMult = dowWeights[dow];
    const dayName = dayNames[dow];
    const dateStr = currentDate.toISOString().split('T')[0];

    for (const ch of channels) {
      const dailyForecastVol = ch.baseDaily * dowMult * (0.95 + 0.10 * pseudoRand());
      let accumulatedBacklog = 0.0;

      for (let hour = 0; hour < 24; hour++) {
        const intervalShare = hourlyCurve[hour];
        const fVol = Math.round(dailyForecastVol * intervalShare);

        let varianceMult = 1.0 + (pseudoRand() - 0.5) * 0.20;
        if (dow === 0 && hour >= 9 && hour <= 11) {
          varianceMult += 0.18; // Monday morning peak rush exception
        }
        if (dow === 4 && hour >= 18 && hour <= 21) {
          varianceMult += 0.14; // Friday evening bump
        }

        const actVol = Math.max(1, Math.round(fVol * varianceMult));
        const fAht = ch.baseAht;
        const actAht = Number((fAht * (0.94 + 0.12 * pseudoRand())).toFixed(1));

        let reqNet = 1;
        if (ch.name === 'Email') {
          const wlHours = calculateWorkloadHours(actVol, actAht);
          reqNet = Math.max(1, Math.ceil(wlHours));
        } else {
          reqNet = calculateRequiredRawAgents(actVol, actAht, ch.targetSlaPct, ch.targetSlaSec);
        }

        const plannedShrink = ch.shrinkage * 0.60;
        const unplannedShrink = ch.shrinkage * 0.40 * (0.8 + 0.4 * pseudoRand());
        const totalShrink = Math.min(0.55, plannedShrink + unplannedShrink);

        const reqGrossFte = Number((reqNet / (1.0 - totalShrink)).toFixed(1));

        const fTraffic = calculateTrafficIntensity(fVol, fAht);
        const schedNet = Math.max(1, Math.ceil(fTraffic * 1.08));
        const schedGrossFte = Number((schedNet / (1.0 - ch.shrinkage)).toFixed(1));

        let adherenceFactor = 0.96 + (pseudoRand() - 0.5) * 0.08;
        if (hour === 12 || hour === 13) {
          adherenceFactor -= 0.08; // Lunch hour staffing dip
        }
        const actAvailableFte = Number((schedGrossFte * (1.0 - unplannedShrink) * adherenceFactor).toFixed(1));
        const staffingGap = Number((actAvailableFte - reqGrossFte).toFixed(1));
        const actualNetAgents = Math.max(1, Math.round(actAvailableFte * (1.0 - plannedShrink)));

        let slaAttainment = 0.85;
        let asaSec = 15.0;

        if (ch.name === 'Email') {
          const capacityHour = (actualNetAgents * 3600.0) / actAht;
          const processed = Math.min(actVol + accumulatedBacklog, capacityHour);
          const newBacklog = Math.max(0.0, (actVol + accumulatedBacklog) - processed);
          accumulatedBacklog = newBacklog;
          slaAttainment = Number(Math.min(1.0, processed / Math.max(1.0, actVol + accumulatedBacklog)).toFixed(3));
          asaSec = Number(((accumulatedBacklog / Math.max(1.0, capacityHour)) * 3600.0).toFixed(1));
        } else {
          const traffic = calculateTrafficIntensity(actVol, actAht);
          if (actualNetAgents > traffic) {
            slaAttainment = Number(calculateServiceLevel(traffic, actualNetAgents, actAht, ch.targetSlaSec).toFixed(3));
            asaSec = Number(calculateASA(traffic, actualNetAgents, actAht).toFixed(1));
            accumulatedBacklog = Math.max(0, Math.round(actVol * (1.0 - slaAttainment) * 0.15));
          } else {
            slaAttainment = Number(Math.max(0.20, (actualNetAgents / Math.max(1.0, traffic)) * 0.70).toFixed(3));
            asaSec = Number((300.0 + (traffic - actualNetAgents) * 45.0).toFixed(1));
            accumulatedBacklog = Math.round((traffic - actualNetAgents) * 12);
          }
        }

        const workloadH = calculateWorkloadHours(actVol, actAht);
        const availableProdH = actualNetAgents * 1.0;
        const utilization = calculateUtilization(workloadH, availableProdH);

        records.push({
          date: dateStr,
          dayName,
          hour,
          channel: ch.name,
          forecastVolume: fVol,
          actualVolume: actVol,
          volumeVariance: actVol - fVol,
          volumeVariancePct: fVol > 0 ? Number((((actVol - fVol) / fVol) * 100).toFixed(1)) : 0,
          forecastAht: fAht,
          actualAht: actAht,
          workloadHours: workloadH,
          requiredNetFte: reqNet,
          requiredGrossFte: reqGrossFte,
          scheduledGrossFte: schedGrossFte,
          availableGrossFte: actAvailableFte,
          staffingGap,
          shrinkageRate: Number(totalShrink.toFixed(3)),
          utilization,
          slaAttainment,
          slaTarget: ch.targetSlaPct,
          slaBreached: slaAttainment < ch.targetSlaPct,
          asaSeconds: asaSec,
          backlog: Math.round(accumulatedBacklog),
          isPeak: intervalShare >= 0.085
        });
      }
    }
  }

  return records;
}

// Initial Sample Action Items
export const INITIAL_ACTION_ITEMS: WfmActionItem[] = [
  {
    id: "ACT-WFM-101",
    issueDescription: "Monday peak interval staffing deficit of -18 FTE on Voice channel between 09:00 - 11:00 UTC",
    priority: "P1 - Critical",
    owner: "Marcus Vance (WFM Capacity Lead)",
    dueDate: "2026-10-18",
    status: "In Progress",
    category: "Shift Scheduling & Overtime",
    dependencies: "Operations Manager approval for 45h overtime allocation",
    verificationNotes: "Pilot voluntary shift adjustment (+1.5h early start) with Tier 1 Voice team",
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-12T14:30:00Z"
  },
  {
    id: "ACT-WFM-102",
    issueDescription: "Unplanned shrinkage spike on Chat queue exceeding modeled 12% baseline (actual running at 19.4%)",
    priority: "P2 - High",
    owner: "Elena Rostova (Operations Manager)",
    dueDate: "2026-10-22",
    status: "Open",
    category: "Shrinkage & Adherence",
    dependencies: "Team lead schedule adherence audit and HR sick-leave reporting sync",
    verificationNotes: "Daily real-time adherence (RTA) tracker deployed to supervisor dashboard",
    createdAt: "2026-10-11T09:15:00Z",
    updatedAt: "2026-10-11T09:15:00Z"
  },
  {
    id: "ACT-WFM-103",
    issueDescription: "Email queue backlog growth during weekend shifts resulting in Monday SLA breaches (<72% vs 80% goal)",
    priority: "P2 - High",
    owner: "Sarah Jenkins (PM I - Workforce Optimization)",
    dueDate: "2026-10-25",
    status: "In Progress",
    category: "Cross-Skilling & Blended Routing",
    dependencies: "Training module sign-off for Voice agents to handle blended asynchronous tickets",
    verificationNotes: "Cross-trained 24 Voice agents to consume email backlog during low call volume intervals",
    createdAt: "2026-10-09T11:00:00Z",
    updatedAt: "2026-10-13T16:45:00Z"
  },
  {
    id: "ACT-WFM-104",
    issueDescription: "Forecast underestimation on Friday evenings following new billing cycle release (WAPE 18.2%)",
    priority: "P3 - Medium",
    owner: "David Chen (Forecasting Analyst)",
    dueDate: "2026-10-29",
    status: "Mitigated",
    category: "Forecast Model Recalibration",
    dependencies: "Product Release calendar sync with billing engineering team",
    verificationNotes: "Integrated release cycle dummy variable into exponential smoothing baseline model",
    createdAt: "2026-10-08T10:20:00Z",
    updatedAt: "2026-10-14T09:00:00Z"
  },
  {
    id: "ACT-WFM-105",
    issueDescription: "AHT variance of +45 seconds on Voice technical support due to recent knowledge base migration",
    priority: "P3 - Medium",
    owner: "Alicia Thorne (Knowledge Base Operations)",
    dueDate: "2026-11-02",
    status: "Open",
    category: "Process & AHT Optimization",
    dependencies: "Internal search indexing fix & quick-resolution macro updates",
    verificationNotes: "Pre-populated standard troubleshooting step macros in CRM",
    createdAt: "2026-10-12T13:40:00Z",
    updatedAt: "2026-10-12T13:40:00Z"
  }
];

// --- REAL DATA INGESTION & CSV PARSER ---

export interface CsvColumnMapping {
  date: string;
  hour: string;
  channel: string;
  actualVolume: string;
  forecastVolume?: string;
  actualAht?: string;
  forecastAht?: string;
  scheduledFte?: string;
  availableFte?: string;
  shrinkage?: string;
  slaTarget?: string;
}

export function generateWfmTemplateCsv(): string {
  const headers = [
    'Date',
    'Hour',
    'Channel',
    'ActualVolume',
    'ForecastVolume',
    'ActualAHT_Sec',
    'ScheduledFTE',
    'AvailableFTE',
    'ShrinkageRate',
    'TargetSLA_Pct'
  ];

  const sampleRows = [
    ['2026-10-14', '9', 'Voice', '380', '350', '330', '48', '42', '0.30', '0.80'],
    ['2026-10-14', '10', 'Voice', '440', '400', '345', '52', '45', '0.30', '0.80'],
    ['2026-10-14', '11', 'Voice', '420', '390', '335', '50', '46', '0.30', '0.80'],
    ['2026-10-14', '14', 'Chat', '260', '250', '420', '38', '35', '0.28', '0.85'],
    ['2026-10-14', '15', 'Chat', '290', '270', '430', '40', '37', '0.28', '0.85'],
    ['2026-10-14', '16', 'Email', '210', '200', '600', '36', '35', '0.25', '0.95']
  ];

  return [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
}

export function deriveWfmRecord(raw: {
  date: string;
  hour: number;
  channel?: 'Voice' | 'Chat' | 'Email' | string;
  actualVolume: number;
  forecastVolume?: number;
  actualAht?: number;
  forecastAht?: number;
  scheduledGrossFte?: number;
  availableGrossFte?: number;
  shrinkageRate?: number;
  slaTarget?: number;
}): HourlyWfmRecord {
  const channel: 'Voice' | 'Chat' | 'Email' = 
    raw.channel?.toLowerCase().includes('chat') ? 'Chat' :
    raw.channel?.toLowerCase().includes('email') ? 'Email' : 'Voice';

  const dateObj = new Date(raw.date);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = !isNaN(dateObj.getTime()) ? dayNames[dateObj.getDay()] : 'Weekday';

  const actVol = Math.max(0, Math.round(raw.actualVolume || 0));
  const fVol = Math.max(0, Math.round(raw.forecastVolume !== undefined ? raw.forecastVolume : actVol));
  const fAht = raw.forecastAht || (channel === 'Email' ? 600 : channel === 'Chat' ? 420 : 330);
  const actAht = raw.actualAht || fAht;
  const shrinkage = raw.shrinkageRate !== undefined ? Math.min(0.60, Math.max(0.10, raw.shrinkageRate)) : (channel === 'Voice' ? 0.32 : channel === 'Chat' ? 0.28 : 0.25);
  const slaTarget = raw.slaTarget !== undefined ? raw.slaTarget : (channel === 'Voice' ? 0.80 : channel === 'Chat' ? 0.85 : 0.95);
  const targetSec = channel === 'Voice' ? 20 : channel === 'Chat' ? 30 : 14400;

  const workloadH = calculateWorkloadHours(actVol, actAht);

  let reqNet = 1;
  if (channel === 'Email') {
    reqNet = Math.max(1, Math.ceil(workloadH));
  } else {
    reqNet = calculateRequiredRawAgents(actVol, actAht, slaTarget, targetSec);
  }

  const reqGrossFte = Number(applyShrinkage(reqNet, shrinkage).toFixed(1));

  // If scheduled FTE not provided, derive based on forecast volume + 8% safety buffer
  let schedGrossFte = raw.scheduledGrossFte;
  if (schedGrossFte === undefined || schedGrossFte <= 0) {
    const fTraffic = calculateTrafficIntensity(fVol, fAht);
    const estSchedNet = Math.max(1, Math.ceil(fTraffic * 1.08));
    schedGrossFte = Number(applyShrinkage(estSchedNet, shrinkage).toFixed(1));
  }

  // If available FTE not provided, derive based on 94% schedule adherence
  let actAvailableFte = raw.availableGrossFte;
  if (actAvailableFte === undefined || actAvailableFte <= 0) {
    actAvailableFte = Number((schedGrossFte * 0.95).toFixed(1));
  }

  const staffingGap = Number((actAvailableFte - reqGrossFte).toFixed(1));
  const actualNetAgents = Math.max(1, Math.round(actAvailableFte * (1.0 - (shrinkage * 0.60))));

  let slaAttainment = 0.85;
  let asaSec = 15.0;
  let backlog = 0;

  if (channel === 'Email') {
    const capacityHour = (actualNetAgents * 3600.0) / actAht;
    const processed = Math.min(actVol, capacityHour);
    backlog = Math.max(0, Math.round(actVol - processed));
    slaAttainment = Number(Math.min(1.0, processed / Math.max(1, actVol)).toFixed(3));
    asaSec = Number(((backlog / Math.max(1, capacityHour)) * 3600.0).toFixed(1));
  } else {
    const traffic = calculateTrafficIntensity(actVol, actAht);
    if (actualNetAgents > traffic) {
      slaAttainment = Number(calculateServiceLevel(traffic, actualNetAgents, actAht, targetSec).toFixed(3));
      asaSec = Number(calculateASA(traffic, actualNetAgents, actAht).toFixed(1));
      backlog = Math.max(0, Math.round(actVol * (1.0 - slaAttainment) * 0.15));
    } else {
      slaAttainment = Number(Math.max(0.15, (actualNetAgents / Math.max(1.0, traffic)) * 0.65).toFixed(3));
      asaSec = Number((300.0 + (traffic - actualNetAgents) * 45.0).toFixed(1));
      backlog = Math.round((traffic - actualNetAgents) * 12);
    }
  }

  const availableProdH = actualNetAgents * 1.0;
  const utilization = calculateUtilization(workloadH, availableProdH);

  return {
    date: raw.date,
    dayName,
    hour: raw.hour,
    channel,
    forecastVolume: fVol,
    actualVolume: actVol,
    volumeVariance: actVol - fVol,
    volumeVariancePct: fVol > 0 ? Number((((actVol - fVol) / fVol) * 100).toFixed(1)) : 0,
    forecastAht: fAht,
    actualAht: actAht,
    workloadHours: workloadH,
    requiredNetFte: reqNet,
    requiredGrossFte: reqGrossFte,
    scheduledGrossFte: schedGrossFte,
    availableGrossFte: actAvailableFte,
    staffingGap,
    shrinkageRate: shrinkage,
    utilization,
    slaAttainment,
    slaTarget,
    slaBreached: slaAttainment < slaTarget,
    asaSeconds: asaSec,
    backlog,
    isPeak: actVol >= 350
  };
}

export function parseWfmCsv(
  csvText: string,
  userMapping?: Partial<CsvColumnMapping>
): { records: HourlyWfmRecord[]; errors: string[]; detectedHeaders: string[] } {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return { records: [], errors: ['CSV file must contain a header row and at least one data row.'], detectedHeaders: [] };
  }

  // Parse header line (handling quoted commas)
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Automatic heuristic column discovery
  const findCol = (keywords: string[]): string => {
    for (const kw of keywords) {
      const idx = lowerHeaders.findIndex(h => h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };

  const mapping: CsvColumnMapping = {
    date: userMapping?.date || findCol(['date', 'day', 'timestamp']) || headers[0],
    hour: userMapping?.hour || findCol(['hour', 'interval', 'time']) || (headers[1] || headers[0]),
    channel: userMapping?.channel || findCol(['channel', 'queue', 'skill', 'lob', 'media']) || (headers[2] || 'Voice'),
    actualVolume: userMapping?.actualVolume || findCol(['actual', 'volume', 'calls', 'contacts', 'inbound', 'offered']) || headers[3] || headers[0],
    forecastVolume: userMapping?.forecastVolume || findCol(['forecast', 'planned_vol', 'projected']),
    actualAht: userMapping?.actualAht || findCol(['actual_aht', 'aht', 'handle_time', 'handle']),
    forecastAht: userMapping?.forecastAht || findCol(['forecast_aht', 'planned_aht']),
    scheduledFte: userMapping?.scheduledFte || findCol(['scheduled', 'roster', 'sched_fte', 'planned_staff']),
    availableFte: userMapping?.availableFte || findCol(['available', 'actual_fte', 'staff', 'logged_in', 'headcount']),
    shrinkage: userMapping?.shrinkage || findCol(['shrinkage', 'shrink']),
    slaTarget: userMapping?.slaTarget || findCol(['sla_target', 'target_sla', 'sla_goal'])
  };

  const records: HourlyWfmRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseRow(lines[i]);
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const getVal = (colName?: string): string => {
        if (!colName) return '';
        const idx = headers.indexOf(colName);
        return idx !== -1 && idx < row.length ? row[idx].replace(/^["']|["']$/g, '').trim() : '';
      };

      const rawDate = getVal(mapping.date) || new Date().toISOString().split('T')[0];
      let rawHour = parseInt(getVal(mapping.hour), 10);
      if (isNaN(rawHour)) {
        // If hour string is like "09:00", extract the hour
        const match = getVal(mapping.hour).match(/(\d{1,2})/);
        rawHour = match ? parseInt(match[1], 10) : (i % 24);
      }
      rawHour = Math.min(23, Math.max(0, rawHour));

      const rawChannel = getVal(mapping.channel) || 'Voice';
      const actualVol = parseFloat(getVal(mapping.actualVolume)) || 0;
      const fVol = mapping.forecastVolume ? parseFloat(getVal(mapping.forecastVolume)) : undefined;
      const actAht = mapping.actualAht ? parseFloat(getVal(mapping.actualAht)) : undefined;
      const fAht = mapping.forecastAht ? parseFloat(getVal(mapping.forecastAht)) : undefined;
      const schedFte = mapping.scheduledFte ? parseFloat(getVal(mapping.scheduledFte)) : undefined;
      const availFte = mapping.availableFte ? parseFloat(getVal(mapping.availableFte)) : undefined;
      let shrink = mapping.shrinkage ? parseFloat(getVal(mapping.shrinkage)) : undefined;
      if (shrink && shrink > 1.0) shrink = shrink / 100.0; // convert 30 to 0.30

      let slaGoal = mapping.slaTarget ? parseFloat(getVal(mapping.slaTarget)) : undefined;
      if (slaGoal && slaGoal > 1.0) slaGoal = slaGoal / 100.0;

      const record = deriveWfmRecord({
        date: rawDate,
        hour: rawHour,
        channel: rawChannel,
        actualVolume: actualVol,
        forecastVolume: fVol,
        actualAht: actAht,
        forecastAht: fAht,
        scheduledGrossFte: schedFte,
        availableGrossFte: availFte,
        shrinkageRate: shrink,
        slaTarget: slaGoal
      });

      records.push(record);
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e?.message || 'Invalid row syntax'}`);
    }
  }

  return { records, errors, detectedHeaders: headers };
}

