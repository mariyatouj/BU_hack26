"""Load data/seed.json into an empty database.  Run:  python -m app.seed  (from backend/)"""
import json
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .alerts import ingredients_for_dish
from .db import Base, SessionLocal, engine
from .models import (Alert, InventoryItem, Pantry, PantryRating, PointEvent, Recipe, RecipeRating, User,
                     utcnow)
from .points import POINTS

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "seed.json"


def seed(db: Session) -> bool:
    if db.scalars(select(User)).first():
        return False
    data = json.loads(SEED_PATH.read_text())
    now = utcnow()
    users = {}
    for u in data["users"]:
        users[u["id"]] = User(**u, points=0)
        db.add(users[u["id"]])
    db.flush()

    def award(uid, action, days_ago, ref=None):
        pts = POINTS[action]
        db.add(PointEvent(user_id=uid, action=action, points=pts, ref_id=ref,
                          created_at=now - timedelta(days=days_ago, hours=uid)))
        users[uid].points += pts

    for p in data["pantries"]:
        items = p.pop("items")
        pantry = Pantry(**p)
        db.add(pantry)
        db.flush()
        for i, (name, cat, level) in enumerate(items):
            db.add(InventoryItem(pantry_id=pantry.id, name=name, category=cat, level=level,
                                 updated_at=now - timedelta(hours=6 + i * 3 + pantry.id * 5)))

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
