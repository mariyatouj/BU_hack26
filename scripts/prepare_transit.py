"""Extract the ordinary, directional route patterns used by SaverMeal from MBTA GTFS."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

OUT = Path(__file__).resolve().parents[1] / "data/routes/transit.json"
ROUTES = {"Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E", "741", "1", "39"}


def prepare(path, retrieved):
    with zipfile.ZipFile(path) as feed:
        def rows(name):
            return csv.DictReader(io.TextIOWrapper(feed.open(name + ".txt"), encoding="utf-8-sig"))

        info = next(rows("feed_info"))
        routes = {r["route_id"]: r for r in rows("routes") if r["route_id"] in ROUTES}
        patterns = {p["representative_trip_id"]: p for p in rows("route_patterns")
                    if p["route_id"] in ROUTES and p["route_pattern_typicality"] == "1"}
        trips = {t["trip_id"]: t for t in rows("trips") if t["trip_id"] in patterns}
        paths = {t["shape_id"]: [] for t in trips.values()}
        for pt in rows("shapes"):
            if pt["shape_id"] in paths:
                paths[pt["shape_id"]].append((int(pt["shape_pt_sequence"]), [float(pt["shape_pt_lat"]), float(pt["shape_pt_lon"])]))
        sequences = {tid: [] for tid in trips}
        for row in rows("stop_times"):
            if row["trip_id"] in trips:
                sequences[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"], row["drop_off_type"] != "1", row["pickup_type"] != "1"))
        ids = {sid for seq in sequences.values() for _, sid, _, _ in seq}
        stops = list(rows("stops"))
        parents = {s["parent_station"] for s in stops if s["stop_id"] in ids} - {""}
        places = {s["stop_id"]: dict(name=s["stop_name"], lat=float(s["stop_lat"]), lng=float(s["stop_lon"]),
                                     station=s["parent_station"], kind=s["location_type"], stepFree=s["wheelchair_boarding"])
                  for s in stops if s["stop_id"] in ids | parents or (s["location_type"] == "2" and s["parent_station"] in parents)}
        lines = []
        for tid, t in trips.items():
            route = routes[t["route_id"]]
            lines.append(dict(id=t["route_id"], pattern=t["route_pattern_id"], name=route["route_short_name"] or route["route_long_name"],
                              direction=int(t["direction_id"]), headsign=t["trip_headsign"], color="#" + route["route_color"],
                              shape=[pt for _, pt in sorted(paths[t["shape_id"]])],
                              stops=[sid for _, sid, _, _ in sorted(sequences[tid])],
                              alight=[sid for _, sid, alight, _ in sorted(sequences[tid]) if alight],
                              board=[sid for _, sid, _, board in sorted(sequences[tid]) if board]))
        assert {line["id"] for line in lines} == ROUTES and all(line["shape"] and line["stops"] for line in lines)
        payload = dict(source="https://cdn.mbta.com/MBTA_GTFS.zip", retrieved=retrieved, feed=info,
                       sha256=hashlib.sha256(path.read_bytes()).hexdigest(), patterns=lines, stops=places)
        OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path)
    parser.add_argument("--retrieved", required=True, help="ISO date the archive was downloaded")
    args = parser.parse_args()
    prepare(args.zip, args.retrieved)
