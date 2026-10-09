# ELEV8 — Backend API endpoints (MVP)

REST API covering the whole MVP spec: Coach, Athlete and Super Admin spaces; Sport, Nutrition and Boutique; payments, KYC, support.

---

## 0. Conventions

- **Base URL:** `/api/v1`
- **Auth:** `Authorization: Bearer <accessToken>` (JWT). Public endpoints are marked 🌐.
- **Roles:** `coach`, `athlete`, `admin` (admin sub-roles: `super`, `support`, `content`, `finance`). Allowed roles are shown in brackets, e.g. `[coach]`.
- **Format:** JSON, `camelCase` fields, dates in ISO 8601 (`2026-10-09T14:00:00Z`), calendar days as `YYYY-MM-DD`. Amounts are in **cents** (`4990` = 49.90 €), currency `EUR`.
- **Pagination (lists):** `?page=1&limit=20` → response `{ "data": [...], "page": 1, "limit": 20, "total": 134 }`
- **Common filters:** `?q=` (search), `?sort=createdAt&order=desc`
- **Errors:** `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "field": "reason" } } }`. HTTP codes: 400, 401, 403, 404, 409, 422, 429.
- **Files:** upload first via `POST /uploads` (multipart). It returns a `fileId`, which you then use in the bodies (`coverImageId`, `videoId`…).
- **Payments:** always **web** payments (Stripe Checkout / Stripe Connect), never in-app purchases. The API returns a `checkoutUrl`; confirmation arrives via webhook.
- 🔒 = sensitive action, logged in the audit log (`audit_logs`).

---

## 1. Authentication & account

### `POST /auth/register` 🌐
Create a coach **or** athlete account. One email = one role.
```json
{
  "role": "athlete",
  "firstName": "Léa",
  "lastName": "Martin",
  "email": "lea.martin@email.fr",
  "password": "********",
  "referralCode": "THOMAS-M8",
  "acceptTerms": true
}
```
Coach-only extra fields (more information is required to collect money):
```json
{
  "role": "coach",
  "firstName": "Thomas",
  "lastName": "Mercier",
  "email": "thomas@mercier-perf.fr",
  "password": "********",
  "phone": "+33612345678",
  "brandName": "Mercier Performance",
  "city": "Lyon",
  "specialties": ["Musculation", "Nutrition"],
  "legalStatus": "micro_enterprise",
  "siret": "12345678900012",
  "plan": "trial",
  "billing": "monthly",
  "referralCode": null,
  "acceptTerms": true
}
```
> If an athlete's `email` matches a client **pre-registered** by a coach, the account is linked to that pre-filled profile automatically. The response then contains `"linkedCoachId"`.
> Coach with a paid plan → the response contains `checkoutUrl` (web subscription payment).

### `POST /auth/login` 🌐
```json
{ "email": "lea.martin@email.fr", "password": "********" }
```
Response: `{ "accessToken": "…", "refreshToken": "…", "user": { "id": "…", "role": "athlete" } }`

### `POST /auth/admin/login` 🌐
Step 1 of the Super Admin login (password).
```json
{ "email": "sarah@elev8.app", "password": "********" }
```
Response: `{ "twoFactorToken": "…" }`

### `POST /auth/admin/verify-2fa` 🌐
```json
{ "twoFactorToken": "…", "code": "246810" }
```

### `POST /auth/refresh` 🌐
```json
{ "refreshToken": "…" }
```

### `POST /auth/logout`
```json
{ "refreshToken": "…" }
```

### `POST /auth/forgot-password` 🌐
```json
{ "email": "lea.martin@email.fr" }
```

### `POST /auth/reset-password` 🌐
```json
{ "token": "…", "newPassword": "********" }
```

### `POST /auth/verify-email` 🌐
```json
{ "token": "…" }
```

### `GET /me`
Current user profile (fields depend on the role).

### `PATCH /me`
```json
{
  "firstName": "Léa",
  "lastName": "Martin",
  "phone": "+33645221890",
  "photoId": "file_123",
  "birthDate": "1997-04-12",
  "gender": "F",
  "heightCm": 168,
  "weightKg": 63.4,
  "goal": "Recomposition corporelle",
  "shippingAddress": { "name": "Léa Martin", "line1": "14 rue de la République", "zip": "69002", "city": "Lyon", "country": "FR" }
}
```

### `PATCH /me/password`
```json
{ "currentPassword": "********", "newPassword": "********" }
```

### `PATCH /me/security`
```json
{ "twoFactorEnabled": true, "newLoginAlerts": true }
```

### `GET /me/sessions` — devices connected to the account
### `DELETE /me/sessions/:sessionId` — log a device out

### `PATCH /me/notification-settings`
```json
{
  "workoutReminders": true,
  "checkinReminder": true,
  "coachMessages": true,
  "orderUpdates": true,
  "coachNewCheckinEmail": true,
  "coachCheckinReminderToClient": true,
  "coachAppointmentReminder24h": true
}
```

### `POST /me/devices` — register a push notification token
```json
{ "platform": "ios", "pushToken": "…" }
```

---

## 2. Files & media

### `POST /uploads` (multipart/form-data)
Fields: `file`, `purpose` (`avatar` | `exercise_image` | `exercise_video` | `product_photo` | `cover` | `kyc_id` | `kyc_selfie` | `diploma` | `meal_photo` | `execution_video` | `document` | `chat_attachment` | `brand_logo`).
Response: `{ "fileId": "file_123", "url": "https://…", "mimeType": "video/mp4", "size": 1834221 }`

### `GET /uploads/:fileId` — signed URL
### `DELETE /uploads/:fileId`

---

## 3. Coaches — public profile & directory

### `GET /coaches/directory` 🌐/[athlete]
Directory of **certified** coaches only. Query: `?q=&specialty=&city=&page=`

### `GET /coaches/:coachId/public`
Public profile: bio, specialties, rating, offers, public page.

### `POST /coaches/:coachId/contact` [athlete]
A solo athlete contacts a coach → creates a prospect for that coach (source `elev8_directory`) and a conversation.
```json
{ "goal": "Prise de masse", "message": "Bonjour, je souhaiterais être accompagné…" }
```

---

## 4. Coach — clients (athletes)

### `GET /coach/dashboard` [coach]
Monthly revenue, new clients this week, active athletes, urgent alerts, recent activity, today's appointments.

### `GET /coach/clients` [coach]
Query: `?status=active|pre|paused&goal=&q=`

### `POST /coach/clients/pre-register` [coach]
Pre-register a client before they create their account. Rejected if the plan's client limit is reached.
```json
{
  "firstName": "Franck",
  "lastName": "Benchetrit",
  "email": "franck.benchetrit@email.fr",
  "phone": "+33671304412",
  "gender": "M",
  "mainGoal": "Perte de poids",
  "notes": "Ancienne entorse cheville droite."
}
```

### `POST /coach/clients/link-existing` [coach]
Add an existing (solo) athlete account by email.
```json
{ "email": "hugo.lefevre@email.fr" }
```

### `POST /coach/clients/invite` [coach]
```json
{ "email": "ami@email.fr" }
```

### `GET /coach/clients/:athleteId` [coach]
Client file: overview (streak, sessions done vs planned, adherence, age, last session, next check-in).

### `PATCH /coach/clients/:athleteId` [coach]
```json
{ "notes": "Gêne épaule gauche", "tags": ["Présentiel", "Premium"], "status": "paused", "offerId": "of2" }
```

