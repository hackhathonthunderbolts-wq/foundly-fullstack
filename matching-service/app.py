"""
Foundly Matching Service
-------------------------
Implements the 0-100 confidence scoring model from the product spec (section 7):
weighted blend of category match, text similarity, image similarity, location
proximity and date proximity. Pure-stdlib scoring logic (no ML dependencies
required to run the core algorithm) with an optional image-embedding hook that
can be swapped for a real CLIP-style model later.

Run:
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8001
"""

import math
import re
from collections import Counter
from datetime import date
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Foundly Matching Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Reference data — location adjacency (mirrors the `locations` table described
# in the data model spec). In production this would come from the Java
# reference-service; kept local here so the matching service has no hard
# runtime dependency on the other services.
# ---------------------------------------------------------------------------

LOCATION_ZONES = {
    "Men's Hostel Block A": "hostel",
    "Ladies Hostel Block C": "hostel",
    "Academic Block 1": "academic",
    "Academic Block 2": "academic",
    "Central Library": "academic",
    "Food Court": "campus_life",
    "Sports Complex": "campus_life",
    "Main Gate": "campus_life",
    "Parking Lot": "campus_life",
    "Auditorium": "campus_life",
}

STOPWORDS = {
    "a", "an", "the", "is", "it", "on", "in", "at", "of", "and", "or", "my",
    "with", "for", "to", "was", "were", "near", "by", "this", "that",
}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class PostInput(BaseModel):
    id: str
    category: str
    title: str
    description: str
    location: str
    event_date: date
    image_embedding: Optional[List[float]] = None  # precomputed vector, optional


class ScoreRequest(BaseModel):
    lost_post: PostInput
    found_post: PostInput


class ScoreBreakdown(BaseModel):
    category: int
    text: int
    image: Optional[int]
    location: int
    date: int


class ScoreResponse(BaseModel):
    total: int = Field(..., ge=0, le=100)
    label: str
    breakdown: ScoreBreakdown
    auto_connect: bool


# ---------------------------------------------------------------------------
# Individual signal scorers (each returns 0-100)
# ---------------------------------------------------------------------------

def score_category(cat_a: str, cat_b: str) -> int:
    return 100 if cat_a.strip().lower() == cat_b.strip().lower() else 0


def _tokenize(text: str) -> Counter:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return Counter(w for w in words if w not in STOPWORDS and len(w) > 1)


def score_text(text_a: str, text_b: str) -> int:
    """Cosine similarity over bag-of-words vectors, scaled to 0-100.
    Pure stdlib so this runs with zero extra dependencies; swap for a
    sentence-embedding model (per spec §7.2) when ready."""
    vec_a, vec_b = _tokenize(text_a), _tokenize(text_b)
    if not vec_a or not vec_b:
        return 0

    shared = set(vec_a) & set(vec_b)
    dot = sum(vec_a[w] * vec_b[w] for w in shared)
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0

    cosine = dot / (mag_a * mag_b)
    score = round(cosine * 100)

    # Brand/model-name bonus: any shared token of length >= 5 (proxy for a
    # distinctive brand/model word, e.g. "hydro", "flask", "casio") nudges
    # the score up, since exact distinctive nouns are high-signal per spec.
    distinctive_overlap = [w for w in shared if len(w) >= 5]
    if distinctive_overlap:
        score = min(100, score + 8)

    return max(0, min(100, score))


def score_image(vec_a: Optional[List[float]], vec_b: Optional[List[float]]) -> Optional[int]:
    """Cosine similarity between two image embeddings. Returns None if either
    post has no photo (per spec, this component is then excluded and its
    weight redistributed — handled in `blend_scores`)."""
    if not vec_a or not vec_b:
        return None
    if len(vec_a) != len(vec_b):
        return None
    dot = sum(x * y for x, y in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(x * x for x in vec_a))
    mag_b = math.sqrt(sum(y * y for y in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0
    cosine = dot / (mag_a * mag_b)
    return max(0, min(100, round(cosine * 100)))


def score_location(loc_a: str, loc_b: str) -> int:
    if loc_a == loc_b:
        return 100
    zone_a = LOCATION_ZONES.get(loc_a)
    zone_b = LOCATION_ZONES.get(loc_b)
    if zone_a and zone_a == zone_b:
        return 40
    return 0


def score_date(lost_date: date, found_date: date) -> int:
    """Found date should be on/after lost date; score decays with distance."""
    delta_days = (found_date - lost_date).days
    if delta_days < 0:
        return 0
    if delta_days == 0:
        return 100
    if delta_days >= 30:
        return 0
    # Exponential-ish decay: ~70 at 7 days, ~30 at 30 days
    return max(0, round(100 * math.exp(-delta_days / 14)))


# ---------------------------------------------------------------------------
# Blending (spec §7.2 weights, with §7.3 guardrails)
# ---------------------------------------------------------------------------

WEIGHTS = {
    "category": 0.15,
    "text": 0.35,
    "image": 0.30,
    "location": 0.12,
    "date": 0.08,
}


def blend_scores(cat: int, text: int, image: Optional[int], loc: int, dat: int):
    if image is None:
        # Redistribute the image weight proportionally across remaining signals
        remaining = {k: v for k, v in WEIGHTS.items() if k != "image"}
        total_remaining = sum(remaining.values())
        weights = {k: v / total_remaining for k, v in remaining.items()}
        total = (
            cat * weights["category"]
            + text * weights["text"]
            + loc * weights["location"]
            + dat * weights["date"]
        )
    else:
        total = (
            cat * WEIGHTS["category"]
            + text * WEIGHTS["text"]
            + image * WEIGHTS["image"]
            + loc * WEIGHTS["location"]
            + dat * WEIGHTS["date"]
        )
    return round(total)


def label_for(score: int) -> str:
    if score >= 90:
        return "Very likely match"
    if score > 75:
        return "Likely match"
    if score >= 40:
        return "Possible match"
    return "Low confidence"


@app.get("/health")
def health():
    return {"status": "ok", "service": "matching-service"}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    lost, found = req.lost_post, req.found_post

    cat = score_category(lost.category, found.category)
    text = score_text(f"{lost.title} {lost.description}", f"{found.title} {found.description}")
    image = score_image(lost.image_embedding, found.image_embedding)
    loc = score_location(lost.location, found.location)
    dat = score_date(lost.event_date, found.event_date)

    total = blend_scores(cat, text, image, loc, dat)

    # Guardrail (§7.3): hard category mismatch caps the score at 30
    if cat == 0:
        total = min(total, 30)

    return ScoreResponse(
        total=total,
        label=label_for(total),
        breakdown=ScoreBreakdown(category=cat, text=text, image=image, location=loc, date=dat),
        auto_connect=total > 75,
    )


@app.post("/score/batch")
def score_batch(lost_post: PostInput, found_posts: List[PostInput]):
    """Score one post against a list of opposite-type candidates in one call —
    used by node-api when a new post is created and needs matching against
    every open post of the opposite type (spec §7.1)."""
    results = []
    for fp in found_posts:
        r = score(ScoreRequest(lost_post=lost_post, found_post=fp))
        results.append({"found_post_id": fp.id, **r.dict()})
    results.sort(key=lambda r: r["total"], reverse=True)
    return {"lost_post_id": lost_post.id, "matches": results}
