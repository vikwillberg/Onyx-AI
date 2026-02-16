from datetime import datetime
from typing import Optional, Union
from uuid import uuid4

import pandas as pd

from app.schemas import ColumnProfile, FileProfile, VisualSpec
from app.services.ingestion import to_serializable
from app.services.llm import generate_visual_spec_from_request, llm_service

ALLOWED_TYPES = {"bar", "line", "pie", "scatter", "histogram", "table", "map"}
AGGREGATIONS = {"count", "mean", "sum", "median"}
AGGREGATION_LABELS = {"mean": "Average", "sum": "Total", "median": "Median"}
PIE_CATEGORY_LIMIT = 7
BAR_CATEGORY_LIMIT = 12
TEXT_CATEGORY_LIMIT = 40
CATEGORY_RATIO_LIMIT = 0.50
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


def is_year_like_column(column: ColumnProfile) -> bool:
    """Detect columns whose values look like calendar years (e.g. 2010-2026).
    These produce useless charts when used as numeric metrics."""
    name = column.name.lower().strip()
    year_hints = ("year", "yr", "fiscal_year", "academic_year")
    if not any(hint in name for hint in year_hints):
        return False
    # Check if min/max values fall in a plausible year range
    try:
        min_val = float(column.min_value) if column.min_value is not None else None
        max_val = float(column.max_value) if column.max_value is not None else None
        if min_val is not None and max_val is not None:
            if 1900 <= min_val <= 2100 and 1900 <= max_val <= 2100:
                return True
    except (ValueError, TypeError):
        pass
    return False


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


def llm_suggest_derived_columns(profile: FileProfile) -> list[dict]:
    """Ask the LLM to suggest computed / derived columns from the data profile.

    Returns a list of dicts like:
      {"name": "subscription_length_days", "operation": "date_diff_days",
       "col_a": "canceled_date", "col_b": "created_date",
       "description": "Days between signup and cancellation"}

    Supported operations:
      date_diff_days   – (col_a - col_b) in days
      date_diff_months – (col_a - col_b) in months
      ratio            – col_a / col_b
      product          – col_a * col_b
      year_extract     – extract year from col_a
      month_extract    – extract month from col_a
      day_of_week      – extract day-of-week name from col_a
      hour_extract     – extract hour from col_a
    """
    if not llm_service.enabled:
        return []

    col_info = []
    for col in profile.columns:
        info: dict = {
            "name": col.name,
            "type": col.inferred_type,
            "unique_count": col.unique_count,
        }
        if col.sample_values:
            info["sample_values"] = col.sample_values[:4]
        if col.min_value is not None:
            info["min"] = col.min_value
        if col.max_value is not None:
            info["max"] = col.max_value
        col_info.append(info)

    system_prompt = (
        "You are a senior data analyst. Given a dataset's column profiles, suggest NEW "
        "computed columns that would unlock deeper insights on a dashboard. "
        "Think about: date differences (duration, tenure, time-to-event), ratios, "
        "rates, year/month extractions, and other business-relevant calculations.\n\n"
        "Return JSON with a 'derived_columns' array. Each item MUST have:\n"
        "  name        – snake_case column name for the result\n"
        "  operation   – one of: date_diff_days, date_diff_months, ratio, product, "
        "year_extract, month_extract, day_of_week, hour_extract\n"
        "  col_a       – first source column name (MUST exist in the provided list)\n"
        "  col_b       – second source column name (required for date_diff/ratio/product, "
        "null for extractions)\n"
        "  description – one-line human description of the metric\n\n"
        "Rules:\n"
        "- ONLY reference column names from the provided list.\n"
        "- For date_diff operations col_a should be the later date, col_b the earlier.\n"
        "- Suggest 1-5 derived columns that would be MOST useful for a dashboard.\n"
        "- Do NOT suggest columns that already exist.\n"
        "- If no useful derivations are possible, return an empty array."
    )
    user_prompt = (
        f"Dataset has {profile.row_count} rows.\nColumns: {col_info}\n"
        "Suggest derived columns."
    )

    response = llm_service.request_json(system_prompt, user_prompt, max_tokens=1000)
    if not response or "derived_columns" not in response:
        return []

    allowed_names = {col.name for col in profile.columns}
    allowed_ops = {
        "date_diff_days", "date_diff_months", "ratio", "product",
        "year_extract", "month_extract", "day_of_week", "hour_extract",
    }
    results: list[dict] = []
    for item in response.get("derived_columns", []):
        try:
            op = str(item.get("operation", "")).lower()
            if op not in allowed_ops:
                continue
            col_a = str(item.get("col_a", ""))
            col_b = item.get("col_b")
            if col_a not in allowed_names:
                continue
            if col_b is not None and str(col_b) not in allowed_names:
                continue
            name = str(item.get("name", "")).strip().replace(" ", "_").lower()
            if not name or name in allowed_names:
                continue
            results.append({
                "name": name,
                "operation": op,
                "col_a": col_a,
                "col_b": str(col_b) if col_b else None,
                "description": str(item.get("description", "")),
            })
        except Exception:
            continue
    return results[:5]