### `DELETE /coach/clients/:athleteId` 🔒 [coach]
End the affiliation (the athlete becomes solo and keeps their history).
```json
{ "reason": "Fin de suivi" }
```

The 9 tabs of the client file:
- `GET /coach/clients/:athleteId/nutrition` — targets, active plan, journal fill rate, macro adherence
- `GET /coach/clients/:athleteId/program` — current assignment, weeks, sessions, load adjustment
- `GET /coach/clients/:athleteId/planning?source=all|program|oneoff`
- `GET /coach/clients/:athleteId/workouts` — workout history (+ smartwatch data if shared)
- `GET /coach/clients/:athleteId/habits`
- `GET /coach/clients/:athleteId/checkins`
- `GET /coach/clients/:athleteId/progress` — body composition, personal records, load curves
- `GET /coach/clients/:athleteId/calendar?from=2026-10-01&to=2026-10-31` — sessions + appointments

### `GET /coach/habits/overview` [coach]
Total habits, average streak, best streak, one row per client.

### `GET /coach/checkins/overview` [coach]
Counts of late / completed / pending check-ins, one row per client.

### `POST /coach/checkins/remind` [coach]
```json
{ "athleteIds": ["a4", "a8"] }
```

---

## 5. Coach — prospects (CRM)

### `GET /coach/prospects` [coach]
Query: `?status=todo|contacted|meeting|converted|lost&q=`
Response includes counters: `{ total, active, meetings, converted }`.

### `POST /coach/prospects` [coach]
```json
{
  "fullName": "Julia Martins",
  "email": "julia.martins@email.fr",
  "phone": "+33712345678",
  "source": "instagram",
  "status": "todo",
  "notes": "Veut perdre 6 kg pour un mariage."
}
```
`source`: `manual` | `referral` | `instagram` | `elev8_directory` | `referral_link` | `gym`

### `PATCH /coach/prospects/:prospectId` [coach]
```json
{ "status": "converted", "notes": "Convertie après l'appel découverte" }
```

### `POST /coach/prospects/:prospectId/convert` [coach]
Turns the prospect into a pre-registered client.
```json
{ "mainGoal": "Perte de poids" }
```

### `DELETE /coach/prospects/:prospectId` [coach]

---

## 6. Appointments, availability & video calls

### `GET /appointments` [coach, athlete]
Query: `?from=&to=&view=month|week|day|list`. Coach response includes `{ monthCount, videoCount }`.

### `POST /appointments` [coach]
```json
{
  "athleteId": "a1",
  "prospectId": null,
  "type": "monthly_review",
  "mode": "video",
  "startAt": "2026-10-12T14:00:00Z",
  "durationMin": 45,
  "note": "Bilan du 1er mois : photos, mensurations."
}
```
`type`: `monthly_review` | `nutrition_followup` | `technique_followup` | `discovery` | `weekly_checkin` | `emergency`
`mode`: `video` | `in_person`; `durationMin`: 30 | 45 | 60 | 90

### `POST /appointments/book` [athlete]
The athlete books a slot from the coach's availability.
```json
{ "startAt": "2026-10-14T10:00:00Z", "type": "technique_followup", "mode": "video" }
```

### `PATCH /appointments/:appointmentId` [coach]
```json
{ "startAt": "2026-10-12T15:00:00Z", "durationMin": 60, "note": "…" }
```

### `POST /appointments/:appointmentId/cancel` [coach, athlete]
```json
{ "reason": "Empêchement" }
```

### `POST /appointments/:appointmentId/video-token` [coach, athlete]
Returns a token / room URL for the in-app video call (WebRTC provider).
Response: `{ "roomUrl": "https://meet.elev8.app/rdv_123", "token": "…" }`

### `GET /coach/availability` [coach]
### `PUT /coach/availability` [coach]
```json
{
  "days": [
    { "dayOfWeek": 1, "enabled": true, "slots": [{ "start": "09:00", "end": "12:00" }, { "start": "14:00", "end": "19:00" }] },
    { "dayOfWeek": 7, "enabled": false, "slots": [] }
  ]
}
```
`dayOfWeek`: 1 = Monday … 7 = Sunday (max 2 slots per day)

### `GET /coaches/:coachId/available-slots?from=2026-10-10&to=2026-10-24&durationMin=45` [athlete]

---

## 7. Messaging

### `GET /conversations` [coach, athlete, admin]
Query: `?q=&kind=coach|support`

### `POST /conversations` [coach, athlete]
```json
{ "participantId": "a1" }
```

### `GET /conversations/:conversationId/messages?before=<messageId>&limit=30`

### `POST /conversations/:conversationId/messages`
```json
{
  "type": "text",
  "text": "Salut Léa, j'ai augmenté tes charges de 1,5 %",
  "attachmentFileId": null,
  "workoutLogId": null
}
```
`type`: `text` | `file` | `video` (execution video) | `workout_summary` (session summary sent to the coach)

### `POST /conversations/:conversationId/read`

### `POST /conversations/:conversationId/report`
```json
{ "reason": "Messages insistants", "messageIds": ["m1", "m2"] }
```

---

## 8. Sport — exercise library

### `GET /exercises`
Query: `?q=&sport=&pattern=&level=&muscle=&equipment=&source=elev8|mine|coach&page=`
An athlete only sees what their coach makes visible (see `PATCH /coach/settings/library-visibility`).

### `GET /exercises/:exerciseId`

### `POST /exercises` [coach, athlete, admin]
Same creation screen for every role (admin → ELEV8 library).
```json
{
  "name": "Back Squat",
  "coverImageId": "file_img",
  "videoId": "file_vid",
  "youtubeUrl": null,
  "sport": "Musculation",
  "pattern": "Squat",
  "level": "Intermédiaire",
  "muscles": ["Quadriceps", "Fessiers"],
  "equipment": ["Barre"],
  "unilateral": false,
  "description": "Squat barre sur le haut du dos.",
  "cues": ["Poitrine haute", "Genoux vers l'extérieur"],
  "commonErrors": ["Dos arrondi", "Genoux vers l'intérieur"]
}
```
Validation: `name` is required, plus at least one of `coverImageId` / `videoId` / `youtubeUrl`. Custom values are allowed for `sport` / `pattern` / `level` / `muscles` / `equipment` ("+ Custom").

### `PATCH /exercises/:exerciseId` [owner, admin]
Same body (partial).

### `PUT /exercises/:exerciseId/media` [admin, owner]
Replace the video/image **without touching existing sessions**.
```json
{ "coverImageId": "file_new", "videoId": "file_newvid", "youtubeUrl": null }
```

### `POST /exercises/:exerciseId/duplicate` [coach, athlete]
### `DELETE /exercises/:exerciseId` [owner] — soft delete if the exercise is used in a session

### `PATCH /coach/settings/library-visibility` [coach]
```json
{ "elev8LibraryVisible": true, "customExercisesVisible": true }
```

---

## 9. Sport — sessions

### `GET /sessions` [coach, athlete, admin]
Query: `?owner=me|elev8|coach&type=&objective=&q=`

### `GET /sessions/:sessionId`

