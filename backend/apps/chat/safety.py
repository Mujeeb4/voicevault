"""Safety checks for chat messages.

If someone writes that they may hurt themselves, the AI recreation should not answer in
the voice of a loved one. We show a short, caring message with crisis resources instead.
"""
import re

_CRISIS_PATTERNS = [
    r"\bkill\s+(myself|my\s*self)\b",
    r"\bend\s+(my|this)\s+life\b",
    r"\b(want|going|plan(ning)?|thinking)\s+(to\s+|of\s+|about\s+)?(die|dying|suicide|killing\s+myself)\b",
    r"\bsuicid(e|al)\b",
    r"\bself[\s-]?harm\b",
    r"\bhurt(ing)?\s+myself\b",
    r"\bcut(ting)?\s+myself\b",
    r"\bdon'?t\s+want\s+to\s+(be\s+alive|live|go\s+on)\b",
    r"\bbetter\s+off\s+(dead|without\s+me)\b",
    r"\bwish\s+i\s+(was|were)\s+dead\b",
    r"\bno\s+reason\s+to\s+live\b",
]
_CRISIS_RE = re.compile("|".join(_CRISIS_PATTERNS), re.IGNORECASE)

CRISIS_MESSAGE = (
    "I'm an AI, and I'm worried about what you just shared. You do not have to carry this alone. "
    "If you are in the United States or Canada, you can call or text 988 at any time to reach the "
    "Suicide and Crisis Lifeline. If you are in immediate danger, call 911. "
    "Please also reach out to someone you trust and let them know how you are feeling."
)


def is_crisis_message(text: str) -> bool:
    return bool(text and _CRISIS_RE.search(text))
