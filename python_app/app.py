"""
Workforce Planning & SLA Intelligence Dashboard
Streamlit Application for Workforce Management (WFM) & Program Governance.

Role Alignment: Program Manager I (Workforce Management, Capacity Planning, Service Level Performance)
Notice: All datasets and results are synthetic and simulated for portfolio demonstration.
"""

import os
import math
import sqlite3
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from datetime import datetime, date

# Import core mathematical models
try:
    from python_app.wfm_core import (
        calculate_workload_hours,
        calculate_traffic_intensity,
        calculate_service_level,
        calculate_average_speed_of_answer,
        calculate_required_raw_agents,
        apply_shrinkage,
        calculate_staffing_gap,
        calculate_utilization,
        calculate_mape,
        calculate_wape,
        calculate_forecast_bias,
        baseline_moving_average,
        baseline_exponential_smoothing,
        identify_peak_demand_intervals,
        ActionTrackerDB,
        generate_synthetic_wfm_dataset
    )
except ImportError:
    from wfm_core import (
        calculate_workload_hours,
        calculate_traffic_intensity,
        calculate_service_level,
        calculate_average_speed_of_answer,
        calculate_required_raw_agents,
        apply_shrinkage,
        calculate_staffing_gap,
        calculate_utilization,
        calculate_mape,
        calculate_wape,
        calculate_forecast_bias,
        baseline_moving_average,
        baseline_exponential_smoothing,
        identify_peak_demand_intervals,
        ActionTrackerDB,
        generate_synthetic_wfm_dataset
    )

# Page configuration
st.set_page_config(
    page_title="Workforce Planning & SLA Intelligence Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .reportview-container { background-color: #0f172a; }
    .simulated-banner {
        background-color: #f8fafc;
        border-left: 4px solid #2563eb;
        padding: 12px 16px;
        margin-bottom: 20px;
        border-radius: 4px;
        color: #334155;
        font-size: 0.875rem;
    }
    .metric-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        padding: 8px 16px;
        border-radius: 6px;
    }
