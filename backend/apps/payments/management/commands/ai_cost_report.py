"""Print worst-case AI cost per question and the margins on credits and Premium."""
from django.conf import settings
from django.core.management.base import BaseCommand

from services.ai_costs import pricing_report, suggested_credit_price_cents


class Command(BaseCommand):
    help = "Show worst-case AI cost per question and the margins on credits and Premium."

    def handle(self, *args, **options):
        report = pricing_report()
        cost = report["worst_case_question_cost_usd"]
        target = report["target_margin_percent"]
        credits = report["credits"]
        premium = report["premium"]

        self.stdout.write("Worst-case AI cost of one question")
        self.stdout.write(f"  Chat answer      ${cost['chat']:.4f}  ({settings.CHAT_MAX_INPUT_TOKENS} in / {settings.CHAT_MAX_OUTPUT_TOKENS} out tokens)")
        self.stdout.write(f"  Voice answer     ${cost['voice_reply']:.4f}")
        self.stdout.write(f"  Voice question   ${cost['voice_question']:.4f}  (up to {settings.VOICE_QUESTION_MAX_SECONDS}s)")
        self.stdout.write(f"  Total            ${cost['total']:.4f}")
        self.stdout.write("")
        self.stdout.write(f"Credits: ${credits['unit_price_usd']:.2f} each, minimum {credits['min_purchase']} (${credits['min_purchase_usd']:.2f})")
        self.stdout.write(f"  Margin on smallest purchase after Stripe fees: {credits['margin_percent']:.1f}%  (target {target:.0f}%)")
        self.stdout.write(f"  Lowest credit price meeting the target: {suggested_credit_price_cents()} cents")
        self.stdout.write("")
        self.stdout.write(f"Premium: ${premium['price_usd']:.2f}, {premium['included_questions']} included questions "
                          f"({settings.PREMIUM_MAX_FAMILY_MEMBERS} members + owner x {settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER})")
        self.stdout.write(f"  Worst-case AI cost if all are used: ${premium['worst_case_cost_usd']:.2f} "
                          f"(incl. ${settings.PREMIUM_SETUP_AI_COST_USD:.2f} setup)")
        self.stdout.write(f"  Margin after Stripe fees: {premium['margin_percent']:.1f}%  (target {target:.0f}%)")
