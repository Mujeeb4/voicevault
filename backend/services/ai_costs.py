"""
Worst-case AI cost per question and the margins it leaves on credits and Premium.

A question's exact token count varies, but every part is capped: question length,
memory context (CHAT_MAX_INPUT_TOKENS), answer length (CHAT_MAX_OUTPUT_TOKENS),
the voice answer that reads it out, and voice-question length. Pricing on the
capped worst case means no question can cost more than it earns.
"""
from __future__ import annotations

from django.conf import settings


def worst_case_question_cost_usd() -> dict:
    """Highest cost of one question: text answer, its voice answer and a spoken question."""
    chat = (
        settings.CHAT_MAX_INPUT_TOKENS * settings.CHAT_INPUT_PRICE_PER_MILLION_USD
        + settings.CHAT_MAX_OUTPUT_TOKENS * settings.CHAT_OUTPUT_PRICE_PER_MILLION_USD
    ) / 1_000_000
    voice_question = settings.VOICE_QUESTION_MAX_SECONDS / 60 * settings.TRANSCRIPTION_PRICE_PER_MINUTE_USD
    voice_reply = settings.VOICE_REPLY_MAX_COST_USD
    return {
        "chat": chat,
        "voice_reply": voice_reply,
        "voice_question": voice_question,
        "total": chat + voice_reply + voice_question,
    }


def stripe_fee_usd(amount_usd: float) -> float:
    return amount_usd * settings.STRIPE_FEE_PERCENT / 100 + settings.STRIPE_FEE_FIXED_CENTS / 100


def _margin_percent(revenue_usd: float, cost_usd: float) -> float:
    net = revenue_usd - stripe_fee_usd(revenue_usd)
    return (net - cost_usd) / revenue_usd * 100 if revenue_usd > 0 else float("-inf")


def pricing_report() -> dict:
    """Margins on the smallest credit purchase and on a fully used Premium vault, at worst-case cost."""
    per_question = worst_case_question_cost_usd()["total"]

    # The smallest purchase carries the largest share of Stripe's fixed fee
    credit_revenue = settings.CREDIT_UNIT_PRICE_CENTS * settings.CREDIT_MIN_PURCHASE / 100
    credit_cost = per_question * settings.CREDIT_MIN_PURCHASE

    # Every family member plus the owner uses their whole allowance
    included_questions = (settings.PREMIUM_MAX_FAMILY_MEMBERS + 1) * settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER
    premium_revenue = settings.STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS / 100
    premium_cost = included_questions * per_question + settings.PREMIUM_SETUP_AI_COST_USD

    return {
        "worst_case_question_cost_usd": worst_case_question_cost_usd(),
        "target_margin_percent": settings.TARGET_GROSS_MARGIN_PERCENT,
        "credits": {
            "unit_price_usd": settings.CREDIT_UNIT_PRICE_CENTS / 100,
            "min_purchase": settings.CREDIT_MIN_PURCHASE,
            "min_purchase_usd": credit_revenue,
            "worst_case_cost_usd": credit_cost,
            "margin_percent": _margin_percent(credit_revenue, credit_cost),
        },
        "premium": {
            "price_usd": premium_revenue,
            "included_questions": included_questions,
            "worst_case_cost_usd": premium_cost,
            "margin_percent": _margin_percent(premium_revenue, premium_cost),
        },
    }


def suggested_credit_price_cents() -> int:
    """Lowest whole-cent credit price that meets the target margin on the smallest purchase."""
    per_question = worst_case_question_cost_usd()["total"]
    keep = 1 - settings.STRIPE_FEE_PERCENT / 100 - settings.TARGET_GROSS_MARGIN_PERCENT / 100
    if keep <= 0:
        return 0
    fixed_fee_per_credit = settings.STRIPE_FEE_FIXED_CENTS / 100 / settings.CREDIT_MIN_PURCHASE
    return int(-(-((per_question + fixed_fee_per_credit) / keep * 100) // 1))