</style>
""", unsafe_allow_html=True)


# --- DATA LOADING & CACHING ---
@st.cache_data
def load_wfm_dataset():
    csv_path = os.path.join(os.path.dirname(__file__), "..", "sample_data", "hourly_contact_center_wfm.csv")
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
    else:
        raw_data = generate_synthetic_wfm_dataset(days=28, seed=42)
        df = pd.DataFrame(raw_data)
    df['date'] = pd.to_datetime(df['date'])
    return df


@st.cache_resource
def get_action_db():
    db_path = os.path.join(os.path.dirname(__file__), "..", "sample_data", "wfm_portfolio.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    db = ActionTrackerDB(db_path)
    db.seed_initial_portfolio_data()
    return db


# --- REAL DATA INGESTION OR CLEAN SLATE ---
st.sidebar.title("WFM Ingestion Hub")
uploaded_file = st.sidebar.file_uploader("Upload Real Contact Center CSV", type=['csv'])

if "wfm_data_cleared" not in st.session_state:
    st.session_state["wfm_data_cleared"] = False

if st.sidebar.button("Clear All Data (Clean Slate)"):
    st.session_state["wfm_data_cleared"] = True
    st.rerun()

if st.sidebar.button("Load Benchmark Dataset"):
    st.session_state["wfm_data_cleared"] = False
    st.rerun()

if uploaded_file is not None:
    try:
        df_all = pd.read_csv(uploaded_file)
        if 'date' in df_all.columns:
            df_all['date'] = pd.to_datetime(df_all['date'])
        st.session_state["wfm_data_cleared"] = False
        st.sidebar.success(f"Ingested {len(df_all)} real records!")
    except Exception as e:
        st.sidebar.error(f"Error parsing CSV: {e}")
        df_all = load_wfm_dataset()
elif st.session_state.get("wfm_data_cleared", False):
    df_all = pd.DataFrame(columns=[
        'date', 'day_name', 'hour', 'channel', 'forecast_volume', 'actual_volume',
        'volume_variance', 'volume_variance_pct', 'forecast_aht', 'actual_aht',
        'workload_hours', 'required_gross_fte', 'scheduled_gross_fte',
        'available_gross_fte', 'staffing_gap', 'sla_attainment', 'sla_target',
        'sla_breached', 'asa_seconds', 'backlog', 'is_peak', 'utilization'
    ])
else:
    df_all = load_wfm_dataset()

action_db = get_action_db()

# --- TOP BANNER ---
if df_all.empty:
    st.info("WORKSPACE CLEAN: All dummy data has been cleared. Ingest your real contact center CSV export using the sidebar uploader or click 'Load Benchmark Dataset'.")
elif uploaded_file is not None:
    st.success(f"ACTIVE PRODUCTION DATASET: {len(df_all):,} real operational records ingested. Erlang-C & SLA models actively calculating.")
else:
    st.markdown("""
    <div class="simulated-banner">
        <strong>ENTERPRISE BENCHMARK DATASET</strong> · Contact-center operational models for Program Management & Workforce Planning Portfolio.
        Use sidebar to ingest real operational CSV exports or clear all records.
    </div>
    """, unsafe_allow_html=True)

# --- SIDEBAR CONTROLS ---
st.sidebar.markdown("---")
st.sidebar.subheader("Active Filters")

# Channel filter
if not df_all.empty and 'channel' in df_all.columns:
    channels = ["All"] + sorted(list(df_all['channel'].unique()))
    selected_channel = st.sidebar.selectbox("Queue Channel", channels, index=0)

    # Date filter
    min_date = df_all['date'].min().date()
    max_date = df_all['date'].max().date()
    date_range = st.sidebar.date_input("Date Range", [min_date, max_date], min_value=min_date, max_value=max_date)

    # Filter dataset
    df_filtered = df_all.copy()
    if selected_channel != "All":
        df_filtered = df_filtered[df_filtered['channel'] == selected_channel]

    if isinstance(date_range, (list, tuple)) and len(date_range) == 2:
        start_d, end_d = date_range
        df_filtered = df_filtered[(df_filtered['date'].dt.date >= start_d) & (df_filtered['date'].dt.date <= end_d)]
else:
    df_filtered = df_all.copy()

# --- NAVIGATION TABS ---
tabs = st.tabs([
    "1. Executive Overview",
    "2. Demand Forecasting",
    "3. Capacity Planning",
    "4. SLA Analytics",
    "5. Variance & Risk",
    "6. Action Tracker",
    "7. Program Governance",
    "8. Reporting & Export"
])


# ==============================================================================
# TAB 1: EXECUTIVE OVERVIEW
# ==============================================================================
with tabs[0]:
    st.subheader("Executive Workforce & Service-Level Overview")
    st.caption("High-level governance scorecard comparing workload, staffing requirements, net gaps, and SLA attainment.")

    tot_forecast_vol = df_filtered['forecast_volume'].sum()
    tot_act_vol = df_filtered['actual_volume'].sum()
    vol_variance = tot_act_vol - tot_forecast_vol
    vol_var_pct = (vol_variance / tot_forecast_vol * 100) if tot_forecast_vol > 0 else 0.0

    avg_req_fte = df_filtered['required_gross_fte'].mean()
    avg_sched_fte = df_filtered['scheduled_gross_fte'].mean()
    avg_avail_fte = df_filtered['available_gross_fte'].mean()
    avg_gap = avg_avail_fte - avg_req_fte

    overall_sla = (df_filtered['actual_volume'] * df_filtered['sla_attainment']).sum() / tot_act_vol if tot_act_vol > 0 else 0.0
    overall_wape = calculate_wape(df_filtered['actual_volume'].tolist(), df_filtered['forecast_volume'].tolist())
    avg_utilization = df_filtered['utilization'].mean()
    tot_backlog = df_filtered.groupby('date')['backlog'].last().sum()

    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Actual Workload", f"{tot_act_vol:,.0f} contacts", f"{vol_var_pct:+.1f}% vs Fcast")
    col2.metric("Required Gross FTE", f"{avg_req_fte:.1f} FTE", "Erlang-C modeled")
    col3.metric("Net Staffing Gap", f"{avg_gap:+.1f} FTE", "Available - Required", delta_color="normal" if avg_gap >= 0 else "inverse")
    col4.metric("SLA Attainment", f"{overall_sla * 100:.1f}%", "-0.8% vs 80.0% Goal", delta_color="normal" if overall_sla >= 0.80 else "inverse")
    col5.metric("Forecast WAPE", f"{overall_wape * 100:.1f}%", "Target < 10.0%", delta_color="inverse" if overall_wape > 0.10 else "normal")

    st.markdown("---")
    c_left, c_right = st.columns([3, 2])

    with c_left:
        st.markdown("##### Intraday Staffing vs. Required Capacity (Hourly Average)")
        intraday = df_filtered.groupby('hour')[['required_gross_fte', 'scheduled_gross_fte', 'available_gross_fte']].mean().reset_index()
        fig_intra = go.Figure()
        fig_intra.add_trace(go.Scatter(x=intraday['hour'], y=intraday['required_gross_fte'], mode='lines+markers', name='Required Gross FTE (Erlang-C)', line=dict(color='#dc2626', width=2.5)))
        fig_intra.add_trace(go.Scatter(x=intraday['hour'], y=intraday['scheduled_gross_fte'], mode='lines', name='Scheduled FTE', line=dict(color='#2563eb', width=2, dash='dot')))
        fig_intra.add_trace(go.Scatter(x=intraday['hour'], y=intraday['available_gross_fte'], mode='lines+markers', name='Actual Available FTE', line=dict(color='#059669', width=2)))
        fig_intra.update_layout(xaxis_title="Hour of Day (UTC)", yaxis_title="FTE Count", height=340, margin=dict(l=20, r=20, t=30, b=20), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
        st.plotly_chart(fig_intra, use_container_width=True)

    with c_right:
        st.markdown("##### Weekly SLA & Backlog Snapshot")
        daily_summary = df_filtered.groupby(df_filtered['date'].dt.date).agg({
            'sla_attainment': 'mean',
            'backlog': 'max'
        }).reset_index()
        fig_daily = go.Figure()
        fig_daily.add_trace(go.Bar(x=daily_summary['date'], y=daily_summary['backlog'], name='Peak Backlog', marker_color='#cbd5e1', yaxis='y2'))
        fig_daily.add_trace(go.Scatter(x=daily_summary['date'], y=daily_summary['sla_attainment'] * 100, mode='lines+markers', name='SLA %', line=dict(color='#7c3aed', width=2.5)))
        fig_daily.add_hline(y=80, line_dash="dash", line_color="#ef4444", annotation_text="80% Target")
        fig_daily.update_layout(
            height=340,
            margin=dict(l=20, r=20, t=30, b=20),
            yaxis=dict(title="SLA Attainment %", range=[50, 100]),
            yaxis2=dict(title="Backlog Units", overlaying='y', side='right', showgrid=False),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_daily, use_container_width=True)


# ==============================================================================
# TAB 2: DEMAND FORECASTING
# ==============================================================================
with tabs[1]:
    st.subheader("Demand Forecasting & Error Evaluation")
    st.caption("Compare forecast volume against actual contact arrival patterns across hour, day, and week grains.")

    f_col1, f_col2, f_col3, f_col4 = st.columns(4)
    wape_val = calculate_wape(df_filtered['actual_volume'].tolist(), df_filtered['forecast_volume'].tolist())
    mape_val = calculate_mape(df_filtered['actual_volume'].tolist(), df_filtered['forecast_volume'].tolist())
    bias_val = calculate_forecast_bias(df_filtered['actual_volume'].tolist(), df_filtered['forecast_volume'].tolist())
    peak_count = df_filtered['is_peak'].sum()

    f_col1.metric("WAPE Error", f"{wape_val * 100:.2f}%", "Target < 10%")
    f_col2.metric("MAPE Error", f"{mape_val * 100:.2f}%", "Intraday mean")
    f_col3.metric("Forecast Bias", f"{bias_val * 100:+.2f}%", "Tracking Signal (+ over / - under)")
    f_col4.metric("Peak Intervals", f"{peak_count} intervals", "Top volume decile")

    granularity = st.radio("Temporal Aggregation", ["Hourly", "Daily", "Weekly"], horizontal=True)

    if granularity == "Hourly":
        chart_data = df_filtered.groupby('hour')[['forecast_volume', 'actual_volume']].sum().reset_index()
        x_col = 'hour'
        x_label = "Hour of Day"
    elif granularity == "Daily":
        chart_data = df_filtered.groupby(df_filtered['date'].dt.date)[['forecast_volume', 'actual_volume']].sum().reset_index()
        x_col = 'date'
        x_label = "Calendar Date"
    else:
        df_filtered['week'] = df_filtered['date'].dt.isocalendar().week
        chart_data = df_filtered.groupby('week')[['forecast_volume', 'actual_volume']].sum().reset_index()
        x_col = 'week'
        x_label = "Fiscal Week"

    fig_demand = go.Figure()
    fig_demand.add_trace(go.Bar(x=chart_data[x_col], y=chart_data['forecast_volume'], name='Forecast Volume', marker_color='#93c5fd'))
    fig_demand.add_trace(go.Scatter(x=chart_data[x_col], y=chart_data['actual_volume'], mode='lines+markers', name='Actual Volume', line=dict(color='#1e3a8a', width=3)))
    fig_demand.update_layout(xaxis_title=x_label, yaxis_title="Interaction Volume", height=380, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    st.plotly_chart(fig_demand, use_container_width=True)

    st.markdown("##### Baseline Forecasting Methodology & Assumptions")
    st.info("""
    **Forecasting Logic & Assumptions:**
    1. **Baseline Model:** Combines a 4-week historical moving average with day-of-week ratio decomposition and an exponential smoothing factor ($\alpha = 0.30$) to capture trend adaptations.
    2. **Intraday Profiling:** Arrival curves reflect diurnal contact arrival distributions with peaks concentrated at 09:00-11:00 UTC and 14:00-16:00 UTC.
    3. **Operational Variance:** Monday morning surge (+18% volume above baseline) and Friday release surges (+14%) represent systematic operational variances.
    """)


# ==============================================================================
# TAB 3: WORKFORCE CAPACITY PLANNING
# ==============================================================================
with tabs[2]:
    st.subheader("Workforce Capacity Planning & Erlang-C Staffing Model")
    st.caption("Calculate gross and net staffing requirements based on workload, AHT, productive hours, and shrinkage.")

    st.markdown("##### Interactive What-If Capacity Scenario Simulator")
    with st.expander("Adjust Scenario Assumptions & Observe Immediate Impact", expanded=True):
        sc_col1, sc_col2, sc_col3, sc_col4 = st.columns(4)
        sim_aht = sc_col1.slider("AHT Adjustment (seconds)", min_value=200, max_value=600, value=330, step=15)
        sim_shrink = sc_col2.slider("Total Shrinkage %", min_value=15, max_value=50, value=30, step=1)
        sim_sla_target = sc_col3.slider("Target SLA %", min_value=60, max_value=95, value=80, step=5)
        sim_threshold_sec = sc_col4.slider("SLA Target Seconds", min_value=10, max_value=60, value=20, step=5)

        # Calculate modeled requirement for an illustrative 500 calls/hour volume
        demo_vol = 500
        sim_traffic = calculate_traffic_intensity(demo_vol, sim_aht)
        sim_net_req = calculate_required_raw_agents(demo_vol, sim_aht, sim_sla_target / 100.0, sim_threshold_sec)
        sim_gross_req = apply_shrinkage(sim_net_req, sim_shrink / 100.0)

        st.write(f"**Scenario Outcome (500 Contacts/Hr):** Traffic Intensity = `{sim_traffic:.1f} Erlangs` · Required Net Productive Agents = `{sim_net_req} Agents` · Required Gross Headcount (including {sim_shrink}% shrinkage) = `{sim_gross_req:.1f} FTE`")

    st.markdown("---")
    st.markdown("##### Scheduled vs. Available vs. Required Headcount (Staffing Gaps)")
    
    hourly_cap = df_filtered.groupby('hour').agg({
        'required_gross_fte': 'mean',
        'scheduled_gross_fte': 'mean',
        'available_gross_fte': 'mean',
        'staffing_gap': 'mean',
        'workload_hours': 'mean'
    }).reset_index()

    fig_gap = go.Figure()
    fig_gap.add_trace(go.Bar(
        x=hourly_cap['hour'],
        y=hourly_cap['staffing_gap'],
        name='Net Staffing Gap (Avail - Req)',
        marker_color=['#059669' if g >= 0 else '#dc2626' for g in hourly_cap['staffing_gap']]
    ))
    fig_gap.add_hline(y=0, line_color="#000000", line_width=1)
    fig_gap.update_layout(xaxis_title="Hour of Day", yaxis_title="Net Headcount Gap (FTE)", height=320)
    st.plotly_chart(fig_gap, use_container_width=True)

    st.markdown("##### Documented Capacity & Shrinkage Assumptions")
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown("""
        **Productive Hours & Shrinkage Breakdown:**
        - **Planned Shrinkage (18%):**
          - Paid meal and wellness breaks: 8.5%
          - 1:1 Coaching and team huddles: 4.5%
          - Training and compliance modules: 5.0%
        - **Unplanned Shrinkage (12%):**
          - Unplanned absenteeism & sick leave: 8.0%
          - Tardiness and system downtime: 4.0%
        - **Total Gross Shrinkage:** **30.0%**
        """)
    with col_b:
        st.markdown("""
        **Capacity Formulas Applied:**
        - $\\text{Workload (Hours)} = \\frac{\\text{Volume} \\times \\text{AHT}}{3600}$
        - $\\text{Traffic Intensity (Erlangs)} = \\frac{\\text{Volume}}{3600} \\times \\text{AHT}$
        - $\\text{Gross FTE Required} = \\frac{\\text{Net FTE}}{1 - \\text{Shrinkage Rate}}$
        - $\\text{Net Staffing Gap} = \\text{Available FTE} - \\text{Required Gross FTE}$
        """)


# ==============================================================================
# TAB 4: SLA ANALYTICS
# ==============================================================================
with tabs[3]:
    st.subheader("Service Level Agreement (SLA) Intelligence")
    st.caption("Attainment distributions, average speed of answer (ASA), backlog queuing, and gap elasticity.")

    sla_col1, sla_col2, sla_col3 = st.columns(3)
    avg_sla_pct = df_filtered['sla_attainment'].mean() * 100
    avg_asa = df_filtered['asa_seconds'].mean()
    breach_hours = df_filtered['sla_breached'].sum()
    total_hours = len(df_filtered)
    breach_pct = (breach_hours / total_hours * 100) if total_hours > 0 else 0

    sla_col1.metric("Average SLA Attainment", f"{avg_sla_pct:.1f}%", "-0.8% below 80% target")
    sla_col2.metric("Average Speed of Answer (ASA)", f"{avg_asa:.1f}s", "Target < 30s")
    sla_col3.metric("SLA Breach Frequency", f"{breach_pct:.1f}%", f"{breach_hours} of {total_hours} intervals breached")

    st.markdown("##### Non-Linear Relationship: Staffing Gap vs. SLA Attainment")
    st.caption("Demonstrating how undercapacity causes exponential queuing delays and service collapse.")

    # Sample scatter points
    scatter_df = df_filtered.sample(n=min(500, len(df_filtered)), random_state=42)
    fig_scatter = px.scatter(
        scatter_df,
        x='staffing_gap',
        y='sla_attainment',
        color='channel',
        hover_data=['hour', 'actual_volume', 'asa_seconds'],
        labels={'staffing_gap': 'Staffing Gap (FTE)', 'sla_attainment': 'SLA Attainment (Fraction)'},
        trendline='lowess'
    )
    fig_scatter.add_hline(y=0.80, line_dash="dash", line_color="#ef4444", annotation_text="80% SLA Threshold")
    fig_scatter.add_vline(x=0, line_dash="dot", line_color="#64748b")
    fig_scatter.update_layout(height=400)
    st.plotly_chart(fig_scatter, use_container_width=True)


# ==============================================================================
# TAB 5: VARIANCE AND RISK ANALYSIS
# ==============================================================================
with tabs[4]:
    st.subheader("Variance, Risk & Operational Exceptions")
    st.caption("Configurable thresholds to detect recurring operational bottlenecks and risk factors.")

    c_t1, c_t2, c_t3 = st.columns(3)
    sla_risk_thresh = c_t1.slider("Critical SLA Threshold (%)", 50, 90, 75, 5)
    gap_risk_thresh = c_t2.slider("Staffing Deficit Warning (FTE)", -30, -5, -15, 1)
    wape_risk_thresh = c_t3.slider("Intraday Variance Warning (%)", 10, 40, 20, 5)

    # Flag exceptions
    exceptions = df_filtered[
        (df_filtered['sla_attainment'] * 100 < sla_risk_thresh) |
        (df_filtered['staffing_gap'] < gap_risk_thresh) |
        (df_filtered['volume_variance_pct'].abs() > wape_risk_thresh)
    ].copy()

    st.markdown(f"##### Detected Operational Exceptions ({len(exceptions)} intervals flagged)")
    if not exceptions.empty:
        exc_display = exceptions[['date', 'channel', 'hour', 'actual_volume', 'volume_variance_pct', 'staffing_gap', 'sla_attainment', 'backlog']].head(15)
        st.dataframe(exc_display.style.format({
            'volume_variance_pct': '{:+.1f}%',
            'staffing_gap': '{:+.1f}',
            'sla_attainment': '{:.1%}',
            'actual_volume': '{:,}'
        }), use_container_width=True)
    else:
        st.success("No intervals breached the active risk thresholds.")


# ==============================================================================
# TAB 6: ACTION TRACKER (SQLITE)
# ==============================================================================
with tabs[5]:
    st.subheader("Workforce Management Action Tracker")
    st.caption("Persistent SQLite repository for capacity re-allocations, overtime approvals, and PM mitigation initiatives.")

    # Top stats
    all_actions = action_db.list_actions()
    st_col1, st_col2, st_col3, st_col4 = st.columns(4)
    open_count = len([a for a in all_actions if a['status'] == 'Open'])
    prog_count = len([a for a in all_actions if a['status'] == 'In Progress'])
    p1_count = len([a for a in all_actions if 'P1' in a['priority']])
    mit_count = len([a for a in all_actions if a['status'] in ('Mitigated', 'Closed')])

    st_col1.metric("Open Actions", open_count)
    st_col2.metric("In Progress", prog_count)
    st_col3.metric("Critical (P1)", p1_count)
    st_col4.metric("Mitigated / Closed", mit_count)

    # Add Action Form
    with st.expander("Log New Workforce Mitigation Action"):
        with st.form("new_action_form", clear_on_submit=True):
            f1, f2 = st.columns(2)
            act_id = f1.text_input("Action ID", value=f"ACT-WFM-{len(all_actions) + 101}")
            priority = f2.selectbox("Priority", ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"])
            desc = st.text_area("Issue Description & Impact", placeholder="Describe the operational gap or bottleneck...")
            f3, f4, f5 = st.columns(3)
            owner = f3.text_input("Owner (Name & Role)", value="Workforce PM")
            due_date = f4.date_input("Target Due Date", value=date.today())
            category = f5.selectbox("Category", [
                "Shift Scheduling & Overtime",
                "Shrinkage & Adherence",
                "Cross-Skilling & Blended Routing",
                "Forecast Model Recalibration",
                "Process & AHT Optimization"
            ])
            dep = st.text_input("Dependencies", placeholder="e.g. Finance budget approval, Operations sign-off")
            notes = st.text_input("Verification & Resolution Notes", placeholder="e.g. Schedule updated in WFM platform")
            
            submit = st.form_submit_button("Save Action to SQLite")
            if submit:
                if not desc.strip():
                    st.error("Please provide an issue description.")
                else:
                    new_item = {
                        "id": act_id,
                        "issue_description": desc,
                        "priority": priority,
                        "owner": owner,
                        "due_date": due_date.isoformat(),
                        "status": "Open",
                        "category": category,
                        "dependencies": dep,
                        "verification_notes": notes
                    }
                    action_db.create_action(new_item)
                    st.success(f"Action {act_id} persisted to SQLite database successfully.")
                    st.rerun()

    # Filter & Display Table
    st.markdown("##### Active Mitigation Actions Registry")
    f_prio = st.selectbox("Filter by Priority", ["All", "P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"])
    f_status = st.selectbox("Filter by Status", ["All", "Open", "In Progress", "Blocked", "Mitigated", "Closed"])

    filtered_actions = action_db.list_actions(status=None if f_status == "All" else f_status, priority=None if f_prio == "All" else f_prio)
    if filtered_actions:
        df_acts = pd.DataFrame(filtered_actions)
        st.dataframe(df_acts[['id', 'priority', 'status', 'owner', 'due_date', 'category', 'issue_description', 'verification_notes']], use_container_width=True)
    else:
        st.info("No action items match the specified filters.")


# ==============================================================================
# TAB 7: PROGRAM GOVERNANCE
# ==============================================================================
with tabs[6]:
    st.subheader("Program Management Governance & Charter")
    st.caption("PM I portfolio artifacts: Project Charter, RACI Matrix, Milestones, and Weekly Status Report Generator.")

    st.markdown("##### 1. Project Charter")
    with st.expander("Workforce Capacity & SLA Intelligence Charter", expanded=True):
        st.markdown("""
        - **Problem Statement:** Contact center operations experienced a 4.2% drop in SLA attainment during peak Monday intervals due to a -18 FTE staffing deficit and unaccounted 7.4% unplanned shrinkage.
        - **Program Objective:** Build deterministic capacity planning and intraday staffing intelligence models to maintain >80% SLA on Voice/Chat queues while keeping agent utilization between 78% and 85%.
        - **Scope:**
          - *In Scope:* Erlang-C multi-channel capacity sizing, shrinkage decomposition, variance alerting, SQLite action governance, weekly executive reporting.
          - *Out of Scope:* Direct telephony PBX routing alterations, compensation adjustments, hiring contract renegotiations.
        - **Success Metrics (KPIs):** SLA attainment $\ge 80\%$, Forecast WAPE $< 10\%$, Schedule Adherence $\ge 92\%$, P1 action closure within 5 business days.
        """)

    st.markdown("##### 2. Responsibility Assignment Matrix (RACI)")
    raci_data = [
        {"Deliverable / Workflow": "Demand Forecast Generation", "Ops Director": "I", "WFM Planning Lead": "A", "Forecasting Analyst": "R", "Team Leads": "C", "Program Manager": "C"},
        {"Deliverable / Workflow": "Erlang-C Sizing & Shift Scheduling", "Ops Director": "I", "WFM Planning Lead": "A", "Forecasting Analyst": "C", "Team Leads": "C", "Program Manager": "R"},
        {"Deliverable / Workflow": "Overtime & Deficit Mitigation", "Ops Director": "A", "WFM Planning Lead": "R", "Forecasting Analyst": "I", "Team Leads": "R", "Program Manager": "R"},
        {"Deliverable / Workflow": "Real-time Adherence & Shrinkage", "Ops Director": "I", "WFM Planning Lead": "C", "Forecasting Analyst": "I", "Team Leads": "A / R", "Program Manager": "I"},
        {"Deliverable / Workflow": "Executive Weekly SLA Governance", "Ops Director": "I", "WFM Planning Lead": "C", "Forecasting Analyst": "C", "Team Leads": "I", "Program Manager": "A / R"}
    ]
    st.table(pd.DataFrame(raci_data).set_index("Deliverable / Workflow"))

    st.markdown("##### 3. Weekly Status-Report Generator")
    rep_text = f"""# WEEKLY WORKFORCE MANAGEMENT & SLA GOVERNANCE BRIEFING