def apply_derived_columns(
    dataframe: pd.DataFrame,
    derivations: list[dict],
) -> tuple[pd.DataFrame, list[str]]:
    """Compute derived columns on the dataframe.

    Returns (modified_dataframe, list_of_new_column_names).
    Silently skips any derivation that fails.
    """
    import logging
    logger = logging.getLogger(__name__)
    df = dataframe.copy()
    added: list[str] = []

    for d in derivations:
        name = d["name"]
        op = d["operation"]
        col_a = d["col_a"]
        col_b = d.get("col_b")

        if col_a not in df.columns:
            continue
        if col_b and col_b not in df.columns:
            continue
        if name in df.columns:
            continue

        try:
            if op == "date_diff_days":
                a = pd.to_datetime(df[col_a], errors="coerce")
                b = pd.to_datetime(df[col_b], errors="coerce")
                df[name] = (a - b).dt.total_seconds() / 86400
                df[name] = df[name].round(1)
            elif op == "date_diff_months":
                a = pd.to_datetime(df[col_a], errors="coerce")
                b = pd.to_datetime(df[col_b], errors="coerce")
                df[name] = ((a - b).dt.total_seconds() / (86400 * 30.44)).round(1)
            elif op == "ratio":
                num = pd.to_numeric(df[col_a], errors="coerce")
                den = pd.to_numeric(df[col_b], errors="coerce")
                df[name] = (num / den.replace(0, float("nan"))).round(4)
            elif op == "product":
                a_num = pd.to_numeric(df[col_a], errors="coerce")
                b_num = pd.to_numeric(df[col_b], errors="coerce")
                df[name] = (a_num * b_num).round(2)
            elif op == "year_extract":
                dt = pd.to_datetime(df[col_a], errors="coerce")
                df[name] = dt.dt.year
            elif op == "month_extract":
                dt = pd.to_datetime(df[col_a], errors="coerce")
                df[name] = dt.dt.month_name()
            elif op == "day_of_week":
                dt = pd.to_datetime(df[col_a], errors="coerce")
                df[name] = dt.dt.day_name()
            elif op == "hour_extract":
                dt = pd.to_datetime(df[col_a], errors="coerce")
                df[name] = dt.dt.hour
            else:
                continue

            # Drop the column if it's entirely null
            if df[name].isna().all():
                df.drop(columns=[name], inplace=True)
                continue

            added.append(name)
            logger.info("Derived column '%s' (%s) added successfully", name, op)
        except Exception as exc:
            logger.warning("Failed to derive column '%s': %s", name, exc)
            if name in df.columns:
                df.drop(columns=[name], inplace=True)

    return df, added


def heuristic_derived_columns(profile: FileProfile) -> list[dict]:
    """Rule-based fallback: detect common derived column patterns without an LLM.

    Detects:
    - Date pairs → duration in days (e.g. canceled_date - created_date)
    - Year/month extraction from datetime columns
    - Ratio between numeric columns with complementary names
    """
    results: list[dict] = []
    existing = {col.name for col in profile.columns}
    datetime_cols = [c for c in profile.columns if c.inferred_type == "datetime"]
    numeric_cols = [c for c in profile.columns if c.inferred_type == "numeric"
                    and not is_identifier_column(c, max(profile.row_count, 1))]

    # --- Date-pair durations ---
    START_HINTS = ("created", "start", "open", "signup", "joined", "hire", "begin",
                   "birth", "enroll", "submit", "order", "purchase", "issued")
    END_HINTS = ("canceled", "cancelled", "end", "close", "closed", "completed",
                 "finish", "expired", "resolved", "delivered", "terminated",
                 "churn", "left", "death", "graduated")
    used_pairs: set[tuple] = set()
    for end_col in datetime_cols:
        end_lower = end_col.name.lower()
        if not any(h in end_lower for h in END_HINTS):
            continue
        for start_col in datetime_cols:
            if start_col.name == end_col.name:
                continue
            start_lower = start_col.name.lower()
            if not any(h in start_lower for h in START_HINTS):
                continue
            pair_key = (start_col.name, end_col.name)
            if pair_key in used_pairs:
                continue
            used_pairs.add(pair_key)
            # Build a readable name
            base = end_lower.replace("_date", "").replace("_at", "").replace("date", "").strip("_")
            start_base = start_lower.replace("_date", "").replace("_at", "").replace("date", "").strip("_")
            name = f"days_{start_base}_to_{base}" if start_base and base else "duration_days"
            name = name.replace(" ", "_").lower()
            if name in existing:
                name = f"{name}_calc"
            if name in existing:
                continue
            results.append({
                "name": name,
                "operation": "date_diff_days",
                "col_a": end_col.name,
                "col_b": start_col.name,
                "description": f"Days between {start_col.name} and {end_col.name}",
            })

    # --- Year/month extraction from datetime columns ---
    for dt_col in datetime_cols[:2]:
        year_name = f"{dt_col.name.replace('_date', '').replace('_at', '').strip('_')}_year"
        month_name = f"{dt_col.name.replace('_date', '').replace('_at', '').strip('_')}_month"
        if year_name not in existing and year_name not in {r["name"] for r in results}:
            results.append({
                "name": year_name,
                "operation": "year_extract",
                "col_a": dt_col.name,
                "col_b": None,
                "description": f"Year extracted from {dt_col.name}",
            })
        if month_name not in existing and month_name not in {r["name"] for r in results}:
            results.append({
                "name": month_name,
                "operation": "month_extract",
                "col_a": dt_col.name,
                "col_b": None,
                "description": f"Month extracted from {dt_col.name}",
            })

    return results[:5]