### `POST /sessions` [coach, athlete, admin]
```json
{
  "name": "Upper Body A",
  "type": "Upper",
  "objective": "Hypertrophie",
  "intensity": "Modérée",
  "items": [
    {
      "exerciseId": "ex42",
      "order": 1,
      "sets": 4,
      "reps": "8",
      "load": "60",
      "restSec": 120,
      "tempo": { "eccentric": 3, "bottomPause": 0, "concentric": 1, "topPause": 0 },
      "targetRir": 2,
      "targetRpe": 7,
      "note": "Omoplates serrées. Alternative : haltères.",
      "labels": { "reps": "Reps", "sets": "Séries", "load": "Charge", "rest": "Repos" },
      "timer": { "mode": "none", "durationSec": null, "sets": null },
      "linkedToNext": false
    },
    {
      "exerciseId": "ex118",
      "order": 2,
      "sets": 3,
      "reps": "45",
      "load": "",
      "restSec": 45,
      "tempo": null,
      "targetRir": null,
      "targetRpe": null,
      "note": "",
      "labels": { "reps": "Durée (s)", "sets": "Séries", "load": "Lest", "rest": "Repos" },
      "timer": { "mode": "countdown", "durationSec": 45, "sets": 3 },
      "linkedToNext": false
    }
  ]
}
```
- `linkedToNext: true` chains the item with the next one, with no rest in between (2 items = bi-set, 3 = tri-set).
- `timer.mode`: `none` | `countdown` | `free`
- `labels` = "Custom labels" (e.g. Charge → "Distance" or "Allure")

### `PUT /sessions/:sessionId` [owner, admin] — same body
### `POST /sessions/:sessionId/duplicate`
### `DELETE /sessions/:sessionId` [owner] — `409` if the session is used in a program

### `POST /coach/one-off-sessions` [coach]
Assign a one-off session outside any program.
```json
{ "sessionId": "s7", "athleteId": "a1", "date": "2026-10-11", "note": "Séance cardio en plus." }
```

### `DELETE /coach/one-off-sessions/:oneOffId` [coach]

---

## 10. Sport — programs & assignments

### `GET /programs` [coach, athlete, admin]
Query: `?owner=me|elev8&objective=&level=&q=&sort=name|weeks`

### `GET /programs/:programId`

### `POST /programs` [coach, admin]
```json
{
  "name": "Recomposition — 8 semaines",
  "objective": "Hypertrophie",
  "level": "Intermédiaire",
  "description": "5 séances/semaine en Upper/Lower + mobilité.",
  "status": "draft",
  "weeks": [
    { "week": 1, "days": ["s1", "s2", null, "s5", "s6", "s4", null] },
    { "week": 2, "days": ["s1", "s2", null, "s5", "s6", "s4", null] }
  ]
}
```
`days`: 7 slots (Monday → Sunday), `sessionId` or `null` (rest day). `status`: `draft` | `published`.

### `PUT /programs/:programId` [owner, admin] — same body
### `POST /programs/:programId/duplicate` [coach]
### `DELETE /programs/:programId` [owner]
### `PATCH /programs/:programId/visibility` [admin]
```json
{ "hidden": true }
```

### `POST /programs/:programId/assign` [coach]
Send the program to one or more athletes (replaces their active program).
```json
{ "athleteIds": ["a1", "a8"], "startDate": "2026-10-12" }
```

### `POST /programs/:programId/start` [athlete]
A solo athlete starts an ELEV8 program.
```json
{ "startDate": "2026-10-05" }
```

### `GET /assignments/:assignmentId` [coach, athlete]
Schedule week by week with status (`done` | `missed` | `today` | `upcoming`) and progress (`done/total`, `%`).

### `POST /assignments/:assignmentId/load-adjustments` [coach]
Raise or lower all of the program's loads at once.
```json
{ "percent": 1.5, "note": "Bonne progression semaine 3" }
```

### `POST /assignments/:assignmentId/load-adjustments/reset` [coach]
```json
{ "note": "Remise à zéro" }
```

### `GET /assignments/:assignmentId/load-adjustments` — history (date, %, author)

### `GET /assignments/:assignmentId/pdf` — program PDF

---

## 11. Sport — live workouts & summaries (athlete)

### `GET /athlete/today` [athlete]
Today's session, nutrition targets, habits, check-in due, next appointment.

### `GET /athlete/schedule?from=&to=` [athlete]

### `POST /workouts` [athlete]
Start a live session.
```json
{ "sessionId": "s2", "assignmentId": "as_a1", "scheduledDate": "2026-10-09" }
```
Response: `{ "workoutId": "w_123", "items": [ ...loads already adjusted... ], "previousPerformance": { "ex1": [ { "reps": 5, "load": 72.5 } ] } }`

### `POST /workouts/:workoutId/sets` [athlete]
Validate a set.
```json
{
  "itemId": "k1",
  "setNumber": 1,
  "reps": "5",
  "load": "72.5",
  "rpe": 8,
  "rir": 2,
  "timeSec": null,
  "note": "Bonne profondeur"
}
```

### `PATCH /workouts/:workoutId/sets/:setId` [athlete] — same body (partial)

### `POST /workouts/:workoutId/items/:itemId/skip` [athlete]

### `POST /workouts/:workoutId/execution-videos` [athlete]
"Capturer l'exécution".
```json
{ "itemId": "k1", "videoFileId": "file_exec", "sendToCoach": true }
```

### `POST /workouts/:workoutId/heart-rate` [athlete]
Live smartwatch samples (optional).
```json
{ "samples": [{ "t": "2026-10-09T18:05:00Z", "bpm": 132 }] }
```

### `POST /workouts/:workoutId/finish` [athlete]
```json
{ "endedAt": "2026-10-09T19:02:00Z", "notes": "" }
```
Response: summary (total duration, completion rate, total volume, average RPE, planned vs done per exercise, done/modified/skipped status, muscles worked, smartwatch data).

### `GET /workouts?athleteId=&from=&to=` [athlete, coach]
### `GET /workouts/:workoutId` — summary

### `POST /workouts/:workoutId/send-to-coach` [athlete]
### `GET /workouts/:workoutId/summary-card.png` — downloadable summary card (with body map)

### `GET /athlete/progress/exercise/:exerciseId` [athlete, coach]
Max load and reps over time ("Bilans").

### `GET /athlete/fun-facts` [athlete]
Total volume, medal (Bronze/Silver/Gold/Diamond), personal records, volume curve, fun comparisons.

---

## 12. Body composition, check-ins, habits

### `GET /athlete/body-metrics` [athlete, coach]
### `POST /athlete/body-metrics` [athlete]
```json
{ "date": "2026-10-09", "weightKg": 63.1, "waistCm": 70.5, "bodyFatPct": 24.1 }
```
### `DELETE /athlete/body-metrics/:metricId` [athlete]

### `GET /athlete/checkins` [athlete, coach]
### `POST /athlete/checkins` [athlete]
```json
{
  "weekStart": "2026-10-05",
  "fatigue": 2,
  "sleep": 4,
  "motivation": 5,
  "programAdherencePct": 90,
  "pain": "Genou droit après les fentes",
  "comment": "Super semaine"
}
```
Scores are 1–5. Notifies the coach (if their setting is enabled).

### `GET /athlete/habits` [athlete, coach]
### `POST /habits` [coach, athlete]
```json
{ "athleteId": "a1", "name": "Hydratation", "kind": "numeric", "target": 2.5, "unit": "L", "step": 0.25, "source": "manual" }
```
`kind`: `boolean` | `numeric`; `source`: `manual` | `watch`
### `PATCH /habits/:habitId` · `DELETE /habits/:habitId`

