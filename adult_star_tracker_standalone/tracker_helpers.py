"""Pure helper functions for the standalone Performer-First Adult Star & Taxonomy Tracker.

Zero external I/O, zero GitHub/Colab logic, zero live LifeOS Hub dependencies.
Provides:
  - Delimiter-safe taxonomy tag normalization and exact matching
  - Measurements (B-W-H) and Waist-to-Hip Ratio (WHR) parsing
  - Boobpedia MediaWiki API URL construction and wikitext infobox parsing
  - Pure mathematical mirrors of the Google Sheets scoring formulas:
      * Stated-vs-Demonstrated blending
      * Saturation-dampened volume bonus
      * Studio auto-scoring with optional explicit boost
      * Re-Rank Bayesian win rate, net margin, consistency score & delta
      * Era & Memory exponential half-life decay
      * Final Active Score calculation
  - Formula static-safety auditors (blank-safety, no Scene_Logs, no live Hub wiring)
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlencode

BOOBPEDIA_API_ENDPOINT = "https://www.boobpedia.com/wiki/api.php"
TARGET_SPREADSHEET_ID = "1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI"
FORBIDDEN_SPREADSHEET_IDS = frozenset({
    "1ZuWRWm5lCJT5_yRvjtvh8WPg_ZQSNcJSjnFrCuiKnEU",  # Adult Star Intelligence & Taxonomy Tracker (LifeOS)
    "1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U",  # LifeOS_feed_hub
    "1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ",  # LifeOS_Master_Bus
})


# ---------------------------------------------------------------------------
# Tag normalization & delimiter-safe exact matching
# ---------------------------------------------------------------------------

def normalize_tag_list(raw: Optional[str], delimiter: str = ";") -> List[str]:
    """Split a semicolon-delimited string into deduplicated, trimmed tags preserving order."""
    if not raw:
        return []
    seen = set()
    result: List[str] = []
    for part in str(raw).split(delimiter):
        cleaned = part.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def wrap_delimited_tags(raw: Optional[str]) -> str:
    """Wrap semicolon-delimited tags as ';tag1;tag2;' for collision-free exact matching."""
    tags = normalize_tag_list(raw)
    if not tags:
        return ""
    return ";" + ";".join(t.lower() for t in tags) + ";"


def has_exact_tag(tag: str, raw_list: Optional[str]) -> bool:
    """Check whether `tag` matches an exact entry in a semicolon-delimited list.

    Prevents substring collisions such as '34D' matching '34DD/E' or 'Slim' matching 'Slim Thick'.
    """
    if not tag or not raw_list:
        return False
    needle = f";{tag.strip().lower()};"
    haystack = wrap_delimited_tags(raw_list)
    return needle in haystack


def to_boobpedia_slug(stage_name: str) -> str:
    """Convert a stage name to a canonical Boobpedia slug (lowercase underscores)."""
    cleaned = re.sub(r"\s+", "_", stage_name.strip())
    return cleaned.lower()


# ---------------------------------------------------------------------------
# Measurements & Waist-to-Hip Ratio (WHR)
# ---------------------------------------------------------------------------

_BWH_RE = re.compile(
    r"^\s*(?P<band>\d{2})(?P<cup>[A-Za-z+]{1,5})?\s*-\s*(?P<waist>\d{2}(?:\.\d+)?)\s*-\s*(?P<hip>\d{2}(?:\.\d+)?)\s*$"
)


def parse_measurements_bwh(bwh: Optional[str]) -> Optional[Dict[str, Any]]:
    """Parse a Bust-Waist-Hip string like '34DDD-26-36' into structured components."""
    if not bwh:
        return None
    m = _BWH_RE.match(str(bwh))
    if not m:
        return None
    band = int(m.group("band"))
    cup = (m.group("cup") or "").upper()
    waist = float(m.group("waist"))
    hip = float(m.group("hip"))
    if hip <= 0:
        return None
    return {
        "band": band,
        "cup": cup,
        "waist": waist,
        "hip": hip,
        "whr": round(waist / hip, 3),
    }


def compute_whr(bwh: Optional[str]) -> Optional[float]:
    """Compute Waist-to-Hip Ratio rounded to 3 decimals, or None if invalid/blank."""
    parsed = parse_measurements_bwh(bwh)
    return parsed["whr"] if parsed else None


def normalize_cup_tag(raw_cup: Optional[str]) -> str:
    """Map raw Boobpedia cup strings to canonical TAXONOMY_MATRIX cup labels."""
    if not raw_cup:
        return ""
    cleaned = re.sub(r"\s+", "", str(raw_cup)).upper()
    # Extract band + cup letters
    m = re.match(r"^(\d{2})([A-Z]+)", cleaned)
    if not m:
        return cleaned
    band, letters = m.group(1), m.group(2)
    if letters in ("DD", "E"):
        return f"{band}DD/E"
    if letters in ("DDD", "F"):
        return f"{band}DDD/F"
    return f"{band}{letters}"


# ---------------------------------------------------------------------------
# Boobpedia MediaWiki API helpers & wikitext infobox parser
# ---------------------------------------------------------------------------

def build_boobpedia_query_url(stage_name: str) -> str:
    """Build a MediaWiki API URL to fetch wikitext + categories for a performer."""
    title = stage_name.strip().replace(" ", "_")
    params = {
        "action": "query",
        "format": "json",
        "redirects": "1",
        "titles": title,
        "prop": "revisions|categories",
        "rvprop": "content",
        "rvslots": "main",
        "cllimit": "100",
    }
    return f"{BOOBPEDIA_API_ENDPOINT}?{urlencode(params)}"


def build_boobpedia_search_url(query: str, limit: int = 10) -> str:
    """Build a MediaWiki opensearch URL for Boobpedia performer lookup."""
    params = {
        "action": "opensearch",
        "format": "json",
        "search": query.strip(),
        "limit": str(max(1, min(limit, 25))),
    }
    return f"{BOOBPEDIA_API_ENDPOINT}?{urlencode(params)}"


def _strip_wiki_markup(value: str) -> str:
    """Remove common MediaWiki templates, links, comments, and refs."""
    text = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    # [[Target|Display]] -> Display, [[Target]] -> Target
    text = re.sub(r"\[\[[^|\]]+\|([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    # Remove simple template braces while preserving plain args
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"''+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_infobox_field(wikitext: str, field_names: Iterable[str]) -> str:
    """Extract a field value from a Boobpedia wikitext infobox."""
    for name in field_names:
        pattern = re.compile(
            rf"^\s*\|\s*{re.escape(name)}\s*=\s*(.+)$",
            flags=re.IGNORECASE | re.MULTILINE,
        )
        m = pattern.search(wikitext)
        if m:
            val = _strip_wiki_markup(m.group(1))
            if val:
                return val
    return ""


def _extract_first_year(text: str) -> Optional[int]:
    """Return the first 4-digit year between 1950 and 2035 found in text."""
    m = re.search(r"\b(19[5-9]\d|20[0-3]\d)\b", text or "")
    return int(m.group(1)) if m else None


def map_boobpedia_categories_to_taxonomy(
    categories: Iterable[str],
    taxonomy_tags: Optional[Iterable[str]] = None,
) -> List[str]:
    """Map Boobpedia category names onto canonical TAXONOMY_MATRIX tag labels."""
    cat_blob = " | ".join(c.lower() for c in categories)
    heuristic_map: List[Tuple[str, str]] = [
        ("natural boobs", "Natural Boobs"),
        ("natural breasts", "Natural Boobs"),
        ("enhanced", "Enhanced/Implants"),
        ("implants", "Enhanced/Implants"),
        ("puffy nipples", "Puffy Nipples"),
        ("large areolas", "Large Areolas"),
        ("pale areolas", "Pale Areolas"),
        ("brown areolas", "Brown Areolas"),
        ("pierced nipples", "Pierced Nipples"),
        ("curvy", "Curvy"),
        ("petite", "Petite"),
        ("athletic", "Athletic"),
        ("slim", "Slim"),
        ("hourglass", "Hourglass"),
        ("tall", "Tall"),
        ("blonde", "Blonde"),
        ("brunette", "Brunette"),
        ("redhead", "Red/Auburn"),
        ("auburn", "Red/Auburn"),
        ("black hair", "Black"),
        ("tattoo", "Tattoos"),
        ("shaved", "Shaved"),
        ("hairy", "Natural Bush/Trimmed"),
        ("titfuck", "Titfuck/Paizuri"),
        ("paizuri", "Titfuck/Paizuri"),
    ]
    matched: List[str] = []
    seen = set()
    for needle, canonical in heuristic_map:
        if needle in cat_blob and canonical.lower() not in seen:
            seen.add(canonical.lower())
            matched.append(canonical)
    if taxonomy_tags:
        for tag in taxonomy_tags:
            t_low = tag.strip().lower()
            if t_low and t_low in cat_blob and t_low not in seen:
                seen.add(t_low)
                matched.append(tag.strip())
    return matched


def parse_boobpedia_page(
    stage_name: str,
    wikitext: str,
    categories: Optional[Iterable[str]] = None,
    taxonomy_tags: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Parse Boobpedia wikitext + categories into a MODEL_ROSTER_INDEX-ready record."""
    cat_list = [str(c).replace("Category:", "").strip() for c in (categories or [])]

    birth_raw = _extract_infobox_field(wikitext, ["birth_date", "born", "birthdate"])
    debut_raw = _extract_infobox_field(wikitext, ["years_active", "active", "debut", "career_start"])
    height_raw = _extract_infobox_field(wikitext, ["height"])
    measurements_raw = _extract_infobox_field(wikitext, ["measurements", "bwh"])
    cup_raw = _extract_infobox_field(wikitext, ["bra_size", "cup_size", "cupsize"])
    boobs_raw = _extract_infobox_field(wikitext, ["boobs", "breasts", "natural_or_enhanced"])
    ethnicity_raw = _extract_infobox_field(wikitext, ["ethnicity", "heritage", "nationality"])
    studios_raw = _extract_infobox_field(wikitext, ["studios", "studio", "companies"])

    # Normalize B-W-H measurement string (e.g. '34DDD-26-36')
    bwh_clean = ""
    bwh_match = re.search(r"(\d{2}[A-Za-z+]{0,5}\s*-\s*\d{2}\s*-\s*\d{2})", measurements_raw)
    if bwh_match:
        bwh_clean = re.sub(r"\s+", "", bwh_match.group(1)).upper()

    # Cup tag from explicit field or measurement prefix
    cup_tag = normalize_cup_tag(cup_raw)
    if not cup_tag and bwh_clean:
        cup_tag = normalize_cup_tag(bwh_clean.split("-")[0])

    # Natural vs Enhanced classification
    boobs_hint = (boobs_raw + " " + " ".join(cat_list)).lower()
    if any(k in boobs_hint for k in ("implant", "enhanced", "augmented", "fake", "silicone")):
        natural_or_enhanced = "Enhanced/Implants"
    elif "natural" in boobs_hint:
        natural_or_enhanced = "Natural Boobs"
    else:
        natural_or_enhanced = ""

    # Heritage mapping (word-boundary regex avoids 'asian' matching inside 'caucasian')
    eth_low = ethnicity_raw.lower()
    if re.search(r"\b(latina|hispanic|colombian|mexican|cuban|puerto)\b", eth_low):
        heritage_tag = "Latina/Hispanic"
    elif re.search(r"\b(asian|japanese|chinese|korean|filipina|vietnamese)\b", eth_low):
        heritage_tag = "Asian"
    elif re.search(r"\b(black|african|ebony)\b", eth_low):
        heritage_tag = "Black/African"
    elif re.search(r"\b(white|caucasian|european|american|australian|british|czech|russian)\b", eth_low):
        heritage_tag = "White/European"
    else:
        heritage_tag = ethnicity_raw

    # Height normalization (prefer feet'inches" if present)
    height_match = re.search(r"(\d'\s*\d{1,2}\"?)", height_raw)
    height_clean = re.sub(r"\s+", "", height_match.group(1)) if height_match else height_raw
    if height_clean and "'" in height_clean and not height_clean.endswith('"'):
        height_clean += '"'

    mapped_cats = map_boobpedia_categories_to_taxonomy(cat_list, taxonomy_tags=taxonomy_tags)
    # Exclude Natural/Enhanced from Auto_Categories since it has its own column
    auto_cats = [c for c in mapped_cats if c not in ("Natural Boobs", "Enhanced/Implants")]

    studios_clean = "; ".join(normalize_tag_list(re.sub(r",", ";", studios_raw)))

    return {
        "Stage_Name": stage_name.strip(),
        "Boobpedia_Slug": to_boobpedia_slug(stage_name),
        "Debut_Year": _extract_first_year(debut_raw) or "",
        "Birth_Year": _extract_first_year(birth_raw) or "",
        "Height": height_clean,
        "Measurements_BWH": bwh_clean,
        "WHR": compute_whr(bwh_clean),
        "Cup_Tag": cup_tag,
        "Natural_or_Enhanced": natural_or_enhanced,
        "Heritage_Tag": heritage_tag,
        "Primary_Studios": studios_clean,
        "Auto_Categories": "; ".join(auto_cats),
        "Source_Tag": "Boobpedia_API",
        "Active_In_Form": True,
        "Custom_Added": True,
    }


