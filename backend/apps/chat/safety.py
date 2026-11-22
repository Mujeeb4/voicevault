"""Safety checks for chat messages.

If someone writes that they may hurt themselves, the AI recreation should not answer in
the voice of a loved one. We show a short, caring message with crisis resources instead.
"""
import re
import unicodedata

# Matched against normalized text (see _normalize). Leans towards catching distress: a false
# alarm only shows a caring message instead of an answer, a miss is far worse.
_CRISIS_PATTERNS = [
    r"\bkill(ing)?\s+my\s?self\b",
    r"\bend(ing)?\s+(my|this)\s+life\b",
    r"\bend\s+it\s+all\b",
    r"\b(want|wanna|going|gonna|plan(ning)?|ready)\s+(to\s+)?(die|end\s+it)\b",
    r"\bsuicidal\b",
    r"\b(think|thinking|thought|thoughts)\s+(about|of)\s+(suicide|killing\s+my\s?self|dying|ending\s+it)\b",
    # "suicide" on its own is often about someone else ("why did grandpa commit suicide?"),
    # so it counts only when the writer speaks about themselves in the same sentence
    r"\b(i|i'm|im|me|my)\b[^.?!]{0,30}\bsuicide\b",
    r"\bself[\s-]?harm(ing)?\b",
    r"\b(hurt|hurting|cut|cutting)\s+my\s?self\b",
    r"\b(don't|dont|do\s+not)\s+want\s+to\s+(be\s+alive|live|go\s+on|wake\s+up)\b",
    r"\b(can't|cant|cannot)\s+(go\s+on|take\s+(it|this)\s+anymore|do\s+this\s+anymore)\b",
    r"\bbetter\s+off\s+(dead|without\s+me)\b",
    r"\bwish\s+i\s+(was|were)\s+(dead|never\s+born)\b",
    r"\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b",
]
_CRISIS_RE = re.compile("|".join(_CRISIS_PATTERNS), re.IGNORECASE)

# Phones and Macs type curly apostrophes ("don’t"), which plain patterns would miss
_QUOTES = str.maketrans({"\u2019": "'", "\u2018": "'", "\u02bc": "'", "\u00b4": "'", "`": "'"})


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_QUOTES).lower()
    return re.sub(r"\s+", " ", text)


CRISIS_MESSAGE = (
    "I'm an AI, and I'm worried about what you just shared. You do not have to carry this alone. "
    "If you are in the United States or Canada, you can call or text 988 at any time to reach the "
    "Suicide and Crisis Lifeline; elsewhere, contact your local crisis line. If you are in immediate "
    "danger, call 911 or your local emergency number. "
    "Please also reach out to someone you trust and let them know how you are feeling."
)


def is_crisis_message(text: str) -> bool:
    return bool(text and _CRISIS_RE.search(_normalize(text)))
