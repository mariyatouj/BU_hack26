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
        assert d["phone"] and d["source_url"]
        assert d["inventory_status"] == "demo"
        assert all(item["source"] == "demo" for item in d["items"])


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


def test_directions_uses_origin_once_and_disables_caching(monkeypatch):
    seen = {}

    async def fake_snapshot(origin, destination):
        seen["origin"] = origin
        seen["destination"] = destination
        return {
            "source": "mbta-v3",
            "live": True,
            "routing_mode": "nearby-stops",
            "generated_at": "2026-11-21T12:00:00+00:00",
            "origin_stored": False,
            "directions_url": "https://www.google.com/maps/dir/?api=1&destination=42.1%2C-71.1&travelmode=transit",
            "origin_stops": [],
            "destination_stops": [],
            "predictions": [],
            "alerts": [],
            "warnings": [],
        }

    monkeypatch.setattr("app.main.transit.transit_snapshot", fake_snapshot)
    with client() as c:
        response = c.post("/api/directions", json={
            "pantry_id": 1,
            "origin_lat": 12.345678,
            "origin_lng": -45.678912,
        })

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, max-age=0"
    assert response.headers["pragma"] == "no-cache"
    assert seen["origin"] == (12.346, -45.679)  # only an approximate area reaches MBTA
    assert seen["destination"] == (response.json()["pantry"]["lat"], response.json()["pantry"]["lng"])
    assert response.json()["origin_stored"] is False
    assert "12.345678" not in response.text
    assert "-45.678912" not in response.text


def test_directions_validation_and_missing_pantry():
    with client() as c:
        bad_location = c.post("/api/directions", json={
            "pantry_id": 1,
            "origin_lat": 100,
            "origin_lng": -71,
        })
        missing = c.post("/api/directions", json={
            "pantry_id": 99999,
            "origin_lat": 42.35,
            "origin_lng": -71.1,
        })

    assert bad_location.status_code == 422
    assert missing.status_code == 404
