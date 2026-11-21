"""Request-scoped MBTA information for a pantry trip.

The caller's origin is used only while this function is running. It is never
written to the database, included in the response, or placed in the external
directions URL. Google Maps asks the device for its own origin when the user
opens that URL.

MBTA v3 exposes stops, predictions and alerts, but is not a door-to-door route
planner. This module therefore returns useful live information around both
ends of a trip and an external transit-directions handoff. A future
OpenTripPlanner integration can replace the handoff without changing the
privacy contract of the API endpoint.
"""
from __future__ import annotations

import asyncio
import math
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

MBTA_BASE_URL = "https://api-v3.mbta.com"
MBTA_RADIUS_DEGREES = 0.012  # roughly 1 km around Boston
MBTA_TIMEOUT_SECONDS = 6.0


def external_directions_url(destination_lat: float, destination_lng: float) -> str:
    """Build a handoff that deliberately omits the user's origin coordinates."""
    params = {
        "api": "1",
        "destination": f"{destination_lat:.6f},{destination_lng:.6f}",
        "travelmode": "transit",
        "dir_action": "navigate",
    }
    return "https://www.google.com/maps/dir/?" + urlencode(params)


def _headers() -> dict[str, str]:
    key = os.getenv("MBTA_API_KEY")
    return {"x-api-key": key} if key else {}


async def _get(client: httpx.AsyncClient, path: str, params: dict[str, Any]) -> dict:
    response = await client.get(path, params=params)
    response.raise_for_status()
    return response.json()


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius_m = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * radius_m * math.asin(math.sqrt(a)))


def _parse_stops(payload: dict, reference: tuple[float, float]) -> list[dict]:
    out = []
    for row in payload.get("data", []):
        attrs = row.get("attributes") or {}
        lat, lng = attrs.get("latitude"), attrs.get("longitude")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            continue
        out.append({
            "id": row.get("id"),
            "name": attrs.get("name"),
            "address": attrs.get("address"),
            "municipality": attrs.get("municipality"),
            "latitude": lat,
            "longitude": lng,
            "wheelchair_boarding": attrs.get("wheelchair_boarding"),
            "distance_m": _distance_m(reference[0], reference[1], lat, lng),
        })
    out.sort(key=lambda stop: stop["distance_m"])
    return out[:4]


def _route_index(payload: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in payload.get("included", []):
        if row.get("type") != "route":
            continue
        attrs = row.get("attributes") or {}
        out[row.get("id")] = {
            "id": row.get("id"),
            "name": attrs.get("long_name") or attrs.get("short_name") or row.get("id"),
            "short_name": attrs.get("short_name"),
            "color": attrs.get("color"),
            "text_color": attrs.get("text_color"),
            "type": attrs.get("type"),
        }
    return out


def _minutes_until(value: str | None, now: datetime) -> int | None:
    if not value:
        return None
    try:
        when = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return max(0, round((when - now).total_seconds() / 60))
    except (TypeError, ValueError):
        return None


def _parse_predictions(payload: dict, now: datetime) -> list[dict]:
    routes = _route_index(payload)
    out = []
    for row in payload.get("data", []):
        attrs = row.get("attributes") or {}
        relationships = row.get("relationships") or {}

        def rel_id(name: str) -> str | None:
            data = (relationships.get(name) or {}).get("data") or {}
            return data.get("id")

        route_id = rel_id("route")
        when = attrs.get("departure_time") or attrs.get("arrival_time")
        out.append({
            "id": row.get("id"),
            "stop_id": rel_id("stop"),
            "trip_id": rel_id("trip"),
            "route": routes.get(route_id, {"id": route_id, "name": route_id}),
            "direction_id": attrs.get("direction_id"),
            "arrival_time": attrs.get("arrival_time"),
            "departure_time": attrs.get("departure_time"),
            "minutes": _minutes_until(when, now),
            "status": attrs.get("status"),
        })
    out.sort(key=lambda prediction: prediction["minutes"] if prediction["minutes"] is not None else 10**9)
    return out[:16]


def _parse_alerts(payload: dict) -> list[dict]:
    out = []
    for row in payload.get("data", []):
        attrs = row.get("attributes") or {}
        out.append({
            "id": row.get("id"),
            "header": attrs.get("short_header") or attrs.get("header"),
            "effect": attrs.get("effect"),
            "severity": attrs.get("severity"),
            "timeframe": attrs.get("timeframe"),
        })
    return out[:8]


async def transit_snapshot(
    origin: tuple[float, float],
    destination: tuple[float, float],
) -> dict:
    """Return live nearby transit data without returning or retaining origin."""
    generated = datetime.now(timezone.utc)
    common = {
        "generated_at": generated.isoformat(),
        "origin_stored": False,
        "directions_url": external_directions_url(*destination),
    }

    def stop_params(point: tuple[float, float]) -> dict[str, Any]:
        return {
            "filter[latitude]": point[0],
            "filter[longitude]": point[1],
            "filter[radius]": MBTA_RADIUS_DEGREES,
            "sort": "distance",
            "page[limit]": 6,
        }

    try:
        async with httpx.AsyncClient(
            base_url=MBTA_BASE_URL,
            headers=_headers(),
            timeout=MBTA_TIMEOUT_SECONDS,
        ) as client:
            origin_payload, destination_payload = await asyncio.gather(
                _get(client, "/stops", stop_params(origin)),
                _get(client, "/stops", stop_params(destination)),
            )
            origin_stops = _parse_stops(origin_payload, origin)
            destination_stops = _parse_stops(destination_payload, destination)
            stop_ids = list(dict.fromkeys(
                stop["id"] for stop in [*origin_stops, *destination_stops] if stop.get("id")
            ))

            predictions: list[dict] = []
            alerts: list[dict] = []
            warnings: list[str] = []
            if stop_ids:
                prediction_result, alert_result = await asyncio.gather(
                    _get(client, "/predictions", {
                        "filter[stop]": ",".join(stop_ids),
                        "include": "route",
                        "page[limit]": 24,
                    }),
                    _get(client, "/alerts", {
                        "filter[stop]": ",".join(stop_ids),
                        "page[limit]": 12,
                    }),
                    return_exceptions=True,
                )
                if isinstance(prediction_result, Exception):
                    warnings.append("Live arrival predictions are temporarily unavailable.")
                else:
                    predictions = _parse_predictions(prediction_result, generated)
                if isinstance(alert_result, Exception):
                    warnings.append("MBTA service alerts are temporarily unavailable.")
                else:
                    alerts = _parse_alerts(alert_result)

            return {
                **common,
                "source": "mbta-v3",
                "live": True,
                "routing_mode": "nearby-stops",
                "origin_stops": origin_stops,
                "destination_stops": destination_stops,
                "predictions": predictions,
                "alerts": alerts,
                "warnings": warnings,
            }
    except (httpx.HTTPError, ValueError, KeyError):
        # Directions still work if MBTA is unavailable; do not expose upstream
        # URLs, response bodies or keys in the client-facing error.
        return {
            **common,
            "source": "fallback",
            "live": False,
            "routing_mode": "external",
            "origin_stops": [],
            "destination_stops": [],
            "predictions": [],
            "alerts": [],
            "warnings": ["Live MBTA information is temporarily unavailable. Open transit directions to continue."],
        }