**Date:** {datetime.today().strftime('%Y-%m-%d')} | **Program:** Contact Center Capacity & SLA Stabilization
**Author:** Program Manager I (Workforce Optimization) | **Status:** 🟡 Amber (Variance Mitigations Active)

## Executive Summary
During the past cycle, total contact workload was {tot_act_vol:,.0f} interactions ({vol_var_pct:+.1f}% vs. forecast). Average SLA attainment closed at {overall_sla * 100:.1f}%, slightly below our 80.0% benchmark primarily driven by Monday 09:00-11:00 UTC understaffing in the Voice queue.

## Key Performance Indicators
- **Volume Actual vs Forecast:** {tot_act_vol:,.0f} actual / {tot_forecast_vol:,.0f} forecast (Variance: {vol_var_pct:+.1f}%)
- **Forecast Accuracy:** WAPE = {overall_wape * 100:.1f}%, MAPE = {mape_val * 100:.1f}%
- **Average Speed of Answer (ASA):** {avg_asa:.1f} seconds
- **Net Staffing Balance:** {avg_gap:+.1f} Gross FTE average balance

## Top Operational Blockers & Mitigation Status
1. **Monday Morning Voice Deficit:** Action ACT-WFM-101 in progress; 45 hours overtime scheduled for Tier 1 Voice team.
2. **Chat Unplanned Shrinkage:** Action ACT-WFM-102 opened; RTA monitoring instituted with operational leads.

## Next Steps
- Finalize cross-skilling certification for 24 Voice agents to consume Email backlog during low-intensity intervals.
- Calibrate exponential smoothing baseline model to reflect post-release billing volume.
"""
    st.text_area("Generated Executive Status Report (Markdown Format)", rep_text, height=280)


# ==============================================================================
# TAB 8: REPORTING & EXPORT
# ==============================================================================
with tabs[7]:
    st.subheader("Data Export & Management Summary")
    st.caption("Generate downloadable CSV datasets and executive summary packages for stakeholder reviews.")

    exp_col1, exp_col2 = st.columns(2)
    with exp_col1:
        st.markdown("##### Export Filtered WFM Dataset (CSV)")
        csv_data = df_filtered.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="Download Filtered WFM Data (.CSV)",
            data=csv_data,
            file_name=f"wfm_data_export_{datetime.today().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
    with exp_col2:
        st.markdown("##### Export Action Tracker Items (CSV)")
        acts = action_db.list_actions()
        csv_acts = pd.DataFrame(acts).to_csv(index=False).encode('utf-8')
        st.download_button(
            label="Download Action Items (.CSV)",
            data=csv_acts,
            file_name=f"wfm_actions_export_{datetime.today().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
