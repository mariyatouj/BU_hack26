# Data and design decisions

## Transit and walking access

The bundled MBTA GTFS schedule was retrieved on November 22, 2026. It covers November 12 through December 12, 2026. The manifest, archive SHA-256, feed version, representative trip patterns, directional stops and shapes are in `data/routes/transit.json`. The offline map draws the official shapes over the app’s illustrative land and water layer. Attribution and the retrieval date appear beside the map. [MBTA feed](https://cdn.mbta.com/MBTA_GTFS.zip) · [MBTA developer resources](https://www.mbta.com/developers/gtfs)

To regenerate, download the archive and run `python3 scripts/prepare_transit.py /path/to/MBTA_GTFS.zip --retrieved YYYY-MM-DD`. Then run `python3 scripts/validate_data.py` and review access records if any stop IDs or patterns have changed. Both directions of typical service are included for Orange, Blue, Red (Ashmont and Braintree), Green B/C/D/E, SL1, bus 1 and bus 39. Drop-off and pickup permissions are checked when validating destination and return stops.

The eight fictional pickup sites are positioned near real named entrances. Their approach lengths are scenario estimates selected after desk review of the GTFS stop, entrance and street information. Each access record names its method, entrance, direction, return stop and review date. Walking estimates use 80 metres per minute rounded up. Actual sidewalk conditions and step-free paths require field verification. The bundled neighborhood/ZIP lookup centers on a demonstration location in the selected area.

## Food and recipes

`data/routes/sites.json` describes the sites and access records. `sessions.json` holds the opening snapshots. Every session, capacity and item observation is synthetic. The separate historical directory in Access help retains the original repository’s September 2021 Boston GIS / GBFB source note and links. The original extraction date is unknown. Visitors are directed to the current locator. [GBFB locator](https://www.gbfb.org/need-food/)

The twenty original demonstration recipes in `recipes.json` are provided under CC0-1.0. Each entry declares acceptable ingredient forms, substitutions, optional extras, equipment, time, servings and source. The canonical ID before the @ sign represents one qualifying food. Only a listed form can satisfy a recipe role. The app displays package-label guidance for dietary preferences. The catalog has not undergone external dietitian or cultural review.

The project’s rehearsal image is synthetic and contains no participant data. It was generated using built-in ImageGen with the prompt “A candid overhead food photograph of a bowl of red lentil dal with soft tomatoes, onion, and cumin on a simple wooden kitchen table. Natural window light, no text, no people. For a clearly labeled synthetic cooking sample in a Boston pantry app.” The image is bundled at `frontend/src/assets/demo/lentil-dal.jpg`. The picker labels it as AI-generated.

## Privacy and reward funding

One browser has one private demo wallet. Submissions require a locally decoded and re-encoded photo, an earlier pickup and three distinct attested ingredients. At most 20 images are retained, up to 1 MiB each. Deleting a photo retains its hash for duplicate detection. Reset removes the photos, hashes and all scenario records. A rolling seven-day window allows three 100-point awards. The opening credit is visibly identified in the ledger.

The catalog simulates three day passes, one week pass and two Planetarium show admissions. Sponsorship is proposed. Every reservation is local and reversible. Actual passes, admissions and access assistance require separate partner arrangements. The app links to existing MBTA and cultural-access programs in Access help.

The statewide household statistic in Access help comes from GBFB and Mass General Brigham’s 2026 report and refers to 2025. The report describes survey estimates. [Food Access Report](https://foodaccessreport.gbfb.org/the-state-of-food-insecurity)
