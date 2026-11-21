from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    university: Mapped[str | None] = mapped_column(String(80), nullable=True)
    t_line: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Red / Orange / Green / Blue / Silver
    avatar: Mapped[str] = mapped_column(String(20), default="sprout")
    points: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Pantry(Base):
    __tablename__ = "pantries"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(200))
    neighborhood: Mapped[str] = mapped_column(String(60))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    # client-choice | pre-packed | mobile | drive-thru
    distribution_model: Mapped[str] = mapped_column(String(30))
    # {"Mon": "10:00-14:00", ...}
    hours: Mapped[dict] = mapped_column(JSON, default=dict)
    # ["Fresh produce", "Halal", "No ID required", ...]
    features: Mapped[list] = mapped_column(JSON, default=list)
    inventory_level: Mapped[str] = mapped_column(String(10), default="medium")  # low | medium | high
    source_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
    submitted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    items: Mapped[list["InventoryItem"]] = relationship(back_populates="pantry", cascade="all, delete-orphan")
    ratings: Mapped[list["PantryRating"]] = relationship(cascade="all, delete-orphan")


class InventoryItem(Base):
    """One row per inventory observation — a natural TimescaleDB hypertable on updated_at."""

    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    pantry_id: Mapped[int] = mapped_column(ForeignKey("pantries.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40))  # produce, grains, protein, canned, dairy, spices
    level: Mapped[str] = mapped_column(String(10), default="medium")  # out | low | medium | high
    # demo | community | pantry | partner. Demo rows are always disclosed in the API/UI.
    source: Mapped[str] = mapped_column(String(20), default="community")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    pantry: Mapped[Pantry] = relationship(back_populates="items")


class PantryRating(Base):
    __tablename__ = "pantry_ratings"
    id: Mapped[int] = mapped_column(primary_key=True)
    pantry_id: Mapped[int] = mapped_column(ForeignKey("pantries.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    stars: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Recipe(Base):
    __tablename__ = "recipes"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    pantry_id: Mapped[int | None] = mapped_column(ForeignKey("pantries.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    ingredients: Mapped[list] = mapped_column(JSON, default=list)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    culture_tags: Mapped[list] = mapped_column(JSON, default=list)  # e.g. ["Mexican"]
    dietary_tags: Mapped[list] = mapped_column(JSON, default=list)  # e.g. ["Vegetarian", "Halal"]
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    minutes: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    author: Mapped[User] = relationship()
    pantry: Mapped[Pantry | None] = relationship()
    ratings: Mapped[list["RecipeRating"]] = relationship(cascade="all, delete-orphan")


class RecipeRating(Base):
    __tablename__ = "recipe_ratings"
    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    taste: Mapped[int] = mapped_column(Integer)
    ease: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PointEvent(Base):
    """Ledger of every point award — leaderboards are aggregates over a time window."""

    __tablename__ = "point_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(30))
    points: Mapped[int] = mapped_column(Integer)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    dish: Mapped[str] = mapped_column(String(80))
    culture: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ingredients: Mapped[list] = mapped_column(JSON, default=list)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_km: Mapped[float] = mapped_column(Float, default=3.0)
    # which events trigger a ping: "ingredients" (pantry stock matches) and/or "recipe" (someone shares a match)
    notify_on: Mapped[list] = mapped_column(JSON, default=lambda: ["ingredients", "recipe"])
    min_match: Mapped[float] = mapped_column(Float, default=0.6)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))  # ingredients | recipe
    message: Mapped[str] = mapped_column(Text)
    pantry_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recipe_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
