# Bug report: intermittent 401 on GET /schools/{id}/members

## Symptom
On the school "scheduling" page (Command Center), the teacher roster sometimes
renders empty even though the user is a valid OWNER and the school genuinely
has teachers. No error is shown — the page just looks like a school with no
teachers.

## Evidence (BFF log capture, single browser session, no navigation away)

First page load — `/schools/{id}/members?role=TEACHER` returns 401:
```
[BFF] →   GET     http://localhost/api/v1/schools/f3ced490-.../members?role=TEACHER
[BFF] ←   GET     401  http://localhost/api/v1/schools/f3ced490-.../members?role=TEACHER  +37ms
GET /api/schools/f3ced490-.../scheduling/command-center 200 in 136ms
```

~1s later, with the *same* session cookies (no token refresh logged in
between), the identical request succeeds with the full roster:
```
[BFF] →   GET     http://localhost/api/v1/schools/f3ced490-.../members?role=TEACHER
[BFF] ←   GET     200  http://localhost/api/v1/schools/f3ced490-.../members?role=TEACHER  +29ms
        body: [ ...6 TEACHER members... ]
```

Other organization-service endpoints called in the same burst
(`/schools`, `/schools/by-slug/{slug}`) succeeded on the first try with the
same access token, so this isn't a generally-expired/invalid token — it's
specific to `/schools/{id}/members`.

## Suspected cause
The first page load fires ~5 concurrent requests to organization-service
(`/schools`, `/schools/by-slug/{slug}`, `/schools` again, `/schools/{id}/members`)
within a few ms of each other (see Promise.all-style burst in BFF logs). The
`/members` endpoint's auth/membership check appears to race under this
concurrent load and intermittently reject a valid session with 401. A retry
of the exact same request moments later succeeds, which points at a
transient race in the auth/membership-check path on the organization-service
side (e.g. an async permission lookup that times out or short-circuits under
concurrent load), not a token expiry issue.

## Why the frontend didn't show an error
The Next.js BFF previously treated this org-service 401 the same as
"refresh failed → give up", and the route that aggregates command-center
data (`getSchoolTeachers`) swallowed the failure and returned an empty
array. The composite `/api/schools/{id}/scheduling/command-center` endpoint
then returned `200` with `teachers: []`, indistinguishable from a school
that genuinely has no teachers.

This has been fixed on the frontend (see `feature/user-detail-page` branch,
commit touching `getSchoolTeachersResult` / command-center route) to surface
a `teachersError` field and render a visible banner instead of a silent
empty state. That only addresses the *symptom* (invisible failure) — the
underlying intermittent 401 from organization-service still needs to be
fixed so users don't see "failed to load" banners on a normal page load.

## Ask
Please check organization-service's auth/membership middleware for
`GET /schools/{id}/members` for a race condition under concurrent requests
from the same session (e.g. an async call to validate role/membership that
isn't safely shared/cached per-request, or a connection-pool/timeout issue
that only this endpoint hits).
