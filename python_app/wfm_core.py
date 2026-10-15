"""
Workforce Management (WFM) Core Engine & Deterministic Models.

This module provides deterministic mathematical models for:
- Workload calculation (calls/interactions, average handling time)
- Erlang-C queuing formula (traffic intensity, queuing probability, ASA, SLA attainment)
- Shrinkage adjustments (gross FTE calculation, productive hours)
- Capacity gap analysis (required vs. scheduled vs. available staffing)
- Forecast accuracy metrics (WAPE, MAPE, Bias, Absolute Error)
- Baseline forecasting models (Moving Average, Exponential Smoothing, Day-of-Week Hourly Profile)
- Synthetic contact-center dataset generation
- SQLite persistence layer for Action Tracker

All data and outputs are synthetic and simulated for workforce planning portfolio demonstration.
"""

import math
import sqlite3
import json
import csv
from datetime import datetime, date, timedelta
from typing import Dict, List, Tuple, Any, Optional

# --- MATHEMATICAL CONSTANTS & DEFAULT PARAMETERS ---
DEFAULT_AHT_SECONDS = 330.0          # 5.5 minutes
DEFAULT_INTERVAL_SECONDS = 3600.0    # 1 hour intervals
DEFAULT_TARGET_SLA_SECONDS = 20.0    # Answer within 20 seconds
DEFAULT_TARGET_SLA_PERCENT = 0.80    # 80% SLA target
DEFAULT_SHRINKAGE_RATE = 0.30        # 30% total shrinkage (18% planned, 12% unplanned)


# --- MODULE 3: ERLANG-C & CAPACITY CALCULATIONS ---

def calculate_workload_hours(volume: float, aht_seconds: float) -> float:
    """Calculate raw workload in hours for a given interaction volume and AHT."""
    if volume < 0 or aht_seconds < 0:
        raise ValueError("Volume and AHT must be non-negative.")
    return (volume * aht_seconds) / 3600.0


def calculate_traffic_intensity(volume: float, aht_seconds: float, interval_seconds: float = DEFAULT_INTERVAL_SECONDS) -> float:
    """Calculate traffic intensity in Erlangs (arrival_rate * AHT)."""
    if interval_seconds <= 0:
        raise ValueError("Interval seconds must be greater than zero.")
    arrival_rate = volume / interval_seconds
    return arrival_rate * aht_seconds


def erlang_c_probability_waiting(traffic_intensity: float, servers: int) -> float:
    """
    Calculate Erlang-C probability that an arriving interaction must wait in queue: P(wait > 0).
    Formula:
        P_w = (A^N / N! * (N / (N - A))) / [ Sum_{k=0}^{N-1} (A^k / k!) + (A^N / N! * (N / (N - A))) ]
    """
    if servers <= 0:
        return 1.0
    if servers <= traffic_intensity:
        # System unstable / overloaded
        return 1.0
    if traffic_intensity <= 0:
        return 0.0

    a = traffic_intensity
    n = servers

    # Numerator term: (a^n / n!) * (n / (n - a))
    # We use iterative log/scaling to prevent numerical overflow
    sum_terms = 1.0
    term = 1.0
    for k in range(1, n):
        term = term * (a / k)
        sum_terms += term

    last_term = term * (a / n)
    queue_factor = n / (n - a)
    num = last_term * queue_factor
    denom = sum_terms + num

    if denom <= 0:
        return 1.0
    prob = num / denom
    return max(0.0, min(1.0, prob))


def calculate_service_level(
    traffic_intensity: float,
    servers: int,
    aht_seconds: float,
    target_time_seconds: float = DEFAULT_TARGET_SLA_SECONDS
) -> float:
    """
    Calculate Service Level (fraction of calls answered within target_time_seconds).
    SL = 1 - P_w * exp( - (N - A) * (T / AHT) )
    """
    if servers <= 0:
        return 0.0
    if servers <= traffic_intensity:
        return 0.0
    if traffic_intensity <= 0:
        return 1.0

    p_wait = erlang_c_probability_waiting(traffic_intensity, servers)
    decay_rate = (servers - traffic_intensity) * (target_time_seconds / aht_seconds)
    sl = 1.0 - (p_wait * math.exp(-decay_rate))
    return max(0.0, min(1.0, sl))


