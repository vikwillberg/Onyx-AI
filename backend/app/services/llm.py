import json
import logging
from typing import Any, Optional

import httpx
from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


class _LLMProvider:
    """Holds connection info for a single LLM provider."""
    def __init__(self, client: OpenAI, model: str, name: str, json_mode: bool = True):
        self.client = client
        self.model = model
        self.name = name
        self.json_mode = json_mode


class LLMService:
    def __init__(self) -> None:
        self._providers: list[_LLMProvider] = []
        self._active: int = 0

        # Use a custom httpx client with SSL verification disabled for corporate networks
        _http = httpx.Client(verify=False)

        if settings.gemini_api_key:
            self._providers.append(_LLMProvider(
                client=OpenAI(api_key=settings.gemini_api_key, base_url=GEMINI_BASE_URL, http_client=_http),
                model=settings.gemini_model,
                name="gemini",
                json_mode=False,
            ))
            logger.info("LLM: registered Google Gemini with model %s", settings.gemini_model)
        if settings.groq_api_key:
            self._providers.append(_LLMProvider(
                client=OpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL, http_client=_http),
                model=settings.groq_model,
                name="groq",
            ))
            logger.info("LLM: registered Groq with model %s", settings.groq_model)
        if settings.openai_api_key:
            base = settings.openai_base_url or None
            kw = {"api_key": settings.openai_api_key, "http_client": _http}
            if base:
                kw["base_url"] = base
            self._providers.append(_LLMProvider(
                client=OpenAI(**kw),
                model=settings.openai_model,
                name="openai",
            ))
            logger.info("LLM: registered OpenAI with model %s", settings.openai_model)
        elif settings.openai_base_url:
            self._providers.append(_LLMProvider(
                client=OpenAI(api_key="local", base_url=settings.openai_base_url, http_client=_http),
                model=settings.openai_model,
                name="local",
            ))
            logger.info("LLM: registered local endpoint %s", settings.openai_base_url)

        if self._providers:
            logger.info("LLM: primary provider is %s (with %d fallbacks)", self._providers[0].name, len(self._providers) - 1)
        else:
            logger.info("LLM: no API key configured — AI features disabled")

    def _current(self) -> Optional[_LLMProvider]:
        if not self._providers:
            return None
        return self._providers[self._active % len(self._providers)]

    @property
    def _client(self) -> Optional[OpenAI]:
        p = self._current()
        return p.client if p else None

    @property
    def _model(self) -> str:
        p = self._current()
        return p.model if p else ""

    @property
    def _supports_json_mode(self) -> bool:
        p = self._current()
        return p.json_mode if p else True

    @property
    def enabled(self) -> bool:
        return len(self._providers) > 0

    @property
    def provider(self) -> str:
        p = self._current()
        return p.name if p else "none"

    @staticmethod
    def _strip_fences(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return text

    def request_json(self, system_prompt: str, user_prompt: str, max_tokens: int = 1200) -> Optional[dict[str, Any]]:
        for idx, prov in enumerate(self._providers):
            try:
                sys_content = system_prompt
                if not prov.json_mode:
                    sys_content += "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code fences, no extra text."
                kwargs: dict[str, Any] = dict(
                    model=prov.model,
                    temperature=0.2,
                    messages=[
                        {"role": "system", "content": sys_content},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                )
                if prov.json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                response = prov.client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if not content:
                    continue
                self._active = idx
                return json.loads(self._strip_fences(content))
            except Exception as exc:
                logger.warning("LLM request_json failed (%s): %s — trying fallback", prov.name, exc)
                continue
        return None

    def chat(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 800,
        temperature: float = 0.4,
    ) -> Optional[str]:
        """Multi-turn chat completion (plain text). Tries all providers with auto-fallback."""
        for idx, prov in enumerate(self._providers):
            try:
                response = prov.client.chat.completions.create(
                    model=prov.model,
                    temperature=temperature,
                    messages=messages,
                    max_tokens=max_tokens,
                )
                result = response.choices[0].message.content or None
                if result:
                    self._active = idx
                return result
            except Exception as exc:
                logger.warning("LLM chat failed (%s): %s — trying fallback", prov.name, exc)
                continue
        return None

    def chat_json(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1200,
        temperature: float = 0.2,
    ) -> Optional[dict[str, Any]]:
        """Multi-turn chat completion with JSON response. Tries all providers with auto-fallback."""
        for idx, prov in enumerate(self._providers):
            try:
                msgs = list(messages)
                if not prov.json_mode and msgs:
                    msgs[0] = dict(msgs[0])
                    msgs[0]["content"] = msgs[0]["content"] + "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code fences, no extra text."
                kwargs: dict[str, Any] = dict(
                    model=prov.model,
                    temperature=temperature,
                    messages=msgs,
                    max_tokens=max_tokens,
                )
                if prov.json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                response = prov.client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if not content:
                    continue
                self._active = idx
                return json.loads(self._strip_fences(content))
            except Exception as exc:
                logger.warning("LLM chat_json failed (%s): %s — trying fallback", prov.name, exc)
                continue
        return None


llm_service = LLMService()


DATA_ANALYST_SYSTEM = """\
You are ONYX, a sharp AI business analyst obsessed with finding ways to grow revenue and cut waste. The user uploaded a dataset and you can see its column profiles below.

Your role is to DIG INTO the data like a curious consultant who genuinely wants to help this business make more money.

MINDSET:
- You are a profit-obsessed detective. Every column is a clue.
- Spot hidden revenue leaks, untapped segments, pricing gaps, underperformers worth cutting, and timing patterns worth exploiting.
- Each conversation should feel DIFFERENT. Vary your opening angle — sometimes lead with a surprising anomaly, sometimes with a revenue opportunity, sometimes with a cost concern, sometimes with a customer behavior pattern.
- Do NOT follow a predictable script. React to what's actually interesting in THIS specific dataset.

FIRST MESSAGE GUIDELINES:
- Write a short, conversational paragraph (NOT bullet lists). Max 80 words.
- Pick ONE genuinely interesting angle from the data (rotate between: a surprising number, a potential revenue opportunity, a cost red flag, a timing pattern, or an underperforming segment). Do NOT always pick the same type of observation.
- Weave in 1-2 specific numbers from the profile.
- End with a pointed question that pushes toward a sales/profit insight — NOT a generic "any questions?" but something like "Want me to dig into why X underperforms?" or "Should we figure out what's driving that gap?"

CONVERSATION BEHAVIOR:
- If column names are ambiguous (single letters, codes like "qty", "amt"), ask what they mean before assuming.
- Think independently. Don't wait for the user to tell you what to analyze — propose angles they haven't thought of. Challenge assumptions.
- Vary your follow-up questions: ask about seasonality one time, product mix another, customer segments another, pricing strategy another. Never ask the same style of question twice in a row.
- When the user agrees or says "go ahead", say "I have what I need." and list the dashboard plan.
- If the user says "yes" or "looks good", proceed to finalize. Do NOT rush to finalize — ask at least one probing question first unless the user explicitly asks you to build.

FINAL MESSAGE: Always include "I have what I need." then list the dashboard plan as a numbered list.

FORMATTING RULES:
- First message: conversational paragraph, NO bullet lists
- Later messages: bullet points and numbered lists are fine
- Use **bold** for key numbers and terms
- Keep sentences short. Max 120 words per reply.

ANALYSIS FOCUS (always prioritize these):
- What drives the MOST revenue? What drives the LEAST?
- Where is money being left on the table?
- What time patterns (day, hour, season) can be exploited?
- Which segments or products should be promoted, bundled, or dropped?
- What would you tell the owner to do THIS WEEK to increase profit?

DATA PROFILE:
{profile_summary}
{dictionary_section}"""


INSIGHT_EXTRACTION_SYSTEM = """\
You are a senior data analyst. Given the conversation between a user and an AI analyst about a dataset, extract structured insights that will drive a DIVERSE, ACTIONABLE dashboard.

CRITICAL: If the user asked a specific question (e.g. "Show me subscription cost trends over time"), that question MUST be captured EXACTLY in "primary_question" and MUST be the FIRST item in "analysis_areas". The dashboard will prioritize this.

Return JSON with:
{
  "data_description": "one-line description of what this data is about",
  "key_metrics": ["list of ALL numeric column names worth tracking as KPIs"],
  "segments": ["list of ALL categorical column names useful for grouping/comparison"],
  "time_column": "name of the main date/time column or null",
  "primary_question": "the EXACT specific question or request the user made — copy their words as closely as possible",
  "analysis_areas": [
    {
      "area": "short name like 'Product Performance' or 'Revenue Trends'",
      "description": "what this analysis shows and why it matters",
      "suggested_chart_types": ["bar", "line", etc],
      "columns_involved": ["col1", "col2"]
    }
  ],
  "goals": ["list of 4-6 diverse analysis goals — user's specific question FIRST, then broader insights"],
  "business_category": "best category: ecommerce, saas, finance, healthcare, marketing, hr, logistics, restaurant, retail, education, general"
}

RULES:
- primary_question: Extract the user's EXACT request. If they said "Show me X trends over time", write exactly that. Do NOT generalize or rephrase it.
- analysis_areas[0]: MUST directly address the user's primary_question.
- analysis_areas MUST contain at least 4 different areas (e.g., trends, comparisons, distributions, top performers).
- goals MUST include the user's specific question PLUS broader business insights.
- key_metrics should include ALL numeric columns that represent money, counts, or quantities.
- segments should include ALL categorical columns useful for slicing data.
- Only use column names that actually exist in the dataset.
"""


def build_profile_summary(profile_data: dict, dictionary_data: dict | None = None) -> str:
    """Build a human-readable summary of a dataset profile for the LLM system prompt."""
    # Build column descriptions lookup from dictionary
    col_descs: dict[str, str] = {}
    if dictionary_data and dictionary_data.get("columns"):
        for k, v in dictionary_data["columns"].items():
            col_descs[k.lower().strip()] = v

    lines = []
    files = profile_data.get("files", [])
    for f in files:
        lines.append(f"File: {f.get('name', '?')} — {f.get('row_count', '?')} rows, {f.get('column_count', '?')} columns")
        for col in f.get("columns", []):
            parts = [f"  {col['name']} ({col['inferred_type']})"]
            # Add dictionary description if available
            desc = col_descs.get(col['name'].lower().strip())
            if desc:
                parts.append(f'desc="{desc}"')
            if col.get("unique_count"):
                parts.append(f"unique={col['unique_count']}")
            if col.get("min_value") is not None:
                parts.append(f"min={col['min_value']}")
            if col.get("max_value") is not None:
                parts.append(f"max={col['max_value']}")
            if col.get("sample_values"):
                parts.append(f"samples={col['sample_values'][:3]}")
            lines.append(", ".join(parts))
    return "\n".join(lines)


def build_dictionary_section(dictionary_data: dict | None) -> str:
    """Build a section describing the data dictionary for the system prompt."""
    if not dictionary_data:
        return ""
    parts = []
    if dictionary_data.get("columns"):
        parts.append("\nDATA DICTIONARY (column definitions from uploaded dictionary file):")
        for col_name, col_desc in dictionary_data["columns"].items():
            parts.append(f"  {col_name}: {col_desc}")
    if dictionary_data.get("raw_text"):
        parts.append("\nDATA DICTIONARY (raw content from uploaded dictionary file):")
        parts.append(dictionary_data["raw_text"][:2000])
    return "\n".join(parts) if parts else ""


def analyze_data_chat(
    profile_data: dict,
    user_message: str,
    history: list[dict[str, str]],
    dictionary_data: dict | None = None,
) -> tuple[str, bool, Optional[dict]]:
    """Run one turn of the data analysis conversation.

    Returns (reply_text, is_done, insights_dict_or_none).
    """
    if not llm_service.enabled:
        return (
            "AI chat is not configured yet (missing GROQ/OpenAI/Gemini API key). "
            "You can still click Start Generating to build a dashboard from your uploaded data.",
            True,
            None,
        )

    profile_summary = build_profile_summary(profile_data, dictionary_data)
    dictionary_section = build_dictionary_section(dictionary_data)
    system = DATA_ANALYST_SYSTEM.format(profile_summary=profile_summary, dictionary_section=dictionary_section)

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    reply = llm_service.chat(messages, max_tokens=600, temperature=0.6)
    if not reply:
        return "I'm having trouble connecting right now. Please try again.", False, None

    # Check if the AI thinks it has enough info
    # Count only real user messages (exclude the initial auto-greeting)
    real_user_count = sum(
        1 for m in messages
        if m["role"] == "user" and "just uploaded" not in m.get("content", "").lower()
    )
    done_signals = ["i have what i need", "have enough", "let me build", "let's build",
                    "i'll create", "ready to build", "generating", "let me generate",
                    "let me create", "i'll design", "dashboard will cover",
                    "here's the plan", "here is the plan", "i'll now create",
                    "let me put together", "i'll put together"]
    is_done = real_user_count >= 1 and any(sig in reply.lower() for sig in done_signals)

    insights = None
    if is_done:
        # Extract structured insights from the conversation
        extract_messages = [
            {"role": "system", "content": INSIGHT_EXTRACTION_SYSTEM},
            {"role": "user", "content": (
                f"Dataset profile:\n{profile_summary}\n\n"
                f"Conversation:\n" +
                "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages[1:]) +
                f"\nUSER: {user_message}\nASSISTANT: {reply}"
            )},
        ]
        insights = llm_service.chat_json(extract_messages, max_tokens=1200)

    return reply, is_done, insights


DASHBOARD_INSIGHTS_SYSTEM = """\
You are a senior business consultant. Given a dataset profile and business context, generate exactly 8 high-impact insights that help the owner GROW REVENUE and REDUCE COSTS.

Rules:
- Each insight is a JSON object with "text" (the insight sentence) and "category" (one of: "trend", "comparison", "anomaly", "recommendation", "distribution").
- Each insight text must be ONE sentence, maximum 25 words.
- Reference ONE specific number or comparison per insight (e.g. "$1,234", "23%", "Tuesday").
- Focus on ACTIONABLE findings — what can the business owner DO about it?
- Use HTML <strong> tags around the single most important number or term in the text.
- Do NOT repeat similar insights. Each must cover a different angle and ideally a different category.
- At least 2 insights MUST be "recommendation" category with specific actions the owner can take THIS WEEK.

Category guide:
- "trend": patterns over time or growth/decline
- "comparison": differences between groups or categories
- "anomaly": unusual or unexpected values
- "recommendation": actionable business suggestion (promote X, stock up on Y, staff up on Z day)
- "distribution": data spread, concentration, or composition

Example:
{"insights": [
  {"text": "<strong>Tuesday</strong> generates $1,123 avg daily sales — 23% above weekly average", "category": "trend"},
  {"text": "<strong>Pepperoni 18\\"</strong> has 42% profit margin but ranks only 5th in popularity", "category": "anomaly"},
  {"text": "Orders spike <strong>3x</strong> between 11am-1pm on weekdays", "category": "comparison"},
  {"text": "Top 3 products account for <strong>68%</strong> of total revenue", "category": "distribution"},
  {"text": "Promote <strong>Gift Cards</strong> more — highest margin at 35% but lowest sales volume", "category": "recommendation"},
  {"text": "Bundle <strong>USB-C cables</strong> with laptops — both sell well but rarely together", "category": "recommendation"}
]}
Only use data that can reasonably be inferred from the profile. Be specific, quantitative, and concise.
"""


VISUAL_SPEC_SYSTEM = """\
You are a data visualization expert. Given a dataset profile (column names, types, sample values) and a user's natural language request, produce a JSON object describing the best chart to visualize what they asked for.

Rules:
- "type" must be one of: "bar", "line", "pie", "scatter", "histogram", "table".
- "x" is the column to use on the x-axis or as the category.
- "y" is the column for the y-axis or value (optional for pie/histogram).
- "values" is an alternative value column (used for histogram).
- "aggregation" is one of: "count", "sum", "mean", "median". Default "count" if no numeric value column.
- "title" is a short descriptive chart title.
- Only use column names that ACTUALLY EXIST in the dataset profile.
- Pick the chart type that best matches the user's intent.
- For "over time" requests, use "line" with a datetime column as x.
- For "distribution" requests, use "histogram".
- For "comparison" or "by category" requests, use "bar".
- For "proportion" or "share" requests, use "pie".
- For "relationship" or "correlation" requests, use "scatter".

Respond with ONLY a JSON object like:
{"type": "line", "x": "date_column", "y": "sales_column", "aggregation": "sum", "title": "Sales Over Time"}
"""


def generate_visual_spec_from_request(
    profile_data: dict,
    user_request: str,
    history: list[dict[str, str]] | None = None,
    dictionary_data: dict | None = None,
) -> dict | None:
    """Use the LLM to interpret a user's visual request and return a chart specification."""
    if not llm_service.enabled:
        return None
    profile_summary = build_profile_summary(profile_data, dictionary_data)
    conversation_context = ""
    if history:
        recent = history[-6:]  # last 3 exchanges
        conversation_context = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in recent)

    user_prompt = (
        f"Dataset profile:\n{profile_summary}\n\n"
        f"Recent conversation:\n{conversation_context}\n\n"
        f"User's visual request: {user_request}\n\n"
        "Produce the JSON chart specification."
    )
    result = llm_service.request_json(VISUAL_SPEC_SYSTEM, user_prompt, max_tokens=400)
    if result and isinstance(result.get("type"), str):
        return result
    return None


def generate_dashboard_insights(profile_data: dict, business_context: dict) -> list:
    """Generate natural language insights for the dashboard.

    Returns a list of dicts with 'text' and 'category' keys, or plain strings
    for backward compatibility.
    """
    if not llm_service.enabled:
        return []
    profile_summary = build_profile_summary(profile_data)
    context_str = json.dumps(business_context, default=str)[:800] if business_context else "No context"
    result = llm_service.request_json(
        DASHBOARD_INSIGHTS_SYSTEM,
        f"Dataset profile:\n{profile_summary}\n\nBusiness context:\n{context_str}",
        max_tokens=800,
    )
    if result and isinstance(result.get("insights"), list):
        raw = result["insights"][:8]
        # Normalise: accept both {"text":..., "category":...} and plain strings
        normalised = []
        for item in raw:
            if isinstance(item, dict) and "text" in item:
                normalised.append({"text": item["text"], "category": item.get("category", "trend")})
            elif isinstance(item, str):
                normalised.append({"text": item, "category": "trend"})
        return normalised
    return []
