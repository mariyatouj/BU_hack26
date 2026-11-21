"""Pantry Pass API (v1).  Run:  uvicorn app.main:app --reload   (from backend/)

Auth is stubbed for the hackathon: send `X-User-Id: <id>` (defaults to user 1).
"""
import os
from contextlib import asynccontextmanager
from datetime import timedelta
from statistics import mean
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import alerts as alert_engine
from .db import get_db
from .gemini import suggest_meals
from .models import (Alert, InventoryItem, Notification, Pantry, PantryRating, PointEvent, Recipe, RecipeRating,
                     User, utcnow)
from .points import POINTS, PRIZES, award, level_for
from .seed import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Pantry Pass API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------

def current_user(x_user_id: int = Header(default=1), db: Session = Depends(get_db)) -> User:
    user = db.get(User, x_user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "university": u.university, "t_line": u.t_line,
            "avatar": u.avatar, "points": u.points, "level": level_for(u.points)}


def latest_items(db: Session, pantry_id: int) -> list[InventoryItem]:
    """Latest observation per item name."""
    rows = db.scalars(select(InventoryItem).where(InventoryItem.pantry_id == pantry_id)
                      .order_by(InventoryItem.updated_at.desc())).all()
    seen, out = set(), []
    for r in rows:
        if r.name.lower() not in seen:
            seen.add(r.name.lower())
            out.append(r)
    return out


def pantry_out(db: Session, p: Pantry, lat: float | None = None, lng: float | None = None,
               detail: bool = False) -> dict:
    stars = [r.stars for r in p.ratings]
    items = latest_items(db, p.id)
    month_ago = utcnow() - timedelta(days=30)
    cooks = db.scalar(select(func.count(func.distinct(Recipe.user_id)))
                      .where(Recipe.pantry_id == p.id, Recipe.created_at >= month_ago)) or 0
    visits = db.scalar(select(func.count(PointEvent.id)).where(
        PointEvent.action == "visit_pantry", PointEvent.ref_id == p.id, PointEvent.created_at >= month_ago)) or 0
    out = {
        "id": p.id, "name": p.name, "address": p.address, "neighborhood": p.neighborhood,
        "lat": p.lat, "lng": p.lng, "distribution_model": p.distribution_model, "hours": p.hours,
        "features": p.features, "inventory_level": p.inventory_level, "verified": p.verified,
        "rating": round(mean(stars), 1) if stars else None, "rating_count": len(stars),
        "item_count": len([i for i in items if i.level != "out"]),
        "last_updated": max((i.updated_at for i in items), default=None),
        "cooks_last_30d": cooks, "visits_last_30d": visits,
        "distance_km": round(alert_engine.haversine_km(lat, lng, p.lat, p.lng), 2) if lat is not None and lng is not None else None,
    }
    if detail:
        out["items"] = [{"name": i.name, "category": i.category, "level": i.level, "updated_at": i.updated_at}
                        for i in sorted(items, key=lambda i: (i.category, i.name))]
        out["reviews"] = [{"stars": r.stars, "comment": r.comment, "created_at": r.created_at} for r in p.ratings]
        recs = db.scalars(select(Recipe).where(Recipe.pantry_id == p.id).order_by(Recipe.created_at.desc())).all()
        out["recipes"] = [recipe_out(r) for r in recs]
    return out


def recipe_out(r: Recipe) -> dict:
    taste = [x.taste for x in r.ratings]
    ease = [x.ease for x in r.ratings]
    return {
        "id": r.id, "title": r.title, "description": r.description, "ingredients": r.ingredients,
        "steps": r.steps, "culture_tags": r.culture_tags, "dietary_tags": r.dietary_tags,
        "image_url": r.image_url, "minutes": r.minutes, "created_at": r.created_at,
        "author": {"id": r.author.id, "name": r.author.name, "university": r.author.university},
        "pantry": {"id": r.pantry.id, "name": r.pantry.name} if r.pantry else None,
        "taste": round(mean(taste), 1) if taste else None,
        "ease": round(mean(ease), 1) if ease else None,
        "rating_count": len(taste),
        "score": round((mean(taste) + mean(ease)) / 2, 2) if taste else 0,
    }