def calculate_average_speed_of_answer(traffic_intensity: float, servers: int, aht_seconds: float) -> float:
    """Calculate Average Speed of Answer (ASA) in seconds: ASA = P_w * AHT / (servers - traffic_intensity)."""
    if servers <= traffic_intensity or servers <= 0:
        return 999.0  # Represents unconstrained queue growth / heavy backlog
    p_wait = erlang_c_probability_waiting(traffic_intensity, servers)
    return (p_wait * aht_seconds) / (servers - traffic_intensity)


def calculate_required_raw_agents(
    volume: float,
    aht_seconds: float,
    target_sla_percent: float = DEFAULT_TARGET_SLA_PERCENT,
    target_time_seconds: float = DEFAULT_TARGET_SLA_SECONDS,
    interval_seconds: float = DEFAULT_INTERVAL_SECONDS
) -> int:
    """
    Find minimum number of productive agents needed to meet target SLA.
    Uses discrete incremental search starting from ceil(traffic_intensity + 1).
    """
    if volume <= 0:
        return 0
    traffic = calculate_traffic_intensity(volume, aht_seconds, interval_seconds)
    min_servers = max(1, math.ceil(traffic) + 1)
    
    servers = min_servers
    max_search = min_servers + 100
    while servers <= max_search:
        sl = calculate_service_level(traffic, servers, aht_seconds, target_time_seconds)
        if sl >= target_sla_percent:
            return servers
        servers += 1
    return servers


def apply_shrinkage(net_staff: float, shrinkage_rate: float) -> float:
    """
    Calculate Gross Required FTE from Net Staffing and Shrinkage Rate.
    Formula: Gross = Net / (1 - Shrinkage)
    """
    if shrinkage_rate >= 1.0 or shrinkage_rate < 0.0:
        raise ValueError("Shrinkage rate must be between 0.0 and 0.99 (exclusive of 1.0).")
    return net_staff / (1.0 - shrinkage_rate)


def calculate_staffing_gap(available_fte: float, required_fte: float) -> float:
    """Calculate Net Staffing Gap: Available - Required. Positive = surplus; Negative = deficit."""
    return round(available_fte - required_fte, 2)


def calculate_utilization(workload_hours: float, available_productive_hours: float) -> float:
    """Calculate Agent Utilization Rate: Workload Hours / Available Productive Hours."""
    if available_productive_hours <= 0:
        return 0.0
    return min(1.0, workload_hours / available_productive_hours)


# --- MODULE 2: FORECASTING ERROR METRICS & BASELINES ---

def calculate_mape(actuals: List[float], forecasts: List[float]) -> float:
    """
    Calculate Mean Absolute Percentage Error (MAPE).
    Skips intervals where actual is zero to avoid division by zero.
    """
    if len(actuals) != len(forecasts):
        raise ValueError("Actuals and forecasts arrays must have identical length.")
    valid_pairs = [(a, f) for a, f in zip(actuals, forecasts) if a > 0]
    if not valid_pairs:
        return 0.0
    total_pct_err = sum(abs(a - f) / a for a, f in valid_pairs)
    return total_pct_err / len(valid_pairs)


def calculate_wape(actuals: List[float], forecasts: List[float]) -> float:
    """
    Calculate Weighted Absolute Percentage Error (WAPE).
    Formula: Sum(|Actual - Forecast|) / Sum(Actual)
    Preferred in workforce management over MAPE because it weights high-volume intervals higher.
    """
    if len(actuals) != len(forecasts):
        raise ValueError("Actuals and forecasts arrays must have identical length.")
    total_actual = sum(actuals)
    if total_actual == 0:
        return 0.0
    total_abs_err = sum(abs(a - f) for a, f in zip(actuals, forecasts))
    return total_abs_err / total_actual


