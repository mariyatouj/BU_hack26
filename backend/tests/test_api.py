import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ.pop("GEMINI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def client():
    return TestClient(app)


def test_pantries_sorted_by_distance():
    with client() as c:
        rows = c.get("/api/pantries", params={"lat": 42.3505, "lng": -71.1054}).json()
        assert len(rows) == 9
        assert rows[0]["distance_km"] <= rows[-1]["distance_km"]
        d = c.get(f"/api/pantries/{rows[0]['id']}").json()
        assert d["items"] and "recipes" in d


def test_recipe_upload_awards_points_and_triggers_alert():
    with client() as c:
        before = c.get("/api/me", headers={"X-User-Id": "3"}).json()["points"]
        r = c.post("/api/recipes", headers={"X-User-Id": "3"}, json={
            "title": "Spicy kimchi fried rice", "ingredients": ["rice", "eggs"], "culture_tags": ["Korean"],
            "pantry_id": 1, "image_url": "data:image/png;base64,AAAA"}).json()
        assert r["points_earned"] == 30
        assert r["total"] == before + 30
        assert r["alerts_triggered"] == 1  # user 1 has a fried-rice alert near Allston
        notes = c.get("/api/notifications", headers={"X-User-Id": "1"}).json()
        assert any("fried rice" in n["message"].lower() for n in notes)


def test_rate_recipe_once_for_points():
    with client() as c:
        h = {"X-User-Id": "9"}
        first = c.post("/api/recipes/1/rate", headers=h, json={"taste": 5, "ease": 4}).json()
        again = c.post("/api/recipes/1/rate", headers=h, json={"taste": 4, "ease": 4}).json()
        assert first["points_earned"] == 5 and again["points_earned"] == 0
        assert c.post("/api/recipes/1/rate", headers={"X-User-Id": "2"}, json={"taste": 5, "ease": 5}).status_code == 400


def test_inventory_update_triggers_ingredient_alert():
    with client() as c:
        c.post("/api/alerts", headers={"X-User-Id": "4"},
               json={"dish": "shakshuka", "lat": 42.3297, "lng": -71.0843, "radius_km": 2, "notify_on": ["ingredients"]})
        res = c.post("/api/pantries/6/inventory", headers={"X-User-Id": "4"},
                     json={"items": [{"name": "eggs", "category": "protein", "level": "high"},
                                     {"name": "bell peppers", "category": "produce", "level": "medium"}]}).json()
        assert res["alerts_triggered"] >= 1


def test_leaderboard_groups_and_ai_fallback():
    with client() as c:
        lb = c.get("/api/leaderboard", params={"period": "month", "group": "university"}).json()
        assert lb["rows"][0]["rank"] == 1 and lb["top_recipes"]
        ai = c.post("/api/ai/suggest", json={"pantry_id": 4, "dietary": ["Vegan"]}).json()
        assert ai["source"] == "fallback" and ai["meals"]
        assert all(m["title"] != "Egg fried rice" for m in ai["meals"])  # not vegan