# ---------- users & points ----------

@app.get("/api/health")
def health():
    return {"ok": True, "gemini": bool(os.getenv("GEMINI_API_KEY"))}


@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.id)).all()]


@app.get("/api/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    events = db.scalars(select(PointEvent).where(PointEvent.user_id == user.id)
                        .order_by(PointEvent.created_at.desc()).limit(15)).all()
    return {**user_out(user),
            "history": [{"action": e.action, "points": e.points, "created_at": e.created_at} for e in events]}


@app.get("/api/points/rules")
def point_rules():
    return {"points": POINTS, "prizes": PRIZES}


# ---------- pantries ----------

class PantryIn(BaseModel):
    name: str
    address: str
    neighborhood: str
    lat: float
    lng: float
    distribution_model: Literal["client-choice", "pre-packed", "mobile", "drive-thru"] = "client-choice"
    hours: dict[str, str] = {}
    features: list[str] = []


class ItemIn(BaseModel):
    name: str
    category: str = "other"
    level: Literal["out", "low", "medium", "high"] = "medium"


class InventoryIn(BaseModel):
    items: list[ItemIn]
    inventory_level: Literal["low", "medium", "high"] | None = None


class PantryRatingIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str | None = None


@app.get("/api/pantries")
def list_pantries(lat: float | None = None, lng: float | None = None, feature: str | None = None,
                  model: str | None = None, include_unverified: bool = False, db: Session = Depends(get_db)):
    q = select(Pantry)
    if not include_unverified:
        q = q.where(Pantry.verified.is_(True))
    out = [pantry_out(db, p, lat, lng) for p in db.scalars(q).all()]
    if feature:
        out = [p for p in out if feature in p["features"]]
    if model:
        out = [p for p in out if p["distribution_model"] == model]
    if lat is not None and lng is not None:
        out.sort(key=lambda p: p["distance_km"])
    return out


@app.get("/api/pantries/{pantry_id}")
def get_pantry(pantry_id: int, lat: float | None = None, lng: float | None = None, db: Session = Depends(get_db)):
    p = db.get(Pantry, pantry_id) or _404("Pantry")
    return pantry_out(db, p, lat, lng, detail=True)