def suggest_derived_columns(profile: FileProfile) -> list[dict]:
    """Unified entry point: use LLM if available, otherwise fall back to heuristics."""
    llm_results = llm_suggest_derived_columns(profile)
    if llm_results:
        return llm_results
    return heuristic_derived_columns(profile)


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
        if is_year_like_column(column):
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
    if value_col and value_col not in dataframe.columns:
        value_col = None
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
    row_count = max(profile.row_count, 1)

    numeric_cols = rank_numeric_columns(profile)
    datetime_cols = [c for c in profile.columns if c.inferred_type == "datetime"]
    has_currency = any(is_currency_column(c.name) for c in numeric_cols)

    # Only show "Total records" if data is transactional (has date + currency/amount)
    if datetime_cols and has_currency:
        visuals.append(build_kpi_visual("Total records", profile.row_count))

    # Date range KPI — format dates nicely
    if datetime_cols and len(visuals) < limit:
        dt_col = datetime_cols[0]
        if dt_col.min_value and dt_col.max_value:
            def _fmt_date(raw: str) -> str:
                try:
                    from datetime import datetime as _dt
                    d = _dt.fromisoformat(str(raw).replace("Z", "+00:00"))
                    return d.strftime("%b %d, %Y")
                except Exception:
                    return str(raw)[:10]
            visuals.append(build_kpi_visual(
                "Date Range",
                f"{_fmt_date(dt_col.min_value)} – {_fmt_date(dt_col.max_value)}",
                subtitle=dt_col.name,
            ))

    for metric in numeric_cols[:2]:
        if len(visuals) >= limit:
            break
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

    categorical_cols = rank_categorical_columns(profile)
    if categorical_cols and len(visuals) < limit:
        # Skip high-cardinality categories (>50 unique) — not useful as KPIs
        for cat_col in categorical_cols:
            unique_count = int(dataframe[cat_col.name].nunique(dropna=True))
            if unique_count > 50:
                continue
            col_title = format_col_title(cat_col.name)
            if col_title.endswith("y"):
                col_title = col_title[:-1] + "ies"
            elif not col_title.endswith("s"):
                col_title += "s"
            visuals.append(build_kpi_visual(f"Unique {col_title}", unique_count, subtitle="Unique"))
            break

    # If no KPIs were generated at all, fall back to total records
    if not visuals:
        visuals.append(build_kpi_visual("Total records", profile.row_count))

    return visuals[:limit]


