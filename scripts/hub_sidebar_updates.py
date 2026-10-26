"""Per-sport featured sidebar video helpers (no global NBA override).

Prefer scripts/restore_hub_featured_videos.py for the canonical hub embeds.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# NBA-only featured video (Rockets/Pacers). Other hubs use sport-specific IDs in restore script.
NBA_VIDEO_ID = "e8KPKNIxEmE"

HUBS_WITH_FEATURED = {
    "nba.html",
    "wnba.html",
    "nfl.html",
}
