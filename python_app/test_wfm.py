"""
Automated Unit Tests for Workforce Planning & SLA Intelligence Dashboard.

Covers:
1. Mathematical calculations (Workload, Erlang-C, Service Level, ASA, Shrinkage, Utilization)
2. Forecasting metrics (MAPE, WAPE, Forecast Bias, Moving Average, Exponential Smoothing, Peak intervals)
3. Capacity planning logic (Required raw vs gross FTE, Net staffing gap, Undercapacity vs Overcapacity)
4. SLA metrics (Attainment, Breach detection, Backlog queue handling)
5. Action Tracker SQLite persistence (CRUD, Priority sorting, Schema constraints, Data validation)
"""

import unittest
import math
import os
import tempfile
import sqlite3
from python_app.wfm_core import (
    calculate_workload_hours,
    calculate_traffic_intensity,
    erlang_c_probability_waiting,
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


class TestWFMCalculations(unittest.TestCase):
    """Test core workforce mathematical equations."""

    def test_workload_hours_basic(self):
        # 120 calls with 180s AHT = 21,600s = 6.0 hours
        self.assertAlmostEqual(calculate_workload_hours(120, 180), 6.0, places=2)
        self.assertEqual(calculate_workload_hours(0, 300), 0.0)

    def test_workload_hours_invalid_input(self):
        with self.assertRaises(ValueError):
            calculate_workload_hours(-10, 180)
        with self.assertRaises(ValueError):
            calculate_workload_hours(100, -50)

    def test_traffic_intensity(self):
        # 360 calls in 3600 seconds with 300s AHT = 0.1 arrival/sec * 300 = 30 Erlangs
        traffic = calculate_traffic_intensity(360, 300, 3600)
        self.assertAlmostEqual(traffic, 30.0, places=2)

    def test_erlang_c_queue_probability(self):
        # When servers <= traffic, queue probability must be 1.0 (unstable system)
        self.assertEqual(erlang_c_probability_waiting(10.0, 10), 1.0)
        self.assertEqual(erlang_c_probability_waiting(12.0, 8), 1.0)
        # When traffic = 0, queue probability is 0.0
        self.assertEqual(erlang_c_probability_waiting(0.0, 5), 0.0)
        # For standard queue: Traffic = 15 Erlangs, Servers = 18
        # P_wait should be strictly between 0 and 1
        p_wait = erlang_c_probability_waiting(15.0, 18)
        self.assertTrue(0.0 < p_wait < 1.0)
        # More servers should strictly decrease probability of waiting
        p_wait_more_servers = erlang_c_probability_waiting(15.0, 20)
        self.assertLess(p_wait_more_servers, p_wait)

    def test_service_level_bounds(self):
        # 20 Erlangs, 25 servers, 300s AHT, 20s target
        sl = calculate_service_level(20.0, 25, 300, 20)
        self.assertTrue(0.0 <= sl <= 1.0)
        # Zero servers gives 0% SLA
        self.assertEqual(calculate_service_level(20.0, 0, 300, 20), 0.0)
        # Huge server count gives ~100% SLA
        sl_huge = calculate_service_level(20.0, 80, 300, 20)
        self.assertGreater(sl_huge, 0.99)

    def test_average_speed_of_answer(self):
        # ASA when stable must be positive
        asa = calculate_average_speed_of_answer(15.0, 18, 300)
        self.assertGreater(asa, 0.0)
        self.assertLess(asa, 300.0)
        # Overloaded system returns unconstrained penalty
        asa_overload = calculate_average_speed_of_answer(20.0, 18, 300)
        self.assertEqual(asa_overload, 999.0)

    def test_required_raw_agents_monotonicity(self):
        # Increasing volume at same AHT must require more or equal servers
        servers_low = calculate_required_raw_agents(100, 300, 0.80, 20)
        servers_high = calculate_required_raw_agents(200, 300, 0.80, 20)
        self.assertGreaterEqual(servers_high, servers_low)

    def test_shrinkage_formula(self):
        # Gross = Net / (1 - Shrinkage)
        # 70 net agents with 30% shrinkage = 70 / 0.70 = 100 gross agents
        gross = apply_shrinkage(70.0, 0.30)
        self.assertAlmostEqual(gross, 100.0, places=2)

    def test_shrinkage_validation(self):
        with self.assertRaises(ValueError):
            apply_shrinkage(50.0, 1.0)  # Cannot be 100%
        with self.assertRaises(ValueError):
            apply_shrinkage(50.0, -0.1)

    def test_staffing_gap_and_utilization(self):
        # Positive gap = surplus
        self.assertEqual(calculate_staffing_gap(105.0, 100.0), 5.0)
        # Negative gap = deficit
        self.assertEqual(calculate_staffing_gap(85.0, 100.0), -15.0)
        # Utilization = 80h workload / 100h available = 80%
        self.assertAlmostEqual(calculate_utilization(80.0, 100.0), 0.80, places=2)
        # Zero available productive hours handling
        self.assertEqual(calculate_utilization(80.0, 0.0), 0.0)


class TestForecastMetrics(unittest.TestCase):
    """Test forecasting error calculations and baseline methods."""

    def test_mape_calculation(self):
        actuals = [100.0, 200.0, 150.0]
        forecasts = [110.0, 190.0, 165.0]
        # errors: 10/100 = 0.10, 10/200 = 0.05, 15/150 = 0.10 -> Mean = 0.25 / 3 = 0.0833
        mape = calculate_mape(actuals, forecasts)
        self.assertAlmostEqual(mape, 0.0833, places=3)

    def test_wape_calculation(self):
        actuals = [100.0, 200.0, 150.0]
        forecasts = [110.0, 190.0, 165.0]
        # Sum(|actual - forecast|) = 10 + 10 + 15 = 35
        # Sum(actual) = 450
        # WAPE = 35 / 450 = 0.0778
        wape = calculate_wape(actuals, forecasts)
        self.assertAlmostEqual(wape, 35.0 / 450.0, places=4)

    def test_forecast_bias(self):
        actuals = [100.0, 100.0]
        forecasts = [110.0, 120.0]
        # Bias = (10 + 20) / 200 = +0.15 (+15% overforecast)
        bias = calculate_forecast_bias(actuals, forecasts)
        self.assertAlmostEqual(bias, 0.15, places=2)

    def test_baseline_moving_average(self):
        history = [10.0, 20.0, 30.0, 40.0, 50.0]
        avg3 = baseline_moving_average(history, window=3)
        # (30 + 40 + 50) / 3 = 40.0
        self.assertAlmostEqual(avg3, 40.0, places=2)

    def test_baseline_exponential_smoothing(self):
        history = [100.0, 110.0, 120.0]
        # s0 = 100
        # s1 = 0.5 * 110 + 0.5 * 100 = 105
        # s2 = 0.5 * 120 + 0.5 * 105 = 60 + 52.5 = 112.5
        es = baseline_exponential_smoothing(history, alpha=0.5)
        self.assertAlmostEqual(es, 112.5, places=2)

    def test_peak_demand_detection(self):
        volumes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        peaks = identify_peak_demand_intervals(volumes, percentile_threshold=0.80)
        # Top 20% should include values >= 90
        self.assertIn(8, peaks)
        self.assertIn(9, peaks)


class TestActionTrackerSQLite(unittest.TestCase):
    """Test SQLite persistence, schema constraints, and CRUD operations."""

    def setUp(self):
        # Create isolated temporary database for each test
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.temp_file.close()
        self.db = ActionTrackerDB(self.temp_file.name)

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            os.remove(self.temp_file.name)

    def test_create_and_retrieve_action(self):
        action_data = {
            "id": "ACT-TEST-001",
            "issue_description": "Understaffing on Chat during weekend shift",
            "priority": "P1 - Critical",
            "owner": "Test Lead",
            "due_date": "2026-10-20",
            "status": "Open",
            "category": "Shift Scheduling & Overtime",
            "dependencies": "Budget approval",
            "verification_notes": "Pending manager review"
        }
        action_id = self.db.create_action(action_data)
        self.assertEqual(action_id, "ACT-TEST-001")

        retrieved = self.db.get_action("ACT-TEST-001")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["issue_description"], action_data["issue_description"])
        self.assertEqual(retrieved["priority"], "P1 - Critical")
        self.assertEqual(retrieved["status"], "Open")

    def test_update_action_status(self):
        action_data = {
            "id": "ACT-TEST-002",
            "issue_description": "AHT variance in billing queue",
            "priority": "P2 - High",
            "owner": "Analyst A",
            "due_date": "2026-10-22",
            "status": "In Progress",
            "category": "Process & AHT Optimization"
        }
        self.db.create_action(action_data)
        updated = self.db.update_action("ACT-TEST-002", {"status": "Mitigated", "verification_notes": "Macro deployed"})
        self.assertTrue(updated)

        retrieved = self.db.get_action("ACT-TEST-002")
        self.assertEqual(retrieved["status"], "Mitigated")
        self.assertEqual(retrieved["verification_notes"], "Macro deployed")

    def test_delete_action(self):
        action_data = {
            "id": "ACT-TEST-003",
            "issue_description": "Temporary training scheduling conflict",
            "priority": "P3 - Medium",
            "owner": "Trainer B",
            "due_date": "2026-10-25",
            "status": "Open",
            "category": "Shrinkage & Adherence"
        }
        self.db.create_action(action_data)
        self.assertTrue(self.db.delete_action("ACT-TEST-003"))
        self.assertIsNone(self.db.get_action("ACT-TEST-003"))

    def test_filter_and_sort_actions(self):
        self.db.seed_initial_portfolio_data()
        all_actions = self.db.list_actions()
        self.assertGreaterEqual(len(all_actions), 5)
        # Verify priority sorting: P1 must come before P3
        priorities = [a["priority"] for a in all_actions]
        p1_idx = priorities.index("P1 - Critical")
        p3_idx = priorities.index("P3 - Medium")
        self.assertLess(p1_idx, p3_idx)

        # Filter by status
        open_actions = self.db.list_actions(status="Open")
        for a in open_actions:
            self.assertEqual(a["status"], "Open")


class TestSyntheticDataset(unittest.TestCase):
    """Test realistic synthetic dataset generator."""

    def test_dataset_generation_completeness(self):
        dataset = generate_synthetic_wfm_dataset(days=7, seed=42)
        # 7 days * 3 channels * 24 hours = 504 hourly records
        self.assertEqual(len(dataset), 504)

        sample = dataset[0]
        expected_keys = [
            "date", "hour", "channel", "forecast_volume", "actual_volume",
            "workload_hours", "required_gross_fte", "scheduled_gross_fte",
            "available_gross_fte", "staffing_gap", "sla_attainment", "backlog"
        ]
        for key in expected_keys:
            self.assertIn(key, sample)
            self.assertIsNotNone(sample[key])


if __name__ == "__main__":
    unittest.main()
