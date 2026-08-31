# 9. Data Model

## 9.1 `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| google_sub | string | Google OAuth subject ID |
| email | string | Real email, never exposed to other users directly (see §8) |
| email_domain_verified | bool | Set by domain check when `REQUIRE_VIT_DOMAIN=true`; currently always `true` (stub) |
| display_name | string | |
| avatar_url | string, nullable | |
| has_completed_onboarding | bool | |
| created_at, updated_at | timestamp | |

## 9.2 `posts`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| owner_id | UUID (FK → users) | |
| type | enum | `lost` \| `found` |
| title | string | |
| category | enum (FK → categories) | |
| description | text | |
| location_id | UUID (FK → locations) | |
| location_notes | string, nullable | |
| event_date | date | "date lost" or "date found" |
| event_time_bucket | enum, nullable | morning/afternoon/evening/night |
| holding_location | enum, nullable | Found posts only |
| contact_preference | enum | relay_only \| allow_direct_after_match |
| reward_note | string, nullable | Lost posts only |
| status | enum | `open`, `matched_pending`, `resolved_matched`, `resolved_self`, `resolved_handed_to_desk`, `expired`, `deleted` |
| text_embedding | vector | cached at submit/edit time |
| created_at, updated_at, expires_at | timestamp | |

## 9.3 `post_photos`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| post_id | UUID (FK → posts) | |
| url | string | |
| image_embedding | vector | cached at upload time |
| sort_order | int | |

## 9.4 `categories` (shared lookup table)
`id, label, icon_key, sort_order` — single source of truth used by both Lost and Found forms.

## 9.5 `locations` (shared lookup table)
`id, label, zone_id, building_id, sort_order` — `zone_id`/`building_id` support the location-adjacency scoring in §7.2.

## 9.6 `matches`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| lost_post_id | UUID (FK → posts) | |
| found_post_id | UUID (FK → posts) | |
| score_total | int (0–100) | |
| score_category | int | raw component scores, for debugging/tuning |
| score_text | int | |
| score_image | int, nullable | null if not computed (no photo on one side) |
| score_location | int | |
| score_date | int | |
| status | enum | `surfaced_low`, `surfaced_possible`, `auto_connected`, `rejected`, `confirmed` |
| created_at, updated_at | timestamp | |

## 9.7 `relay_threads`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| match_id | UUID (FK → matches) | |
| relay_email_address | string | unique generated address |
| lost_user_confirmed | bool | |
| found_user_confirmed | bool | |
| lost_user_shared_email | bool | |
| found_user_shared_email | bool | |
| status | enum | `active`, `resolved`, `blocked` |
| created_at, updated_at | timestamp | |

## 9.8 `relay_messages`
`id, thread_id (FK), sender_id (FK → users), body, photo_url (nullable), sent_via (enum: in_app \| email), created_at`

## 9.9 `reports`
`id, thread_id (FK), reporter_id (FK → users), reported_user_id (FK → users), reason, notes, status (open/reviewed), created_at`
