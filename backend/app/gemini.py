"""Catalog-backed compatibility adapter for v1 meal ideas and Gemini configuration."""
import json
import os
from pathlib import Path

GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DATA = Path(__file__).resolve().parents[2] / "data/routes"
RECIPES = {r["id"]: r for r in json.loads((DATA / "recipes.json").read_text())}

# Old directory rows predate canonical forms. Only map explicit forms or known seed labels.
SEED_FORMS = {"rice": "rice@dry", "eggs": "egg@shell", "canned tomatoes": "tomatoes@canned",
              "carrots": "carrot@standard", "bananas": "banana@standard", "potatoes": "potato@standard",
              "frozen peas": "peas@frozen", "tofu": "tofu@firm", "oats": "oats@rolled",
              "pasta": "pasta@dry", "peanut butter": "peanut butter@smooth"}


def suggest_meals(pantry_name: str, neighborhood: str, items: list[str],
                  dietary: list[str], culture: str | None) -> dict:
    stock = {}
    for name in items:
        normalized = name.strip().casefold()
        stock[SEED_FORMS.get(normalized, normalized + "@standard")] = name
    ideas = []
    for recipe in RECIPES.values():
        if culture and culture.casefold() != recipe["cuisine"].casefold():
            continue
        if not set(dietary).issubset(recipe["diet"]):
            continue
        uses, missing = [], []
        for options in recipe["required"]:
            item = next((stock[key] for key in options if key in stock), None)
            if item:
                uses.append(item)
            else:
                missing.append(options[0].replace("@", ", "))
        if uses:
            ideas.append((len(uses) / len(recipe["required"]), {
                "title": recipe["title"], "culture": recipe["cuisine"], "minutes": recipe["minutes"],
                "uses": uses, "missing": missing, "substitutions": [],
                "how": " ".join(step.rstrip(".") + "." for step in recipe["steps"]),
            }))
    ideas.sort(key=lambda pair: -pair[0])
    return {"source": "fallback", "pantry": pantry_name, "meals": [meal for _, meal in ideas[:4]]}
