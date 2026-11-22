"""Validate the data actually imported by the browser and optional API."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "data/routes"
sites, recipes, transit = [json.loads((root / name).read_text()) for name in
                           ("sites.json", "recipes.json", "transit.json")]
patterns = {p["pattern"]: p for p in transit["patterns"]}
stops = transit["stops"]
assert len(sites) == len({s["id"] for s in sites}) == 8
assert len(recipes) == len({r["id"] for r in recipes}) >= 20
assert len({r["cuisine"] for r in recipes}) >= 6
assert transit["source"].startswith("https://") and transit["retrieved"] and transit["feed"]["feed_version"]
assert len(transit["sha256"]) == 64
for p in patterns.values():
    assert p["stops"] and all(s in stops for s in p["stops"])
    assert len(p["shape"]) > 1 and p["direction"] in (0, 1)
for site in sites:
    assert site["isDemo"] and site["access"] and site["source"] and site["retrievedAt"]
    for a in site["access"]:
        p = patterns[a["pattern"]]
        assert a["meters"] > 0 and a["stop"] in p["alight"] and a["entrance"] in stops
        assert a["verifiedAt"] and a["accessibility"] and a["method"]
        if a["returnStop"]:
            assert any(q["id"] == p["id"] and q["direction"] != p["direction"] and
                       a["returnStop"] in q["board"] for q in patterns.values())
sessions = json.loads((root / "sessions.json").read_text())
assert {s["pantryId"] for s in sessions} == {s["id"] for s in sites}
assert len({s["sessionId"] for s in sessions}) == len(sessions)
for s in sessions:
    assert s["startsAt"] < s["endsAt"] and s["sourceMode"] == "demo"
    assert s["timezone"] == "America/New_York"
    assert len({i["key"] for i in s["items"]}) == len(s["items"])
    for item in s["items"]:
        assert s["startsAt"] <= item["observedAt"] < item["validUntil"] <= s["endsAt"]
        assert item["state"] in {"available", "limited", "unavailable", "unknown"}
        assert item["sourceMode"] == "demo"
for recipe in recipes:
    assert recipe["source"] and recipe["license"] and recipe["steps"]
    assert recipe["servings"] > 0 and recipe["minutes"] > 0
    forms = [k for group in recipe["required"] for k in group]
    assert len(forms) == len(set(forms)) and all("@" in k for k in forms)
print(f'{len(sites)} fictional sites, {len(recipes)} recipes, {len(patterns)} directional MBTA patterns validated.')