### `POST /habits/:habitId/entries` [athlete]
```json
{ "date": "2026-10-09", "value": 0.25, "increment": true }
```
For boolean habits: `{ "date": "2026-10-09", "done": true }`

---

## 13. Smartwatches & health data

### `GET /athlete/wearables` [athlete]

### `POST /athlete/wearables/connect` [athlete]
```json
{
  "provider": "garmin",
  "consent": true,
  "dataTypes": ["heart_rate", "calories", "distance_pace", "steps", "sleep", "resting_hr"],
  "shareWithCoach": true
}
```
`provider`: `apple_health` | `garmin` | `fitbit` | `polar` | `samsung` | `suunto` (to confirm). Response: `{ "authUrl": "…" }` (OAuth with the provider).

### `GET /athlete/wearables/callback?provider=garmin&code=…` 🌐 — OAuth return

### `PATCH /athlete/wearables` [athlete]
```json
{ "shareWithCoach": false, "dataTypes": ["heart_rate", "steps"] }
```

### `POST /athlete/wearables/sync` [athlete]
For HealthKit / Health Connect, the mobile app pushes the data itself:
```json
{
  "provider": "apple_health",
  "dailyMetrics": [{ "date": "2026-10-09", "steps": 6730, "sleepHours": 7.3, "restingHr": 54 }],
  "workouts": [{ "workoutId": "w_123", "hrAvg": 132, "hrMax": 176, "kcal": 410, "distanceKm": null, "pace": null, "hrSeries": [110, 125, 140] }]
}
```

### `DELETE /athlete/wearables` [athlete] — disconnect
### `DELETE /athlete/wearables/data` 🔒 [athlete] — delete the health data

---

## 14. Nutrition — calculations, profile & targets

### `POST /nutrition/calculate`
Base metabolism (Mifflin-St Jeor), daily energy expenditure, proposed targets.
```json
{ "sex": "F", "age": 29, "heightCm": 168, "weightKg": 63.4, "activityLevel": "moderate", "goal": "recomposition" }
```
Response:
```json
{ "bmr": 1378, "tdee": 2136, "suggested": { "training": { "kcal": 2080, "protein": 127, "carbs": 265, "fat": 57 }, "rest": { "kcal": 1810, "protein": 127, "carbs": 182, "fat": 63 } } }
```
`activityLevel`: `sedentary` | `light` | `moderate` | `active` | `very_active`; `goal`: `weight_loss` | `muscle_gain` | `maintenance` | `recomposition`

### `GET /athletes/:athleteId/nutrition-profile` [coach, athlete]
### `PUT /athletes/:athleteId/nutrition-profile` [coach, athlete]
```json
{
  "sex": "F",
  "age": 29,
  "heightCm": 168,
  "weightKg": 63.4,
  "activityLevel": "moderate",
  "goal": "recomposition",
  "dietaryTags": ["lactose_free"],
  "allergies": "arachides"
}
```

---

## 15. Nutrition — plans

### `GET /nutrition-plans` [coach, athlete, admin]
Query: `?athleteId=&status=active|template|elev8&q=`

### `GET /nutrition-plans/:planId`

### `POST /nutrition-plans` [coach, athlete, admin]
```json
{
  "name": "Plan recomposition — Léa",
  "athleteId": "a1",
  "status": "active",
  "mode": "detailed",
  "targets": {
    "training": { "kcal": 2050, "protein": 130, "carbs": 230, "fat": 66 },
    "rest": { "kcal": 1800, "protein": 130, "carbs": 170, "fat": 66 }
  },
  "meals": {
    "training": [
      { "name": "Petit-déjeuner", "items": [{ "type": "menu", "id": "m1", "servings": 1 }] },
      { "name": "Déjeuner", "items": [{ "type": "ingredient", "id": "i1", "grams": 140 }, { "type": "ingredient", "id": "i12", "grams": 180 }] },
      { "name": "Dîner", "items": [{ "type": "recipe", "id": "r3", "servings": 1 }] }
    ],
    "rest": []
  },
  "notes": "Hydratation ≥ 2,5 L."
}
```
- `mode`: `detailed` (meal by meal) | `free` (macro targets only, `meals` empty)
- `status`: `active` (sent to the athlete) | `template` (coach template / sold in the shop) | `elev8` (admin only)
- `athleteId: null` for a template or an ELEV8 program
- Saving an `active` plan archives the athlete's previous active plan and notifies them.

### `PUT /nutrition-plans/:planId` — same body
### `POST /nutrition-plans/:planId/duplicate`
### `DELETE /nutrition-plans/:planId`
### `GET /nutrition-plans/:planId/pdf`

### `POST /nutrition-plans/:planId/adopt` [athlete]
The athlete picks an ELEV8 nutrition program (copied as their active plan).

### `GET /athlete/nutrition-plan` [athlete]
Active plan, or `null` → the app shows "Aucun programme nutrition".

### `GET /coach/nutrition/overview` [coach]
Athletes followed in nutrition, active athletes, plans in progress; per athlete: journal fill rate over 14 days, macro adherence, last entry.

---

## 16. Nutrition — ingredients, menus, recipes

### `GET /ingredients`
Query: `?q=&category=carbs|fats|dairy|vegetables|protein|custom&source=elev8|mine`

### `POST /ingredients` [coach, athlete, admin]
```json
{
  "name": "Galette de sarrasin maison",
  "category": "custom",
  "photoId": null,
  "per100g": { "kcal": 160, "protein": 5.5, "carbs": 30, "fat": 2 },
  "portion": { "label": "1 galette", "grams": 60 }
}
```
No photo → a neutral image is shown.

### `PATCH /ingredients/:ingredientId` [owner, admin] — same body (partial; admin can fix an obviously wrong value)
### `PUT /ingredients/:ingredientId/photo` [admin]
```json
{ "photoId": "file_ai_photo" }
```
### `DELETE /ingredients/:ingredientId` [owner]

### `GET /menus`
Query: `?q=&goal=&dietaryTag=&meal=`

### `POST /menus` [coach, admin]
```json
{
  "name": "Bowl poulet, riz & brocoli",
  "meal": "Déjeuner",
  "goal": "muscle_gain",
  "dietaryTags": ["gluten_free", "lactose_free"],
  "photoId": null,
  "items": [
    { "type": "ingredient", "id": "i1", "grams": 150 },
    { "type": "recipe", "id": "r2", "servings": 1 }
  ]
}
```
Calories and macros are **computed by the server** from the items (never from the image).

### `PUT /menus/:menuId` · `POST /menus/:menuId/duplicate` · `DELETE /menus/:menuId`

### `GET /recipes`
Query: `?q=&difficulty=easy|intermediate|hard`. An athlete sees the recipes shared by their coach plus their own.

### `POST /recipes` [coach, athlete, admin]
```json
{
  "name": "Poulet citron & riz basmati",
  "difficulty": "easy",
  "timeMin": 25,
  "servings": 2,
  "photoId": null,
  "items": [{ "type": "ingredient", "id": "i1", "grams": 300 }, { "type": "ingredient", "id": "i12", "grams": 300 }],
  "steps": ["Cuire le riz.", "Saisir le poulet.", "Servir avec un filet de citron."],
  "sharedWithAthleteIds": ["a1", "a3"]
}
```

