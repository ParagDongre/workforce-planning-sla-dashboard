# Workforce Planning & SLA Intelligence Dashboard

> **Portfolio Project:** Tailored for **Program Manager I** roles in **Workforce Management (WFM), Capacity Planning, and Service-Level Performance**.  
> **Simulation Notice:** All datasets, schedules, and metrics are **synthetic and simulated** for portfolio demonstration using deterministic queuing theory models. This project does not access, copy, or imply access to Amazon's or any other company's internal systems or data. No quantified financial benefits or realized corporate impacts are claimed.

---

## 📌 Executive Summary

Contact center operations frequently suffer from service-level degradation caused by misalignment between forecasted demand and scheduled productive capacity. This portfolio application establishes a closed-loop operational governance framework:
1. **Mathematical Capacity Sizing:** Applies the **Erlang-C ($M/M/c$) queuing model** and structured shrinkage budgeting to calculate gross roster headcount.
2. **Intraday Demand Evaluation:** Evaluates arrival variance across hourly, daily, and weekly grains using **WAPE, MAPE, and Forecast Bias**.
3. **Service Level Sensitivity:** Demonstrates the non-linear relationship between net staffing gaps and queue wait times (ASA).
4. **Closed-Loop Action Governance:** Tracks mitigation initiatives (overtime authorization, cross-skilling, schedule adherence) persisted in **SQLite**.
5. **Program Management Artifacts:** Delivers a Project Charter, Milestones Roadmap, RACI Matrix, RAID log, KPI Dictionary, Variance Analysis, and automated Weekly Executive Status Reports.

---

## 📂 Sample Dummy Data Directory (`sample_data/`)

All sample and benchmark workforce datasets are consolidated in the [`sample_data/`](./sample_data/) folder:

| File Name | Record Count | Description |
|---|---|---|
| [`hourly_contact_center_wfm.csv`](./sample_data/hourly_contact_center_wfm.csv) | 2,016 rows | 28 days $\times$ 3 channels (Voice, Chat, Email) $\times$ 24 hourly intervals with volume, AHT, Erlang-C required FTE, available FTE, staffing gaps, SLA attainment, ASA, and backlog. |
| [`daily_contact_center_wfm.csv`](./sample_data/daily_contact_center_wfm.csv) | 28 rows | Calendar-day aggregated metrics including cumulative actual volume, volume variance %, average FTE headcount, net staffing gap, and weighted daily SLA %. |
| [`action_items.csv`](./sample_data/action_items.csv) | 5 rows | Seed workforce management mitigation items (shift overtime, schedule adherence audits, cross-skilling, baseline model recalibration). |
| [`wfm_ingestion_template.csv`](./sample_data/wfm_ingestion_template.csv) | Template | Standard schema template for ingesting external contact-center CSV files with automatic column detection. |
| [`wfm_portfolio.db`](./sample_data/wfm_portfolio.db) | SQLite DB | Relational SQLite database file initialized with the `actions` table and seed mitigations. |
| [`README.md`](./sample_data/README.md) | Documentation | Complete data dictionary and mathematical assumptions for the sample datasets. |

---

## 📋 Program Management Deliverables (`docs/PORTFOLIO_DELIVERABLES.md`)

Full copy-ready Program Management artifacts are maintained in [`docs/PORTFOLIO_DELIVERABLES.md`](./docs/PORTFOLIO_DELIVERABLES.md):

1. **One-Page Project Charter:** Objectives, in/out scope, stakeholders, documented assumptions, success KPIs, milestones, and risks.
2. **Weekly Program Status Report Template:** Quantitative metrics scorecard, milestone tracker, blocker log, and next steps.
3. **KPI Dictionary:** Definitions, formulas, and WFM operational significance for 20 core metrics (Workload, Erlang-C, Shrinkage, WAPE, MAPE, Bias, Net Gap, Utilization, SLA).
4. **Planned-vs-Actual Variance Analysis Example:** Detailed case study of a simulated Monday morning Voice queue surge (+25.7% volume, -18.6 FTE deficit, SLA dip to 74.2%).
5. **RAID Log (Risks, Issues, Dependencies, Mitigations):** Risk escalation register with impact levels, triggers, owners, and due dates.
6. **RACI Responsibility Assignment Matrix:** Cross-functional governance across Operations, WFM Planning, Forecasting, Team Leads, and Program Management.
7. **Executive Narrative:** Senior leadership briefing summarizing operational problems, quantitative evidence, recommended remediation, and expected implications.
8. **Project Portfolio Description:** High-level summary of competencies demonstrated for technical hiring managers.

---

## 🛠 Tech Stack

- **Python 3.10+ / Core Engine:** Deterministic Erlang-C model, shrinkage calculations, forecast error metrics, and SQLite database.
- **Streamlit:** Python dashboard frontend (`python_app/app.py`).
- **Pandas & NumPy:** Dataset wrangling and tabular aggregation.
- **Plotly:** Interactive multi-channel time-series charts and queuing scatter plots.
- **SQLite:** Relational persistence for PM mitigation action items (`actions` table).
- **React 19 / TypeScript / Vite / Tailwind CSS:** High-fidelity interactive web dashboard running live in AI Studio.
- **Automated Test Suite:** Built-in Python `unittest` suite (`python_app/test_wfm.py`) and browser-based test execution runner.