@app.get("/api/pantries/{pantry_id}/history")
def pantry_history(pantry_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Ingredient availability over time (TimescaleDB time_bucket candidate)."""
    cutoff = utcnow() - timedelta(days=days)
    rows = db.scalars(select(InventoryItem).where(InventoryItem.pantry_id == pantry_id,
                                                  InventoryItem.updated_at >= cutoff)
                      .order_by(InventoryItem.updated_at)).all()
    return [{"name": r.name, "level": r.level, "updated_at": r.updated_at} for r in rows]


@app.post("/api/pantries", status_code=201)
def submit_pantry(body: PantryIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = Pantry(**body.model_dump(), verified=False, submitted_by=user.id)
    db.add(p)
    db.commit()
    return {"id": p.id, "verified": False, "message": f"Thanks! You'll earn {POINTS['submit_pantry']} points once it's verified."}


@app.post("/api/pantries/{pantry_id}/verify")
def verify_pantry(pantry_id: int, db: Session = Depends(get_db)):
    p = db.get(Pantry, pantry_id) or _404("Pantry")
    if not p.verified:
        p.verified = True
        if p.submitted_by:
            award(db, db.get(User, p.submitted_by), "submit_pantry", p.id)
        db.commit()
    return {"id": p.id, "verified": True}


@app.post("/api/pantries/{pantry_id}/inventory")
def update_inventory(pantry_id: int, body: InventoryIn, user: User = Depends(current_user),
                     db: Session = Depends(get_db)):
    p = db.get(Pantry, pantry_id) or _404("Pantry")
    for it in body.items:
        db.add(InventoryItem(pantry_id=p.id, **it.model_dump()))
    if body.inventory_level:
        p.inventory_level = body.inventory_level
    pts = award(db, user, "update_inventory", p.id)
    db.flush()
    notes = alert_engine.on_inventory_update(db, p)
    db.commit()
    return {"points_earned": pts, "alerts_triggered": len(notes)}


@app.post("/api/pantries/{pantry_id}/rate")
def rate_pantry(pantry_id: int, body: PantryRatingIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    db.get(Pantry, pantry_id) or _404("Pantry")
    db.add(PantryRating(pantry_id=pantry_id, user_id=user.id, **body.model_dump()))
    pts = award(db, user, "rate_pantry", pantry_id)
    db.commit()
    return {"points_earned": pts, "total": user.points}


@app.post("/api/pantries/{pantry_id}/visit")
def visit_pantry(pantry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.get(Pantry, pantry_id) or _404("Pantry")
    today = utcnow() - timedelta(hours=12)
    dup = db.scalars(select(PointEvent).where(PointEvent.user_id == user.id, PointEvent.action == "visit_pantry",
                                              PointEvent.ref_id == pantry_id, PointEvent.created_at >= today)).first()
    if dup:
        return {"points_earned": 0, "total": user.points, "message": "Already checked in today"}
    pts = award(db, user, "visit_pantry", pantry_id)
    db.commit()
    return {"points_earned": pts, "total": user.points}


# ---------- recipes ----------

class RecipeIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = ""
    ingredients: list[str] = Field(min_length=1)
    steps: list[str] = []
    culture_tags: list[str] = []
    dietary_tags: list[str] = []
    pantry_id: int | None = None
    image_url: str | None = None  # URL or data: URI
    minutes: int = 30


class RecipeRatingIn(BaseModel):
    taste: int = Field(ge=1, le=5)
    ease: int = Field(ge=1, le=5)


@app.get("/api/recipes")
def list_recipes(culture: str | None = None, dietary: str | None = None, pantry_id: int | None = None,
                 q: str | None = None, sort: Literal["top", "new", "easy"] = "top", db: Session = Depends(get_db)):
    out = [recipe_out(r) for r in db.scalars(select(Recipe)).all()]
    if culture:
        out = [r for r in out if culture in r["culture_tags"]]
    if dietary:
        out = [r for r in out if dietary in r["dietary_tags"]]
    if pantry_id:
        out = [r for r in out if r["pantry"] and r["pantry"]["id"] == pantry_id]
    if q:
        ql = q.lower()
        out = [r for r in out if ql in r["title"].lower() or any(ql in i.lower() for i in r["ingredients"])]
    key = {"top": lambda r: (-r["score"], -r["rating_count"]),
           "new": lambda r: r["created_at"],
           "easy": lambda r: (-(r["ease"] or 0), r["minutes"])}[sort]
    out.sort(key=key, reverse=(sort == "new"))
    return out


@app.post("/api/recipes", status_code=201)
def create_recipe(body: RecipeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.pantry_id:
        db.get(Pantry, body.pantry_id) or _404("Pantry")
    r = Recipe(user_id=user.id, **body.model_dump())
    db.add(r)
    db.flush()
    pts = award(db, user, "share_recipe", r.id)
    if body.image_url:
        pts += award(db, user, "recipe_photo", r.id)
    db.refresh(r)
    notes = alert_engine.on_new_recipe(db, r)
    db.commit()
    return {"recipe": recipe_out(r), "points_earned": pts, "total": user.points, "alerts_triggered": len(notes)}


@app.post("/api/recipes/{recipe_id}/rate")
def rate_recipe(recipe_id: int, body: RecipeRatingIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    r = db.get(Recipe, recipe_id) or _404("Recipe")
    if r.user_id == user.id:
        raise HTTPException(400, "You can't rate your own recipe")
    existing = db.scalars(select(RecipeRating).where(RecipeRating.recipe_id == recipe_id,
                                                     RecipeRating.user_id == user.id)).first()
    pts = 0
    if existing:
        existing.taste, existing.ease = body.taste, body.ease
    else:
        db.add(RecipeRating(recipe_id=recipe_id, user_id=user.id, **body.model_dump()))
        pts = award(db, user, "rate_recipe", recipe_id)
    db.commit()
    db.refresh(r)
    return {"recipe": recipe_out(r), "points_earned": pts, "total": user.points}


# ---------- leaderboard ----------

@app.get("/api/leaderboard")
def leaderboard(period: Literal["week", "month", "all"] = "week",
                group: Literal["user", "university", "t_line"] = "user", db: Session = Depends(get_db)):
    q = select(PointEvent.user_id, func.sum(PointEvent.points)).group_by(PointEvent.user_id)
    if period != "all":
        q = q.where(PointEvent.created_at >= utcnow() - timedelta(days=7 if period == "week" else 30))
    totals = dict(db.execute(q).all())
    users = {u.id: u for u in db.scalars(select(User)).all()}
    if group == "user":
        rows = [{"key": users[uid].name, "user": user_out(users[uid]), "points": pts} for uid, pts in totals.items()]
    else:
        agg: dict[str, dict] = {}
        for uid, pts in totals.items():
            k = getattr(users[uid], group) or "Unaffiliated"
            agg.setdefault(k, {"key": k, "points": 0, "members": 0})
            agg[k]["points"] += pts
            agg[k]["members"] += 1
        rows = list(agg.values())
    rows.sort(key=lambda r: -r["points"])
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["prize"] = next((p["prize"] for p in PRIZES if i <= p["rank"]), None) if group == "user" else None

    since = utcnow() - timedelta(days=7 if period == "week" else 30 if period == "month" else 10_000)
    recs = [recipe_out(r) for r in db.scalars(select(Recipe).where(Recipe.created_at >= since)).all()]
    recs.sort(key=lambda r: (-r["score"], -r["rating_count"]))
    return {"period": period, "group": group, "rows": rows, "top_recipes": recs[:5]}


# ---------- alerts ----------

class AlertIn(BaseModel):
    dish: str
    culture: str | None = None
    ingredients: list[str] | None = None
    lat: float
    lng: float
    radius_km: float = Field(default=3.0, gt=0, le=30)
    notify_on: list[Literal["ingredients", "recipe"]] = ["ingredients", "recipe"]
    min_match: float = Field(default=0.6, ge=0.1, le=1)


def alert_out(a: Alert) -> dict:
    return {"id": a.id, "dish": a.dish, "culture": a.culture, "ingredients": a.ingredients, "lat": a.lat,
            "lng": a.lng, "radius_km": a.radius_km, "notify_on": a.notify_on, "min_match": a.min_match,
            "active": a.active, "created_at": a.created_at}


@app.get("/api/alerts")
def list_alerts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc())).all()
    return [{**alert_out(a), "matches": alert_engine.alert_matches(db, a)} for a in rows]


@app.post("/api/alerts", status_code=201)
def create_alert(body: AlertIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ingredients = body.ingredients or alert_engine.ingredients_for_dish(body.dish)
    if not ingredients:
        raise HTTPException(422, "Unknown dish — please list its main ingredients")
    a = Alert(user_id=user.id, **body.model_dump(exclude={"ingredients"}), ingredients=ingredients)
    db.add(a)
    db.commit()
    return {**alert_out(a), "matches": alert_engine.alert_matches(db, a)}


@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.get(Alert, alert_id)
    if not a or a.user_id != user.id:
        _404("Alert")
    db.query(Notification).filter(Notification.alert_id == a.id).update({Notification.alert_id: None})
    db.delete(a)
    db.commit()
    return {"deleted": alert_id}


@app.get("/api/dishes")
def known_dishes():
    return alert_engine.DISH_INGREDIENTS


@app.get("/api/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.created_at.desc()).limit(30)).all()
    return [{"id": n.id, "kind": n.kind, "message": n.message, "pantry_id": n.pantry_id, "recipe_id": n.recipe_id,
             "read": n.read, "created_at": n.created_at} for n in rows]


@app.post("/api/notifications/read")
def mark_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id).update({Notification.read: True})
    db.commit()
    return {"ok": True}


# ---------- Gemini ----------

class SuggestIn(BaseModel):
    pantry_id: int
    dietary: list[str] = []
    culture: str | None = None


@app.post("/api/ai/suggest")
def ai_suggest(body: SuggestIn, db: Session = Depends(get_db)):
    p = db.get(Pantry, body.pantry_id) or _404("Pantry")
    items = [i.name for i in latest_items(db, p.id) if i.level != "out"]
    return suggest_meals(p.name, p.neighborhood, items, body.dietary, body.culture)


def _404(what: str):
    raise HTTPException(404, f"{what} not found")