### `PUT /recipes/:recipeId` · `DELETE /recipes/:recipeId`
### `PUT /recipes/:recipeId/sharing` [coach]
```json
{ "athleteIds": ["a1", "a3", "a4"] }
```

---

## 17. Nutrition — food journal (athlete)

### `GET /athlete/food-log?date=2026-10-09` [athlete, coach]
Entries per meal, totals, targets for the day (training / rest), remaining calories and macros.

### `POST /athlete/food-log` [athlete]
```json
{
  "date": "2026-10-09",
  "meal": "Déjeuner",
  "source": "library",
  "item": { "type": "ingredient", "id": "i1", "grams": 150 }
}
```
Other `source` / `item` variants:
```json
{ "date": "2026-10-09", "meal": "Collation", "source": "menu", "item": { "type": "menu", "id": "m5", "servings": 1 } }
{ "date": "2026-10-09", "meal": "Dîner", "source": "custom", "item": { "type": "custom", "name": "Sandwich maison", "grams": 220, "kcal": 480, "protein": 24, "carbs": 52, "fat": 18 } }
{ "date": "2026-10-09", "meal": "Collation", "source": "barcode", "item": { "type": "barcode", "barcode": "3560070818117", "grams": 150 } }
{ "date": "2026-10-09", "meal": "Déjeuner", "source": "plan", "fromPlanMeal": true }
```

### `PATCH /athlete/food-log/:entryId` [athlete]
```json
{ "grams": 180, "meal": "Dîner" }
```

### `DELETE /athlete/food-log/:entryId` [athlete]

### `GET /food/barcode/:barcode`
Product lookup (e.g. Open Food Facts) → `{ "name": "…", "per100g": { … }, "defaultGrams": 150 }`

### `PUT /athlete/meal-photos` [athlete]
```json
{ "date": "2026-10-09", "meal": "Déjeuner", "photoId": "file_meal" }
```

### `GET /athlete/food-log/history?from=2026-09-10&to=2026-10-09` [athlete, coach]
Daily totals vs targets, status (`on_target` | `over` | `under` | `not_logged`), percentage of targets met over 7 / 30 days.

---

## 18. Boutique — coach side

### `GET /coach/shop/listings` [coach]
### `POST /coach/shop/listings` [coach]
Put a digital program up for sale (requires a verified Stripe Connect account).
```json
{
  "kind": "sport_program",
  "refId": "p1",
  "title": "Programme Recomposition 8 semaines",
  "description": "40 séances, accès immédiat.",
  "coverImageId": "file_cover",
  "priceCents": 4900
}
```
`kind`: `sport_program` | `nutrition_plan`

### `PATCH /coach/shop/listings/:listingId` [coach]
```json
{ "title": "…", "description": "…", "coverImageId": "…", "priceCents": 3900, "published": false }
```

### `GET /coach/shop/products` [coach]
### `POST /coach/shop/products` [coach] (Pro plan or above)
```json
{
  "name": "T-shirt Mercier Performance",
  "description": "T-shirt technique respirant.",
  "photoIds": ["file_p1", "file_p2"],
  "priceCents": 2900,
  "variants": {
    "name": "Taille",
    "options": [{ "label": "S", "stock": 4 }, { "label": "M", "stock": 0 }, { "label": "L", "stock": 7 }]
  },
  "stock": null,
  "published": true
}
```
No variants: `"variants": null, "stock": 25`. Stock at 0 → shown as "épuisé" (sold out) and can't be bought.

### `PATCH /coach/shop/products/:productId` · `DELETE /coach/shop/products/:productId`

### `PATCH /coach/shop/products/:productId/stock` [coach]
```json
{ "variants": [{ "label": "M", "stock": 10 }], "stock": null }
```

### `GET /coach/shop/shipping` [coach]
### `PUT /coach/shop/shipping` [coach]
```json
{ "zones": ["FR", "BE"], "feeCents": 490, "freeShippingEnabled": true, "freeShippingAboveCents": 6000 }
```

### `GET /coach/shop/orders` [coach]
Query: `?status=pending|shipped|all`

### `POST /coach/shop/orders/:orderId/ship` [coach]
```json
{ "carrier": "Colissimo", "trackingNumber": "6A12345678901" }
```
Notifies the buyer. Physical shipping happens outside the app.

### `GET /coach/shop/sales` [coach]
All sales (programs + products), gross amount, ELEV8 commission, net. Query: `?from=&to=&type=digital|product`

### `GET /coach/shop/sales/export.csv` [coach]

---

## 19. Boutique — athlete side

### `GET /shop` [athlete]
Programs and products of the athlete's coach(es) only (no general catalogue). Solo athlete → empty list.

### `GET /shop/listings/:listingId` · `GET /shop/products/:productId`

### `POST /shop/digital-purchases` [athlete]
```json
{ "listingId": "l1", "promoCode": null }
```
Response: `{ "checkoutUrl": "https://checkout.stripe.com/…" }`, or `403 KYC_REQUIRED` on the first purchase if the identity isn't verified yet. After the webhook, the program appears in the athlete's space (sport assignment or active nutrition plan).

### `GET /cart` [athlete]
### `POST /cart/items` [athlete]
```json
{ "productId": "pr1", "variant": "L", "quantity": 1 }
```
### `PATCH /cart/items/:itemId` [athlete]
```json
{ "quantity": 2 }
```
### `DELETE /cart/items/:itemId` [athlete]

### `POST /cart/shipping-quote` [athlete]
```json
{ "country": "FR" }
```
Response: `{ "subtotalCents": 4890, "shippingCents": 490, "totalCents": 5380, "zoneAccepted": true }`

### `POST /orders/checkout` [athlete]
```json
{
  "shippingAddress": { "name": "Léa Martin", "line1": "14 rue de la République", "zip": "69002", "city": "Lyon", "country": "FR" },
  "promoCode": null
}
```
Response: `{ "orderId": "o_1043", "checkoutUrl": "…" }`. Stock is reserved, then decremented on payment.

### `GET /orders` [athlete]
Order history (`pending_shipment` | `shipped` | `refunded`) and digital purchases.

### `GET /orders/:orderId`
### `GET /invoices/:invoiceId/pdf` [buyer, coach, admin]

---

## 20. Payments, subscriptions & payouts

### Coach subscription to ELEV8 (web)
#### `GET /coach/subscription` [coach]
#### `POST /coach/subscription/checkout` [coach]
```json
{ "plan": "pro", "billing": "annual", "promoCode": "LAUNCH30" }
```
`plan`: `start` | `pro` | `elite`; `billing`: `monthly` | `annual` (−20 %). Response: `{ "checkoutUrl": "…" }`. Rejected if the coach has more clients than the new plan allows.
#### `POST /coach/subscription/cancel` [coach]
```json
{ "atPeriodEnd": true, "reason": "…" }
```
#### `GET /coach/subscription/invoices` [coach]

### Coach payouts (Stripe Connect)
#### `GET /coach/payouts/account` [coach]
#### `POST /coach/payouts/onboarding` [coach]
Enhanced verification (business account).
```json
{ "legalStatus": "micro_enterprise", "siret": "12345678900012", "birthDate": "1990-01-01", "businessAddress": "…", "iban": "FR76…" }
```
Response: `{ "onboardingUrl": "https://connect.stripe.com/…" }`
#### `GET /coach/payouts` [coach] — upcoming / past payouts

