"""Historical community activity and compatibility responses for v1 clients."""
from sqlalchemy.orm import Session

from .models import PointEvent, User

HISTORICAL_POINTS = {
    "share_recipe": 20,      # upload a dish/recipe
    "recipe_photo": 10,      # bonus for contributing an image
    "rate_recipe": 5,        # rate someone else's dish
    "rate_pantry": 5,        # rate a pantry
    "visit_pantry": 10,      # check in at a pantry
    "submit_pantry": 30,     # submit a pantry (awarded when verified)
    "update_inventory": 5,   # report what's on the shelves
}

# The v1 activity API retains its response shape. All new awards are private cooking
# transactions in the Routes wallet. Historical events stay readable.
POINTS = dict.fromkeys(HISTORICAL_POINTS, 0)
PRIZES = []

LEVELS = [(0, "Seedling"), (100, "Sprout"), (250, "Harvester"), (500, "Pantry Pro"), (1000, "Boston Legend")]


def level_for(points: int) -> str:
    name = LEVELS[0][1]
    for threshold, label in LEVELS:
        if points >= threshold:
            name = label
    return name


def award(db: Session, user: User, action: str, ref_id: int | None = None) -> int:
    if action == "visit_pantry":
        db.add(PointEvent(user_id=user.id, action=action, points=0, ref_id=ref_id))
    return 0
