"""Gemini meal suggestions.

Set GEMINI_API_KEY (and optionally GEMINI_MODEL) to use the real API.
Without a key, a deterministic rule-based fallback returns suggestions so the demo still works.
"""
import json
import os

import httpx

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Fallback templates: (title, culture, needs, dietary, minutes, idea)
TEMPLATES = [
    ("Egg fried rice", "Chinese", ["rice", "eggs", "frozen peas", "carrots", "onion"], ["Vegetarian"], 20,
     "Day-old rice works best. Scramble eggs first, then toss everything in a very hot pan."),
    ("Arroz con frijoles", "Latin American", ["rice", "black beans", "onion", "garlic"], ["Vegan", "Halal"], 35,
     "Sofrito the onion and garlic, add beans with their liquid, serve over rice."),
    ("Masoor dal", "South Asian", ["lentils", "onion", "garlic", "canned tomatoes"], ["Vegan", "Halal"], 30,
     "Simmer lentils until soft, finish with onion-garlic tadka. Great with rice."),
    ("Shakshuka", "Middle Eastern", ["eggs", "canned tomatoes", "onion", "bell peppers"], ["Vegetarian"], 25,
     "Cook down tomatoes and peppers, crack eggs into wells, cover until set."),
    ("Peanut butter banana oats", "American", ["oats", "milk", "bananas", "peanut butter"], ["Vegetarian"], 10,
     "Cook oats in milk, top with sliced banana and a spoon of peanut butter."),
    ("Tomato garlic pasta", "Italian", ["pasta", "canned tomatoes", "garlic", "onion"], ["Vegan"], 20,
     "Simmer tomatoes with garlic while pasta cooks; loosen with pasta water."),
    ("Potato lentil soup", "Irish", ["potatoes", "carrots", "onion", "lentils"], ["Vegan", "Halal"], 40,
     "One pot: sweat onion and carrot, add diced potato and lentils, cover with water and simmer."),
    ("Tofu broccoli stir fry", "Chinese", ["tofu", "broccoli", "carrots", "rice", "soy sauce"], ["Vegan"], 25,
     "Crisp the tofu first, then stir-fry vegetables and glaze with soy sauce."),
    ("Turkey bean chili", "American", ["ground turkey", "black beans", "canned tomatoes", "onion"], ["Halal"], 45,
     "Brown turkey with onion, add beans and tomatoes, simmer 30 minutes."),
    ("Chicken ginger congee", "Chinese", ["rice", "chicken", "ginger", "scallions"], [], 60,
     "Simmer rice in lots of water with ginger and chicken until creamy; top with scallions."),
]


def _fallback(pantry_name: str, items: list[str], dietary: list[str], culture: str | None) -> dict:
    stock = {i.lower() for i in items}
    ideas = []
    for title, cult, needs, diet, mins, how in TEMPLATES:
        if dietary and not all(d in diet or (d == "Vegetarian" and "Vegan" in diet) for d in dietary):
            continue
        have = [n for n in needs if any(n in s or s in n for s in stock)]
        if len(have) / len(needs) < 0.5:
            continue
        score = len(have) / len(needs) + (0.3 if culture and culture.lower() in cult.lower() else 0)
        ideas.append((score, {
            "title": title, "culture": cult, "minutes": mins,
            "uses": have, "missing": [n for n in needs if n not in have],
            "substitutions": [f"No {m}? Skip it or swap with what's on the shelf." for m in needs if m not in have][:2],
            "how": how,
        }))
    ideas.sort(key=lambda x: -x[0])
    return {"source": "fallback", "pantry": pantry_name, "meals": [i for _, i in ideas[:4]]}


def suggest_meals(pantry_name: str, neighborhood: str, items: list[str],
                  dietary: list[str], culture: str | None) -> dict:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return _fallback(pantry_name, items, dietary, culture)

    prompt = (
        "You help Boston residents cook with food-pantry ingredients.\n"
        f"Pantry: {pantry_name} in {neighborhood}, Boston.\n"
        f"Available now: {', '.join(items)}.\n"
        f"Dietary needs: {', '.join(dietary) or 'none'}. Preferred cuisine: {culture or 'any'}.\n"
        "Suggest 3-4 affordable meals that mainly use the available items, including at least one dish "
        "inspired by the neighborhood's communities. Assume only salt, pepper and oil at home.\n"
        'Reply as JSON: {"meals":[{"title":str,"culture":str,"minutes":int,"uses":[str],'
        '"missing":[str],"substitutions":[str],"how":str}]}'
    )
    try:
        r = httpx.post(
            GEMINI_URL.format(model=GEMINI_MODEL),
            params={"key": key},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"responseMimeType": "application/json", "temperature": 0.7}},
            timeout=30,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
        return {"source": "gemini", "pantry": pantry_name, "meals": data.get("meals", [])}
    except Exception as e:  # never break the demo because of the LLM
        out = _fallback(pantry_name, items, dietary, culture)
        out["error"] = f"Gemini unavailable: {type(e).__name__}"
        return out