# ---------------------------------------------------------------------------
# Pure Scoring Engines (exact mirrors of the Google Sheets formulas)
# ---------------------------------------------------------------------------

def clamp(value: float, low: float = 1.0, high: float = 10.0) -> float:
    """Clamp a numeric score within [low, high]."""
    return max(low, min(high, value))


def blend_stated_demonstrated(
    stated: Optional[float],
    demonstrated: Optional[float],
    log_count: int = 0,
    weight_demo: float = 0.6,
    vol_scale: float = 0.05,
    default_baseline: float = 7.0,
) -> float:
    """Blend Stated Baseline and Demonstrated Average using WEIGHT_STATED_DEMO.

    Convention (consistent across Trait_Intelligence, Niche_Intelligence, Performer_Intelligence):
      - `weight_demo` (PARAM_CONFIG_HUB `WEIGHT_STATED_DEMO`, default 0.60) is the weight on
        Demonstrated evidence when logs exist; `1 - weight_demo` (0.40) anchors to Stated/Prior.
      - When no logs exist (`demonstrated is None` or `log_count <= 0`), returns Stated cleanly.
      - Adds a bounded logarithmic confirmation lift `min(0.35, vol_scale * ln(1 + log_count))`.
    """
    base = float(stated) if stated is not None else float(default_baseline)
    if demonstrated is None or log_count <= 0:
        return round(clamp(base, 1.0, 10.0), 2)
    blended = (weight_demo * float(demonstrated)) + ((1.0 - weight_demo) * base)
    vol_lift = min(0.35, vol_scale * math.log(1.0 + log_count))
    return round(clamp(blended + vol_lift, 1.0, 10.0), 2)