def calculate_forecast_bias(actuals: List[float], forecasts: List[float]) -> float:
    """
    Calculate Forecast Bias / Tracking Error: Sum(Forecast - Actual) / Sum(Actual).
    Positive = Overforecasting; Negative = Underforecasting.
    """
    if len(actuals) != len(forecasts):
        raise ValueError("Actuals and forecasts arrays must have identical length.")
    total_actual = sum(actuals)
    if total_actual == 0:
        return 0.0
    return sum(f - a for a, f in zip(actuals, forecasts)) / total_actual


def baseline_moving_average(history: List[float], window: int = 7) -> float:
    """Simple moving average forecast for the next period."""
    if not history:
        return 0.0
    usable = history[-window:] if len(history) >= window else history
    return sum(usable) / len(usable)


def baseline_exponential_smoothing(history: List[float], alpha: float = 0.3) -> float:
    """Single Exponential Smoothing forecast."""
    if not history:
        return 0.0
    s = history[0]
    for val in history[1:]:
        s = alpha * val + (1.0 - alpha) * s
    return s


def identify_peak_demand_intervals(volumes: List[float], percentile_threshold: float = 0.90) -> List[int]:
    """Identify indices of intervals that qualify as peak demand (top percentile)."""
    if not volumes:
        return []
    sorted_v = sorted(volumes)
    cutoff_idx = int(len(sorted_v) * percentile_threshold)
    threshold_value = sorted_v[min(cutoff_idx, len(sorted_v) - 1)]
    return [i for i, v in enumerate(volumes) if v >= threshold_value]


# --- MODULE 6: SQLITE ACTION TRACKER REPOSITORY ---

