"""Point rules — the '?? points' from the proposal, filled in with v1 defaults. Tune freely."""
from sqlalchemy.orm import Session

from .models import PointEvent, User

POINTS = {
    "share_recipe": 20,      # upload a dish/recipe
    "recipe_photo": 10,      # bonus for contributing an image
    "rate_recipe": 5,        # rate someone else's dish
    "rate_pantry": 5,        # rate a pantry
    "visit_pantry": 10,      # check in at a pantry
    "submit_pantry": 30,     # submit a pantry (awarded when verified)
    "update_inventory": 5,   # report what's on the shelves
}

# Prize tiers for weekly / monthly winners
PRIZES = [
    {"rank": 1, "prize": "Customized CharlieCard + 7-day T-pass"},
    {"rank": 2, "prize": "7-day T-pass"},
    {"rank": 3, "prize": "Gold Ladle badge"},
    {"rank": 10, "prize": "Top-10 avatar frame"},
]

LEVELS = [(0, "Seedling"), (100, "Sprout"), (250, "Harvester"), (500, "Pantry Pro"), (1000, "Boston Legend")]


def level_for(points: int) -> str:
    name = LEVELS[0][1]
    for threshold, label in LEVELS:
        if points >= threshold:
            name = label
    return name


def award(db: Session, user: User, action: str, ref_id: int | None = None) -> int:
    pts = POINTS[action]
    db.add(PointEvent(user_id=user.id, action=action, points=pts, ref_id=ref_id))
    user.points += pts
    return pts
