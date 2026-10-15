# Sample Workforce Management (WFM) Datasets

> **Notice:** All datasets in this directory are **100% synthetic and simulated** for portfolio modeling and demonstration purposes. No internal proprietary systems, employee records, or actual customer contacts were used.

---

## 📁 Files in This Directory

1. **`hourly_contact_center_wfm.csv`**
   - **Records:** 2,016 hourly intervals (28 calendar days $\times$ 3 channels: Voice, Chat, Email $\times$ 24 hours).
   - **Columns:**
     - `date`: Calendar date (YYYY-MM-DD).
     - `day_name`: Day of week (Monday through Sunday).
     - `hour`: Hour interval (0 to 23 UTC).
     - `channel`: Queue channel (`Voice`, `Chat`, `Email`).
     - `forecast_volume`: Modeled baseline volume.
     - `actual_volume`: Simulated actual contact arrivals.
     - `volume_variance`: Difference (`actual_volume - forecast_volume`).
     - `volume_variance_pct`: Percentage deviation vs forecast.
     - `forecast_aht` / `actual_aht`: Average handling time in seconds.
     - `workload_hours`: Workload hours ($Volume \times AHT / 3600$).
     - `required_net_fte`: Productive headcount needed via Erlang-C.
     - `required_gross_fte`: Headcount inflated for 30% gross shrinkage ($Net / (1 - 0.30)$).
     - `scheduled_gross_fte`: Published roster capacity.
     - `available_gross_fte`: Logged-in agents adjusting for adherence and absenteeism.
     - `staffing_gap`: Net headcount balance ($Available - Required$).
     - `shrinkage_rate`: Modeled total shrinkage (planned + unplanned).
     - `utilization`: Agent occupancy / workload utilization rate.
     - `sla_attainment`: Service level fraction (e.g. 0.85 = 85%).
     - `sla_target`: Goal threshold (Voice: 0.80 in 20s, Chat: 0.85 in 30s, Email: 0.95 in 4h).
     - `sla_breached`: Binary flag (1 if SLA < target, else 0).
     - `asa_seconds`: Average speed of answer in seconds.
     - `backlog`: Queued interactions remaining at interval close.
     - `is_peak`: Binary flag indicating top-decile volume arrival intervals.

2. **`daily_contact_center_wfm.csv`**
   - **Records:** 28 daily rollups.
   - **Columns:** `date`, `day_name`, `forecast_volume`, `actual_volume`, `volume_variance`, `volume_variance_pct`, `workload_hours`, `avg_required_gross_fte`, `avg_scheduled_gross_fte`, `avg_available_gross_fte`, `net_staffing_gap_fte`, `daily_sla_attainment_pct`, `peak_backlog_units`.

3. **`action_items.csv`**
   - Seed workforce management mitigation items (shift overtime, schedule adherence audits, cross-skilling, baseline model recalibration).
   - Schema matches the SQLite `actions` table.

4. **`wfm_ingestion_template.csv`**
   - Minimal standard template for users uploading custom external contact-center logs.

5. **`wfm_portfolio.db`**
   - SQLite relational database file initialized with the `actions` mitigation table.

---

## 🔬 Mathematical Assumptions

- **Arrival Distribution:** Diurnal curves reflecting typical contact center operational flows with morning (09:00–11:00 UTC) and afternoon (14:00–16:00 UTC) peaks.
- **Queuing Model:** Continuous Markovian Erlang-C ($M/M/c$) for Voice and Chat queues; throughput-based queue clearing for asynchronous Email tickets.
- **Shrinkage Decomposition:** 18% planned shrinkage (breaks, coaching, training) and 12% unplanned shrinkage (sick leave, tardiness, downtime) = 30% total gross shrinkage.
