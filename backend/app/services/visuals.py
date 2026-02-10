from datetime import datetime
from typing import Optional, Union
from uuid import uuid4

import pandas as pd

from app.schemas import ColumnProfile, FileProfile, VisualSpec
from app.services.ingestion import to_serializable
from app.services.llm import llm_service

ALLOWED_TYPES = {"bar", "line", "pie", "scatter", "histogram", "table", "map"}
AGGREGATIONS = {"count", "mean", "sum", "median"}
AGGREGATION_LABELS = {"mean": "Average", "sum": "Total", "median": "Median"}
PIE_CATEGORY_LIMIT = 7
BAR_CATEGORY_LIMIT = 12
TEXT_CATEGORY_LIMIT = 20
CATEGORY_RATIO_LIMIT = 0.35
SUMMARY_TABLE_LIMIT = 4
KPI_LIMIT = 4
IDENTIFIER_HINTS = ("id", "uuid", "guid", "key")
# Columns that end with these suffixes are ALWAYS identifiers (no uniqueness check needed)
STRONG_ID_SUFFIXES = ("_id", " id")
# Internal columns added by the system that should never appear in visuals
EXCLUDED_COLUMNS = {"_source_file"}
TIME_HINTS = (
    "date",
    "time",
    "timestamp",
    "created",
    "updated",
    "submitted",
    "opened",
    "closed",
    "start",
    "end",
    "day",
    "week",
    "month",
    "year",
    "quarter",
    "period",
    "fiscal",
)
LATITUDE_HINTS = ("lat", "latitude", "y_coord", "lat_", "_lat")
LONGITUDE_HINTS = ("lon", "lng", "longitude", "long", "x_coord", "lon_", "_lon", "_lng")
CURRENCY_HINTS = (
    "sales",
    "revenue",
    "profit",
    "cost",
    "price",
    "amount",
    "total",
    "payment",
    "charge",
    "fee",
    "income",
    "expense",
    "budget",
    "spend",
    "value",
    "balance",
    "claim",
    "wage",
    "salary",
    "commission",
    "discount",
    "tax",
    "margin",
)
VALUE_HINTS = (
    "amount",
    "cost",
    "charge",
    "revenue",
    "sales",
    "profit",
    "price",
    "spend",
    "payment",
    "claim",
    "value",
    "balance",
    "total",
)
SEGMENT_HINTS = (
    "gender",
    "sex",
    "age",
    "age_group",
    "region",
    "country",
    "state",
    "city",
    "zip",
    "postcode",
    "device",
    "channel",
    "source",
    "audience",
    "segment",
    "payer",
    "plan",
)
DRIVER_HINTS = (
    "type",
    "category",
    "class",
    "procedure",
    "product",
    "service",
    "reason",
    "code",
    "diagnosis",
    "page",
    "event",
    "campaign",
    "department",
    "provider",
    "status",
)
SUM_HINTS = (
    "total",
    "sum",
    "revenue",
    "sales",
    "amount",
    "cost",
    "profit",
    "qty",
    "quantity",
    "volume",
    "count",
    "units",
)
MEAN_HINTS = ("avg", "average", "mean", "rate", "ratio", "score", "price", "margin")