def compute_studio_score(
    auto_demo: Optional[float],
    explicit_baseline: Optional[float],
    log_count: int = 0,
    boost_weight: float = 0.15,
    default_baseline: float = 7.0,
    vol_scale: float = 0.05,
) -> Dict[str, Any]:
    """Compute Studio Intelligence score: auto-scored from Performer_Logs + optional explicit boost."""
    if explicit_baseline is not None:
        boost_delta = round((float(explicit_baseline) - float(default_baseline)) * float(boost_weight), 3)
    else:
        boost_delta = 0.0

    if auto_demo is not None and log_count > 0:
        vol_lift = min(0.30, float(vol_scale) * math.log(1.0 + log_count))
        score = round(clamp(float(auto_demo) + boost_delta + vol_lift, 1.0, 10.0), 2)
        mode = "AUTO + EXPLICIT_BOOST" if explicit_baseline is not None else "AUTO_ONLY"
    elif explicit_baseline is not None:
        score = round(clamp(float(explicit_baseline), 1.0, 10.0), 2)
        mode = "EXPLICIT_ONLY"
    else:
        score = round(clamp(float(default_baseline), 1.0, 10.0), 2)
        mode = "ROSTER_DEFAULT"

    return {
        "explicit_boost_delta": boost_delta,
        "studio_score": score,
        "scoring_mode": mode,
    }