class ActionTrackerDB:
    """SQLite Database manager for Workforce Management mitigation actions."""

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS actions (
                    id TEXT PRIMARY KEY,
                    issue_description TEXT NOT NULL,
                    priority TEXT NOT NULL CHECK(priority IN ('P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low')),
                    owner TEXT NOT NULL,
                    due_date TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('Open', 'In Progress', 'Blocked', 'Mitigated', 'Closed')),
                    category TEXT NOT NULL,
                    dependencies TEXT,
                    verification_notes TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.commit()

    def create_action(self, action_data: Dict[str, Any]) -> str:
        """Insert a new action item into SQLite."""
        required = ['id', 'issue_description', 'priority', 'owner', 'due_date', 'status', 'category']
        for field in required:
            if field not in action_data or not str(action_data[field]).strip():
                raise ValueError(f"Missing required field: {field}")

        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO actions (
                    id, issue_description, priority, owner, due_date, status, category, dependencies, verification_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                action_data['id'],
                action_data['issue_description'],
                action_data['priority'],
                action_data['owner'],
                action_data['due_date'],
                action_data['status'],
                action_data['category'],
                action_data.get('dependencies', ''),
                action_data.get('verification_notes', ''),
                now,
                now
            ))
            conn.commit()
        return action_data['id']

    def update_action(self, action_id: str, updates: Dict[str, Any]) -> bool:
        """Update existing action fields."""
        allowed = ['issue_description', 'priority', 'owner', 'due_date', 'status', 'category', 'dependencies', 'verification_notes']
        set_clauses = []
        params = []
        for key in allowed:
            if key in updates:
                set_clauses.append(f"{key} = ?")
                params.append(updates[key])

        if not set_clauses:
            return False

        set_clauses.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(action_id)

        sql = f"UPDATE actions SET {', '.join(set_clauses)} WHERE id = ?"
        with self._get_connection() as conn:
            cursor = conn.execute(sql, params)
            conn.commit()
            return cursor.rowcount > 0

    def delete_action(self, action_id: str) -> bool:
        """Delete an action item."""
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM actions WHERE id = ?", (action_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_action(self, action_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single action item by ID."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
            if row:
                return dict(row)
        return None

    def list_actions(self, status: Optional[str] = None, priority: Optional[str] = None) -> List[Dict[str, Any]]:
        """List action items with optional status and priority filtering."""
        query = "SELECT * FROM actions WHERE 1=1"
        params = []
        if status and status != 'All':
            query += " AND status = ?"
            params.append(status)
        if priority and priority != 'All':
            query += " AND priority = ?"
            params.append(priority)
        query += " ORDER BY CASE priority WHEN 'P1 - Critical' THEN 1 WHEN 'P2 - High' THEN 2 WHEN 'P3 - Medium' THEN 3 ELSE 4 END, due_date ASC"

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def seed_initial_portfolio_data(self):
        """Populate initial realistic Program Manager WFM mitigation actions if table empty."""
        with self._get_connection() as conn:
            count = conn.execute("SELECT COUNT(*) FROM actions").fetchone()[0]
            if count > 0:
                return

        sample_actions = [
            {
                "id": "ACT-WFM-101",
                "issue_description": "Monday peak interval staffing deficit of -18 FTE on Voice channel between 09:00 - 11:00 UTC",
                "priority": "P1 - Critical",
                "owner": "Marcus Vance (WFM Capacity Lead)",
                "due_date": "2026-10-18",
                "status": "In Progress",
                "category": "Shift Scheduling & Overtime",
                "dependencies": "Operations Manager approval for 45h overtime allocation",
                "verification_notes": "Pilot voluntary shift adjustment (+1.5h early start) with Tier 1 Voice team"
            },
            {
                "id": "ACT-WFM-102",
                "issue_description": "Unplanned shrinkage spike on Chat queue exceeding modeled 12% baseline (actual running at 19.4%)",
                "priority": "P2 - High",
                "owner": "Elena Rostova (Operations Manager)",
                "due_date": "2026-10-22",
                "status": "Open",
                "category": "Shrinkage & Adherence",
                "dependencies": "Team lead schedule adherence audit and HR sick-leave reporting sync",
                "verification_notes": "Daily real-time adherence (RTA) tracker deployed to supervisor dashboard"
            },
            {
                "id": "ACT-WFM-103",
                "issue_description": "Email queue backlog growth during weekend shifts resulting in Monday SLA breaches (<72% vs 80% goal)",
                "priority": "P2 - High",
                "owner": "Sarah Jenkins (PM I - Workforce Optimization)",
                "due_date": "2026-10-25",
                "status": "In Progress",
                "category": "Cross-Skilling & Blended Routing",
                "dependencies": "Training module sign-off for Voice agents to handle blended asynchronous tickets",
                "verification_notes": "Cross-trained 24 Voice agents to consume email backlog during low call volume intervals"
            },
            {
                "id": "ACT-WFM-104",
                "issue_description": "Forecast underestimation on Friday evenings following new billing cycle release (WAPE 18.2%)",
                "priority": "P3 - Medium",
                "owner": "David Chen (Forecasting Analyst)",
                "due_date": "2026-10-29",
                "status": "Mitigated",
                "category": "Forecast Model Recalibration",
                "dependencies": "Product Release calendar sync with billing engineering team",
                "verification_notes": "Integrated release cycle dummy variable into exponential smoothing baseline model"
            },
            {
                "id": "ACT-WFM-105",
                "issue_description": "AHT variance of +45 seconds on Voice technical support due to recent knowledge base migration",
                "priority": "P3 - Medium",
                "owner": "Alicia Thorne (Knowledge Base Operations)",
                "due_date": "2026-11-02",
                "status": "Open",
                "category": "Process & AHT Optimization",
                "dependencies": "Internal search indexing fix & quick-resolution macro updates",
                "verification_notes": "Pre-populated standard troubleshooting step macros in CRM"
            }
        ]
        for a in sample_actions:
            self.create_action(a)


# --- SYNTHETIC CONTACT CENTER DATASET GENERATOR ---

