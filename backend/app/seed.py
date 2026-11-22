"""Load directory/demo data into an empty database. Run: python -m app.seed (from backend/)."""
import csv
import json
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .alerts import ingredients_for_dish
from .db import Base, SessionLocal, engine
from .models import (Alert, InventoryItem, Pantry, PantryRating, PointEvent, Recipe, RecipeRating, User,
                     utcnow)
from .points import HISTORICAL_POINTS

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed.json"
DEMO_INVENTORY_PATH = Path(__file__).resolve().parents[2] / "data" / "demo_inventory.csv"


def seed(db: Session) -> bool:
    if db.scalars(select(User)).first():
        return False
    data = json.loads(SEED_PATH.read_text())
    now = utcnow()
    inventory: dict[int, list[dict]] = defaultdict(list)
    with DEMO_INVENTORY_PATH.open(newline="") as f:
        for row in csv.DictReader(f):
            inventory[int(row["pantry_id"])].append(row)
    users = {}
    for u in data["users"]:
        users[u["id"]] = User(**u, points=0)
        db.add(users[u["id"]])
    db.flush()

    def award(uid, action, days_ago, ref=None):
        pts = HISTORICAL_POINTS[action]
        db.add(PointEvent(user_id=uid, action=action, points=pts, ref_id=ref,
                          created_at=now - timedelta(days=days_ago, hours=uid)))
        users[uid].points += pts

    for p in data["pantries"]:
        pantry = Pantry(**p)
        db.add(pantry)
        db.flush()
        for item in inventory[pantry.id]:
            db.add(InventoryItem(
                pantry_id=pantry.id,
                name=item["name"],
                category=item["category"],
                level=item["level"],
                source="demo",
                updated_at=now - timedelta(hours=int(item["hours_ago"])),
            ))

    for r in data["recipes"]:
        ratings = r.pop("ratings")
        days = r.pop("days_ago")
        rec = Recipe(**r, created_at=now - timedelta(days=days))
        db.add(rec)
        db.flush()
        award(rec.user_id, "share_recipe", days, rec.id)
        for uid, taste, ease in ratings:
            db.add(RecipeRating(recipe_id=rec.id, user_id=uid, taste=taste, ease=ease,
                                created_at=now - timedelta(days=max(days - 1, 0))))
            award(uid, "rate_recipe", max(days - 1, 0), rec.id)

    for pid, uid, stars in data["pantry_ratings"]:
        db.add(PantryRating(pantry_id=pid, user_id=uid, stars=stars))
        award(uid, "rate_pantry", (pid * uid) % 20, pid)

    for pid, uid, days in data["visits"]:
        award(uid, "visit_pantry", days, pid)

    for a in data["alerts"]:
        db.add(Alert(**a, ingredients=ingredients_for_dish(a["dish"])))

    db.commit()
    return True


def init_db() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)


if __name__ == "__main__":
    init_db()
    print("Database ready.")