def compute_rerank_metrics(
    wins: int,
    losses: int,
    net_margin: float,
    default_baseline: float = 7.0,
) -> Dict[str, Optional[float]]:
    """Compute ReRank win rate, Bayesian consistency score (1-10), and bounded delta."""
    matches = wins + losses
    if matches <= 0:
        return {
            "matches": 0,
            "win_rate": None,
            "consistency_score": None,
            "rerank_delta": 0.0,
        }
    win_rate = wins / matches
    # Bayesian smoothed win rate prevents 1-duel overreaction
    smoothed_wr = (wins + 1.0) / (matches + 2.0)
    avg_margin = net_margin / matches
    margin_term = max(-1.0, min(1.0, avg_margin * 1.5))
    consistency = round(
        clamp(float(default_baseline) + 0.5 + (smoothed_wr - 0.5) * 5.0 + margin_term, 1.0, 10.0),
        2,
    )
    delta = round(
        max(-0.75, min(0.75, (smoothed_wr - 0.5) * 1.2 + max(-0.35, min(0.35, avg_margin * 0.5)))),
        3,
    )
    return {
        "matches": matches,
        "win_rate": round(win_rate, 3),
        "consistency_score": consistency,
        "rerank_delta": delta,
    }


def compute_volume_dampened_bonus(
    log_count: int,
    vol_scale: float = 0.05,
    saturation_threshold: float = 10.0,
) -> float:
    """Compute smooth saturation-dampened frequency bonus bounded by vol_scale * saturation_threshold."""
    if log_count <= 0 or saturation_threshold <= 0:
        return 0.0
    bonus = float(vol_scale) * float(saturation_threshold) * (
        1.0 - math.exp(-float(log_count) / float(saturation_threshold))
    )
    return round(bonus, 3)