### Coaching fees (athlete → coach, 0 % ELEV8 commission)
#### `GET /coach/offers` [coach] · `GET /coaches/:coachId/offers` [athlete]
#### `POST /coach/offers` [coach]
```json
{ "name": "Suivi Premium", "priceCents": 12000, "period": "month", "description": "Sport + nutrition + visio mensuelle", "active": true }
```
`period`: `week` | `month` | `quarter` | `one_time`
#### `PATCH /coach/offers/:offerId` · `DELETE /coach/offers/:offerId`

#### `GET /athlete/coaching` [athlete]
Current offer, next due date, payment history.
#### `POST /athlete/coaching/subscribe` [athlete]
```json
{ "offerId": "of2", "promoCode": "RENTREE20" }
```
#### `POST /athlete/coaching/payments/:paymentId/pay` [athlete] → `{ "checkoutUrl": "…" }`

#### `GET /coach/billing/client-invoices` [coach]
Query: `?status=paid|pending|failed`
#### `POST /coach/billing/client-invoices/:paymentId/remind` [coach]

### Coach promo codes
#### `GET /coach/promo-codes` [coach]
#### `POST /coach/promo-codes` [coach]
```json
{ "code": "RENTREE20", "discountType": "percent", "discountValue": 20, "description": "−20 % le premier mois", "maxUses": 20, "expiresAt": "2026-10-31" }
```
#### `PATCH /coach/promo-codes/:codeId`
```json
{ "active": false }
```