def generate_synthetic_wfm_dataset(days: int = 28, seed: int = 42) -> List[Dict[str, Any]]:
    """
    Generate deterministic, realistic synthetic workforce management contact center data.
    Generates 28 days (4 weeks) of hourly intervals for Voice, Chat, and Email channels.
    Includes:
      - Hourly Forecast Volume vs Actual Volume
      - Forecast AHT vs Actual AHT
      - Erlang-C required FTE
      - Scheduled FTE vs Actual Available FTE
      - Net Staffing Gap (Available - Required)
      - Shrinkage (Planned & Unplanned)
      - SLA Attainment % and Backlog
    """
    # Deterministic pseudo-random generator without external random module dependence
    state = seed
    def pseudo_rand() -> float:
        nonlocal state
        state = (state * 1103515245 + 12345) & 0x7fffffff
        return state / 2147483648.0

    # Diurnal hourly demand distribution profile (0h to 23h)
    hourly_curve = [
        0.015, 0.010, 0.008, 0.008, 0.012, 0.025,
        0.045, 0.070, 0.085, 0.095, 0.090, 0.085,
        0.080, 0.082, 0.085, 0.080, 0.070, 0.060,
        0.050, 0.040, 0.030, 0.024, 0.018, 0.016
    ]
    # Day of week volume weights (Mon=1.18, Tue=1.10, Wed=1.05, Thu=1.02, Fri=1.00, Sat=0.85, Sun=0.80)
    dow_weights = [1.18, 1.10, 1.05, 1.02, 1.00, 0.85, 0.80]

    channels = [
        {"name": "Voice", "base_daily": 3200, "base_aht": 330, "target_sla_sec": 20, "target_sla_pct": 0.80, "shrinkage": 0.32},
        {"name": "Chat", "base_daily": 2400, "base_aht": 420, "target_sla_sec": 30, "target_sla_pct": 0.85, "shrinkage": 0.28},
        {"name": "Email", "base_daily": 1800, "base_aht": 600, "target_sla_sec": 14400, "target_sla_pct": 0.95, "shrinkage": 0.25}
    ]

    start_date = date(2026, 9, 14)
    records = []

    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)
        dow = current_date.weekday()
        dow_mult = dow_weights[dow]

        for ch in channels:
            daily_forecast_vol = ch["base_daily"] * dow_mult * (0.95 + 0.10 * pseudo_rand())
            
            # Cumulative backlog carrying over
            accumulated_backlog = 0.0

            for hour in range(24):
                interval_share = hourly_curve[hour]
                # Forecast workload
                f_vol = round(daily_forecast_vol * interval_share)
                # Actual volume with stochastic operational variance (+/- 12%, with Monday morning surge)
                variance_mult = 1.0 + (pseudo_rand() - 0.5) * 0.20
                if dow == 0 and 9 <= hour <= 11:
                    variance_mult += 0.18  # Monday morning rush exception
                if dow == 4 and 18 <= hour <= 21:
                    variance_mult += 0.14  # Friday evening bump

                act_vol = max(1, round(f_vol * variance_mult))

                # Handling time (forecast vs actual)
                f_aht = ch["base_aht"]
                act_aht = round(f_aht * (0.94 + 0.12 * pseudo_rand()), 1)

                # Required net agents using Erlang-C for Voice/Chat, throughput for Email
                if ch["name"] == "Email":
                    # Throughput capacity: Workload / 1 hour
                    workload_h = calculate_workload_hours(act_vol, act_aht)
                    req_net = max(1, math.ceil(workload_h))
                else:
                    req_net = calculate_required_raw_agents(
                        volume=act_vol,
                        aht_seconds=act_aht,
                        target_sla_percent=ch["target_sla_pct"],
                        target_time_seconds=ch["target_sla_sec"]
                    )

                # Shrinkage: planned (breaks, training) + unplanned (absenteeism)
                planned_shrink = ch["shrinkage"] * 0.60
                unplanned_shrink = ch["shrinkage"] * 0.40 * (0.8 + 0.4 * pseudo_rand())
                total_shrink = min(0.55, planned_shrink + unplanned_shrink)

                req_gross_fte = round(req_net / (1.0 - total_shrink), 1)

                # Scheduled FTE is planned based on forecast
                f_traffic = calculate_traffic_intensity(f_vol, f_aht)
                sched_net = max(1, math.ceil(f_traffic * 1.08))
                sched_gross_fte = round(sched_net / (1.0 - ch["shrinkage"]), 1)

                # Actual available FTE reflects schedule adherence and unplanned shrinkage
                adherence_factor = 0.96 + (pseudo_rand() - 0.5) * 0.08
                if hour in (12, 13):
                    # Lunch hour staffing dip
                    adherence_factor -= 0.08
                act_available_fte = round(sched_gross_fte * (1.0 - unplanned_shrink) * adherence_factor, 1)

                # Staffing gap
                staffing_gap = round(act_available_fte - req_gross_fte, 1)

                # Productive FTE working interactions
                actual_net_agents = max(1, int(act_available_fte * (1.0 - planned_shrink)))

                # Actual SLA attainment calculation
                if ch["name"] == "Email":
                    # For email, queue resolution depends on throughput capacity
                    capacity_hour = (actual_net_agents * 3600.0) / act_aht
                    processed = min(act_vol + accumulated_backlog, capacity_hour)
                    new_backlog = max(0.0, (act_vol + accumulated_backlog) - processed)
                    accumulated_backlog = new_backlog
                    sla_attainment = round(min(1.0, processed / (act_vol + accumulated_backlog if act_vol + accumulated_backlog > 0 else 1.0)), 3)
                    asa_sec = round((accumulated_backlog / max(1.0, capacity_hour)) * 3600.0, 1)
                else:
                    traffic = calculate_traffic_intensity(act_vol, act_aht)
                    if actual_net_agents > traffic:
                        sla_attainment = round(calculate_service_level(traffic, actual_net_agents, act_aht, ch["target_sla_sec"]), 3)
                        asa_sec = round(calculate_average_speed_of_answer(traffic, actual_net_agents, act_aht), 1)
                        backlog_queue = max(0, int(act_vol * (1.0 - sla_attainment) * 0.15))
                    else:
                        # Overcapacity deficit / queue blowout
                        sla_attainment = round(max(0.20, (actual_net_agents / max(1.0, traffic)) * 0.70), 3)
                        asa_sec = round(300.0 + (traffic - actual_net_agents) * 45.0, 1)
                        backlog_queue = int((traffic - actual_net_agents) * 12)
                    accumulated_backlog = backlog_queue

                workload_h = calculate_workload_hours(act_vol, act_aht)
                available_prod_h = actual_net_agents * 1.0
                utilization = round(calculate_utilization(workload_h, available_prod_h), 3)

                records.append({
                    "date": current_date.isoformat(),
                    "day_name": current_date.strftime("%A"),
                    "hour": hour,
                    "channel": ch["name"],
                    "forecast_volume": f_vol,
                    "actual_volume": act_vol,
                    "volume_variance": act_vol - f_vol,
                    "volume_variance_pct": round(((act_vol - f_vol) / f_vol) * 100, 1) if f_vol > 0 else 0.0,
                    "forecast_aht": f_aht,
                    "actual_aht": act_aht,
                    "workload_hours": round(workload_h, 2),
                    "required_net_fte": req_net,
                    "required_gross_fte": req_gross_fte,
                    "scheduled_gross_fte": sched_gross_fte,
                    "available_gross_fte": act_available_fte,
                    "staffing_gap": staffing_gap,
                    "shrinkage_rate": round(total_shrink, 3),
                    "utilization": utilization,
                    "sla_attainment": sla_attainment,
                    "sla_target": ch["target_sla_pct"],
                    "sla_breached": 1 if sla_attainment < ch["target_sla_pct"] else 0,
                    "asa_seconds": asa_sec,
                    "backlog": int(accumulated_backlog),
                    "is_peak": 1 if interval_share >= 0.085 else 0
                })

    return records
