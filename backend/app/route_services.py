"""Optional connected services for the offline-first Pantry Routes experience."""
import json
import os

import httpx
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from . import transit
from .gemini import DATA, GEMINI_MODEL, GEMINI_URL, RECIPES

router = APIRouter(prefix="/api/routes")
SITES = {r["id"]: r for r in json.loads((DATA / "sites.json").read_text())}


class DemoDirections(BaseModel):
    site_id: str
    origin_lat: float = Field(ge=-90, le=90)
    origin_lng: float = Field(ge=-180, le=180)


@router.post("/directions")
async def directions(body: DemoDirections, response: Response):
    site = SITES.get(body.site_id)
    if not site:
        raise HTTPException(404, "Unknown demo pantry")
    response.headers["Cache-Control"] = "no-store"
    return await transit.transit_snapshot((round(body.origin_lat, 3), round(body.origin_lng, 3)),
                                          (site["lat"], site["lng"]))


class Adaptation(BaseModel):
    recipe_id: str
    pantry: list[str] = Field(max_length=24)
    home: list[str] = Field(max_length=24)
    missing: list[str] = Field(max_length=24)
    uncertain: list[str] = Field(max_length=24)


@router.post("/adapt")
async def adapt(body: Adaptation):
    recipe = RECIPES.get(body.recipe_id)
    if not recipe:
        raise HTTPException(404, "Unknown recipe")
    chosen = body.pantry + body.home + body.missing + body.uncertain
    groups = recipe["required"]
    # Exactly one compatible form per required role. Preserve the browser's snapshot assignments.
    if len(chosen) != len(groups) or any(sum(k in group for k in chosen) != 1 for group in groups):
        raise HTTPException(422, "Inconsistent recipe coverage")
    options = []
    if body.missing:
        options.append("Before cooking, obtain " + ", ".join(k.split("@")[0] for k in body.missing) + ".")
    if body.uncertain:
        options.append("Confirm availability of " + ", ".join(k.split("@")[0] for k in body.uncertain) + " before visiting.")
    for group in groups:
        if len(group) > 1:
            supplied = next(k for k in chosen if k in group)
            options.append("This adaptation accepts " + " or ".join(k.split("@")[0] for k in group)
                           + ". Your selected form is " + supplied.replace("@", ", ") + ".")
    options.extend(step.rstrip(".") + "." for step in recipe["steps"])
    fallback = {"source": "catalog", "tip": options[0]}
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return fallback
    prompt = {"task": "Select up to three distinct catalog tips most relevant to this meal and its gaps. Return JSON with indices in order.",
              "equipment": recipe["equipment"], "coverage": body.model_dump(), "tips": list(enumerate(options))}
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            res = await client.post(GEMINI_URL.format(model=GEMINI_MODEL), headers={"x-goog-api-key": key},
                                    json={"contents": [{"parts": [{"text": json.dumps(prompt)}]}],
                                          "generationConfig": {"responseMimeType": "application/json"}})
        res.raise_for_status()
        picks = json.loads(res.json()["candidates"][0]["content"]["parts"][0]["text"])["indices"]
        if (not isinstance(picks, list) or not 1 <= len(picks) <= 3
                or any(type(i) is not int or i < 0 or i >= len(options) for i in picks)):
            return fallback
        return {"source": "gemini", "tip": " ".join(options[i] for i in dict.fromkeys(picks))}
    except (httpx.HTTPError, ValueError, IndexError, KeyError, TypeError):
        return fallback