TEMPLATE_REGISTRY: dict[str, dict] = {
    "retail": {
        "kpi_priorities": ["total_revenue", "avg_order_value", "total_orders", "unique_products"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_products", "title": "Top 10 Products", "sort": "desc", "limit": 10},
            {"type": "bar", "intent": "bottom_products", "title": "Least Popular Products", "sort": "asc", "limit": 10},
            {"type": "line", "intent": "sales_over_time", "title": "Sales Over Time"},
            {"type": "bar", "intent": "sales_by_day_of_week", "title": "Avg Sales by Day of Week"},
            {"type": "pie", "intent": "category_share", "title": "Revenue by Category"},
        ],
        "column_role_overrides": {
            "driver_hints": ("product", "sku", "item", "brand", "name"),
            "value_hints": ("revenue", "sales", "amount", "total", "price", "quantity"),
            "time_hints": ("date", "order_date", "created", "purchased"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "restaurant": {
        "kpi_priorities": ["total_revenue", "avg_ticket_size", "total_orders", "total_covers"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_items", "title": "Best-Selling Menu Items", "sort": "desc", "limit": 10},
            {"type": "bar", "intent": "sales_by_day_of_week", "title": "Revenue by Day of Week"},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Trend Over Time"},
            {"type": "pie", "intent": "category_share", "title": "Sales Mix by Category"},
            {"type": "bar", "intent": "hourly_distribution", "title": "Orders by Hour of Day"},
            {"type": "bar", "intent": "bottom_items", "title": "Lowest-Selling Items", "sort": "asc", "limit": 10},
        ],
        "column_role_overrides": {
            "driver_hints": ("item", "menu", "dish", "food", "category", "meal", "pizza", "burger",
                             "product", "name", "type", "size", "cuisine", "table"),
            "value_hints": ("total", "amount", "price", "tip", "revenue", "sales", "cost",
                            "subtotal", "tax", "discount", "quantity", "qty", "order_total",
                            "unit_price", "total_price"),
            "time_hints": ("date", "time", "order_date", "created", "datetime", "timestamp",
                           "order_time", "placed_at"),
            "segment_hints": ("server", "waiter", "waitress", "staff", "shift", "table",
                              "dining_type", "dine_in", "takeout", "delivery", "order_type"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
        "auto_derive": ["hour_of_day", "day_of_week"],
    },
    "coffee_shop": {
        "kpi_priorities": ["total_revenue", "avg_transaction_value", "total_transactions", "items_per_transaction"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_drinks", "title": "Top-Selling Drinks", "sort": "desc", "limit": 10},
            {"type": "bar", "intent": "sales_by_hour", "title": "Sales by Hour (Peak Hours)", "sort": "desc"},
            {"type": "line", "intent": "revenue_over_time", "title": "Daily Revenue Trend"},
            {"type": "pie", "intent": "category_share", "title": "Revenue by Product Category"},
            {"type": "bar", "intent": "sales_by_day_of_week", "title": "Busiest Days of the Week"},
            {"type": "bar", "intent": "size_preference", "title": "Drink Size Popularity"},
        ],
        "column_role_overrides": {
            "driver_hints": ("item", "drink", "product", "beverage", "coffee", "tea", "name",
                             "menu_item", "type", "category", "size", "flavor", "roast",
                             "milk", "milk_type", "espresso"),
            "value_hints": ("total", "amount", "price", "revenue", "sales", "cost",
                            "subtotal", "tip", "unit_price", "total_price", "quantity", "qty"),
            "time_hints": ("date", "time", "order_date", "datetime", "timestamp",
                           "transaction_date", "order_time", "created"),
            "segment_hints": ("store", "location", "branch", "barista", "staff",
                              "order_type", "channel", "payment_method", "loyalty"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
        "auto_derive": ["hour_of_day", "day_of_week"],
    },
    "ecommerce": {
        "kpi_priorities": ["total_revenue", "total_orders", "avg_order_value", "conversion_rate"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_products", "title": "Top-Selling Products", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "pie", "intent": "category_share", "title": "Revenue by Category"},
            {"type": "bar", "intent": "orders_by_day_of_week", "title": "Orders by Day of Week"},
            {"type": "bar", "intent": "channel_performance", "title": "Sales by Channel"},
        ],
        "column_role_overrides": {
            "driver_hints": ("product", "item", "sku", "brand", "category", "name"),
            "value_hints": ("revenue", "sales", "amount", "total", "price", "quantity", "gmv",
                            "order_value", "discount", "shipping"),
            "time_hints": ("date", "order_date", "created", "purchased", "timestamp"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "saas": {
        "kpi_priorities": ["mrr", "total_subscribers", "churn_rate", "arpu"],
        "must_have_visuals": [
            {"type": "line", "intent": "mrr_over_time", "title": "MRR Growth Over Time"},
            {"type": "pie", "intent": "plan_distribution", "title": "Subscribers by Plan"},
            {"type": "bar", "intent": "revenue_by_plan", "title": "Revenue by Plan"},
            {"type": "line", "intent": "churn_over_time", "title": "Churn Rate Over Time"},
        ],
        "column_role_overrides": {
            "driver_hints": ("plan", "tier", "subscription", "feature", "product"),
            "value_hints": ("mrr", "arr", "revenue", "amount", "price", "ltv", "churn"),
            "time_hints": ("date", "created", "started", "cancelled", "signup_date"),
        },
        "preferred_chart_mix": {"bar": 2, "line": 3, "pie": 1, "table": 1, "kpi": 4},
    },
    "finance": {
        "kpi_priorities": ["total_revenue", "net_profit", "total_expenses", "profit_margin"],
        "must_have_visuals": [
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "bar", "intent": "expenses_by_category", "title": "Expenses by Category"},
            {"type": "pie", "intent": "revenue_sources", "title": "Revenue Sources"},
            {"type": "line", "intent": "profit_trend", "title": "Profit Trend"},
        ],
        "column_role_overrides": {
            "driver_hints": ("category", "department", "account", "type", "source"),
            "value_hints": ("revenue", "profit", "expense", "cost", "amount", "balance",
                            "income", "debit", "credit", "budget", "actual"),
            "time_hints": ("date", "period", "quarter", "fiscal_year", "month"),
        },
        "preferred_chart_mix": {"bar": 2, "line": 3, "pie": 1, "table": 1, "kpi": 4},
    },
    "healthcare": {
        "kpi_priorities": ["total_patients", "avg_wait_time", "total_appointments", "readmission_rate"],
        "must_have_visuals": [
            {"type": "bar", "intent": "patients_by_department", "title": "Patients by Department"},
            {"type": "line", "intent": "visits_over_time", "title": "Patient Visits Over Time"},
            {"type": "pie", "intent": "diagnosis_distribution", "title": "Top Diagnoses"},
            {"type": "bar", "intent": "wait_time_by_department", "title": "Avg Wait Time by Department"},
        ],
        "column_role_overrides": {
            "driver_hints": ("department", "diagnosis", "procedure", "doctor", "provider", "specialty"),
            "value_hints": ("charge", "cost", "payment", "amount", "duration", "wait_time",
                            "length_of_stay", "bill"),
            "time_hints": ("date", "admission_date", "discharge_date", "visit_date", "appointment"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "education": {
        "kpi_priorities": ["total_students", "avg_grade", "pass_rate", "enrollment_count"],
        "must_have_visuals": [
            {"type": "bar", "intent": "performance_by_subject", "title": "Performance by Subject"},
            {"type": "line", "intent": "enrollment_over_time", "title": "Enrollment Over Time"},
            {"type": "pie", "intent": "grade_distribution", "title": "Grade Distribution"},
            {"type": "bar", "intent": "attendance_by_class", "title": "Attendance by Class"},
        ],
        "column_role_overrides": {
            "driver_hints": ("subject", "course", "class", "teacher", "department", "grade_level"),
            "value_hints": ("grade", "score", "gpa", "mark", "attendance", "enrollment", "credits"),
            "time_hints": ("date", "semester", "term", "year", "academic_year"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "marketing": {
        "kpi_priorities": ["total_spend", "total_conversions", "cost_per_acquisition", "roas"],
        "must_have_visuals": [
            {"type": "bar", "intent": "performance_by_channel", "title": "Performance by Channel"},
            {"type": "line", "intent": "spend_over_time", "title": "Spend Over Time"},
            {"type": "pie", "intent": "budget_allocation", "title": "Budget Allocation"},
            {"type": "bar", "intent": "campaign_performance", "title": "Top Campaigns by ROI"},
        ],
        "column_role_overrides": {
            "driver_hints": ("channel", "campaign", "source", "medium", "ad_group", "keyword"),
            "value_hints": ("spend", "cost", "revenue", "conversions", "clicks", "impressions",
                            "ctr", "cpc", "roas", "roi"),
            "time_hints": ("date", "start_date", "end_date", "created", "month"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "logistics": {
        "kpi_priorities": ["total_shipments", "avg_delivery_time", "on_time_rate", "total_cost"],
        "must_have_visuals": [
            {"type": "bar", "intent": "shipments_by_destination", "title": "Shipments by Destination"},
            {"type": "line", "intent": "volume_over_time", "title": "Shipment Volume Over Time"},
            {"type": "pie", "intent": "carrier_share", "title": "Shipments by Carrier"},
            {"type": "bar", "intent": "delivery_time_by_region", "title": "Avg Delivery Time by Region"},
        ],
        "column_role_overrides": {
            "driver_hints": ("carrier", "destination", "origin", "route", "warehouse", "region"),
            "value_hints": ("cost", "weight", "volume", "distance", "delivery_time", "freight",
                            "shipping_cost"),
            "time_hints": ("date", "ship_date", "delivery_date", "created", "eta"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "services": {
        "kpi_priorities": ["total_revenue", "total_clients", "avg_project_value", "total_hours"],
        "must_have_visuals": [
            {"type": "bar", "intent": "revenue_by_client", "title": "Revenue by Client", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "pie", "intent": "service_mix", "title": "Revenue by Service Type"},
            {"type": "bar", "intent": "hours_by_project", "title": "Hours by Project"},
        ],
        "column_role_overrides": {
            "driver_hints": ("client", "project", "service", "type", "department"),
            "value_hints": ("revenue", "amount", "fee", "hours", "billable", "rate"),
            "time_hints": ("date", "invoice_date", "start_date", "created"),
        },
        "preferred_chart_mix": {"bar": 2, "line": 2, "pie": 1, "table": 2, "kpi": 4},
    },
    "health_beauty": {
        "kpi_priorities": ["total_revenue", "total_appointments", "avg_service_value", "unique_clients"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_services", "title": "Most Popular Services", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "pie", "intent": "service_mix", "title": "Revenue by Service"},
            {"type": "bar", "intent": "appointments_by_day", "title": "Appointments by Day of Week"},
        ],
        "column_role_overrides": {
            "driver_hints": ("service", "treatment", "stylist", "therapist", "client"),
            "value_hints": ("price", "revenue", "amount", "total", "cost"),
            "time_hints": ("date", "appointment_date", "booked", "created"),
        },
        "preferred_chart_mix": {"bar": 2, "line": 2, "pie": 1, "table": 2, "kpi": 4},
    },
    "fitness": {
        "kpi_priorities": ["total_members", "total_revenue", "avg_attendance", "active_memberships"],
        "must_have_visuals": [
            {"type": "bar", "intent": "class_popularity", "title": "Most Popular Classes", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "attendance_over_time", "title": "Attendance Over Time"},
            {"type": "pie", "intent": "membership_mix", "title": "Membership Types"},
            {"type": "bar", "intent": "attendance_by_day", "title": "Attendance by Day of Week"},
        ],
        "column_role_overrides": {
            "driver_hints": ("class", "member", "membership", "instructor", "type"),
            "value_hints": ("fee", "revenue", "amount", "attendance", "visits"),
            "time_hints": ("date", "check_in", "start_date", "created"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "home_services": {
        "kpi_priorities": ["total_revenue", "total_jobs", "avg_job_value", "unique_customers"],
        "must_have_visuals": [
            {"type": "bar", "intent": "revenue_by_service", "title": "Revenue by Service Type", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "pie", "intent": "job_type_share", "title": "Jobs by Type"},
            {"type": "bar", "intent": "jobs_by_day", "title": "Jobs by Day of Week"},
        ],
        "column_role_overrides": {
            "driver_hints": ("service", "job", "type", "technician", "customer"),
            "value_hints": ("revenue", "amount", "total", "cost", "estimate", "price"),
            "time_hints": ("date", "scheduled", "completed", "created"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "freelance": {
        "kpi_priorities": ["total_revenue", "total_projects", "avg_project_value", "total_hours"],
        "must_have_visuals": [
            {"type": "bar", "intent": "revenue_by_client", "title": "Revenue by Client", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Income Over Time"},
            {"type": "pie", "intent": "project_type_share", "title": "Revenue by Project Type"},
            {"type": "bar", "intent": "hours_by_project", "title": "Hours by Project"},
        ],
        "column_role_overrides": {
            "driver_hints": ("client", "project", "type", "deliverable", "task"),
            "value_hints": ("revenue", "income", "amount", "fee", "hours", "rate", "invoice"),
            "time_hints": ("date", "invoice_date", "due_date", "created"),
        },
        "preferred_chart_mix": {"bar": 2, "line": 2, "pie": 1, "table": 2, "kpi": 4},
    },
    "automotive": {
        "kpi_priorities": ["total_revenue", "total_work_orders", "avg_repair_value", "total_parts_sold"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_services", "title": "Top Service Types", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "revenue_over_time", "title": "Revenue Over Time"},
            {"type": "pie", "intent": "revenue_mix", "title": "Revenue: Parts vs Labor"},
            {"type": "bar", "intent": "jobs_by_day", "title": "Work Orders by Day"},
        ],
        "column_role_overrides": {
            "driver_hints": ("service", "repair", "part", "vehicle", "make", "model", "type"),
            "value_hints": ("total", "labor", "parts", "cost", "revenue", "amount", "price"),
            "time_hints": ("date", "repair_date", "completed", "created"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
    "real_estate": {
        "kpi_priorities": ["total_commission", "total_transactions", "avg_sale_price", "total_listings"],
        "must_have_visuals": [
            {"type": "bar", "intent": "top_agents", "title": "Top Agents by Commission", "sort": "desc", "limit": 10},
            {"type": "line", "intent": "sales_over_time", "title": "Transactions Over Time"},
            {"type": "pie", "intent": "property_type_share", "title": "Sales by Property Type"},
            {"type": "bar", "intent": "price_distribution", "title": "Sales by Price Range"},
        ],
        "column_role_overrides": {
            "driver_hints": ("agent", "property", "type", "neighborhood", "city", "listing"),
            "value_hints": ("price", "commission", "sale_price", "amount", "value"),
            "time_hints": ("date", "sale_date", "listed_date", "closed", "created"),
        },
        "preferred_chart_mix": {"bar": 3, "line": 2, "pie": 1, "table": 1, "kpi": 4},
    },
}


def _match_template_column(
    intent: str,
    columns: list[ColumnProfile],
    preferred_type: Optional[str] = None,
) -> Optional[ColumnProfile]:
    """Fuzzy-match a template visual intent to an actual column."""
    intent_lower = intent.replace("_", " ").lower()
    tokens = set(intent_lower.split())
    best: Optional[ColumnProfile] = None
    best_score = 0.0
    for col in columns:
        col_lower = col.name.lower()
        col_tokens = set(col_lower.replace("_", " ").split())
        overlap = len(tokens & col_tokens)
        if overlap == 0:
            partial = sum(1 for t in tokens if t in col_lower)
            overlap = partial * 0.5
        if overlap <= 0:
            continue
        score = overlap
        if preferred_type and col.inferred_type == preferred_type:
            score += 0.5
        if score > best_score:
            best = col
            best_score = score
    return best


def _build_template_visual(
    template_vis: dict,
    profile: FileProfile,
    dataframe: pd.DataFrame,
    numeric_cols: list[ColumnProfile],
    categorical_cols: list[ColumnProfile],
    datetime_cols: list[ColumnProfile],
) -> Optional[VisualSpec]:
    """Build a visual from a template intent definition."""
    vis_type = template_vis["type"]
    title = template_vis["title"]
    intent = template_vis.get("intent", "")
    sort_order = template_vis.get("sort", "desc")
    limit = template_vis.get("limit", 12)

    if vis_type == "line":
        time_col = datetime_cols[0] if datetime_cols else None
        if not time_col:
            return None
        value_col = _match_template_column(intent, numeric_cols, "numeric")
        if value_col:
            agg = preferred_aggregation(value_col.name)
            vis = build_line_visual(dataframe, time_col.name, value_col.name, agg)
        else:
            vis = build_line_visual(dataframe, time_col.name, None, "count")
        if vis:
            vis.title = title
        return vis

    if vis_type == "pie":
        cat_col = _match_template_column(intent, categorical_cols, "categorical")
        if not cat_col:
            cat_col = categorical_cols[0] if categorical_cols else None
        if not cat_col:
            return None
        value_col = numeric_cols[0] if numeric_cols else None
        agg = preferred_aggregation(value_col.name) if value_col else "count"
        vis = build_bar_or_pie_visual(
            dataframe, cat_col.name,
            value_col.name if value_col else None,
            agg, "pie",
        )
        if vis:
            vis.title = title
        return vis

    if vis_type == "bar":
        cat_col = _match_template_column(intent, categorical_cols, "categorical")
        if not cat_col:
            cat_col = categorical_cols[0] if categorical_cols else None
        if not cat_col:
            return None
        value_col = _match_template_column(intent, numeric_cols, "numeric")
        if not value_col and numeric_cols:
            value_col = numeric_cols[0]
        agg = preferred_aggregation(value_col.name) if value_col else "count"
        vis = build_bar_or_pie_visual(
            dataframe, cat_col.name,
            value_col.name if value_col else None,
            agg, "bar",
        )
        if vis:
            vis.title = title
        return vis

    return None


def compute_kpi_trend(
    dataframe: pd.DataFrame,
    metric_col: str,
    datetime_col: Optional[str],
    aggregation: str,
    review_frequency: Optional[str] = None,
) -> dict:
    """Compute period-over-period trend for a KPI metric."""
    result = {"trend_percent": 0.0, "trend_direction": "flat"}
    if dataframe.empty or metric_col not in dataframe.columns:
        return result

    series = dataframe[metric_col].dropna()
    if series.empty or len(series) < 2:
        return result

    if datetime_col and datetime_col in dataframe.columns:
        frame = dataframe[[datetime_col, metric_col]].copy()
        frame[datetime_col] = pd.to_datetime(frame[datetime_col], errors="coerce", format="mixed")
        frame = frame.dropna()
        if frame.empty or len(frame) < 2:
            return result
        frame = frame.sort_values(datetime_col)
        midpoint = len(frame) // 2
        first_half = frame.iloc[:midpoint][metric_col]
        second_half = frame.iloc[midpoint:][metric_col]
    else:
        midpoint = len(series) // 2
        first_half = series.iloc[:midpoint]
        second_half = series.iloc[midpoint:]

    if aggregation == "sum":
        prev_val = first_half.sum()
        curr_val = second_half.sum()
    elif aggregation == "median":
        prev_val = first_half.median()
        curr_val = second_half.median()
    else:
        prev_val = first_half.mean()
        curr_val = second_half.mean()

    if pd.isna(prev_val) or pd.isna(curr_val) or prev_val == 0:
        return result

    pct = ((curr_val - prev_val) / abs(prev_val)) * 100
    if abs(pct) < 0.01:
        return result

    return {
        "trend_percent": round(float(pct), 1),
        "trend_direction": "up" if pct > 0 else "down",
    }


def is_currency_column(column_name: str) -> bool:
    """Check if a column name suggests currency/money values."""
    lower_name = column_name.lower().strip()
    # ID columns are never currency
    if lower_name == "id" or any(lower_name.endswith(sfx) for sfx in STRONG_ID_SUFFIXES):
        return False
    return any(hint in lower_name for hint in CURRENCY_HINTS)


def is_latitude_column(column: ColumnProfile) -> bool:
    """Check if a column is likely a latitude coordinate."""
    if column.inferred_type != "numeric":
        return False
    lower_name = column.name.lower()
    if not any(hint in lower_name for hint in LATITUDE_HINTS):
        return False
    # Latitude values should be between -90 and 90
    try:
        min_val = float(column.min_value) if column.min_value is not None else None
        max_val = float(column.max_value) if column.max_value is not None else None
        if min_val is not None and max_val is not None:
            return -90 <= min_val <= 90 and -90 <= max_val <= 90
    except (ValueError, TypeError):
        pass
    return True  # If we can't check range, trust the name


def is_longitude_column(column: ColumnProfile) -> bool:
    """Check if a column is likely a longitude coordinate."""
    if column.inferred_type != "numeric":
        return False
    lower_name = column.name.lower()
    if not any(hint in lower_name for hint in LONGITUDE_HINTS):
        return False
    # Longitude values should be between -180 and 180
    try:
        min_val = float(column.min_value) if column.min_value is not None else None
        max_val = float(column.max_value) if column.max_value is not None else None
        if min_val is not None and max_val is not None:
            return -180 <= min_val <= 180 and -180 <= max_val <= 180
    except (ValueError, TypeError):
        pass
    return True  # If we can't check range, trust the name


def find_lat_lon_columns(profile: FileProfile) -> tuple[Optional[ColumnProfile], Optional[ColumnProfile]]:
    """Find latitude and longitude column pair in the profile."""
    lat_col = None
    lon_col = None
    for col in profile.columns:
        if lat_col is None and is_latitude_column(col):
            lat_col = col
        elif lon_col is None and is_longitude_column(col):
            lon_col = col
        if lat_col and lon_col:
            break
    return lat_col, lon_col


def is_time_period_column(column: ColumnProfile, dataframe: pd.DataFrame) -> bool:
    """Check if a column represents time periods like month names, years, quarters."""
    lower_name = column.name.lower()
    # Check name hints
    period_hints = ("month", "year", "quarter", "week", "day", "period", "fiscal")
    if not any(hint in lower_name for hint in period_hints):
        return False
    # Check if values look like time periods
    if column.sample_values:
        samples = [str(v).lower() for v in column.sample_values if v is not None]
        month_names = {"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
                       "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december"}
        quarter_names = {"q1", "q2", "q3", "q4", "quarter 1", "quarter 2", "quarter 3", "quarter 4"}
        # Check if samples match month/quarter names or look like years
        for sample in samples:
            if sample in month_names or sample in quarter_names:
                return True
            # Check if it's a year (4-digit number between 1900-2100)
            try:
                year = int(sample)
                if 1900 <= year <= 2100:
                    return True
            except ValueError:
                pass
    return False


DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def auto_derive_columns(
    dataframe: pd.DataFrame,
    datetime_cols: list[ColumnProfile],
    derivations: list[str],
) -> pd.DataFrame:
    """Add derived columns (hour_of_day, day_of_week) from datetime columns."""
    if not datetime_cols or not derivations:
        return dataframe
    df = dataframe.copy()
    dt_col = datetime_cols[0].name
    if dt_col not in df.columns:
        return df
    parsed = pd.to_datetime(df[dt_col], errors="coerce", format="mixed")
    if parsed.isna().all():
        return df
    if "hour_of_day" in derivations and "hour_of_day" not in df.columns:
        hours = parsed.dt.hour
        if not hours.isna().all():
            df["hour_of_day"] = hours
    if "day_of_week" in derivations and "day_of_week" not in df.columns:
        days = parsed.dt.day_name()
        if not days.isna().all():
            df["day_of_week"] = days
    return df


def build_day_of_week_visual(
    dataframe: pd.DataFrame,
    value_col: Optional[str],
    aggregation: str,
    title: str = "Revenue by Day of Week",
) -> Optional[VisualSpec]:
    """Build a bar chart ordered Mon-Sun."""
    if "day_of_week" not in dataframe.columns:
        return None
    if value_col and value_col in dataframe.columns and aggregation != "count":
        grouped = dataframe.groupby("day_of_week")[value_col].agg(aggregation).reset_index()
        y_col = value_col
    else:
        grouped = dataframe.groupby("day_of_week").size().reset_index(name="count")
        y_col = "count"
    cat_type = pd.CategoricalDtype(categories=DAY_ORDER, ordered=True)
    grouped["day_of_week"] = grouped["day_of_week"].astype(cat_type)
    grouped = grouped.sort_values("day_of_week").dropna(subset=["day_of_week"])
    if grouped.empty:
        return None
    return VisualSpec(
        visual_id=build_visual_id("bar"),
        type="bar",
        title=title,
        x="day_of_week",
        y=y_col,
        aggregation=aggregation,
        data=serialize_dataframe(grouped, limit=7),
    )


def build_hour_of_day_visual(
    dataframe: pd.DataFrame,
    value_col: Optional[str],
    aggregation: str,
    title: str = "Orders by Hour of Day",
) -> Optional[VisualSpec]:
    """Build a bar chart for each hour 0-23."""
    if "hour_of_day" not in dataframe.columns:
        return None
    if value_col and value_col in dataframe.columns and aggregation != "count":
        grouped = dataframe.groupby("hour_of_day")[value_col].agg(aggregation).reset_index()
        y_col = value_col
    else:
        grouped = dataframe.groupby("hour_of_day").size().reset_index(name="count")
        y_col = "count"
    grouped = grouped.sort_values("hour_of_day")
    if grouped.empty:
        return None
    return VisualSpec(
        visual_id=build_visual_id("bar"),
        type="bar",
        title=title,
        x="hour_of_day",
        y=y_col,
        aggregation=aggregation,
        data=serialize_dataframe(grouped, limit=24),
    )


def build_visual_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"


def serialize_records(records: list[dict]) -> list[dict]:
    serialized: list[dict] = []
    for row in records:
        serialized.append({key: to_serializable(value) for key, value in row.items()})
    return serialized


def serialize_dataframe(frame: pd.DataFrame, limit: int = 50) -> list[dict]:
    records = frame.head(limit).to_dict(orient="records")
    return serialize_records(records)


def column_groups(profile: FileProfile) -> dict[str, list[str]]:
    numeric = []
    categorical = []
    datetime_cols = []
    text = []

    for col in profile.columns:
        if col.inferred_type == "numeric":
            numeric.append(col.name)
        elif col.inferred_type == "datetime":
            datetime_cols.append(col.name)
        elif col.inferred_type in {"categorical", "boolean"}:
            categorical.append(col.name)
        else:
            text.append(col.name)

    return {
        "numeric": numeric,
        "categorical": categorical,
        "datetime": datetime_cols,
        "text": text,
    }


def column_cardinality(column: ColumnProfile, row_count: int) -> tuple[int, float]:
    unique = int(column.unique_count or 0)
    ratio = unique / max(row_count, 1)
    return unique, ratio


def is_identifier_column(column: ColumnProfile, row_count: int) -> bool:
    name = column.name.lower().strip()
    # Strong ID match: column name ends with '_id' or is exactly 'id'
    if name == "id" or any(name.endswith(sfx) for sfx in STRONG_ID_SUFFIXES):
        return True
    # Weaker hints: require high uniqueness ratio
    if not any(hint in name for hint in IDENTIFIER_HINTS):
        return False
    unique, ratio = column_cardinality(column, row_count)
    return unique >= max(row_count * 0.9, 10) or ratio >= 0.9


def is_categorical_candidate(column: ColumnProfile, row_count: int) -> bool:
    if column.inferred_type in {"categorical", "boolean"}:
        return True
    if column.inferred_type == "text":
        unique, ratio = column_cardinality(column, row_count)
        return unique <= TEXT_CATEGORY_LIMIT or ratio <= CATEGORY_RATIO_LIMIT
    return False


def preferred_aggregation(metric_name: str) -> str:
    name = metric_name.lower()
    if any(hint in name for hint in MEAN_HINTS):
        return "mean"
    if any(hint in name for hint in SUM_HINTS):
        return "sum"
    return "mean"


def score_numeric_column(column: ColumnProfile, row_count: int) -> float:
    unique, ratio = column_cardinality(column, row_count)
    score = ratio
    if column.null_ratio is not None:
        score += max(0.0, 0.25 - column.null_ratio)
    lower_name = column.name.lower()
    if any(hint in lower_name for hint in SUM_HINTS + MEAN_HINTS):
        score += 0.6
    if any(hint in lower_name for hint in VALUE_HINTS):
        score += 1.0
    if unique <= 2:
        score -= 0.4
    if column.max_value is not None and column.min_value is not None:
        try:
            if float(column.max_value) != float(column.min_value):
                score += 0.15
        except Exception:
            pass
    return score


def score_categorical_column(column: ColumnProfile, row_count: int) -> float:
    unique, ratio = column_cardinality(column, row_count)
    score = 1 - ratio
    if unique <= PIE_CATEGORY_LIMIT:
        score += 0.35
    if unique <= BAR_CATEGORY_LIMIT:
        score += 0.2
    lower_name = column.name.lower()
    if any(hint in lower_name for hint in ("type", "status", "region", "brand", "category")):
        score += 0.2
    if any(hint in lower_name for hint in SEGMENT_HINTS):
        score += 0.35
    if any(hint in lower_name for hint in DRIVER_HINTS):
        score += 0.25
    if column.null_ratio is not None:
        score += max(0.0, 0.2 - column.null_ratio)
    return score


def llm_column_role_hints(profile: FileProfile) -> dict[str, list[str]]:
    if not llm_service.enabled:
        return {}

    payload = {
        "columns": [
            {
                "name": col.name,
                "type": col.inferred_type,
                "unique_count": col.unique_count,
                "null_ratio": col.null_ratio,
                "sample_values": col.sample_values,
            }
            for col in profile.columns
        ]
    }

    system_prompt = (
        "You are a data modeling assistant. Your job is to infer dashboard column roles. "
        "Return JSON only with keys: time_columns, value_columns, segmentation_columns, driver_columns. "
        "Each key maps to an array of column names from the provided list. "
        "Pick likely roles even if names are generic; use types, sample values, and cardinality."
    )
    user_prompt = f"Infer dashboard roles for these columns: {payload}"
    response = llm_service.request_json(system_prompt, user_prompt)
    if not isinstance(response, dict):
        return {}

    allowed = {col.name for col in profile.columns}

    def normalize_list(value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned: list[str] = []
        for item in value:
            name = str(item)
            if name in allowed and name not in cleaned:
                cleaned.append(name)
        return cleaned

    return {
        "time_columns": normalize_list(response.get("time_columns")),
        "value_columns": normalize_list(response.get("value_columns")),
        "segmentation_columns": normalize_list(response.get("segmentation_columns")),
        "driver_columns": normalize_list(response.get("driver_columns")),
    }


def rank_numeric_columns(profile: FileProfile) -> list[ColumnProfile]:
    row_count = max(profile.row_count, 1)
    scored: list[tuple[float, ColumnProfile]] = []
    for column in profile.columns:
        if column.inferred_type != "numeric":
            continue
        if column.name in EXCLUDED_COLUMNS:
            continue
        if is_identifier_column(column, row_count):
            continue
        scored.append((score_numeric_column(column, row_count), column))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [column for _, column in scored]


def rank_categorical_columns(profile: FileProfile) -> list[ColumnProfile]:
    row_count = max(profile.row_count, 1)
    scored: list[tuple[float, ColumnProfile]] = []
    for column in profile.columns:
        if column.name in EXCLUDED_COLUMNS:
            continue
        if not is_categorical_candidate(column, row_count):
            continue
        if is_identifier_column(column, row_count):
            continue
        unique, _ = column_cardinality(column, row_count)
        if unique < 2:
            continue
        scored.append((score_categorical_column(column, row_count), column))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [column for _, column in scored]


def rank_datetime_columns(profile: FileProfile) -> list[ColumnProfile]:
    row_count = max(profile.row_count, 1)
    scored: list[tuple[float, ColumnProfile]] = []
    for column in profile.columns:
        if column.inferred_type != "datetime":
            continue
        if is_identifier_column(column, row_count):
            continue
        unique, ratio = column_cardinality(column, row_count)
        if unique < 2:
            continue
        scored.append((ratio, column))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [column for _, column in scored]


def infer_datetime_frequency(frame: pd.DataFrame, datetime_col: str) -> str:
    span_days = (frame[datetime_col].max() - frame[datetime_col].min()).days
    if span_days > 365:
        return "ME"
    if span_days > 120:
        return "W"
    return "D"


def aggregation_title(aggregation: str) -> str:
    return AGGREGATION_LABELS.get(aggregation, aggregation.title())


def format_col_title(name: str) -> str:
    """Convert snake_case column names to Title Case for chart titles."""
    return name.replace("_", " ").replace("-", " ").strip().title()


def visual_signature(spec: VisualSpec) -> tuple:
    return (
        spec.type,
        spec.x,
        spec.y,
        spec.values,
        spec.aggregation,
    )


def build_table_visual(dataframe: pd.DataFrame, columns: Optional[list[str]] = None) -> VisualSpec:
    selected_columns = columns or [str(col) for col in dataframe.columns]
    filtered = [col for col in selected_columns if col in dataframe.columns]
    if not filtered:
        filtered = [str(col) for col in dataframe.columns]
    table_frame = dataframe[filtered]
    return VisualSpec(
        visual_id=build_visual_id("table"),
        type="table",
        title="Sample Data Table",
        data=serialize_dataframe(table_frame, limit=12),
        config={"columns": filtered},
    )


def build_summary_table_visual(
    dataframe: pd.DataFrame,
    category_col: str,
    value_col: Optional[str],
    aggregation: str,
) -> Optional[VisualSpec]:
    if category_col not in dataframe.columns:
        return None
    if value_col and value_col not in dataframe.columns:
        value_col = None
    if aggregation not in AGGREGATIONS:
        aggregation = "count"

    if value_col and aggregation != "count":
        grouped = dataframe.groupby(category_col)[value_col].agg(aggregation).reset_index()
        value_name = value_col
        aggregation_used = aggregation
    else:
        grouped = dataframe.groupby(category_col).size().reset_index(name="count")
        value_name = "count"
        aggregation_used = "count"

    grouped = grouped.sort_values(value_name, ascending=False).head(10)
    if grouped.empty:
        return None

    title = (
        f"{aggregation_title(aggregation_used)} {format_col_title(value_name)} by {format_col_title(category_col)}"
        if aggregation_used != "count"
        else f"Count by {format_col_title(category_col)}"
    )

    return VisualSpec(
        visual_id=build_visual_id("table"),
        type="table",
        title=title,
        x=category_col,
        values=value_name,
        aggregation=aggregation_used,
        data=serialize_dataframe(grouped, limit=10),
        config={
            "columns": [category_col, value_name],
            "table_type": "summary",
            "category": category_col,
            "value": value_col,
            "aggregation": aggregation_used,
        },
    )


def _format_bin_label(interval) -> str:
    """Format a pandas Interval as a short readable label like '10.9 – 12.5'."""
    try:
        left = interval.left
        right = interval.right
        # Use integer formatting if values are whole numbers
        if left == int(left) and right == int(right):
            return f"{int(left)}–{int(right)}"
        # Otherwise round to 1 decimal
        return f"{left:.1f}–{right:.1f}"
    except Exception:
        return str(interval)


def build_histogram_visual(dataframe: pd.DataFrame, column: str) -> Optional[VisualSpec]:
    series = dataframe[column].dropna()
    if series.empty:
        return None
    bins = pd.cut(series, bins=min(10, max(series.nunique(), 3)))
    counts = bins.value_counts().sort_index()
    data = [
        {"bin": _format_bin_label(interval), "count": int(count)}
        for interval, count in counts.items()
    ]
    return VisualSpec(
        visual_id=build_visual_id("hist"),
        type="histogram",
        title=f"Distribution of {format_col_title(column)}",
        values=column,
        aggregation="count",
        data=serialize_records(data),
    )


def build_bar_or_pie_visual(
    dataframe: pd.DataFrame,
    category_col: str,
    value_col: Optional[str],
    aggregation: str,
    chart_type: str,
) -> Optional[VisualSpec]:
    if chart_type not in {"bar", "pie"}:
        return None
    if aggregation not in AGGREGATIONS:
        aggregation = "count"

    if value_col and value_col in dataframe.columns and aggregation != "count":
        grouped = dataframe.groupby(category_col)[value_col].agg(aggregation).reset_index()
        value_name = value_col
    else:
        grouped = dataframe.groupby(category_col).size().reset_index(name="count")
        value_name = "count"
        aggregation = "count"

    grouped = grouped.sort_values(value_name, ascending=False)

    # For pie charts, group small slices into "Other" when > PIE_CATEGORY_LIMIT
    if chart_type == "pie" and len(grouped) > PIE_CATEGORY_LIMIT:
        top = grouped.head(PIE_CATEGORY_LIMIT - 1)
        rest = grouped.iloc[PIE_CATEGORY_LIMIT - 1:]
        other_row = {category_col: "Other", value_name: rest[value_name].sum()}
        grouped = pd.concat([top, pd.DataFrame([other_row])], ignore_index=True)
    else:
        grouped = grouped.head(BAR_CATEGORY_LIMIT)

    data = serialize_dataframe(grouped, limit=BAR_CATEGORY_LIMIT)

    cat_label = format_col_title(category_col)
    val_label = format_col_title(value_name)
    if aggregation == "count":
        title = f"Count by {cat_label}" if chart_type == "bar" else f"Share by {cat_label}"
    else:
        agg_label = AGGREGATION_LABELS.get(aggregation, aggregation.title())
        title = f"{agg_label} {val_label} by {cat_label}"

    config = {}
    if value_col and is_currency_column(value_col):
        config["is_currency"] = True

    return VisualSpec(
        visual_id=build_visual_id(chart_type),
        type=chart_type,
        title=title,
        x=category_col,
        y=value_name if chart_type == "bar" else None,
        values=value_name if chart_type == "pie" else None,
        aggregation=aggregation,
        data=data,
        config=config if config else None,
    )


def build_line_visual(
    dataframe: pd.DataFrame,
    datetime_col: str,
    value_col: Optional[str],
    aggregation: str,
) -> Optional[VisualSpec]:
    if aggregation not in AGGREGATIONS:
        aggregation = "mean"
    columns = [datetime_col] + ([value_col] if value_col else [])
    frame = dataframe[columns].copy()
    frame[datetime_col] = pd.to_datetime(frame[datetime_col], errors="coerce", format="mixed")
    drop_fields = [datetime_col] + ([value_col] if value_col else [])
    frame = frame.dropna(subset=drop_fields)
    if frame.empty:
        return None

    freq = infer_datetime_frequency(frame, datetime_col)
    if value_col and aggregation != "count":
        grouped = (
            frame.groupby(pd.Grouper(key=datetime_col, freq=freq))[value_col]
            .agg(aggregation)
            .reset_index()
        )
        y_column = value_col
        title = f"{aggregation_title(aggregation)} {format_col_title(value_col)} over {format_col_title(datetime_col)}"
        aggregation_used = aggregation
    else:
        grouped = frame.groupby(pd.Grouper(key=datetime_col, freq=freq)).size().reset_index(name="count")
        y_column = "count"
        title = f"Count over {format_col_title(datetime_col)}"
        aggregation_used = "count"

    config: dict = {"frequency": freq}
    if value_col and is_currency_column(value_col):
        config["is_currency"] = True

    return VisualSpec(
        visual_id=build_visual_id("line"),
        type="line",
        title=title,
        x=datetime_col,
        y=y_column,
        aggregation=aggregation_used,
        data=serialize_dataframe(grouped, limit=50),
        config=config,
    )


def build_scatter_visual(dataframe: pd.DataFrame, x_col: str, y_col: str) -> Optional[VisualSpec]:
    frame = dataframe[[x_col, y_col]].dropna()
    if frame.empty:
        return None
    if len(frame) > 500:
        frame = frame.sample(500, random_state=42)

    return VisualSpec(
        visual_id=build_visual_id("scatter"),
        type="scatter",
        title=f"{format_col_title(y_col)} vs {format_col_title(x_col)}",
        x=x_col,
        y=y_col,
        data=serialize_dataframe(frame, limit=500),
    )


def build_map_visual(
    dataframe: pd.DataFrame,
    lat_col: str,
    lon_col: str,
    label_col: Optional[str] = None,
    value_col: Optional[str] = None,
) -> Optional[VisualSpec]:
    """Build a map visual from latitude/longitude coordinates."""
    columns = [lat_col, lon_col]
    if label_col and label_col in dataframe.columns:
        columns.append(label_col)
    if value_col and value_col in dataframe.columns:
        columns.append(value_col)
    
    frame = dataframe[columns].dropna(subset=[lat_col, lon_col])
    if frame.empty:
        return None
    
    # Limit points for performance
    if len(frame) > 1000:
        frame = frame.sample(1000, random_state=42)
    
    title = "Location Map"
    if value_col:
        title = f"{value_col} by Location"
    elif label_col:
        title = f"{label_col} Locations"
    
    config = {
        "lat_column": lat_col,
        "lon_column": lon_col,
    }
    if label_col:
        config["label_column"] = label_col
    if value_col:
        config["value_column"] = value_col
        config["is_currency"] = is_currency_column(value_col)
    
    return VisualSpec(
        visual_id=build_visual_id("map"),
        type="map",
        title=title,
        x=lon_col,
        y=lat_col,
        values=value_col,
        data=serialize_dataframe(frame, limit=1000),
        config=config,
    )


def build_kpi_visual(
    title: str,
    value: object,
    subtitle: Optional[str] = None,
    is_currency: bool = False,
) -> VisualSpec:
    config = {}
    if subtitle:
        config["subtitle"] = subtitle
    if is_currency:
        config["is_currency"] = True
    return VisualSpec(
        visual_id=build_visual_id("kpi"),
        type="kpi",
        title=title,
        data=[{"value": to_serializable(value)}],
        config=config if config else None,
    )


def compute_kpi_value(series: pd.Series, aggregation: str) -> Optional[Union[float, int]]:
    if series.empty:
        return None
    aggregation = aggregation if aggregation in AGGREGATIONS else "mean"
    if aggregation == "sum":
        value = series.sum()
    elif aggregation == "median":
        value = series.median()
    else:
        value = series.mean()
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return value


def build_kpi_visuals(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    limit: int = KPI_LIMIT,
    datetime_col: Optional[str] = None,
    review_frequency: Optional[str] = None,
) -> list[VisualSpec]:
    visuals: list[VisualSpec] = []
    visuals.append(build_kpi_visual("Total records", profile.row_count))

    numeric_cols = rank_numeric_columns(profile)
    for metric in numeric_cols[:2]:
        aggregation = preferred_aggregation(metric.name)
        series = dataframe[metric.name].dropna()
        value = compute_kpi_value(series, aggregation)
        if value is None:
            continue
        metric_is_currency = is_currency_column(metric.name)
        trend = compute_kpi_trend(dataframe, metric.name, datetime_col, aggregation, review_frequency)
        kpi = build_kpi_visual(
            f"{aggregation_title(aggregation)} {format_col_title(metric.name)}",
            value,
            subtitle=aggregation_title(aggregation),
            is_currency=metric_is_currency,
        )
        if kpi.config is None:
            kpi.config = {}
        kpi.config.update(trend)
        visuals.append(kpi)
        if len(visuals) >= limit:
            return visuals[:limit]

    categorical_cols = rank_categorical_columns(profile)
    if categorical_cols and len(visuals) < limit:
        column = categorical_cols[0].name
        unique_count = int(dataframe[column].nunique(dropna=True))
        col_title = format_col_title(column)
        # Simple pluralization
        if col_title.endswith("y"):
            col_title = col_title[:-1] + "ies"
        elif not col_title.endswith("s"):
            col_title += "s"
        visuals.append(build_kpi_visual(f"Unique {col_title}", unique_count, subtitle="Unique"))

    return visuals[:limit]


def generate_candidate_specs(profile: FileProfile) -> list[VisualSpec]:
    row_count = max(profile.row_count, 1)
    numeric_cols = rank_numeric_columns(profile)
    categorical_cols = rank_categorical_columns(profile)
    datetime_cols = rank_datetime_columns(profile)

    candidates: list[VisualSpec] = []

    if datetime_cols:
        date_col = datetime_cols[0].name
        if numeric_cols:
            for metric in numeric_cols[:2]:
                aggregation = preferred_aggregation(metric.name)
                candidates.append(
                    VisualSpec(
                        visual_id=build_visual_id("line"),
                        type="line",
                        title=f"{aggregation_title(aggregation)} {metric.name} over {date_col}",
                        x=date_col,
                        y=metric.name,
                        aggregation=aggregation,
                    )
                )
        candidates.append(
            VisualSpec(
                visual_id=build_visual_id("line"),
                type="line",
                title=f"Count over {date_col}",
                x=date_col,
                aggregation="count",
            )
        )

    for cat in categorical_cols[:3]:
        unique, _ = column_cardinality(cat, row_count)
        cat_name = cat.name
        if unique <= SUMMARY_TABLE_LIMIT:
            if numeric_cols:
                metric = numeric_cols[0]
                aggregation = preferred_aggregation(metric.name)
                candidates.append(
                    VisualSpec(
                        visual_id=build_visual_id("table"),
                        type="table",
                        title=f"{aggregation_title(aggregation)} {metric.name} by {cat_name}",
                        x=cat_name,
                        values=metric.name,
                        aggregation=aggregation,
                        config={
                            "table_type": "summary",
                            "category": cat_name,
                            "value": metric.name,
                            "aggregation": aggregation,
                        },
                    )
                )
            else:
                candidates.append(
                    VisualSpec(
                        visual_id=build_visual_id("table"),
                        type="table",
                        title=f"Count by {cat_name}",
                        x=cat_name,
                        aggregation="count",
                        config={
                            "table_type": "summary",
                            "category": cat_name,
                            "value": None,
                            "aggregation": "count",
                        },
                    )
                )
        if SUMMARY_TABLE_LIMIT < unique <= PIE_CATEGORY_LIMIT:
            candidates.append(
                VisualSpec(
                    visual_id=build_visual_id("pie"),
                    type="pie",
                    title=f"Share by {cat_name}",
                    x=cat_name,
                    aggregation="count",
                )
            )
        if unique <= BAR_CATEGORY_LIMIT:
            if numeric_cols:
                for metric in numeric_cols[:2]:
                    aggregation = preferred_aggregation(metric.name)
                    candidates.append(
                        VisualSpec(
                            visual_id=build_visual_id("bar"),
                            type="bar",
                            title=f"{aggregation_title(aggregation)} {metric.name} by {cat_name}",
                            x=cat_name,
                            y=metric.name,
                            aggregation=aggregation,
                        )
                    )
            candidates.append(
                VisualSpec(
                    visual_id=build_visual_id("bar"),
                    type="bar",
                    title=f"Count by {cat_name}",
                    x=cat_name,
                    aggregation="count",
                )
            )

    for metric in numeric_cols[:2]:
        candidates.append(
            VisualSpec(
                visual_id=build_visual_id("hist"),
                type="histogram",
                title=f"Distribution of {metric.name}",
                values=metric.name,
                aggregation="count",
            )
        )

    if len(numeric_cols) >= 2:
        candidates.append(
            VisualSpec(
                visual_id=build_visual_id("scatter"),
                type="scatter",
                title=f"{numeric_cols[1].name} vs {numeric_cols[0].name}",
                x=numeric_cols[0].name,
                y=numeric_cols[1].name,
            )
        )

    return candidates


def dashboard_signature(visual: VisualSpec) -> tuple:
    if visual.type == "kpi":
        return ("kpi", visual.title)
    return visual_signature(visual)


def generate_dashboard_visuals(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    max_visuals: int = 12,
    business_category: Optional[str] = None,
    business_context: Optional[dict] = None,
) -> list[VisualSpec]:
    row_count = max(profile.row_count, 1)
    numeric_cols = rank_numeric_columns(profile)
    categorical_cols = rank_categorical_columns(profile)
    datetime_cols = rank_datetime_columns(profile)

    template = TEMPLATE_REGISTRY.get(business_category or "", None)
    overrides = template.get("column_role_overrides", {}) if template else {}

    # Auto-derive hour_of_day / day_of_week for restaurant, coffee_shop, etc.
    derivations = template.get("auto_derive", []) if template else []
    if derivations and datetime_cols:
        dataframe = auto_derive_columns(dataframe, datetime_cols, derivations)

    if overrides:
        extra_driver = overrides.get("driver_hints", ())
        extra_value = overrides.get("value_hints", ())
        extra_time = overrides.get("time_hints", ())
        extra_segment = overrides.get("segment_hints", ())
        for col in numeric_cols:
            lower = col.name.lower()
            if any(h in lower for h in extra_value):
                col._template_boost = 1.0  # type: ignore[attr-defined]
        for col in categorical_cols:
            lower = col.name.lower()
            if any(h in lower for h in extra_driver):
                col._template_boost = 1.0  # type: ignore[attr-defined]
            if extra_segment and any(h in lower for h in extra_segment):
                col._template_boost = 0.7  # type: ignore[attr-defined]

    role_hints = llm_column_role_hints(profile)

    visuals: list[VisualSpec] = []
    signatures: set[tuple] = set()

    def pick_value_metric() -> Optional[ColumnProfile]:
        hinted = role_hints.get("value_columns")
        if hinted:
            for name in hinted:
                for col in numeric_cols:
                    if col.name == name:
                        return col
        if not numeric_cols:
            return None
        boosted = [c for c in numeric_cols if getattr(c, "_template_boost", 0) > 0]
        return boosted[0] if boosted else numeric_cols[0]

    def pick_time_column() -> Optional[ColumnProfile]:
        hinted = role_hints.get("time_columns")
        if hinted:
            for name in hinted:
                for col in datetime_cols:
                    if col.name == name:
                        return col
        if datetime_cols:
            return datetime_cols[0]
        for col in profile.columns:
            if col.inferred_type != "text":
                continue
            if any(hint in col.name.lower() for hint in TIME_HINTS):
                return ColumnProfile(
                    name=col.name,
                    normalized_name=col.normalized_name,
                    inferred_type="datetime",
                    sample_values=col.sample_values,
                    null_ratio=col.null_ratio,
                    unique_count=col.unique_count,
                    min_value=col.min_value,
                    max_value=col.max_value,
                    mean_value=col.mean_value,
                    top_values=col.top_values,
                )
        return None

    def score_segmentation_candidate(col: ColumnProfile, exclude: set[str]) -> float:
        if col.name in exclude:
            return -1e9
        unique, _ = column_cardinality(col, row_count)
        if unique < 2:
            return -1e9
        if unique > max(BAR_CATEGORY_LIMIT, PIE_CATEGORY_LIMIT):
            return -1e9
        score = score_categorical_column(col, row_count)
        lower_name = col.name.lower()
        if any(hint in lower_name for hint in SEGMENT_HINTS):
            score += 0.6
        score += max(0.0, (PIE_CATEGORY_LIMIT - unique) / max(PIE_CATEGORY_LIMIT, 1)) * 0.25
        score += getattr(col, "_template_boost", 0)
        return score

    def score_driver_candidate(col: ColumnProfile, exclude: set[str]) -> float:
        if col.name in exclude:
            return -1e9
        unique, _ = column_cardinality(col, row_count)
        if unique < 2:
            return -1e9
        if unique > BAR_CATEGORY_LIMIT:
            return -1e9
        score = score_categorical_column(col, row_count)
        lower_name = col.name.lower()
        if any(hint in lower_name for hint in DRIVER_HINTS):
            score += 0.55
        score += min(unique, BAR_CATEGORY_LIMIT) / max(BAR_CATEGORY_LIMIT, 1) * 0.2
        score += getattr(col, "_template_boost", 0)
        return score

    def pick_segmentation_category(exclude: set[str]) -> Optional[ColumnProfile]:
        hinted = role_hints.get("segmentation_columns")
        if hinted:
            for name in hinted:
                if name in exclude:
                    continue
                for col in categorical_cols:
                    if col.name == name:
                        unique, _ = column_cardinality(col, row_count)
                        if 2 <= unique <= max(BAR_CATEGORY_LIMIT, PIE_CATEGORY_LIMIT):
                            return col

        best: Optional[ColumnProfile] = None
        best_score = -1e9
        for col in categorical_cols:
            score = score_segmentation_candidate(col, exclude)
            if score > best_score:
                best = col
                best_score = score
        return best

    def pick_driver_category(exclude: set[str]) -> Optional[ColumnProfile]:
        hinted = role_hints.get("driver_columns")
        if hinted:
            for name in hinted:
                if name in exclude:
                    continue
                for col in categorical_cols:
                    if col.name == name:
                        unique, _ = column_cardinality(col, row_count)
                        if 2 <= unique <= BAR_CATEGORY_LIMIT:
                            return col

        best: Optional[ColumnProfile] = None
        best_score = -1e9
        for col in categorical_cols:
            score = score_driver_candidate(col, exclude)
            if score > best_score:
                best = col
                best_score = score
        return best

    def append_visual(visual: Optional[VisualSpec]) -> None:
        if not visual or len(visuals) >= max_visuals:
            return
        signature = dashboard_signature(visual)
        if signature in signatures:
            return
        visuals.append(visual)
        signatures.add(signature)

    time_col = pick_time_column()
    ctx = business_context or {}
    review_freq = ctx.get("review_frequency")
    focus_area = ctx.get("focus_area", "").lower()
    metric_focus = ctx.get("metric_focus", "").lower()
    comparison_dim = ctx.get("comparison_dimension", "").lower()
    datetime_col_name = time_col.name if time_col else None

    # Use context answers to boost specific numeric columns
    if metric_focus:
        for col in numeric_cols:
            if metric_focus.replace(" ", "_") in col.name.lower() or col.name.lower() in metric_focus:
                col._template_boost = getattr(col, "_template_boost", 0) + 1.5  # type: ignore[attr-defined]

    # Use comparison_dimension to boost matching categorical columns
    if comparison_dim:
        dim_tokens = set(comparison_dim.replace("_", " ").split())
        for col in categorical_cols:
            col_tokens = set(col.name.lower().replace("_", " ").split())
            if dim_tokens & col_tokens:
                col._template_boost = getattr(col, "_template_boost", 0) + 1.5  # type: ignore[attr-defined]

    # Auto-derive hour_of_day / day_of_week based on focus_area (even without template)
    if datetime_cols and not template:
        need_hour = "peak" in focus_area or "hour" in focus_area or "time of day" in comparison_dim
        need_dow = "day of week" in comparison_dim or "day" in focus_area
        derive_list = []
        if need_hour:
            derive_list.append("hour_of_day")
        if need_dow:
            derive_list.append("day_of_week")
        if derive_list:
            dataframe = auto_derive_columns(dataframe, datetime_cols, derive_list)

    for kpi_visual in build_kpi_visuals(
        profile, dataframe,
        datetime_col=datetime_col_name,
        review_frequency=review_freq,
    ):
        append_visual(kpi_visual)

    # --- Template-driven visuals (if a business category template exists) ---
    if template:
        for tmpl_vis in template.get("must_have_visuals", []):
            vis = _build_template_visual(
                tmpl_vis, profile, dataframe,
                numeric_cols, categorical_cols, datetime_cols,
            )
            append_visual(vis)

    # --- Derived column visuals (hour_of_day, day_of_week) ---
    value_metric_for_derived = None
    for col in numeric_cols:
        if getattr(col, "_template_boost", 0) > 0:
            value_metric_for_derived = col
            break
    if not value_metric_for_derived and numeric_cols:
        value_metric_for_derived = numeric_cols[0]

    derived_agg = preferred_aggregation(value_metric_for_derived.name) if value_metric_for_derived else "count"
    derived_val = value_metric_for_derived.name if value_metric_for_derived else None

    if "day_of_week" in dataframe.columns:
        dow_title = "Revenue by Day of Week" if derived_val else "Orders by Day of Week"
        append_visual(build_day_of_week_visual(dataframe, derived_val, derived_agg, dow_title))
    if "hour_of_day" in dataframe.columns:
        hod_title = "Revenue by Hour" if derived_val else "Orders by Hour of Day"
        append_visual(build_hour_of_day_visual(dataframe, derived_val, derived_agg, hod_title))

    # --- LLM-powered dashboard plan (when API key is available) ---
    if len(visuals) < max_visuals:
        llm_specs = llm_dashboard_plan(profile, business_category, business_context, max_visuals - len(visuals))
        for spec in llm_specs:
            vis = apply_data_to_spec(spec, dataframe)
            append_visual(vis)

    # --- Summary table: "Top N" for high-cardinality categoricals ---
    value_metric = pick_value_metric()
    for cat_col in categorical_cols:
        unique, _ = column_cardinality(cat_col, row_count)
        if unique >= 8:
            agg = preferred_aggregation(value_metric.name) if value_metric else "count"
            val = value_metric.name if value_metric else None
            append_visual(build_summary_table_visual(dataframe, cat_col.name, val, agg))
            break

    # --- Generic bucket-based generation for remaining slots ---
    # Pre-populate used_categories from already-generated visuals (template, derived, etc.)
    used_categories: set[str] = set()
    for existing_vis in visuals:
        if existing_vis.x and existing_vis.type in {"bar", "pie"}:
            used_categories.add(existing_vis.x)

    # Bucket 1: Volume & Magnitude
    if time_col:
        date_col = time_col.name
        append_visual(build_line_visual(dataframe, date_col, None, "count"))
        if value_metric:
            aggregation = preferred_aggregation(value_metric.name)
            append_visual(build_line_visual(dataframe, date_col, value_metric.name, aggregation))
    else:
        fallback_cat = pick_segmentation_category(used_categories) or pick_driver_category(used_categories)
        if fallback_cat:
            used_categories.add(fallback_cat.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=fallback_cat.name,
                    value_col=None,
                    aggregation="count",
                    chart_type="bar",
                )
            )
        elif value_metric:
            append_visual(build_histogram_visual(dataframe, value_metric.name))

    # Bucket 2: Segmentation & Demographics
    segmentation_cat = pick_segmentation_category(used_categories)
    if segmentation_cat:
        used_categories.add(segmentation_cat.name)
        unique, _ = column_cardinality(segmentation_cat, row_count)
        # Choose pie OR bar based on cardinality — not both (avoids redundancy)
        if unique <= PIE_CATEGORY_LIMIT:
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=segmentation_cat.name,
                    value_col=None,
                    aggregation="count",
                    chart_type="pie",
                )
            )
        else:
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=segmentation_cat.name,
                    value_col=None,
                    aggregation="count",
                    chart_type="bar",
                )
            )
        # Also show value breakdown by this segmentation if value_metric exists
        if value_metric:
            seg_agg = preferred_aggregation(value_metric.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=segmentation_cat.name,
                    value_col=value_metric.name,
                    aggregation=seg_agg,
                    chart_type="bar",
                )
            )

    # Bucket 3: Performance & Drivers
    driver_cat = pick_driver_category(used_categories)
    if driver_cat:
        used_categories.add(driver_cat.name)
        if value_metric:
            aggregation = preferred_aggregation(value_metric.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=driver_cat.name,
                    value_col=value_metric.name,
                    aggregation=aggregation,
                    chart_type="bar",
                )
            )
        else:
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=driver_cat.name,
                    value_col=None,
                    aggregation="count",
                    chart_type="bar",
                )
            )

    # Bucket 3b: Second value metric breakdown (adds diversity)
    if len(numeric_cols) >= 2:
        second_metric = numeric_cols[1] if numeric_cols[0] == value_metric else numeric_cols[0]
        second_cat = pick_driver_category(used_categories) or pick_segmentation_category(used_categories)
        if second_cat and second_metric:
            used_categories.add(second_cat.name)
            agg2 = preferred_aggregation(second_metric.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=second_cat.name,
                    value_col=second_metric.name,
                    aggregation=agg2,
                    chart_type="bar",
                )
            )

    # Bucket 4: Financial & Value Impact
    if value_metric:
        value_cat = pick_driver_category(used_categories) or pick_segmentation_category(used_categories)
        if value_cat:
            used_categories.add(value_cat.name)
            aggregation = preferred_aggregation(value_metric.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=value_cat.name,
                    value_col=value_metric.name,
                    aggregation=aggregation,
                    chart_type="bar",
                )
            )

    # Bucket 5: Geographic
    lat_col, lon_col = find_lat_lon_columns(profile)
    if lat_col and lon_col:
        label_col = None
        for col in categorical_cols:
            unique, _ = column_cardinality(col, row_count)
            if 2 <= unique <= 50:
                label_col = col.name
                break
        append_visual(
            build_map_visual(
                dataframe,
                lat_col=lat_col.name,
                lon_col=lon_col.name,
                label_col=label_col,
                value_col=value_metric.name if value_metric else None,
            )
        )

    # Bucket 6: Additional categorical breakdowns for remaining slots
    for extra_cat in categorical_cols:
        if len(visuals) >= max_visuals:
            break
        if extra_cat.name in used_categories:
            continue
        unique, _ = column_cardinality(extra_cat, row_count)
        if unique < 2 or unique > BAR_CATEGORY_LIMIT:
            continue
        used_categories.add(extra_cat.name)
        if value_metric:
            agg_extra = preferred_aggregation(value_metric.name)
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=extra_cat.name,
                    value_col=value_metric.name,
                    aggregation=agg_extra,
                    chart_type="bar",
                )
            )
        else:
            append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=extra_cat.name,
                    value_col=None,
                    aggregation="count",
                    chart_type="bar",
                )
            )

    # Fill remaining slots with distribution / relationship visuals
    if value_metric:
        append_visual(build_histogram_visual(dataframe, value_metric.name))
    if len(numeric_cols) >= 2:
        append_visual(build_scatter_visual(dataframe, numeric_cols[0].name, numeric_cols[1].name))

    return visuals


def apply_data_to_spec(spec: VisualSpec, dataframe: pd.DataFrame) -> Optional[VisualSpec]:
    if spec.type == "table":
        config = spec.config if isinstance(spec.config, dict) else {}
        if config.get("table_type") == "summary":
            visual = build_summary_table_visual(
                dataframe,
                category_col=config.get("category") or spec.x,
                value_col=config.get("value") or spec.values or spec.y,
                aggregation=config.get("aggregation") or spec.aggregation or "count",
            )
            if visual and spec.title:
                visual.title = spec.title
        else:
            columns = config.get("columns") if isinstance(config, dict) else None
            visual = build_table_visual(dataframe, columns=columns)
    elif spec.type == "histogram" and spec.values:
        visual = build_histogram_visual(dataframe, spec.values)
    elif spec.type in {"bar", "pie"} and spec.x:
        visual = build_bar_or_pie_visual(
            dataframe,
            category_col=spec.x,
            value_col=spec.y or spec.values,
            aggregation=spec.aggregation or "count",
            chart_type=spec.type,
        )
    elif spec.type == "line" and spec.x:
        visual = build_line_visual(
            dataframe,
            datetime_col=spec.x,
            value_col=spec.y,
            aggregation=spec.aggregation or "mean",
        )
    elif spec.type == "scatter" and spec.x and spec.y:
        visual = build_scatter_visual(dataframe, spec.x, spec.y)
    elif spec.type == "map" and spec.x and spec.y:
        config = spec.config if isinstance(spec.config, dict) else {}
        visual = build_map_visual(
            dataframe,
            lat_col=config.get("lat_column") or spec.y,
            lon_col=config.get("lon_column") or spec.x,
            label_col=config.get("label_column"),
            value_col=config.get("value_column") or spec.values,
        )
    else:
        visual = None
    if not visual:
        return None
    if isinstance(spec.config, dict) and spec.config:
        visual.config = {**(visual.config or {}), **spec.config}
    return visual


def llm_dashboard_plan(
    profile: FileProfile,
    business_category: Optional[str] = None,
    business_context: Optional[dict] = None,
    max_visuals: int = 8,
) -> list[VisualSpec]:
    """Use LLM to generate an intelligent dashboard plan based on the data profile and business context."""
    if not llm_service.enabled:
        return []

    col_info = []
    for col in profile.columns:
        info: dict = {
            "name": col.name,
            "type": col.inferred_type,
            "unique_count": col.unique_count,
            "null_ratio": col.null_ratio,
        }
        if col.sample_values:
            info["sample_values"] = col.sample_values[:5]
        if col.min_value is not None:
            info["min"] = col.min_value
        if col.max_value is not None:
            info["max"] = col.max_value
        col_info.append(info)

    category_label = business_category or "general"
    context_str = ""
    if business_context:
        context_str = f"\nBusiness context: {business_context}"

    system_prompt = (
        "You are an expert data analyst designing a dashboard. "
        "Given a dataset profile and business category, propose the best dashboard visuals. "
        "Think about what KPIs and charts would give the most actionable insights for this type of business. "
        "Return JSON with a 'visuals' array. Each visual must have: "
        "type (one of: bar, line, pie, scatter, histogram, table), "
        "title (descriptive, business-friendly), "
        "x (column name for x-axis/category, required for bar/line/pie/scatter), "
        "y (column name for y-axis/value, for bar/line/scatter), "
        "values (column name for pie values or histogram), "
        "aggregation (one of: count, sum, mean, median). "
        "ONLY use column names from the provided list. "
        "Prioritize: 1) time-series trends, 2) top/bottom performers, 3) distribution breakdowns, "
        "4) category comparisons, 5) correlations. "
        "For restaurants/coffee shops: focus on peak hours, best sellers, day-of-week patterns, category mix."
    )
    user_prompt = (
        f"Business category: {category_label}{context_str}\n"
        f"Row count: {profile.row_count}\n"
        f"Columns: {col_info}\n"
        f"Propose up to {max_visuals} visuals for the dashboard."
    )

    response = llm_service.request_json(system_prompt, user_prompt, max_tokens=2000)
    if not response or "visuals" not in response:
        return []

    column_names = {col.name for col in profile.columns}
    # Also allow derived columns
    column_names.update(["hour_of_day", "day_of_week"])
    visuals: list[VisualSpec] = []

    for item in response.get("visuals", []):
        try:
            visual_type = str(item.get("type", "")).lower()
            if visual_type not in ALLOWED_TYPES:
                continue
            title = str(item.get("title", "AI Suggested Visual"))
            x = item.get("x")
            y = item.get("y")
            values = item.get("values")
            aggregation = item.get("aggregation")
            if aggregation and aggregation not in AGGREGATIONS:
                aggregation = None
            if x and x not in column_names:
                continue
            if y and y not in column_names:
                continue
            if values and values not in column_names:
                continue

            visuals.append(
                VisualSpec(
                    visual_id=build_visual_id(visual_type),
                    type=visual_type,
                    title=title,
                    x=x,
                    y=y,
                    values=values,
                    aggregation=aggregation,
                )
            )
        except Exception:
            continue

    return visuals


def llm_visual_suggestions(profile: FileProfile, selected_visuals: Optional[list[VisualSpec]], limit: int) -> list[VisualSpec]:
    if not llm_service.enabled or limit <= 0:
        return []

    payload = {
        "columns": [
            {
                "name": col.name,
                "type": col.inferred_type,
                "sample_values": col.sample_values,
            }
            for col in profile.columns
        ],
        "selected_visuals": [visual.model_dump(exclude={"data", "config"}) for visual in selected_visuals or []],
        "allowed_types": sorted(ALLOWED_TYPES),
        "max_visuals": limit,
    }
    system_prompt = (
        "You are a data visualization assistant. Propose chart specs based on column types. "
        "Return JSON with a 'visuals' array. Each visual should include: type, title, x, y, values, aggregation. "
        "Only use provided column names."
    )
    user_prompt = f"Suggest up to {limit} visuals for the dataset: {payload}"

    response = llm_service.request_json(system_prompt, user_prompt)
    if not response or "visuals" not in response:
        return []

    column_names = {col.name for col in profile.columns}
    visuals: list[VisualSpec] = []

    for item in response.get("visuals", []):
        try:
            visual_type = str(item.get("type", "")).lower()
            if visual_type not in ALLOWED_TYPES:
                continue
            title = str(item.get("title", "Suggested Visual"))
            x = item.get("x")
            y = item.get("y")
            values = item.get("values")
            aggregation = item.get("aggregation")
            if aggregation and aggregation not in AGGREGATIONS:
                aggregation = None
            if x and x not in column_names:
                continue
            if y and y not in column_names:
                continue
            if values and values not in column_names:
                continue

            visuals.append(
                VisualSpec(
                    visual_id=build_visual_id(visual_type),
                    type=visual_type,
                    title=title,
                    x=x,
                    y=y,
                    values=values,
                    aggregation=aggregation,
                )
            )
        except Exception:
            continue

    return visuals


def generate_sample_visuals(profile: FileProfile, dataframe: pd.DataFrame, max_visuals: int = 8) -> list[VisualSpec]:
    candidates = generate_candidate_specs(profile)
    llm_candidates = llm_visual_suggestions(profile, None, max_visuals // 2)
    candidates.extend(llm_candidates)

    visuals: list[VisualSpec] = []
    signatures: set[tuple] = set()

    for spec in candidates:
        visual = apply_data_to_spec(spec, dataframe)
        if not visual:
            continue
        signature = visual_signature(visual)
        if signature in signatures:
            continue
        visuals.append(visual)
        signatures.add(signature)
        if len(visuals) >= max_visuals:
            break

    return visuals


def generate_final_visuals(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    selected_visuals: list[VisualSpec],
    max_visuals: int = 8,
) -> list[VisualSpec]:
    llm_candidates = llm_visual_suggestions(profile, selected_visuals, max_visuals)
    candidates = selected_visuals + llm_candidates

    visuals: list[VisualSpec] = []
    signatures: set[tuple] = set()

    for spec in candidates:
        visual = apply_data_to_spec(spec, dataframe)
        if not visual:
            continue
        signature = visual_signature(visual)
        if signature in signatures:
            continue
        visuals.append(visual)
        signatures.add(signature)
        if len(visuals) >= max_visuals:
            break

    return visuals


def generate_more_visuals(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    existing_visuals: list[VisualSpec],
    selected_visuals: Optional[list[VisualSpec]] = None,
    max_visuals: int = 6,
) -> list[VisualSpec]:
    candidates = generate_candidate_specs(profile)
    candidates.extend(llm_visual_suggestions(profile, selected_visuals or existing_visuals, max_visuals))

    existing_signatures = {visual_signature(visual) for visual in existing_visuals}
    visuals: list[VisualSpec] = []

    for spec in candidates:
        visual = apply_data_to_spec(spec, dataframe)
        if not visual:
            continue
        signature = visual_signature(visual)
        if signature in existing_signatures:
            continue
        visuals.append(visual)
        existing_signatures.add(signature)
        if len(visuals) >= max_visuals:
            break

    return visuals


# ---------------------------------------------------------------------------
# Duel-mode: generate a large pool of candidates and pair them for user picks
# ---------------------------------------------------------------------------

def generate_duel_pool(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    business_category: Optional[str] = None,
    business_context: Optional[dict] = None,
    max_pool: int = 30,
) -> tuple[list[VisualSpec], list[VisualSpec]]:
    """Generate a large pool of candidate visuals for duel mode.

    Returns (kpis, pool) where kpis are auto-included and pool is for dueling.
    """
    row_count = max(profile.row_count, 1)
    numeric_cols = rank_numeric_columns(profile)
    categorical_cols = rank_categorical_columns(profile)
    datetime_cols = rank_datetime_columns(profile)

    template = TEMPLATE_REGISTRY.get(business_category or "", None)

    # Auto-derive hour_of_day / day_of_week when template requests it
    derivations = template.get("auto_derive", []) if template else []
    if derivations and datetime_cols:
        dataframe = auto_derive_columns(dataframe, datetime_cols, derivations)
        # Re-profile to pick up derived columns
        derived_profile = profile.model_copy()
        for col_name in ["hour_of_day", "day_of_week"]:
            if col_name in dataframe.columns and not any(c.name == col_name for c in derived_profile.columns):
                from app.services.ingestion import profile_series
                cp = profile_series(dataframe[col_name])
                derived_profile.columns.append(cp)
                derived_profile.column_count = len(derived_profile.columns)
        profile = derived_profile
        numeric_cols = rank_numeric_columns(profile)
        categorical_cols = rank_categorical_columns(profile)

    # --- Generate KPIs (auto-included, not dueled) ---
    time_col = datetime_cols[0] if datetime_cols else None
    kpis = build_kpi_visuals(profile, dataframe, datetime_col=time_col.name if time_col else None)

    # --- Build candidate specs covering ALL column combos ---
    specs: list[VisualSpec] = []
    signatures: set[tuple] = set()

    def add_spec(spec: VisualSpec) -> None:
        sig = visual_signature(spec)
        if sig not in signatures:
            signatures.add(sig)
            specs.append(spec)

    # Template must-have visuals get priority (added first)
    if template:
        for tmpl_vis in template.get("must_have_visuals", []):
            vis = _build_template_visual(
                tmpl_vis, profile, dataframe,
                numeric_cols, categorical_cols, datetime_cols,
            )
            if vis:
                add_spec(vis)

    # Derived column visuals (day_of_week, hour_of_day)
    if "day_of_week" in dataframe.columns:
        value_metric = numeric_cols[0] if numeric_cols else None
        derived_val = value_metric.name if value_metric else None
        derived_agg = preferred_aggregation(derived_val) if derived_val else "count"
        dow_title = "Revenue by Day of Week" if derived_val else "Orders by Day of Week"
        vis = build_day_of_week_visual(dataframe, derived_val, derived_agg, dow_title)
        if vis:
            add_spec(vis)

    if "hour_of_day" in dataframe.columns:
        value_metric = numeric_cols[0] if numeric_cols else None
        derived_val = value_metric.name if value_metric else None
        derived_agg = preferred_aggregation(derived_val) if derived_val else "count"
        hod_title = "Revenue by Hour" if derived_val else "Orders by Hour of Day"
        vis = build_hour_of_day_visual(dataframe, derived_val, derived_agg, hod_title)
        if vis:
            add_spec(vis)

    # Line charts: every numeric × datetime
    for dt_col in datetime_cols:
        # Count over time
        add_spec(VisualSpec(
            visual_id=build_visual_id("line"),
            type="line",
            title=f"Count over {format_col_title(dt_col.name)}",
            x=dt_col.name,
            aggregation="count",
        ))
        for metric in numeric_cols:
            agg = preferred_aggregation(metric.name)
            add_spec(VisualSpec(
                visual_id=build_visual_id("line"),
                type="line",
                title=f"{aggregation_title(agg)} {format_col_title(metric.name)} over {format_col_title(dt_col.name)}",
                x=dt_col.name,
                y=metric.name,
                aggregation=agg,
            ))

    # Bar charts: every numeric × categorical
    for cat in categorical_cols:
        unique, _ = column_cardinality(cat, row_count)
        if unique > BAR_CATEGORY_LIMIT:
            continue
        # Count by category
        add_spec(VisualSpec(
            visual_id=build_visual_id("bar"),
            type="bar",
            title=f"Count by {format_col_title(cat.name)}",
            x=cat.name,
            aggregation="count",
        ))
        for metric in numeric_cols:
            agg = preferred_aggregation(metric.name)
            add_spec(VisualSpec(
                visual_id=build_visual_id("bar"),
                type="bar",
                title=f"{aggregation_title(agg)} {format_col_title(metric.name)} by {format_col_title(cat.name)}",
                x=cat.name,
                y=metric.name,
                aggregation=agg,
            ))

    # Pie charts: low-cardinality categoricals
    for cat in categorical_cols:
        unique, _ = column_cardinality(cat, row_count)
        if unique > PIE_CATEGORY_LIMIT:
            continue
        add_spec(VisualSpec(
            visual_id=build_visual_id("pie"),
            type="pie",
            title=f"Share by {format_col_title(cat.name)}",
            x=cat.name,
            aggregation="count",
        ))
        if numeric_cols:
            metric = numeric_cols[0]
            agg = preferred_aggregation(metric.name)
            add_spec(VisualSpec(
                visual_id=build_visual_id("pie"),
                type="pie",
                title=f"{format_col_title(metric.name)} by {format_col_title(cat.name)}",
                x=cat.name,
                values=metric.name,
                aggregation=agg,
            ))

    # Histograms: every numeric
    for metric in numeric_cols:
        add_spec(VisualSpec(
            visual_id=build_visual_id("hist"),
            type="histogram",
            title=f"Distribution of {format_col_title(metric.name)}",
            values=metric.name,
            aggregation="count",
        ))

    # Scatter: every numeric pair
    for i, m1 in enumerate(numeric_cols):
        for m2 in numeric_cols[i + 1:]:
            add_spec(VisualSpec(
                visual_id=build_visual_id("scatter"),
                type="scatter",
                title=f"{format_col_title(m2.name)} vs {format_col_title(m1.name)}",
                x=m1.name,
                y=m2.name,
            ))

    # Summary tables: high-cardinality categoricals
    for cat in categorical_cols:
        unique, _ = column_cardinality(cat, row_count)
        if unique >= 8:
            val = numeric_cols[0].name if numeric_cols else None
            agg = preferred_aggregation(val) if val else "count"
            vis = build_summary_table_visual(dataframe, cat.name, val, agg)
            if vis:
                add_spec(vis)

    # Apply data to all specs
    pool: list[VisualSpec] = []
    for spec in specs:
        visual = apply_data_to_spec(spec, dataframe)
        if visual and visual.data:
            pool.append(visual)

    return kpis, pool[:max_pool]


def pair_candidates(
    pool: list[VisualSpec],
    max_rounds: int = 7,
) -> list[dict]:
    """Arrange pool visuals into duel pairs.

    Strategy:
    - Template/derived visuals are at the front of the pool (shown first)
    - Pair visuals that show different perspectives (different types or different columns)
    - Returns list of {round, option_a, option_b}
    """
    if len(pool) < 2:
        return [{"round": 1, "option_a": pool[0], "option_b": pool[0]}] if pool else []

    pairs: list[dict] = []
    used: set[int] = set()

    # First pass: pair visuals with same x-column but different types
    for i in range(len(pool)):
        if i in used:
            continue
        for j in range(i + 1, len(pool)):
            if j in used:
                continue
            a, b = pool[i], pool[j]
            same_col = (a.x and a.x == b.x) or (a.values and a.values == b.values)
            diff_type = a.type != b.type
            if same_col and diff_type:
                pairs.append({"round": len(pairs) + 1, "option_a": a, "option_b": b})
                used.update([i, j])
                break

    # Second pass: pair remaining visuals with same type but different columns
    for i in range(len(pool)):
        if i in used:
            continue
        for j in range(i + 1, len(pool)):
            if j in used:
                continue
            a, b = pool[i], pool[j]
            same_type = a.type == b.type
            diff_col = (a.x != b.x) or (a.y != b.y) or (a.values != b.values)
            if same_type and diff_col:
                pairs.append({"round": len(pairs) + 1, "option_a": a, "option_b": b})
                used.update([i, j])
                break

    # Third pass: pair any remaining unpaired visuals
    remaining = [i for i in range(len(pool)) if i not in used]
    for k in range(0, len(remaining) - 1, 2):
        i, j = remaining[k], remaining[k + 1]
        pairs.append({"round": len(pairs) + 1, "option_a": pool[i], "option_b": pool[j]})

    # If odd one left, pair it with the first pool item as a solo
    if len(remaining) % 2 == 1:
        last = remaining[-1]
        if last not in used:
            pairs.append({"round": len(pairs) + 1, "option_a": pool[last], "option_b": pool[last]})

    # Renumber rounds
    for idx, pair in enumerate(pairs[:max_rounds]):
        pair["round"] = idx + 1

    return pairs[:max_rounds]