def generate_candidate_specs(profile: FileProfile) -> list[VisualSpec]:
    row_count = max(profile.row_count, 1)
    numeric_cols = rank_numeric_columns(profile)
    categorical_cols = rank_categorical_columns(profile)
    datetime_cols = rank_datetime_columns(profile)

    candidates: list[VisualSpec] = []

    # Line charts: ALL datetime × ALL numeric cols (+ count)
    for dt_col in datetime_cols:
        date_col = dt_col.name
        for metric in numeric_cols:
            aggregation = preferred_aggregation(metric.name)
            candidates.append(
                VisualSpec(
                    visual_id=build_visual_id("line"),
                    type="line",
                    title=f"{aggregation_title(aggregation)} {format_col_title(metric.name)} over {format_col_title(date_col)}",
                    x=date_col,
                    y=metric.name,
                    aggregation=aggregation,
                )
            )
        candidates.append(
            VisualSpec(
                visual_id=build_visual_id("line"),
                type="line",
                title=f"Count over {format_col_title(date_col)}",
                x=date_col,
                aggregation="count",
            )
        )

    # Bar, pie, summary table: ALL eligible categoricals × ALL numeric cols
    for cat in categorical_cols:
        unique, _ = column_cardinality(cat, row_count)
        cat_name = cat.name
        if unique <= SUMMARY_TABLE_LIMIT:
            if numeric_cols:
                for metric in numeric_cols:
                    aggregation = preferred_aggregation(metric.name)
                    candidates.append(
                        VisualSpec(
                            visual_id=build_visual_id("table"),
                            type="table",
                            title=f"{aggregation_title(aggregation)} {format_col_title(metric.name)} by {format_col_title(cat_name)}",
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
                        title=f"Count by {format_col_title(cat_name)}",
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
                    title=f"Share by {format_col_title(cat_name)}",
                    x=cat_name,
                    aggregation="count",
                )
            )
            # Also try value-based pie for top numeric
            if numeric_cols:
                metric = numeric_cols[0]
                agg = preferred_aggregation(metric.name)
                candidates.append(
                    VisualSpec(
                        visual_id=build_visual_id("pie"),
                        type="pie",
                        title=f"{format_col_title(metric.name)} by {format_col_title(cat_name)}",
                        x=cat_name,
                        values=metric.name,
                        aggregation=agg,
                    )
                )
        if unique <= BAR_CATEGORY_LIMIT:
            if numeric_cols:
                for metric in numeric_cols:
                    aggregation = preferred_aggregation(metric.name)
                    candidates.append(
                        VisualSpec(
                            visual_id=build_visual_id("bar"),
                            type="bar",
                            title=f"{aggregation_title(aggregation)} {format_col_title(metric.name)} by {format_col_title(cat_name)}",
                            x=cat_name,
                            y=metric.name,
                            aggregation=aggregation,
                        )
                    )
            candidates.append(
                VisualSpec(
                    visual_id=build_visual_id("bar"),
                    type="bar",
                    title=f"Count by {format_col_title(cat_name)}",
                    x=cat_name,
                    aggregation="count",
                )
            )

    # Histograms: ALL numeric cols
    for metric in numeric_cols:
        candidates.append(
            VisualSpec(
                visual_id=build_visual_id("hist"),
                type="histogram",
                title=f"Distribution of {format_col_title(metric.name)}",
                values=metric.name,
                aggregation="count",
            )
        )

    # Scatter: ALL numeric pairs (n choose 2)
    for i, m1 in enumerate(numeric_cols):
        for m2 in numeric_cols[i + 1:]:
            candidates.append(
                VisualSpec(
                    visual_id=build_visual_id("scatter"),
                    type="scatter",
                    title=f"{format_col_title(m2.name)} vs {format_col_title(m1.name)}",
                    x=m1.name,
                    y=m2.name,
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

    # --- AI / heuristic derived columns (date diffs, ratios, extractions) ---
    smart_derivations = suggest_derived_columns(profile)
    if smart_derivations:
        from app.services.ingestion import profile_series
        dataframe, added_cols = apply_derived_columns(dataframe, smart_derivations)
        if added_cols:
            derived_profile = profile.model_copy()
            for col_name in added_cols:
                if col_name in dataframe.columns and not any(c.name == col_name for c in derived_profile.columns):
                    cp = profile_series(dataframe[col_name])
                    derived_profile.columns.append(cp)
            derived_profile.column_count = len(derived_profile.columns)
            profile = derived_profile
            numeric_cols = rank_numeric_columns(profile)
            categorical_cols = rank_categorical_columns(profile)
            datetime_cols = rank_datetime_columns(profile)

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

    # --- Chart-type diversity tracking ---
    type_counts: dict[str, int] = {}

    def count_type(t: str) -> int:
        return type_counts.get(t, 0)

    def _append_visual(visual: Optional[VisualSpec]) -> None:
        if not visual or len(visuals) >= max_visuals:
            return
        signature = dashboard_signature(visual)
        if signature in signatures:
            return
        visuals.append(visual)
        signatures.add(signature)
        type_counts[visual.type] = type_counts.get(visual.type, 0) + 1

    # Ideal chart mix targets (excluding KPIs)
    chart_slots = max_visuals - KPI_LIMIT
    ideal_mix = {"line": max(2, chart_slots // 4), "pie": 1, "bar": max(2, chart_slots // 4),
                 "histogram": 1, "scatter": 1, "table": 1}

    def needs_type(t: str) -> bool:
        return count_type(t) < ideal_mix.get(t, 2)

    for kpi_visual in build_kpi_visuals(
        profile, dataframe,
        datetime_col=datetime_col_name,
        review_frequency=review_freq,
    ):
        _append_visual(kpi_visual)

    requested_visual = generate_requested_visual(profile, dataframe, business_context)
    if requested_visual:
        _append_visual(requested_visual)

    # --- Template-driven visuals (if a business category template exists) ---
    if template:
        for tmpl_vis in template.get("must_have_visuals", []):
            vis = _build_template_visual(
                tmpl_vis, profile, dataframe,
                numeric_cols, categorical_cols, datetime_cols,
            )
            _append_visual(vis)

    # --- LLM-powered dashboard plan FIRST (primary driver for diversity) ---
    if len(visuals) < max_visuals:
        llm_specs = llm_dashboard_plan(profile, business_category, business_context, max_visuals - len(visuals))
        for spec in llm_specs:
            vis = apply_data_to_spec(spec, dataframe)
            _append_visual(vis)

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
        _append_visual(build_day_of_week_visual(dataframe, derived_val, derived_agg, dow_title))
    if "hour_of_day" in dataframe.columns:
        hod_title = "Revenue by Hour" if derived_val else "Orders by Hour of Day"
        _append_visual(build_hour_of_day_visual(dataframe, derived_val, derived_agg, hod_title))

    # --- Diversity-aware heuristic fill for remaining slots ---
    value_metric = pick_value_metric()
    _metric_index = [0]

    def next_metric() -> Optional[ColumnProfile]:
        if not numeric_cols:
            return None
        col = numeric_cols[_metric_index[0] % len(numeric_cols)]
        _metric_index[0] += 1
        return col

    used_categories: set[str] = set()
    for existing_vis in visuals:
        if existing_vis.x and existing_vis.type in {"bar", "pie"}:
            used_categories.add(existing_vis.x)

    # Line charts (time-series trends) — fill if needed
    if time_col and needs_type("line"):
        date_col = time_col.name
        _append_visual(build_line_visual(dataframe, date_col, None, "count"))
        if value_metric and needs_type("line"):
            aggregation = preferred_aggregation(value_metric.name)
            _append_visual(build_line_visual(dataframe, date_col, value_metric.name, aggregation))
        # Additional line charts with rotated metrics
        for _ in range(2):
            if not needs_type("line"):
                break
            m = next_metric()
            if m and m.name != (value_metric.name if value_metric else ""):
                agg = preferred_aggregation(m.name)
                _append_visual(build_line_visual(dataframe, date_col, m.name, agg))

    # Pie chart (segmentation) — fill if needed
    if needs_type("pie"):
        segmentation_cat = pick_segmentation_category(used_categories)
        if segmentation_cat:
            used_categories.add(segmentation_cat.name)
            pie_metric = value_metric
            _append_visual(
                build_bar_or_pie_visual(
                    dataframe,
                    category_col=segmentation_cat.name,
                    value_col=pie_metric.name if pie_metric else None,
                    aggregation=preferred_aggregation(pie_metric.name) if pie_metric else "count",
                    chart_type="pie",
                )
            )

    # Bar charts (comparisons) — fill if needed
    while needs_type("bar") and len(visuals) < max_visuals:
        cat = pick_driver_category(used_categories) or pick_segmentation_category(used_categories)
        if not cat:
            break
        used_categories.add(cat.name)
        m = next_metric()
        _append_visual(
            build_bar_or_pie_visual(
                dataframe,
                category_col=cat.name,
                value_col=m.name if m else None,
                aggregation=preferred_aggregation(m.name) if m else "count",
                chart_type="bar",
            )
        )

    # Histogram (distribution) — fill if needed
    if needs_type("histogram") and numeric_cols:
        for m in numeric_cols:
            if not needs_type("histogram"):
                break
            _append_visual(build_histogram_visual(dataframe, m.name))

    # Scatter (correlation) — fill if needed
    if needs_type("scatter") and len(numeric_cols) >= 2:
        for i, m1 in enumerate(numeric_cols):
            if not needs_type("scatter"):
                break
            for m2 in numeric_cols[i + 1:]:
                if not needs_type("scatter"):
                    break
                _append_visual(build_scatter_visual(dataframe, m1.name, m2.name))

    # Summary table — fill if needed
    if needs_type("table"):
        for cat_col in categorical_cols:
            unique, _ = column_cardinality(cat_col, row_count)
            if unique >= 5:
                agg = preferred_aggregation(value_metric.name) if value_metric else "count"
                val = value_metric.name if value_metric else None
                _append_visual(build_summary_table_visual(dataframe, cat_col.name, val, agg))
                break

    # Geographic
    lat_col, lon_col = find_lat_lon_columns(profile)
    if lat_col and lon_col:
        label_col = None
        for col in categorical_cols:
            unique, _ = column_cardinality(col, row_count)
            if 2 <= unique <= 50:
                label_col = col.name
                break
        _append_visual(
            build_map_visual(
                dataframe,
                lat_col=lat_col.name,
                lon_col=lon_col.name,
                label_col=label_col,
                value_col=value_metric.name if value_metric else None,
            )
        )

    # Final fill: rotate through under-represented types
    fill_types = ["line", "pie", "histogram", "scatter", "bar"]
    for ftype in fill_types:
        if len(visuals) >= max_visuals:
            break
        if not needs_type(ftype):
            continue
        if ftype == "line" and time_col:
            m = next_metric()
            if m:
                _append_visual(build_line_visual(dataframe, time_col.name, m.name, preferred_aggregation(m.name)))
        elif ftype == "pie":
            for cat in categorical_cols:
                if cat.name in used_categories:
                    continue
                unique, _ = column_cardinality(cat, row_count)
                if 2 <= unique <= PIE_CATEGORY_LIMIT:
                    used_categories.add(cat.name)
                    _append_visual(build_bar_or_pie_visual(dataframe, cat.name, None, "count", "pie"))
                    break
        elif ftype == "histogram":
            m = next_metric()
            if m:
                _append_visual(build_histogram_visual(dataframe, m.name))
        elif ftype == "scatter" and len(numeric_cols) >= 2:
            m1, m2 = numeric_cols[0], numeric_cols[1]
            _append_visual(build_scatter_visual(dataframe, m1.name, m2.name))
        elif ftype == "bar":
            cat = pick_driver_category(used_categories) or pick_segmentation_category(used_categories)
            if cat:
                used_categories.add(cat.name)
                m = next_metric()
                _append_visual(build_bar_or_pie_visual(dataframe, cat.name, m.name if m else None,
                                                        preferred_aggregation(m.name) if m else "count", "bar"))

    return visuals


def build_requested_visual_spec(
    profile: FileProfile,
    business_context: Optional[dict] = None,
) -> Optional[VisualSpec]:
    if not llm_service.enabled or not business_context:
        return None

    primary_question = str(business_context.get("primary_question") or "").strip()
    if not primary_question:
        return None

    profile_data = {"files": [profile.model_dump(mode="json")]}
    spec_dict = generate_visual_spec_from_request(
        profile_data=profile_data,
        user_request=primary_question,
        history=None,
    )
    if not spec_dict:
        return None

    visual_type = str(spec_dict.get("type", "")).lower()
    if visual_type not in ALLOWED_TYPES:
        return None

    aggregation = spec_dict.get("aggregation")
    if aggregation and aggregation not in AGGREGATIONS:
        aggregation = None

    title = str(spec_dict.get("title") or "Requested Analysis")
    return VisualSpec(
        visual_id=build_visual_id(visual_type),
        type=visual_type,
        title=title,
        x=spec_dict.get("x"),
        y=spec_dict.get("y"),
        values=spec_dict.get("values"),
        aggregation=aggregation,
    )


def generate_requested_visual(
    profile: FileProfile,
    dataframe: pd.DataFrame,
    business_context: Optional[dict] = None,
) -> Optional[VisualSpec]:
    requested_spec = build_requested_visual_spec(profile, business_context)
    if not requested_spec:
        return None
    visual = apply_data_to_spec(requested_spec, dataframe)
    if not visual or not visual.data:
        return None
    return visual


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

    # Build rich context from AI chat insights
    context_parts = []
    if business_context:
        if business_context.get("primary_question"):
            context_parts.append(f"User's primary question: {business_context['primary_question']}")
        if business_context.get("analysis_areas"):
            areas = business_context["analysis_areas"]
            area_strs = [f"- {a.get('area', '?')}: {a.get('description', '')}" for a in areas if isinstance(a, dict)]
            if area_strs:
                context_parts.append("Requested analysis areas:\n" + "\n".join(area_strs))
        if business_context.get("goals"):
            context_parts.append("Analysis goals: " + "; ".join(business_context["goals"]))
        if business_context.get("key_metrics"):
            context_parts.append("Key metrics to track: " + ", ".join(business_context["key_metrics"]))
        if business_context.get("segments"):
            context_parts.append("Segmentation columns: " + ", ".join(business_context["segments"]))
        if business_context.get("time_column"):
            context_parts.append(f"Time column: {business_context['time_column']}")
        if not context_parts:
            context_parts.append(f"Business context: {business_context}")
    context_str = "\n".join(context_parts)

    system_prompt = (
        "You are an expert data analyst designing a DIVERSE, ACTIONABLE dashboard. "
        "CRITICAL RULE: You MUST use a VARIETY of chart types. "
        "Do NOT generate all bar charts — that makes the dashboard look monotonous.\n\n"
        "MANDATORY chart type distribution:\n"
        "- 2-3 LINE charts (time-series trends — use datetime columns for x-axis)\n"
        "- 1-2 BAR charts (comparisons, rankings)\n"
        "- 1 PIE chart (proportions/shares — use low-cardinality categorical column)\n"
        "- 1 HISTOGRAM (value distribution — use a numeric column in 'values' field)\n"
        "- 1 SCATTER plot (correlation between two numeric columns)\n"
        "- 0-1 TABLE (summary/leaderboard for high-cardinality data)\n\n"
        "Each visual MUST answer a DIFFERENT business question and cover different analysis dimensions: "
        "trends over time, segmentation, top/bottom performers, distributions, correlations.\n\n"
        "Return JSON with a 'visuals' array. Each visual must have: "
        "type (one of: bar, line, pie, scatter, histogram, table), "
        "title (descriptive, business-friendly — should tell the user what insight they get), "
        "x (column name for x-axis/category — for line charts use a datetime column), "
        "y (column name for y-axis/value — for scatter use second numeric column), "
        "values (column name for pie values or histogram distribution), "
        "aggregation (one of: count, sum, mean, median). "
        "ONLY use column names from the provided list. "
        "For HISTOGRAM: set type='histogram', put the numeric column in 'values', set aggregation='count'. "
        "For SCATTER: set type='scatter', put one numeric column in 'x', another in 'y'."
    )
    user_prompt = (
        f"Business category: {category_label}\n"
        f"Row count: {profile.row_count}\n"
        f"Columns: {col_info}\n"
    )
    if context_str:
        user_prompt += f"\n{context_str}\n"
    user_prompt += (
        f"\nPropose up to {max_visuals} visuals. "
        "Make sure they cover at least 4 different analysis angles. "
        "Do NOT make more than 2 visuals about the same topic."
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

    # --- AI / heuristic derived columns (date diffs, ratios, extractions) ---
    smart_derivations = suggest_derived_columns(profile)
    if smart_derivations:
        from app.services.ingestion import profile_series as _profile_series
        dataframe, added_cols = apply_derived_columns(dataframe, smart_derivations)
        if added_cols:
            derived_profile = profile.model_copy()
            for col_name in added_cols:
                if col_name in dataframe.columns and not any(c.name == col_name for c in derived_profile.columns):
                    cp = _profile_series(dataframe[col_name])
                    derived_profile.columns.append(cp)
            derived_profile.column_count = len(derived_profile.columns)
            profile = derived_profile
            numeric_cols = rank_numeric_columns(profile)
            categorical_cols = rank_categorical_columns(profile)
            datetime_cols = rank_datetime_columns(profile)

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

    requested_spec = build_requested_visual_spec(profile, business_context)
    if requested_spec:
        add_spec(requested_spec)

    if max_pool > 0:
        context_llm_specs = llm_dashboard_plan(
            profile,
            business_category=business_category,
            business_context=business_context,
            max_visuals=min(max_pool, 8),
        )
        for llm_spec in context_llm_specs:
            add_spec(llm_spec)

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

    # Line charts: every numeric × datetime (preferred aggregation only)
    for dt_col in datetime_cols:
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

    # Bar charts for time-series data (to pair against line charts in duel)
    for dt_col in datetime_cols:
        for metric in numeric_cols[:3]:
            agg = preferred_aggregation(metric.name)
            add_spec(VisualSpec(
                visual_id=build_visual_id("bar"),
                type="bar",
                title=f"{aggregation_title(agg)} {format_col_title(metric.name)} over {format_col_title(dt_col.name)}",
                x=dt_col.name,
                y=metric.name,
                aggregation=agg,
            ))

    # Bar charts: limit to top 3 categoricals × top 2 numerics (avoid bar explosion)
    bar_cats = categorical_cols[:3]
    bar_metrics = numeric_cols[:2]
    for cat in bar_cats:
        unique, _ = column_cardinality(cat, row_count)
        if unique > BAR_CATEGORY_LIMIT * 3:
            continue
        add_spec(VisualSpec(
            visual_id=build_visual_id("bar"),
            type="bar",
            title=f"Count by {format_col_title(cat.name)}",
            x=cat.name,
            aggregation="count",
        ))
        for metric in bar_metrics:
            agg = preferred_aggregation(metric.name)
            add_spec(VisualSpec(
                visual_id=build_visual_id("bar"),
                type="bar",
                title=f"{aggregation_title(agg)} {format_col_title(metric.name)} by {format_col_title(cat.name)}",
                x=cat.name,
                y=metric.name,
                aggregation=agg,
            ))

    # Pie charts: low-cardinality categoricals (with value-based variants)
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
        for metric in numeric_cols:
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
        try:
            visual = apply_data_to_spec(spec, dataframe)
        except Exception:
            continue
        if visual and visual.data:
            pool.append(visual)

    # Minimum-pool guarantee: if pool is too small, add extra fallbacks
    MIN_POOL_SIZE = 6
    if len(pool) < MIN_POOL_SIZE:
        pool_sigs = {visual_signature(v) for v in pool}
        for metric in numeric_cols:
            if len(pool) >= MIN_POOL_SIZE:
                break
            vis = build_histogram_visual(dataframe, metric.name)
            if vis and visual_signature(vis) not in pool_sigs:
                pool.append(vis)
                pool_sigs.add(visual_signature(vis))
        for i, m1 in enumerate(numeric_cols):
            if len(pool) >= MIN_POOL_SIZE:
                break
            for m2 in numeric_cols[i + 1:]:
                if len(pool) >= MIN_POOL_SIZE:
                    break
                vis = build_scatter_visual(dataframe, m1.name, m2.name)
                if vis and visual_signature(vis) not in pool_sigs:
                    pool.append(vis)
                    pool_sigs.add(visual_signature(vis))

    # --- Type-balanced pool selection ---
    # Prevent any single type from dominating the duel pool
    from collections import defaultdict as _dd
    type_buckets: dict[str, list[VisualSpec]] = _dd(list)
    for v in pool:
        type_buckets[v.type].append(v)

    # Round-robin across types to build a balanced pool
    balanced: list[VisualSpec] = []
    type_order = ["line", "pie", "histogram", "scatter", "bar", "table"]
    active_types = [t for t in type_order if t in type_buckets]
    # Also include types not in the predefined order
    for t in type_buckets:
        if t not in active_types:
            active_types.append(t)
    max_per_type = max(max_pool // max(len(active_types), 1), 2)
    indices = {t: 0 for t in active_types}
    while len(balanced) < max_pool:
        added_any = False
        for t in active_types:
            if indices[t] < len(type_buckets[t]) and indices[t] < max_per_type:
                balanced.append(type_buckets[t][indices[t]])
                indices[t] += 1
                added_any = True
                if len(balanced) >= max_pool:
                    break
        if not added_any:
            break

    return kpis, balanced


def _visual_col_key(v: VisualSpec) -> str:
    """Return a string key representing the column combination of a visual."""
    return f"{v.type}|{v.x or ''}|{v.y or ''}|{v.values or ''}"


def _visual_data_key(v: VisualSpec) -> str:
    """Return a key representing the DATA a visual shows (ignoring chart type)."""
    return f"{v.x or ''}|{v.y or ''}|{v.values or ''}|{v.aggregation or ''}"


def _build_round_label(a: VisualSpec, b: VisualSpec) -> str:
    """Generate a human-readable label explaining what this duel round is about."""
    # If same columns, different type — user is choosing visual style
    metric_a = a.y or a.values or ""
    metric_b = b.y or b.values or ""
    same_cols = (a.x == b.x) and (metric_a == metric_b) and a.type != b.type

    if same_cols and a.x:
        col_name = format_col_title(a.x)
        if metric_a:
            metric_name = format_col_title(metric_a)
            return f"{metric_name} by {col_name} — pick your preferred chart style"
        return f"{col_name} analysis — pick your preferred chart style"
    elif a.x and a.x == b.x and a.type != b.type:
        col_name = format_col_title(a.x)
        return f"{col_name} — which visualization works better?"
    else:
        # Different columns — user is picking between different insights
        parts = []
        if a.title:
            parts.append(a.title)
        if b.title and b.title != a.title:
            parts.append(b.title)
        if len(parts) == 2:
            return f"Which insight is more useful?"
        return ""


def pair_candidates(
    pool: list[VisualSpec],
    max_rounds: int = 7,
    analysis_areas: Optional[list[dict]] = None,
) -> list[dict]:
    """Arrange pool visuals into duel pairs.

    Strategy: show the SAME data in DIFFERENT chart styles so the user picks
    their preferred visual representation for each insight.

    1. Pair visuals that use the SAME columns but DIFFERENT chart types.
    2. Pair visuals that use similar columns (same x) but different type/agg.
    3. Fall back to different-column pairs for remaining slots.
    """
    if len(pool) < 2:
        return [{"round": 1, "option_a": pool[0], "option_b": pool[0], "round_label": ""}] if pool else []

    pairs: list[dict] = []
    used: set[int] = set()

    # Pass 1 (PRIORITY): same columns, different chart type
    # Group by data columns (x, y/values) ignoring chart type
    # Normalize: pie uses 'values' where bar uses 'y', treat them as equivalent
    from collections import defaultdict
    col_groups: dict[str, list[int]] = defaultdict(list)
    for i, v in enumerate(pool):
        metric_col = v.y or v.values or ""
        key = f"{v.x or ''}|{metric_col}"
        col_groups[key].append(i)

    for key, indices in col_groups.items():
        if len(pairs) >= max_rounds:
            break
        if len(indices) < 2:
            continue
        # Find pairs with different types within this group
        for ii in range(len(indices)):
            if len(pairs) >= max_rounds:
                break
            idx_a = indices[ii]
            if idx_a in used:
                continue
            for jj in range(ii + 1, len(indices)):
                idx_b = indices[jj]
                if idx_b in used:
                    continue
                a, b = pool[idx_a], pool[idx_b]
                if a.type != b.type:
                    label = _build_round_label(a, b)
                    pairs.append({"round": len(pairs) + 1, "option_a": a, "option_b": b, "round_label": label})
                    used.update([idx_a, idx_b])
                    break

    # Pass 2: same x-column, different type (looser match - y/values may differ)
    for i in range(len(pool)):
        if i in used or len(pairs) >= max_rounds:
            continue
        for j in range(i + 1, len(pool)):
            if j in used:
                continue
            a, b = pool[i], pool[j]
            same_x = a.x and a.x == b.x
            if same_x and a.type != b.type:
                label = _build_round_label(a, b)
                pairs.append({"round": len(pairs) + 1, "option_a": a, "option_b": b, "round_label": label})
                used.update([i, j])
                break

    # Pass 3: pair any remaining unpaired visuals (different data perspectives)
    remaining = [i for i in range(len(pool)) if i not in used]
    for k in range(0, len(remaining) - 1, 2):
        if len(pairs) >= max_rounds:
            break
        i, j = remaining[k], remaining[k + 1]
        a, b = pool[i], pool[j]
        label = _build_round_label(a, b)
        pairs.append({"round": len(pairs) + 1, "option_a": a, "option_b": b, "round_label": label})

    if len(remaining) % 2 == 1 and len(pairs) < max_rounds:
        last = remaining[-1]
        pairs.append({"round": len(pairs) + 1, "option_a": pool[last], "option_b": pool[last], "round_label": ""})

    for idx, pair in enumerate(pairs[:max_rounds]):
        pair["round"] = idx + 1

    return pairs[:max_rounds]


def rebuild_visual_data(
    visual: VisualSpec,
    dataframe: pd.DataFrame,
) -> VisualSpec:
    """Re-compute the data for a single visual from a (possibly filtered) dataframe.

    Returns a new VisualSpec with updated data but the same layout/config.
    """
    vtype = visual.type
    try:
        if vtype == "kpi":
            # Re-compute KPI from filtered data
            config = visual.config or {}
            subtitle = config.get("subtitle", "")
            is_currency = config.get("is_currency", False)
            # Try to find the relevant column for this KPI
            y_col = visual.y or visual.values or subtitle
            if y_col and y_col in dataframe.columns:
                series = pd.to_numeric(dataframe[y_col], errors="coerce").dropna()
                agg = visual.aggregation or "sum"
                value = compute_kpi_value(series, agg)
                if value is not None:
                    return visual.model_copy(update={"data": [{"value": to_serializable(value)}]})
            # Special KPIs like "Total records" or "Date Range"
            title_lower = visual.title.lower()
            if "total record" in title_lower or "row count" in title_lower:
                return visual.model_copy(update={"data": [{"value": len(dataframe)}]})
            if "date range" in title_lower:
                dt_cols = [c for c in dataframe.columns
                           if pd.api.types.is_datetime64_any_dtype(dataframe[c])]
                if not dt_cols:
                    # Try parsing
                    for c in dataframe.columns:
                        if any(h in c.lower() for h in TIME_HINTS):
                            try:
                                dataframe[c] = pd.to_datetime(dataframe[c], errors="coerce", format="mixed")
                                if dataframe[c].notna().sum() > 0:
                                    dt_cols.append(c)
                                    break
                            except Exception:
                                pass
                if dt_cols:
                    s = dataframe[dt_cols[0]].dropna()
                    if not s.empty:
                        mn = s.min()
                        mx = s.max()
                        fmt = lambda d: pd.Timestamp(d).strftime("%b %d, %Y")
                        return visual.model_copy(update={"data": [{"value": f"{fmt(mn)} – {fmt(mx)}"}]})
            return visual  # Can't recompute, return as-is

        elif vtype in ("bar", "pie"):
            cat_col = visual.x
            val_col = visual.y or visual.values
            agg = visual.aggregation or "count"
            if cat_col and cat_col in dataframe.columns:
                rebuilt = build_bar_or_pie_visual(dataframe, cat_col, val_col, agg, vtype)
                if rebuilt:
                    return visual.model_copy(update={"data": rebuilt.data})
            return visual

        elif vtype == "line":
            dt_col = visual.x
            val_col = visual.y
            agg = visual.aggregation or "mean"
            if dt_col and dt_col in dataframe.columns:
                rebuilt = build_line_visual(dataframe, dt_col, val_col, agg)
                if rebuilt:
                    return visual.model_copy(update={"data": rebuilt.data})
            return visual

        elif vtype == "scatter":
            x_col = visual.x
            y_col = visual.y
            if x_col and y_col and x_col in dataframe.columns and y_col in dataframe.columns:
                rebuilt = build_scatter_visual(dataframe, x_col, y_col)
                if rebuilt:
                    return visual.model_copy(update={"data": rebuilt.data})
            return visual

        elif vtype == "histogram":
            col = visual.values or visual.x
            if col and col in dataframe.columns:
                rebuilt = build_histogram_visual(dataframe, col)
                if rebuilt:
                    return visual.model_copy(update={"data": rebuilt.data})
            return visual

        elif vtype == "table":
            config = visual.config or {}
            cols = config.get("columns")
            if config.get("table_type") == "summary":
                cat = config.get("category") or visual.x
                val = config.get("value") or visual.values
                agg = config.get("aggregation") or visual.aggregation or "count"
                if cat and cat in dataframe.columns:
                    rebuilt = build_summary_table_visual(dataframe, cat, val, agg)
                    if rebuilt:
                        return visual.model_copy(update={"data": rebuilt.data})
            else:
                rebuilt = build_table_visual(dataframe, cols)
                if rebuilt:
                    return visual.model_copy(update={"data": rebuilt.data})
            return visual

    except Exception:
        pass
    return visual


def rebuild_all_visuals(
    visuals: list[VisualSpec],
    dataframe: pd.DataFrame,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    column_filters: Optional[list[dict]] = None,
) -> list[VisualSpec]:
    """Re-compute data for all visuals after applying date/column filters to the dataframe."""
    df = dataframe.copy()

    # Apply date filter
    if date_start or date_end:
        dt_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
        if not dt_cols:
            for c in df.columns:
                if any(h in c.lower() for h in TIME_HINTS):
                    try:
                        df[c] = pd.to_datetime(df[c], errors="coerce", format="mixed")
                        if df[c].notna().sum() > 0:
                            dt_cols.append(c)
                            break
                    except Exception:
                        pass
        if dt_cols:
            date_col = dt_cols[0]
            if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
                df[date_col] = pd.to_datetime(df[date_col], errors="coerce", format="mixed")
            if date_start:
                df = df[df[date_col] >= pd.Timestamp(date_start)]
            if date_end:
                df = df[df[date_col] <= pd.Timestamp(date_end)]

    # Apply column-value filters
    if column_filters:
        for filt in column_filters:
            col = filt.get("column")
            val = filt.get("value")
            if col and val is not None and col in df.columns:
                df = df[df[col].astype(str) == str(val)]

    if df.empty:
        return visuals  # Return originals if filtering removed all data

    return [rebuild_visual_data(v, df) for v in visuals]