def compute_half_life_decay(age_days: Optional[float], halflife_days: float) -> Optional[float]:
    """Compute exponential half-life decay factor in [0.0, 1.0], preserving None for blank dates."""
    if age_days is None:
        return None
    if halflife_days <= 0:
        raise ValueError("halflife_days must be positive")
    clamped_age = max(0.0, float(age_days))
    return round(0.5 ** (clamped_age / float(halflife_days)), 4)


def compute_final_active_score(
    master_score: Optional[float],
    era_decay: Optional[float],
    memory_decay: Optional[float],
) -> Optional[float]:
    """Compute Final Active Score combining all-time Master_Score with gentle Era & Memory freshness."""
    if master_score is None:
        return None
    era = float(era_decay) if era_decay is not None else 0.0
    mem = float(memory_decay) if memory_decay is not None else 0.0
    modifier = 0.90 + (0.04 * era) + (0.06 * mem)
    return round(clamp(float(master_score) * modifier, 1.0, 10.0), 2)


# ---------------------------------------------------------------------------
# Formula & Standalone Scope Static Auditors
# ---------------------------------------------------------------------------

def audit_formula_blank_safety(formula: str) -> Tuple[bool, str]:
    """Verify a Google Sheets formula uses blank-safe guarding rather than bare expressions."""
    if not isinstance(formula, str) or not formula.startswith("="):
        return True, "non-formula literal"
    upper = formula.upper()
    # Acceptable blank-safe patterns: IF(ISBLANK(...), "", ...), IF(...="", "", ...),
    # IF(COUNTA(...)=0, "", ...), IFERROR(SORT(...), ""), TEXT(NOW(), ...)
    safe_markers = (
        "IF(ISBLANK(",
        "ISBLANK(",
        '=""',
        "=0,",
        "COUNTA(",
        "IFERROR(",
        "TEXT(NOW()",
    )
    if any(marker in upper for marker in safe_markers):
        return True, "blank-safe guard detected"
    return False, f"Formula lacks blank-safe guard: {formula[:80]}"


def audit_no_scene_logs_dependency(text: str) -> bool:
    """Return True iff text contains zero references to Scene_Logs."""
    return "scene_logs" not in str(text).lower()


def audit_no_live_lifeos_wiring(text: str) -> bool:
    """Return True iff text contains zero live IMPORTRANGE or forbidden LifeOS spreadsheet IDs."""
    low = str(text).lower()
    if "importrange(" in low:
        return False
    for bad_id in FORBIDDEN_SPREADSHEET_IDS:
        if bad_id.lower() in low:
            return False
    return True
