"""Food alerts: dish/culture -> search radius -> notification rules.

Backend flow from the proposal:
  1. Store a user's preferred dish and search radius.
  2. Match the dish's ingredients against pantry inventory updates.
  3. Filter matching pantries by distance.
  4. Notify the user when new, sufficiently recent information meets their criteria.
"""
import math
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Alert, InventoryItem, Notification, Pantry, Recipe, utcnow

FRESH_DAYS = 7  # inventory older than this is not "sufficiently recent"

# Starter ingredient lists so an alert works even before Gemini is configured.
DISH_INGREDIENTS = {
    "fried rice": ["rice", "eggs", "frozen peas", "carrots", "onion", "soy sauce"],
    "rice and beans": ["rice", "black beans", "onion", "garlic", "canned tomatoes"],
    "dal": ["lentils", "onion", "garlic", "canned tomatoes", "rice"],
    "pasta": ["pasta", "canned tomatoes", "garlic", "onion"],
    "chili": ["black beans", "canned tomatoes", "onion", "ground turkey", "rice"],
    "congee": ["rice", "ginger", "chicken", "scallions"],
    "shakshuka": ["eggs", "canned tomatoes", "onion", "bell peppers"],
    "oatmeal": ["oats", "milk", "bananas", "peanut butter"],
    "stir fry": ["rice", "tofu", "broccoli", "carrots", "soy sauce"],
    "soup": ["potatoes", "carrots", "onion", "lentils"],
}


def norm(s: str) -> str:
    return s.strip().lower()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def ingredients_for_dish(dish: str) -> list[str]:
    d = norm(dish)
    for key, items in DISH_INGREDIENTS.items():
        if key in d or d in key:
            return items
    return []


def fresh_stock(db: Session, pantry_id: int) -> set[str]:
    cutoff = utcnow() - timedelta(days=FRESH_DAYS)
    rows = db.scalars(
        select(InventoryItem).where(
            InventoryItem.pantry_id == pantry_id,
            InventoryItem.updated_at >= cutoff,
            InventoryItem.level != "out",
        )
    ).all()
    return {norm(r.name) for r in rows}


def match_score(wanted: list[str], stock: set[str]) -> tuple[float, list[str], list[str]]:
    wanted_n = [norm(w) for w in wanted]
    if not wanted_n:
        return 0.0, [], []
    have = [w for w in wanted_n if any(w in s or s in w for s in stock)]
    missing = [w for w in wanted_n if w not in have]
    return len(have) / len(wanted_n), have, missing


def alert_matches(db: Session, alert: Alert) -> list[dict]:
    """Pantries within the alert radius, ranked by how much of the dish they can cover."""
    out = []
    for p in db.scalars(select(Pantry).where(Pantry.verified.is_(True))).all():
        dist = haversine_km(alert.lat, alert.lng, p.lat, p.lng)
        if dist > alert.radius_km:
            continue
        score, have, missing = match_score(alert.ingredients, fresh_stock(db, p.id))
        out.append(
            {"pantry_id": p.id, "pantry_name": p.name, "distance_km": round(dist, 2),
             "match": round(score, 2), "have": have, "missing": missing}
        )
    return sorted(out, key=lambda m: (-m["match"], m["distance_km"]))


def _already_notified(db: Session, alert: Alert, **ref) -> bool:
    cutoff = utcnow() - timedelta(days=1)
    q = select(Notification).where(Notification.alert_id == alert.id, Notification.created_at >= cutoff)
    for k, v in ref.items():
        q = q.where(getattr(Notification, k) == v)
    return db.scalars(q).first() is not None


def on_inventory_update(db: Session, pantry: Pantry) -> list[Notification]:
    created = []
    stock = fresh_stock(db, pantry.id)
    for a in db.scalars(select(Alert).where(Alert.active.is_(True))).all():
        if "ingredients" not in a.notify_on:
            continue
        dist = haversine_km(a.lat, a.lng, pantry.lat, pantry.lng)
        if dist > a.radius_km:
            continue
        score, have, missing = match_score(a.ingredients, stock)
        if score < a.min_match or _already_notified(db, a, pantry_id=pantry.id, kind="ingredients"):
            continue
        msg = (f"{pantry.name} ({dist:.1f} km away) now has {len(have)}/{len(a.ingredients)} "
               f"ingredients for {a.dish}." + (f" Still missing: {', '.join(missing)}." if missing else ""))
        n = Notification(user_id=a.user_id, alert_id=a.id, kind="ingredients", message=msg, pantry_id=pantry.id)
        db.add(n)
        created.append(n)
    return created


def on_new_recipe(db: Session, recipe: Recipe) -> list[Notification]:
    created = []
    title = norm(recipe.title)
    cultures = {norm(c) for c in recipe.culture_tags}
    for a in db.scalars(select(Alert).where(Alert.active.is_(True))).all():
        if "recipe" not in a.notify_on or a.user_id == recipe.user_id:
            continue
        dish_hit = norm(a.dish) in title or any(w in title for w in norm(a.dish).split() if len(w) > 3)
        culture_hit = bool(a.culture) and norm(a.culture) in cultures
        if not (dish_hit or culture_hit):
            continue
        if recipe.pantry is not None:
            if haversine_km(a.lat, a.lng, recipe.pantry.lat, recipe.pantry.lng) > a.radius_km:
                continue
        where = f" using food from {recipe.pantry.name}" if recipe.pantry else ""
        n = Notification(user_id=a.user_id, alert_id=a.id, kind="recipe", recipe_id=recipe.id,
                         pantry_id=recipe.pantry_id,
                         message=f"New recipe matching your '{a.dish}' alert: {recipe.title}{where}.")
        db.add(n)
        created.append(n)
    return created