---

## 📐 Mathematical Models & Formulations

### 1. Workload Hours
$$\text{Workload (Hours)} = \frac{\text{Interaction Volume} \times \text{Average Handling Time (seconds)}}{3600}$$

### 2. Traffic Intensity ($A$ in Erlangs)
$$A = \lambda \times \text{AHT} = \frac{\text{Volume}}{\text{Interval Seconds}} \times \text{AHT}$$

### 3. Erlang-C Waiting Probability ($P_w$)
The probability that an arriving contact must wait in queue:
$$P_w = \frac{\frac{A^N}{N!} \left(\frac{N}{N - A}\right)}{\sum_{k=0}^{N-1} \frac{A^k}{k!} + \frac{A^N}{N!} \left(\frac{N}{N - A}\right)}$$
*Condition for Stability:* $N > A$ (number of productive agents must strictly exceed traffic intensity).

### 4. Service Level Agreement (SLA Attainment)
$$\text{SLA} = 1 - P_w \cdot e^{-(N - A) \cdot \frac{T}{\text{AHT}}}$$
- **Voice Target:** 80% answered within $T = 20\text{ seconds}$.
- **Chat Target:** 85% answered within $T = 30\text{ seconds}$.
- **Email Target:** 95% resolved within $T = 4\text{ hours}$ (modeled via throughput capacity).

### 5. Shrinkage Factor & Gross FTE Sizing
$$\text{Gross Required Headcount} = \frac{\text{Net Productive Agents}}{1 - \text{Total Shrinkage Rate}}$$
- **Planned Shrinkage (18.0%):** Meal & rest breaks (8.5%), 1:1 coaching (4.5%), compliance training (5.0%).
- **Unplanned Shrinkage (12.0%):** Unplanned absenteeism / sick leave (8.0%), tardiness & system downtime (4.0%).
- **Total Shrinkage:** 30.0% $\rightarrow$ Gross inflation multiplier = $\frac{1}{1 - 0.30} \approx 1.428\times$.

### 6. Forecast Accuracy Metrics
- **Weighted Absolute Percentage Error (WAPE):**
  $$\text{WAPE} = \frac{\sum |\text{Actual}_t - \text{Forecast}_t|}{\sum \text{Actual}_t}$$
  *Preferred in WFM over MAPE because it weights high-volume intervals appropriately.*
- **Forecast Bias (Tracking Signal):**
  $$\text{Bias} = \frac{\sum (\text{Forecast}_t - \text{Actual}_t)}{\sum \text{Actual}_t}$$
  *(Positive = overforecasting; Negative = underforecasting).*

---

## 🧪 Automated Testing & Verification

Automated tests cover mathematical formulas, boundary conditions, queuing stability, forecast error metrics, and SQLite CRUD operations.

### Running Python Unit Tests:
```bash
python3 -m unittest python_app.test_wfm
```
**Results:**
```
Ran 21 tests in 0.049s
OK
```

### In-App Test Execution:
Navigate to the **Test Suite** tab in the web interface and click **"Execute Test Suite Now"** to view real-time verification of all 18+ browser assertions with execution times and logs.

---

## 🚀 Setup & Launch Instructions

### Option 1: Web Dashboard (Default Live Environment)
The interactive React application runs automatically on port 3000 via Vite.
```bash
npm install
npm run dev
```

### Option 2: Python / Streamlit Application
To run the Streamlit dashboard:
```bash
pip install -r requirements.txt
streamlit run python_app/app.py
```

---

## 📊 Modules Overview

| Module | Core Functionality | PM Value |
|---|---|---|
| **1. Executive Overview** | 10 key KPIs, intraday required vs scheduled vs available FTE, daily SLA trend | High-level governance and operational pulse |
| **2. Demand Forecasting** | WAPE, MAPE, Bias, Moving Average baseline, peak interval identification | Workload predictability & variance containment |
| **3. Capacity Planning** | Erlang-C mathematical model, 30% shrinkage taxonomy, what-if simulator | Headcount sizing and cost-per-contact optimization |
| **4. SLA Analytics** | SLA attainment vs 80/20 target, ASA trends, backlog aging, gap sensitivity scatter | Service-level reliability and queue protection |
| **5. Variance & Risk** | Planned vs actual matrix, configurable risk thresholds, anomaly classification | Proactive risk escalation & exception management |
| **6. Action Tracker** | SQLite persistence, CRUD, priority filters, owner assignments, verification notes | Closed-loop mitigation and accountability |
| **7. Program Governance** | Project Charter, Milestones roadmap, RAID log, RACI matrix, weekly status report | Senior leadership communication & alignment |
| **8. Reporting & Export** | Management briefing, CSV exports for hourly dataset, daily rollup, and action registry | Cross-functional reporting and stakeholder reviews |
