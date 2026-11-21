"""Startup checks that warn when credit or Premium prices fall below the target AI margin."""
from django.conf import settings
from django.core.checks import Warning, register

from services.ai_costs import pricing_report, suggested_credit_price_cents


@register()
def check_ai_pricing_margins(app_configs, **kwargs):
    report = pricing_report()
    target = report["target_margin_percent"]
    per_question = report["worst_case_question_cost_usd"]["total"]
    warnings = []

    credits = report["credits"]
    if credits["margin_percent"] < target:
        warnings.append(Warning(
            f"Question credits leave a {credits['margin_percent']:.0f}% margin at worst-case AI cost "
            f"(${per_question:.4f}/question), below the {target:.0f}% target.",
            hint=f"Raise CREDIT_UNIT_PRICE_CENTS to at least {suggested_credit_price_cents()} "
                 f"or CREDIT_MIN_PURCHASE (now {settings.CREDIT_MIN_PURCHASE}). "
                 "Run `python manage.py ai_cost_report` for details.",
            id="payments.W001",
        ))

    premium = report["premium"]
    if premium["margin_percent"] < target:
        warnings.append(Warning(
            f"Premium leaves a {premium['margin_percent']:.0f}% margin if every family member uses all "
            f"{settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER} included questions, below the {target:.0f}% target.",
            hint="Lower PREMIUM_QUESTIONS_PER_FAMILY_MEMBER or PREMIUM_MAX_FAMILY_MEMBERS, or raise "
                 "STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS. Run `python manage.py ai_cost_report` for details.",
            id="payments.W002",
        ))
    return warnings


@register()
def check_stripe_webhook_secret(app_configs, **kwargs):
    """Without a valid secret every Stripe webhook is rejected, so payments are never confirmed by webhook."""
    secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "") or ""
    if settings.STRIPE_SECRET_KEY and not secret.startswith("whsec_"):
        mode = getattr(settings, "STRIPE_MODE", "test").upper()
        return [Warning(
            "STRIPE_WEBHOOK_SECRET is missing or invalid, so Stripe webhooks are rejected.",
            hint=f"Set STRIPE_{mode}_WEBHOOK_SECRET to the endpoint's signing secret (whsec_...).",
            id="payments.W003",
        )]
    return []