### Stripe webhooks
#### `POST /webhooks/stripe` 🌐 (Stripe signature)
Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted`, `account.updated` (Connect), `charge.refunded`, `charge.dispute.created`.

---

## 21. Athlete identity check (KYC at first purchase)

### `GET /athlete/kyc` [athlete]
### `POST /athlete/kyc` [athlete]
```json
{ "method": "card" }
```
or
```json
{ "method": "id_document", "idDocumentFileId": "file_id", "selfieFileId": "file_selfie" }
```
Response: `{ "status": "approved" | "pending", "verificationUrl": "…" }` (provider such as Stripe Identity)

---

## 22. Coach — identity check & certification

### `GET /coach/verification` [coach]
Response: `{ "kycStatus": "approved", "certified": false, "certificationStatus": "none", "listedInDirectory": false }`

### `POST /coach/verification/kyc` [coach]
```json
{
  "path": "certified",
  "documentType": "id_card",
  "idDocumentFileId": "file_id",
  "selfieFileId": "file_selfie",
  "diploma": { "fileId": "file_dip", "title": "BPJEPS AF", "issuer": "CREPS", "year": 2022 }
}
```
`path`: `basic` (ID + selfie) | `certified` (+ diploma)

### `POST /coach/verification/certification` [coach]
An already-verified coach adds a diploma.
```json
{ "fileId": "file_dip", "title": "Licence STAPS", "issuer": "Université Aix-Marseille", "year": 2019 }
```

---

## 23. Coach — contract, settings, documents, branding, referral

### Coach-athlete contract
#### `GET /coach/contract` [coach] — current version + version history
#### `POST /coach/contract/versions` [coach] — publish a new version (athletes are asked to sign it)
```json
{
  "note": "Clause données de santé",
  "clauses": [{ "title": "Objet", "text": "…" }, { "title": "Résiliation", "text": "…" }],
  "paymentRules": [
    { "text": "Le paiement est dû en début de période.", "reminderCount": null },
    { "text": "Après {n} rappels non honorés, le contrat est rompu automatiquement.", "reminderCount": 3 }
  ]
}
```
#### `GET /coach/contract/versions/:version/preview?format=html|pdf|docx` [coach]
#### `GET /athlete/contract` [athlete]
#### `POST /athlete/contract/sign` [athlete]
```json
{ "version": 3, "accepted": true }
```

### Coach profile & public page
#### `PATCH /coach/profile` [coach]
```json
{ "firstName": "Thomas", "lastName": "Mercier", "photoId": "file", "brandName": "Mercier Performance", "gym": "Fit Arena", "city": "Lyon", "bio": "…", "specialties": ["Musculation"] }
```

### Elite branding (Elite plan only)
#### `PUT /coach/branding` [coach]
```json
{
  "enabled": true,
  "displayName": "Mercier Performance",
  "logoFileId": "file_logo",
  "accentColor": "#C5F23A",
  "primaryColor": "#0F1115",
  "email": { "intro": "Bonjour {{prenom}},", "signature": "Thomas — Mercier Performance" },
  "publicPage": { "enabled": true, "theme": "dark", "coverFileId": "file_cover", "tagline": "Deviens la meilleure version de toi-même", "ctaLabel": "Réserver un appel découverte" }
}
```
#### `GET /athlete/branding` [athlete] — branding of the athlete's Elite coach (or ELEV8's default)

### Documents
#### `GET /coach/documents` [coach] · `GET /athlete/documents` [athlete] (shared documents)
#### `POST /coach/documents` [coach]
```json
{ "fileId": "file_doc", "name": "Questionnaire de santé.pdf", "sharedWithAthletes": true }
```
#### `PATCH /coach/documents/:documentId`
```json
{ "sharedWithAthletes": false }
```
#### `DELETE /coach/documents/:documentId`

### Referral / ambassador programme
#### `GET /me/referral` [coach]
Response: `{ "code": "THOMAS-M8", "athleteLink": "https://elev8.app/r/THOMAS-M8", "coachLink": "https://elev8.app/coach/r/THOMAS-M8", "referredAthletes": 5, "referredCoaches": 1, "commissionRate": 10 }`

### Activity stats
#### `GET /coach/stats?months=6` [coach] — revenue (coaching / shop), client count, workouts per week, top programs

---

## 24. Notifications

### `GET /notifications?unreadOnly=true`
### `POST /notifications/:notificationId/read`
### `POST /notifications/read-all`

---

## 25. Help & support (coach / athlete)

### `GET /faq` 🌐
### `GET /support/tickets` [coach, athlete]
### `POST /support/tickets` [coach, athlete]
```json
{ "subject": "Virement Boutique en attente", "topic": "billing", "description": "Mes ventes n'apparaissent pas…", "attachmentFileId": null }
```
Category (`coach` | `coached_athlete` | `solo_athlete`) is set by the server; default priority is 3 (2 for the Elite plan).

### `GET /support/tickets/:ticketId`
### `POST /support/tickets/:ticketId/messages` [coach, athlete]
```json
{ "text": "Merci, c'est réglé !", "attachmentFileId": null }
```

### `GET /support/chat` · `POST /support/chat/messages`
```json
{ "text": "Bonjour, une question sur la commission Boutique" }
```

---

## 26. GDPR (user side)

### `POST /me/data-export` — export request (JSON file sent by email or download)
### `POST /me/account-deletion`
```json
{ "reason": "…", "confirm": true }
```

---

## 27. Public

### `POST /waitlist` 🌐
```json
{ "fullName": "Mathilde Rey", "email": "mathilde@email.fr", "role": "coach", "city": "Lyon", "sport": "Musculation", "social": "@mathilde.coach" }
```
### `GET /plans` 🌐 — coach plans (prices, client limits, features), annual discount, trial length
### `GET /health` 🌐 — API status

---

# SUPER ADMIN — prefix `/admin`

Every endpoint is `[admin]`, with a permission check per sub-role. Endpoints marked 🔒 write to `audit_logs` (author, date, target, reason).

## A1. Team, roles & permissions
- `GET /admin/team`
- `POST /admin/team` 🔒
```json
{ "name": "Yacine Amrani", "email": "yacine@elev8.app", "role": "support" }
```
- `PATCH /admin/team/:adminId` 🔒
```json
{ "role": "finance", "active": true }
```
- `GET /admin/roles` · `PUT /admin/roles/:role` 🔒
```json
{ "permissions": ["dashboard", "clients", "kyc", "support"] }
```

## A2. Dashboard & analytics
- `GET /admin/dashboard` — MRR + change, active coaches + new ones, total athletes, churn rate, revenue over the last 6 months, split by plan (Affiliated, Free, Start, Pro, Elite), last 5 coaches, recent activity
- `GET /admin/analytics?months=12` — monthly revenue (subscriptions / shop commission), top coaches, ads section (future)
- `GET /admin/activity?type=&page=` — activity log (date + time)
- `GET /admin/audit-logs?actor=&action=&from=&to=`

## A3. Clients — coaches, athletes, waitlist
- `GET /admin/coaches?q=&plan=&status=`
- `GET /admin/coaches/:coachId` — profile, subscription & payment status, athletes, shop sales, tickets
- `GET /admin/athletes?q=&coachId=&solo=true`
- `GET /admin/athletes/:athleteId` — profile, coach, recent activity, purchases, tickets
- `POST /admin/users` 🔒
```json
{ "role": "coach", "firstName": "Laura", "lastName": "Chevalier", "email": "laura@email.fr", "plan": "start", "coachId": null, "sendInvite": true }
```
- `POST /admin/users/:userId/suspend` 🔒
```json
{ "reason": "Impayés répétés" }
```
- `POST /admin/users/:userId/reactivate` 🔒
- `DELETE /admin/users/:userId` 🔒
```json
{ "reason": "Demande RGPD", "gdprRequestId": "g1" }
```
- `PATCH /admin/coaches/:coachId/plan` 🔒
```json
{ "plan": "pro", "billing": "monthly" }
```
- `PATCH /admin/coaches/:coachId/free-access` 🔒
```json
{ "freeAccess": true, "until": "2026-12-31" }
```
- `PATCH /admin/coaches/:coachId/subscription-status` 🔒
```json
{ "status": "inactive" }
```
- `PATCH /admin/athletes/:athleteId/coach` 🔒
```json
{ "coachId": "c2" }
```
`coachId: null` = solo
- `GET /admin/gdpr-requests?status=pending`
- `POST /admin/gdpr-requests/:requestId/process` 🔒
```json
{ "action": "export" }
```
`action`: `export` | `delete`
- `GET /admin/waitlist?q=&role=` · `GET /admin/waitlist/export.csv`

## A4. Sport content
- `GET /admin/exercises?source=all|elev8|coach&q=&sport=&pattern=&level=&muscle=` (+ total count)
- `POST /admin/exercises` — same body as `POST /exercises` (ELEV8 library)
- `PATCH /admin/exercises/:exerciseId` · `PUT /admin/exercises/:exerciseId/media` 🔒
- `PATCH /admin/exercises/:exerciseId/visibility` 🔒
```json
{ "hidden": true }
```
- `POST /admin/exercises/:exerciseId/remove` 🔒 — removes content created by a coach/athlete and notifies the author
```json
{ "reason": "Exécution dangereuse" }
```
- `GET /admin/sessions?owner=elev8|users` · `POST /admin/sessions` · `PUT /admin/sessions/:sessionId`
- `GET /admin/programs?tab=library|by_athlete&objective=&q=&sort=` · `POST /admin/programs` · `PUT /admin/programs/:programId` · `PATCH /admin/programs/:programId/visibility`
  (coaches' personal programs are read-only)

## A5. Nutrition content
- `GET /admin/ingredients?category=&q=` · `POST /admin/ingredients` · `PATCH /admin/ingredients/:id` 🔒 (correct a value) · `PUT /admin/ingredients/:id/photo`
- `GET /admin/menus` · `POST /admin/menus` · `PUT /admin/menus/:id`
- `GET /admin/recipes` · `POST /admin/recipes` · `PUT /admin/recipes/:id`
- `PATCH /admin/nutrition/:type/:id/visibility` 🔒 — `type`: `ingredients` | `menus` | `recipes`
```json
{ "hidden": true }
```
- `POST /admin/nutrition/:type/:id/remove` 🔒
```json
{ "reason": "Valeurs nutritionnelles manifestement fausses" }
```
- `GET /admin/nutrition-programs` · `POST /admin/nutrition-programs` · `PUT /admin/nutrition-programs/:id` — same body as `POST /nutrition-plans` (`status: "elev8"`)

## A6. Commerce — plans, promo codes, invoices
- `GET /admin/plans` — coach and athlete plans, subscriber count per plan, MRR
- `PUT /admin/plans/:planId` 🔒
```json
{ "priceCents": 9900, "maxClients": 50, "features": ["Tout Start", "Jusqu'à 50 clients", "Boutique en ligne"], "hiddenFeatures": ["Communauté"] }
```
- `PUT /admin/settings/annual-discount` 🔒
```json
{ "percent": 20 }
```
- `GET /admin/promo-codes` · `POST /admin/promo-codes` 🔒
```json
{ "code": "LAUNCH30", "discountLabel": "−30 % pendant 3 mois", "discountType": "percent", "discountValue": 30, "durationMonths": 3, "plans": ["start", "pro"], "maxUses": 100, "expiresAt": "2026-11-30" }
```
- `PATCH /admin/promo-codes/:codeId` 🔒
```json
{ "active": false }
```
- `GET /admin/invoices?status=paid|pending|late&coachId=` (+ totals: billed, paid, pending, late)
- `GET /admin/invoices/export.csv` · `GET /admin/invoices/export.pdf` · `GET /admin/invoices/:invoiceId/pdf`
- `POST /admin/invoices/:invoiceId/remind` · `POST /admin/invoices/:invoiceId/mark-paid` 🔒

## A7. Affiliations (ambassadors)
- `GET /admin/affiliations?tab=ambassadors|elite_coaches` (+ active ambassadors, revenue generated, commission)
- `POST /admin/ambassadors` 🔒
```json
{ "name": "Samuel Ortiz", "email": "samuel@email.fr" }
```
- `PATCH /admin/ambassadors/:ambassadorId` 🔒
```json
{ "commissionRate": 15, "active": true }
```
- `PUT /admin/settings/ambassador-commission` 🔒
```json
{ "defaultRate": 10 }
```
> The commission base (which payments, for how long) and the payout date still have to be decided before development.

## A8. Boutique (admin)
- `GET /admin/shop/catalog?coachId=&type=listing|product`
- `GET /admin/shop/orders?coachId=&status=&from=&to=`
- `GET /admin/shop/accounts` — per coach: sales, amounts collected, ELEV8 commission, net paid out, Stripe Connect status
- `PATCH /admin/shop/:type/:id/visibility` 🔒 — `type`: `listings` | `products`
```json
{ "hidden": true }
```
- `POST /admin/shop/:type/:id/remove` 🔒
```json
{ "reason": "Allégations de santé trompeuses" }
```
- `POST /admin/shop/orders/:orderId/refund` 🔒
```json
{ "amountCents": 9000, "reason": "Article non conforme" }
```
- `POST /admin/shop/orders/:orderId/dispute/close` 🔒
```json
{ "resolution": "refunded", "note": "…" }
```
- `PUT /admin/settings/shop-commission` 🔒
```json
{ "percent": 8 }
```

## A9. Advertising (planned for later, out of MVP scope)
- `GET /admin/ads/formulas` · `POST /admin/ads/formulas`
```json
{ "name": "Profil mis en avant — 7 jours", "type": "profile", "durationDays": 7, "priceCents": 2900, "description": "…" }
```
- `GET /admin/ads/campaigns` · `GET /admin/ads/discounts` · `GET /admin/ads/analytics`

## A10. Verification, moderation & contracts
- `GET /admin/kyc?status=pending|approved|rejected&type=coach|athlete` (+ total, pending, approval rate)
- `GET /admin/kyc/:requestId` — signed URLs for the ID document, selfie and media
- `POST /admin/kyc/:requestId/approve` 🔒 → "KYC approuvé" email
- `POST /admin/kyc/:requestId/reject` 🔒 → "KYC rejeté" email
```json
{ "reason": "Selfie flou" }
```
- `GET /admin/certifications?status=pending` (+ pending badge count)
- `POST /admin/certifications/:requestId/approve` 🔒 — coach becomes `certified` and appears in the directory (requires an approved KYC)
- `POST /admin/certifications/:requestId/reject` 🔒
```json
{ "reason": "Diplôme illisible" }
```
- `GET /admin/reports?type=conversation|exercise|recipe|product|ingredient&status=pending|processed`
- `GET /admin/reports/:reportId`
- `POST /admin/reports/:reportId/remove-content` 🔒
```json
{ "reason": "…", "notifyAuthor": true }
```
- `POST /admin/reports/:reportId/warn` 🔒
```json
{ "message": "Merci de respecter les règles de la communauté ELEV8." }
```
- `POST /admin/reports/:reportId/dismiss` 🔒
- `GET /admin/contracts?q=&status=signed|pending|expiring|expired` (ELEV8 ↔ coach contracts) · `GET /admin/contracts/:contractId/pdf`
- `GET /admin/contracts/stats` — signed, pending, expiring soon, expired, signatures per month
- `POST /admin/terms/notify` 🔒 ("Notify Terms Update")
```json
{ "message": "Nos conditions générales évoluent au 1er novembre.", "audience": "all", "newVersion": "CGU Coach v2.4" }
```
`audience`: `all` | `coaches` | `athletes`

## A11. Support & communication
- `GET /admin/tickets?q=&status=open|in_progress|resolved&category=coach|coached_athlete|solo_athlete&priority=1..5&assigned=all|mine|unassigned`
- `GET /admin/tickets/:ticketId` — conversation thread, requester's profile (plan, activity, purchases), the requester's other tickets
- `POST /admin/tickets/:ticketId/messages`
```json
{ "text": "Bonjour Hugo, pouvez-vous reconnecter la montre ?", "internal": false }
```
`internal: true` = internal note, hidden from the requester. A reply sends the requester a notification and an email.
- `PATCH /admin/tickets/:ticketId` 🔒
```json
{ "status": "in_progress", "priority": 2, "assigneeId": "ad2" }
```
Priority: 1 Critical, 2 High, 3 Moderate, 4 Low, 5 Planning
- `GET /admin/support-chats` · `GET /admin/support-chats/:conversationId/messages` · `POST /admin/support-chats/:conversationId/messages`
```json
{ "text": "Bonjour Thomas !" }
```
- `GET /admin/email-templates?theme=`
- `PUT /admin/email-templates/:templateId` 🔒
```json
{ "subject": "Votre identité est vérifiée ✅", "body": "Bonjour {{prenom}},\n\n…", "variables": ["prenom"] }
```
- `POST /admin/email-templates/:templateId/test`
```json
{ "to": "sarah@elev8.app", "sampleData": { "prenom": "Léa" } }
```
Template keys: `session_scheduled`, `session_cancelled`, `progress_report`, `program_completed`, `coach_invitation`, `contract_signed`, `client_limit_reached`, `contract_reminder_30d`, `contract_reminder_7d`, `contract_expired`, `client_contract_expiring`, `referral_new`, `commission_paid`, `affiliation_welcome`, `appointment_confirmation`, `appointment_reminder`, `video_guest_link`, `kyc_approved`, `kyc_rejected`

## A12. Documentation, API health, settings
- `GET /admin/docs` · `GET /admin/docs/:docId` · `POST /admin/docs` · `PUT /admin/docs/:docId`
```json
{ "title": "Circulation de l'argent", "category": "Paiements", "content": "<p>…</p>" }
```
- `GET /admin/health/services` — status, latency, uptime for each service (API, auth, DB, Stripe, video storage, video calls, emails, push, smartwatches, PDF, barcode, search)
- `POST /admin/health/services/:serviceId/check`
- `POST /admin/health/batch-check` ("Batch Health Check")
- `GET /admin/settings`
- `PUT /admin/settings/general` 🔒
```json
{ "platformName": "ELEV8", "supportEmail": "support@elev8.app", "emailNotifications": true, "autoBilling": true, "maintenanceMode": false, "trialDays": 14 }
```
`maintenanceMode: true` → every coach/athlete API call returns `503 MAINTENANCE`.
- `GET /admin/settings/platform-promotions/export.csv` · `…/export.pdf` (coaches' advertising revenue — future)

---

## Main enums (reference)

| Field | Values |
|---|---|
| `role` | `coach`, `athlete`, `admin` |
| `plan` (coach) | `trial`, `start`, `pro`, `elite` |
| `athletePlan` | `free` (solo), `affiliated` |
| athlete `status` | `active`, `pre_registered`, `paused`, `suspended` |
| `kycStatus` | `none`, `pending`, `approved`, `rejected` |
| `sport` | Musculation, Athlétisme, CrossFit, Natation (+ custom) |
| `pattern` | Squat, Hinge, Push, Pull, Carry, Core, Cardio, Mobilité, Compound, Isolation |
| `level` | Débutant, Intermédiaire, Avancé |
| `muscles` | Quadriceps, Fessiers, Ischio-jambiers, Pectoraux, Triceps, Dorsaux, Biceps, Deltoïdes, Core, Abdominaux, Trapèzes, Rhomboïdes |
| `equipment` | Barre, Haltères, Poulie, Barre de traction, Banc, Aucun, Foam Roller, Bâton, Barres parallèles |
| session `type` | Push, Pull, Upper, Lower, Full Body, Mobilité |
| session `objective` | Puissance, Force, Explosivité, Hypertrophie, Endurance |
| `intensity` | Faible, Modérée, Élevée |
| program `objective` | prise de masse, sèche, force, explosivité, hypertrophie, endurance, maintien, mobilité, cardio |
| RPE | 1–10 (ELEV8 scale) · RIR 0–5+ |
| food `category` | carbs, fats, dairy, vegetables, protein, custom |
| `dietaryTags` | vegetarian, vegan, gluten_free, lactose_free |
| prospect `status` | todo, contacted, meeting, converted, lost |
| order `status` | pending_payment, pending_shipment, shipped, refunded, dispute |
| ticket `status` | open, in_progress, resolved |
