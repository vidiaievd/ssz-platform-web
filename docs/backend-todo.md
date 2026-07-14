# Backend TODO

> Задачи для бэкенда, которые нужны для реализации фич на фронте.
> Последнее обновление: 2026-06-12

---

## Разделение ролей `tutor` / `teacher` + TeachingProfile — ✅ Готово (2026-06-12)

> Спека: [`docs/plan/workspace-switching/01b-role-separation.md`](plan/workspace-switching/01b-role-separation.md)
> Мотивация: ранее оба концепта использовали роль `tutor`, что ломало роутинг учителей школ.

### A. auth-service — новая глобальная роль `teacher` ✅

Добавить `teacher` в enum разрешённых глобальных ролей.
- Нельзя назначить самостоятельно через `POST /auth/roles` — только через accept school-инвайта.
- При accept инвайта с `role=TEACHER` → grant `teacher` (вместо текущего `tutor`).

### B. profile-service — новый `TeachingProfile` ✅ (endpoints + hasTeachingProfile реализованы; TutorProfile FK — отложено)

Новая сущность — базовый профиль для всех, кто преподаёт (`teacher` + `tutor`).

**Таблицы:**
```sql
teaching_profile (id, user_id UNIQUE, created_at, updated_at)
teaching_language (id, profile_id FK, code CHAR(2), level VARCHAR)
```

**Новые эндпоинты:**
```
POST   /api/v1/profiles/me/teaching              { }  → 201 | 409
GET    /api/v1/profiles/me/teaching              → 200 { id, languages: [] } | 404
POST   /api/v1/profiles/me/teaching/languages    { code, level } → 204
DELETE /api/v1/profiles/me/teaching/languages/{code}             → 204
GET    /api/v1/profiles/{userId}/teaching        → 200 | 404   (для валидации назначения)
```

**Изменения в TutorProfile:**
- `tutor_profile` становится расширением `teaching_profile` (добавить FK `teaching_profile_id`)
- При `POST /profiles/me/tutor` — авто-создать TeachingProfile если нет
- `hourlyRate`, `yearsOfExperience` — сделать nullable (уже фактически опциональны)

**Флаг в `GET /profiles/me`:**
```json
{ "hasTeachingProfile": true }   ← NEW, рядом с hasStudentProfile / hasTutorProfile
```

### C. org-service — TEACHER invite accept выдаёт `teacher` ✅

`POST /api/v1/schools/invitations/{token}/accept` при `invitation.role = TEACHER`:
```
Было:  grant global role `tutor`  →  create TutorProfile
Стало: grant global role `teacher` → create TeachingProfile
       → add teachingLanguages из invitation → TeachingProfile.languages (идемпотентно)
       → materialize maxWeeklyHours + employmentType → school_teacher
```

**Расширить payload `POST /api/v1/schools/{schoolId}/invitations`** для `role=TEACHER`:
```json
{
  "teachingLanguages": [{ "code": "nb", "level": "C2" }]   // ← NEW, опционально
}
```
Хранить в `invitation.teacher_languages JSONB NULL`.

Ветка `kind=onboard_existing` для TEACHER — то же самое.

### D. scheduling-service — читать языки из TeachingProfile ✅

Заменить источник языков в трёх местах:

| Место | Было | Стало |
|---|---|---|
| Language-fit check при назначении учителя на группу | `tutor_profile_languages` | `teaching_languages` |
| `GET /schools/{id}/teachers` → поле `langs[]` | денорм из tutor_profile | денорм из teaching_profile |
| Candidate ranking (§7.2) | tutor langs | teaching langs |

---

## Workspace Switching (`organization-service`) — ✅ Готово (2026-06-12)

### `GET /api/v1/schools` — добавить `myRole` + `myCapabilities` ✅

Спека: [`docs/plan/workspace-switching/01-backend-change.md`](plan/workspace-switching/01-backend-change.md)

Каждый объект в ответе теперь содержит два дополнительных поля:

```json
{
  "myRole": "TEACHER",       // OWNER|ADMIN|MANAGER|TEACHER|STUDENT|CONTENT_ADMIN|SCHEDULER
  "myCapabilities": []       // [] для TEACHER/STUDENT; массив для MANAGER; null для OWNER/ADMIN/CONTENT_ADMIN/SCHEDULER
}
```

Реализация: inline-определение роли из `school.ownerId`/`school.getMemberRole()`. Для MANAGER — батч-запрос к `school_member_permissions` (один SELECT на весь список). OpenAPI-схема `SchoolSummaryResponseDto` обновлена.

---

## Schools (`organization-service`) — ✅ Все базовые задачи выполнены

### `POST /api/v1/schools` — поля payload ✅

Поддерживаются опциональные поля: `slug` (авто-генерация из `name` если не передан), `website`, `contactEmail`, `city`, `description`, `avatarUrl`, **`type` (`ONLINE`|`HYBRID`, default `ONLINE`)**.
Response: `201 Created` + полный объект школы.

### `PATCH /api/v1/schools/{id}` ✅

Все поля редактируемы через PATCH, включая `type`. Slug проверяется на уникальность.

### `GET /api/v1/schools/slug-available?slug=` ✅

```json
{ "available": true | false, "suggestions": ["nordic-academy-2"] }
```

### `GET /api/v1/schools/by-slug/{slug}` ✅

Resolve slug → объект School.

### `GET /api/v1/schools` и `GET /api/v1/schools/{id}` ✅

`GET /schools` возвращает только школы текущего пользователя. Response включает поле `type`.

---

## Школьные группы/когорты (`organization-service`) — ✅ Полностью реализовано

> Группа является полноценной когортой: курс, учителя, ёмкость, статус, term-даты.
> Расписание выносится в **scheduling-service** (новый, фронт мокает).

```
POST   /api/v1/schools/{schoolId}/groups               { name, description?, mode?, courseId?, lang?, level?, capacityMin?, capacityMax?, startDate?, endDate? }
GET    /api/v1/schools/{schoolId}/groups               → SchoolGroupSummaryResponseDto[] (все поля когорты + teachers[])
GET    /api/v1/schools/{schoolId}/groups/{groupId}     → SchoolGroupResponseDto (все поля + members[] + teachers[])
PATCH  /api/v1/schools/{schoolId}/groups/{groupId}     { все поля опциональны }
POST   /api/v1/schools/{schoolId}/groups/{groupId}/publish   → 200 | 409 { blockers: ['no-course'|'no-primary'] }
POST   /api/v1/schools/{schoolId}/groups/{groupId}/archive   → 204
DELETE /api/v1/schools/{schoolId}/groups/{groupId}     Hard-delete только для пустых draft/archived групп
POST   /api/v1/schools/{schoolId}/groups/{groupId}/members   { userId }
DELETE /api/v1/schools/{schoolId}/groups/{groupId}/members/{userId}
POST   /api/v1/schools/{schoolId}/groups/{groupId}/teachers  { userId, role, fromDate?, toDate?, reason?, override? }
DELETE /api/v1/schools/{schoolId}/groups/{groupId}/teachers/{userId}?role=...
```

Учительские роли: `primary` | `co_primary` | `substitute`. Валидация: language fit (hard, от profile-service), workload (warn, overridable).
Teacher attrs школы: `GET /api/v1/schools/{schoolId}/teachers`, `PATCH /api/v1/schools/{schoolId}/teachers/{userId}`.

---

## Связь «частный репетитор ↔ студент» (`organization-service`) — ✅ Реализовано

```
POST   /api/v1/tutoring/group
GET    /api/v1/tutoring/group
PATCH  /api/v1/tutoring/group
DELETE /api/v1/tutoring/group
GET    /api/v1/tutoring/my-tutor
DELETE /api/v1/tutoring/group/students/{userId}
POST   /api/v1/tutoring/group/invitations
GET    /api/v1/tutoring/group/invitations
POST   /api/v1/tutoring/invitations/{token}/accept
```

---

## Групповые задания (`learning-service`) — ✅ Реализовано

```
POST /api/v1/assignments/group
```

---

## Profiles (`profile-service`) — ✅ Поле uiLocale согласовано

`GET /api/v1/profiles/me` возвращает `uiLocale`. `PATCH` принимает `uiLocale`.

---

## Entitlements (`content-service`) — ✅ Реализовано

```
GET /api/v1/me/entitlements
```

---

## Exercise Engine — история попыток — ✅ Реализовано

```
GET /api/v1/exercises/{id}/attempts
GET /api/v1/exercises/{id}/attempts/{attemptId}
```

---

## Learning Service — прогресс, флаги — ✅ Реализовано

```
GET   /api/v1/progress/{contentType}/{contentId}
GET   /api/v1/progress/assignment/{id}
PATCH /api/v1/progress/{contentType}/{contentId}/flag
PATCH /api/v1/progress/{contentType}/{contentId}/resolve
```

---

## School Dashboard — ✅ Полностью реализовано

> Бэкенд-план: [`docs/plan/school-dashboard-backend.md`](plan/school-dashboard-backend.md).

Все виджеты дашборда подкреплены реальными данными из Analytics Service.

### ✅ 0. Роль зрителя в школе

`SchoolResponseDto.members[].role` присутствует. OWNER выводится из `ownerId`.
Analytics Service авторизует через собственную проекцию `SchoolMembership` — без обращения к org-service.

### ✅ 1. KPI strip — `GET /api/v1/schools/{schoolId}/dashboard/kpis`

4 headline-метрики: `active_students_7d`, `lessons_completed_7d`, `pending_reviews`, `at_risk`.
Каждая: `value + delta + trend + spark[7]` (нормализован 0–100). Owner-only метрики (`at_risk`) фильтруются по роли.
Delta = null до накопления ≥14д истории.

### ✅ 2. Activity feed — `GET /api/v1/schools/{schoolId}/activity?limit=&cursor=`

Хронологическая лента событий школы (people / content / review), курсорная пагинация.
`actorName` денормализован из `UserDirectory` при записи. Источники: `school.member.added`, `content.container.published`, `learning.enrollment.created`, `learning.submission.*`.

### ✅ 3. Course health — `GET /api/v1/schools/{schoolId}/dashboard/courses/health`

Per-course: enrollment, completion (0 до заполнения leafItemCount), trend (recent vs prev 7d), dropoff flag.
Sorted by enrollment desc.

### ✅ 4. At-risk students — `GET /api/v1/schools/{schoolId}/dashboard/at-risk?limit=`

Студенты без активности в последние `AT_RISK_THRESHOLD_DAYS` дней.
Response: `{ students: [{ userId, name, course, lastSeen, progress, lang }], total }`.
Sorted by longest inactivity. Owner/admin only.

### ⚠️ 5. Review queue (publish-approval) — нужно решение

`GET /moderation/queue` — контент, ожидающий owner-апрува перед публикацией.
Это **отдельный workstream** (content-governance), не данные дашборда.
Отдельная спека/PR. До реализации — `{ status: 'unavailable' }` в BFF.

### ✅ 6. Today's classes — `GET /scheduling/schools/{id}/...` — реализовано в scheduling-service

`School.type: ONLINE|HYBRID` добавлен (D.2). Scheduling-service реализован (2026-06-08).

### ✅ 7. Onboarding status — frontend-композит (бэкенд не нужен)

Фронт считает сам из наличных данных.

### ❌ 8. Trial status — нет billing-сервиса

`trial = null` (баннер скрыт). До реализации — `{ status: 'unavailable' }` в BFF.

### ✅ 9. Mutation: nudge at-risk — `POST /api/v1/schools/{schoolId}/dashboard/nudge`

`{ scope: 'all-at-risk' }` → `{ nudged: n }`.
Публикует `analytics.nudge.requested` per student → notification-service создаёт STUDY_REMINDER in-app запись.

---

### Сводка приоритетов

| #   | Что                             | Статус                                    |
| --- | ------------------------------- | ----------------------------------------- |
| 0   | Роль зрителя (`members[].role`) | ✅ Готово                                 |
| 1   | KPI-агрегаты + sparkline        | ✅ Готово                                 |
| 2   | Activity feed / audit           | ✅ Готово                                 |
| 3   | Course health                   | ✅ Готово                                 |
| 4   | At-risk students                | ✅ Готово                                 |
| 5   | Publish-approval queue          | ⚠️ Отдельный workstream                   |
| 6   | Scheduling + тип школы          | `type` ✅; scheduling ✅ (2026-06-08)    |
| 7   | Onboarding status               | ✅ Frontend-композит                      |
| 8   | Trial/billing                   | ❌ Отдельный billing-сервис               |
| 9   | Nudge at-risk mutation          | ✅ Готово                                 |

---

## Флоу без бэкенда — продуктовые решения

### Scheduling / live-уроки / календарь

Нет API бронирования. `School.type: HYBRID` добавлен. Нужен новый сервис (слоты, бронь, видеозвонок,
absence/подмены/forecast). Полный план — §3 + §4 «Teacher Management».

### Trial/billing

Нет billing-сервиса. До решения фронт держит `trial = null`.

### Messaging тьютор↔студент

Нет API чата. Решить: встроенный обмен или только комментарии в review-сабмишенах?

### Certificates / завершение курса

При `PATCH /enrollments/{id}/complete` можно выдавать сертификат. Нужно: шаблон, PDF, верифицируемая ссылка.

### Placement / диагностика уровня (CEFR)

Нет API диагностики. Для онбординга студента.

### Publish-approval (#5)

Отдельный workstream content-governance. Своя спека/PR.

---

## Статус

| Задача                                            | Статус                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| Группы/когорты в школе — API                      | ✅ Готово                                           |
| Связь репетитор↔студент — API                     | ✅ Готово                                           |
| Групповые задания                                 | ✅ Готово                                           |
| `GET /api/v1/me/entitlements`                     | ✅ Готово                                           |
| `GET /api/v1/exercises/{id}/attempts`             | ✅ Готово                                           |
| `GET /api/v1/progress/{type}/{id}`, flag, resolve | ✅ Готово                                           |
| School CRUD + slug + все поля                     | ✅ Готово                                           |
| `School.type: ONLINE\|HYBRID`                     | ✅ Готово (D.2)                                     |
| KPI-агрегаты + sparkline-серии                    | ✅ Готово (B.4)                                     |
| At-risk students                                  | ✅ Готово (B.5)                                     |
| Course health                                     | ✅ Готово (B.6)                                     |
| Activity feed / audit                             | ✅ Готово (B.7)                                     |
| Nudge at-risk mutation                            | ✅ Готово (D.1)                                     |
| BFF composite `GET /api/schools/[id]/dashboard`   | ✅ Готово (C.1, web)                                |
| Publish-approval queue                            | ⚠️ Нужно решение (отдельный workstream)             |
| Scheduling / Today's classes                      | ✅ Готово (scheduling-service, 2026-06-08)          |
| Разделение ролей `tutor`/`teacher` + TeachingProfile | ✅ Готово (2026-06-12)                           |
| Trial/billing                                     | ❌ Отдельный сервис                                 |
| Group Management — расширение когорты (1.1–1.5)  | ✅ Готово (2026-06-04)                              |
| Student Management — доработки (2.1–2.3)          | ✅ Готово (2026-06-04)                              |
| Scheduling-service (slots/lessons/conflicts/absences/substitutions/curriculum/alerts) | ✅ Готово (2026-06-08) |
| Teacher Management (absence/подмены/forecast/roles) | ✅ Готово (2026-06-08) |

---

---

## Discover Flow (`organization-service`) — ❌ Не реализовано

> Фронт-план: [`docs/plan/discover-flow/`](plan/discover-flow/).
> До реализации BFF фильтрует/пагинирует полный список на стороне Next.js.

### D.1 Серверная фильтрация и пагинация `/schools/public` — ❌

Текущий `/schools/public` возвращает полный список без фильтров и пагинации.
Нужно добавить query-параметры:

```
GET /api/v1/schools/public?q=&type=&sort=recommended|rating|price-asc|students&cursor=&limit=
→ { items:[...], pageInfo:{ endCursor, hasNextPage, total } }
```

`sort=recommended` — бизнес-ранжирование (featured → rating → studentCount → name);
`sort=rating`, `sort=students` — потребуют реального рейтинг-сервиса (§D.4).
До тех пор BFF деградирует все sort-варианты в `name`.

### D.2 Расширенный публичный профиль школы `/schools/public/{slug}` — ❌

Текущий `/schools/public` (список) отдаёт минимальные поля. Нужны детали для страницы `s/[slug]`:

```
GET /api/v1/schools/public/{slug}
→ {
    schoolId, schoolSlug, schoolName, description, avatarUrl, city, website,
    isOpenForApplications,
    courses: [{ id, name, level, lang, description? }],      // ← NEW
    levels: string[],                                         // ← NEW (CEFR)
    teachers: [{ userId, name, avatarUrl, langs[], bio? }],  // ← NEW (public roster)
    studentCount: number,                                     // ← NEW (enrolled)
    containerCount: number,                                   // ← NEW (курсов)
  }
```

Пока не реализовано: `courses`, `levels`, `teachers`, `studentCount` — опциональные поля в
`School` (тип фронта), секции страницы рендерятся условно.

### D.3 Публичный каталог тьюторов — ❌

Нет эндпоинта публичного листинга тьюторов. Фаза 5 discover-flow реализуется за mock-провайдером
(`DiscoveryProvider`) и включается только при ненулевом mock-фиде. До бэкенда:
- сегмент «Tutors» скрыт в каталоге при пустом фиде.

```
GET /api/v1/tutors/public?q=&lang=&level=&sort=&cursor=&limit=
→ { items:[...], pageInfo:{ endCursor, hasNextPage, total } }

GET /api/v1/tutors/public/{slug}
→ { ...профиль, availability:[{ weekday, from, to }], pricePerHour, currency }
```

### D.4 Reviews & ratings — ❌ (отдельный сервис, заморожено)

Нет сервиса рейтингов/отзывов. UI деградирует изящно: rating-чип не отображается,
секция Reviews скрыта. Когда сервис появится:

```
GET /api/v1/reviews/{entityType}/{entityId}?limit=&cursor=
    entityType = school | tutor
→ { items:[{ userId, rating:1-5, text, createdAt }], average, total }
```

## Сводка задач (Discover Flow)

| # | Сервис | Задача | Статус | Блокирует фронт |
| --- | --- | --- | --- | --- |
| D.1 | org | Серверная фильтрация + пагинация `/schools/public` | ❌ | каталог (сейчас BFF-фильтр) |
| D.2 | org | Расширенный публичный профиль `/schools/public/{slug}` | ❌ | страница школы: курсы, roster, counts |
| D.3 | org | Публичный каталог тьюторов `/tutors/public` | ❌ | фаза 5 (пока mock) |
| D.4 | reviews-service | Reviews & ratings | ❌ | rating-чип, секция Reviews |

---

# ▣ Group Management & Student Management — бэкенд-план

> Frontend-спеки: [`plan/spec/Group-Management-Implementation-Spec.md`](plan/spec/Group-Management-Implementation-Spec.md),
> [`plan/spec/Student-Management-Implementation-Spec.md`](plan/spec/Student-Management-Implementation-Spec.md).
> Frontend-планы: [`plan/group-management/`](plan/group-management/), [`plan/student-management/`](plan/student-management/).
>
> **Согласованные архитектурные решения (2026-06-04):**
>
> 1. **Расписание (slots → lessons → конфликты → нагрузка → бронь комнат) выносится в новый
>    `scheduling-service`.** До его готовности фронт **мокает весь schedule-слой** детерминированно.
> 2. **Группа связана ровно с одним курсом** (`course_id`). Пока группа активна, курс **авто-доступен**
>    всем её участникам (entitlement выдаётся при вступлении, отзывается при выходе/архивации).
> 3. Атрибуты нагрузки учителя (`max_weekly_hours`, `availability`) живут в **org-service** рядом с
>    членством (школа-специфичны). Языки преподавания берём из teaching profile (profile-service).
> 4. **term-даты** (`start_date`/`end_date`) живут на группе в **org-service**; scheduling-service
>    читает их как окно генерации уроков.

---

## 1. Group Management — расширение когорты (`organization-service`) — ✅ Готово

### 1.1 Расширить сущность `Group` ✅

К существующей таблице группы добавить поля:

| Поле           | Тип                                               | Назначение                               |
| -------------- | ------------------------------------------------- | ---------------------------------------- |
| `course_id`    | UUID FK → `content.container`, **nullable**       | курс когорты (в `draft` может быть пуст) |
| `lang`         | CHAR(2), ISO 639-1                                | язык обучения                            |
| `level`        | VARCHAR                                           | CEFR `A1..C2`                            |
| `status`       | ENUM(`draft`,`active`,`archived`) DEFAULT `draft` | новые группы рождаются `draft`           |
| `mode`         | ENUM(`online`,`in_person`) DEFAULT `online`       | для HYBRID-школ добавляет комнату в слот |
| `capacity_min` | INT                                               | минимум для алерта `under`               |
| `capacity_max` | INT                                               | максимум для алерта `over`               |
| `start_date`   | DATE                                              | начало term                              |
| `end_date`     | DATE                                              | конец term                               |

`memberCount` уже есть; `studentCount` = denormalized по `group_member`.

`PATCH /groups/{id}` должен принимать все новые поля (частично). `POST /groups` — принимать их при
создании (status фиксируется `draft`).

**Переход draft → active (публикация):** отдельное действие — отдельный эндпоинт или `PATCH {status}`.
Сервер при публикации обязан проверить инвариант **«не может быть рождена сломанной»**: есть
`primary` учитель, есть `course_id`, есть ≥1 слот (слот проверяется в scheduling-service —
см. §3.6 кросс-сервисную проверку). Без primary → `409 { error: 'no-primary' }`.

```
POST /api/v1/schools/{schoolId}/groups/{groupId}/publish   → 200 | 409 { blockers:[...] }
POST /api/v1/schools/{schoolId}/groups/{groupId}/archive   → 204
```

`DELETE` (hard) — только если группа `draft`/`archived` и пуста и не имела уроков; иначе только
`archive` (мягко). Фронт это отражает (спека §7: «hard-delete only when empty + never run»).

### 1.2 `group_teacher` — junction-таблица ролей учителей ✅

Одна таблица на все три роли (primary / co-primary / substitute):

```
group_teacher
├─ id            UUID
├─ group_id      FK → group
├─ user_id       FK → school_member.user_id   (должен быть TEACHER в этой школе)
├─ role          ENUM(primary | co_primary | substitute)
├─ from_date     DATE NULL    -- только substitute (окно замены)
├─ to_date       DATE NULL    -- только substitute
├─ reason        TEXT NULL    -- ОБЯЗАТЕЛЕН для substitute (спека §5)
└─ created_at

constraints:
  UNIQUE (group_id) WHERE role='primary'       -- ровно один primary
  UNIQUE (group_id) WHERE role='co_primary'    -- максимум один co-primary
  -- substitute: 0..N, окна могут пересекаться
```

Эндпоинты (спека §6):

```
POST   /api/v1/schools/{schoolId}/groups/{groupId}/teachers
       { role:'primary'|'co_primary'|'substitute', userId, from?, to?, reason?, override?:bool }
DELETE /api/v1/schools/{schoolId}/groups/{groupId}/teachers/{userId}?role=...
```

**Серверная валидация (авторитетная, спека §6 «validation twice, truth once»):**

1. **Language fit** (hard block): учитель должен преподавать `group.lang` (langs из teaching profile).
   Нет языка → `409`, не overridable.
2. **Time conflict** (danger, overridable): слот группы пересекается с другой активной группой
   этого учителя → требует кросс-вызов в scheduling-service (§3). Принять при `?override=true`.
3. **Workload** (warn, overridable): назначение перебивает `max_weekly_hours`.

Ответ при наличии проблем: `200 { ok:true, warnings:[{type,with,day,time}] }` (если override)
или `409 { conflicts:[...], warnings:[...] }`.

Удаление primary, оставляющее группу без primary → разрешено, но группа немедленно получает
алерт `no-primary` (и не может быть `active`).

> **Substitutes layer, never swap.** Primary — teacher-of-record для отчётности. Замена накладывается
> окном `[from,to]`; внутри окна урок рендерит substitute, вне — primary. Это логика scheduling-service.

### 1.3 `school_teacher` — атрибуты нагрузки ✅

```
school_teacher
├─ school_id, user_id   (PK, FK → school_member)
├─ max_weekly_hours  INT
├─ employment_type   ENUM(full|part|contract)   -- 🆕 HR-метка, см. §5.7
└─ availability      JSONB   -- [{ weekday, start, end }]  окна доступности
```

Нужен read-эндпоинт для timetable/assign-модалок и для аналитики:

```
GET  /api/v1/schools/{schoolId}/teachers
     → [{ userId, name, avatarUrl, langs[], maxWeeklyHours, employmentType, availability[] }]
PATCH /api/v1/schools/{schoolId}/teachers/{userId}   { maxWeeklyHours?, employmentType?, availability? }
```

`langs` денормализуем из profile-service (teaching profile) при ответе.

> 🆕 `employment_type` (`full|part|contract`) — **HR-метка под будущий payroll**, не для scheduling.
> Планировщик нагрузки/конфликтов (§3.3) смотрит **только** на `max_weekly_hours`. Семантика значений
> и проброс при инвайте — в §5.7.

### 1.4 Авто-доступ к курсу по членству в группе (оркестрация) ✅

> Решение №2: пока группа активна, её `course_id` доступен всем участникам.

При событиях:

- **студент добавлен в активную группу** → выдать entitlement на `group.course_id`
  (content-service `POST /containers/{course_id}/entitlements`, level `FREE_WITHIN_SCHOOL`,
  `schoolId` в контексте).
- **студент удалён из группы** → отозвать entitlement (если курс не доступен ему через другую группу).
- **группа archived** → отозвать entitlements курса у всех участников (с той же оговоркой).
- **группа publish (draft→active) с уже добавленными студентами** → выдать entitlements всем.

Реализовать через доменные события (`group.member.added`, `group.member.removed`, `group.archived`)
и подписчика в content-service, либо синхронно в org-service. Идемпотентно.

### 1.5 GET-ответы должны вернуть расширенную форму ✅

`GET /groups` (список) и `GET /groups/{id}` (детали) дополнить полями: `courseId, courseName, lang,
level, status, mode, capacity{min,max}, startDate, endDate, studentCount, teachers:[{userId, role,
from, to, reason}]`. Слоты/конфликты/уроки — из scheduling-service (или мок).

---

## 2. Student Management — доработки — ✅ Готово (2.1–2.3)

### 2.1 Список студентов школы с производным статусом ✅

Спека §6: `GET /schools/{slug}/students` → студенты + статус + членства. Сейчас отдельного
эндпоинта нет (есть только `at-risk` из analytics и `members` из org).

```
GET /api/v1/schools/{schoolId}/students?segment=&search=&limit=&cursor=
→ { items: [{
      userId, name, email, avatarUrl, lang, level,
      status: 'active'|'at-risk'|'new'|'finished'|'clash'|'unassigned',  // ДЕРИВИРОВАН на сервере
      groups: [{ id, name, lang, level }],
      progress: 0..1, lastSeen: ISO|null, enrolledAt: ISO
    }], total, nextCursor }
```

**Статус деривируется на сервере** (спека §2, «never store a manually-set status»):

- `active` — активность ≤7 дней (есть в analytics).
- `at-risk` — нет активности 7+ дней или stalled progress (analytics уже считает at-risk).
- `new` — enrolled ≤14 дней.
- `finished` — завершил курс (enrollment complete).
- `unassigned` — 0 групп (derived из `group_member`).
- `clash` — состоит в 2+ группах с пересекающимися слотами → **зависит от scheduling-service**
  (до него — статус `clash` мокается/не выставляется).

Источники разнесены по сервисам (org: membership; analytics: activity/progress; scheduling: clash).
**Рекомендация:** агрегировать в analytics-service (у него уже есть проекции активности и членства),
либо собирать BFF-композитом на фронте. Зафиксировать при реализации.

### 2.2 `GET /analytics/schools/{schoolId}/students/{userId}` — детали ✅

`{ userId, name, email, avatarUrl, lang, level, status, progress, lastSeen, enrolledAt,
   groups:[{ id, name, lang, level, schedule, teachers:[{userId,name,role}] }], clashes:[...] }`.
Учителя выводятся из членства в группах (read-only, спека: «teachers are read-only here»).

### 2.3 Добавление студентов в группу — 3-веточный flow ✅

Пользовательский сценарий (требование владельца):

| Ветка                           | Условие                          | Действие бэкенда                                                                                                                                                                  |
| ------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Нет в системе**            | email не найден                  | инвайт `register` → письмо со ссылкой → студент регистрируется → онбординг → попадает в школу+группу                                                                              |
| **B. Есть, роль `student`**     | userId найден, есть роль student | прямо привязать: `POST /groups/{gid}/members` (без письма)                                                                                                                        |
| **C. Есть, БЕЗ роли `student`** | userId найден, нет роли student  | инвайт `onboard-existing` → письмо со ссылкой на **онбординг** (не регистрацию) → по клику добавить роль `student` в профиль + создать student-профиль + привязать к школе+группе |

**Чего не хватает в бэкенде:**

**(1) Резолв email → пользователь + его роли** (нужен, чтобы фронт/BFF выбрал ветку):

```
GET /api/v1/users/lookup?email=...        (auth- или profile-service, требует school admin)
→ 200 { userId, roles:['student'|'tutor'|...], displayName? }  |  404 (нет такого)
```

> Приватность: доступ только OWNER/ADMIN школы; не раскрывать лишнего, только факт наличия + роли.

**(2) Инвайт с типом и целевой группой.** Расширить существующий
`POST /schools/{schoolId}/invitations`:

```
{ email, role:'STUDENT', targetGroupId?, kind:'register'|'onboard-existing' }
→ 201 { invitationId, token, kind, expiresAt }
```

`POST /schools/invitations/{token}/accept` по токену:

- `kind='register'`: пользователь уже зарегистрировался → выдать роль `student` (если нет) →
  создать student-профиль → добавить в школу (`STUDENT`) → добавить в `targetGroupId`.
- `kind='onboard-existing'`: пользователь уже залогинен (существующий) → **выдать роль `student`**
  (`auth/roles`) → создать student-профиль → добавить в школу+группу. **Без повторной регистрации.**

**(3) Прямое добавление (ветка B)** уже есть: `POST /groups/{gid}/members { userId }` (после lookup).
Должно дополнительно убедиться, что user — `STUDENT`-член школы (если нет — добавить как члена школы
с ролью STUDENT перед вступлением в группу).

**Капасити/клэш-проверка при добавлении** (спека §6): `POST /groups/{gid}/members?override=true`
ре-валидирует ёмкость + кросс-групповой клэш (clash — из scheduling-service), `200 { ok, warnings:[...] }`
или `409`. Удаление участника — мягко, с Undo на фронте (просто повторный POST при отмене).

> **Atribуты учителя при инвайте** (`maxWeeklyHours` / `employmentType`) — см. Invitation Management §5.7.
> **Авторизация «кто может звать»** — см. Invitation Management §5.8 + эпик «Manager RBAC».

### 2.4 Bulk message + сегменты (спека §6) — ❌ отложено (фиче-флаг)

```
POST /schools/{schoolId}/students/message   { audience:{segment|userIds[]}, subject, body }
POST /schools/{schoolId}/students/segments   { name, predicate }   → сохранённый фильтр
GET  /schools/{schoolId}/students/segments
```

Сообщения идут через notification-service. Nudge уже есть (analytics `/nudge`). Можно отложить —
фронт строит сегменты как клиентские предикаты, «Save segment» прячем за фиче-флагом до бэкенда.

---

## 3. Scheduling-service (НОВЫЙ сервис) — ✅ Реализован (2026-06-08)

> Владеет **всем волатильным таймтейблом**: недельный паттерн (slots) → датированные уроки (lessons)
> → конфликты → нагрузка учителей → **отпуска (absence) → подмены (substitution engine)** → бронь комнат
> → прогноз нагрузки → (позже) календарь/видео.
> До готовности сервиса фронт мокает весь слой детерминированно; референс-математика конфликтов/нагрузки/
> ранжирования/прогноза уже есть в [`src/lib/groups/operations.ts`](../src/lib/groups/operations.ts)
> (расширяется формулами спеки) — её портировать на сервер.
>
> **Обновлено 2026-06-08 под спеку Teacher Management**
> ([`plan/spec/teacher-workload-and-resourcing/`](plan/spec/teacher-workload-and-resourcing/),
> frontend-план [`plan/teacher-management/`](plan/teacher-management/)). Согласованные решения:
>
> 1. **Объём** — полная спека (5 поверхностей): Workload Command Center, Teacher Schedule View, Substitute
>    Console, Curriculum Planner, Forecast.
> 2. **Absence + substitution-движок живут в scheduling-service** (он владеет уроками/нагрузкой).
>    `group_teacher role=substitute` (org-service) — **teacher-of-record-проекция** результата:
>    scheduling-service материализует per-lesson `lesson.teacher_id` override и публикует событие назад.
> 3. **Модель — REST + server-derived проекции** (не event-sourcing). Имена событий из спеки §3
>    (`TEACHER_ABSENCE_REPORTED`, `SUBSTITUTE_ASSIGNED`, `SCHEDULE_RECALCULATED`, …) — доменные события
>    для notification/analytics-консьюмеров.
> 4. **Новая роль `SCHEDULER`** в org-service (см. §4 ниже).

### 3.1 `slot` — недельный паттерн (привязан к группе)

```
slot
├─ id, group_id (ссылка на org-service Group), school_id
├─ weekday    ENUM(mon..sun)
├─ start_time TIME      -- "18:00"
├─ end_time   TIME      -- "19:30"
└─ room       VARCHAR   -- "Online" для online-групп; имя комнаты для hybrid
```

```
GET    /api/v1/scheduling/groups/{groupId}/slots
PUT    /api/v1/scheduling/groups/{groupId}/slots     -- заменить весь набор (slot-editor сохраняет целиком)
POST   /api/v1/scheduling/groups/{groupId}/slots
DELETE /api/v1/scheduling/groups/{groupId}/slots/{slotId}
```

### 3.2 `lesson` — материализованные датированные занятия

Генерируются из `slots + group.start_date + group.end_date − holidays`:

```
lesson
├─ id, group_id, school_id
├─ date       DATE
├─ start_time TIME, end_time TIME
├─ teacher_id UUID     -- с учётом активной substitution на эту дату!
├─ room       VARCHAR
└─ status     ENUM(scheduled | moved | cancelled)
```

```
GET   /api/v1/scheduling/groups/{groupId}/lessons?from=&to=
GET   /api/v1/scheduling/groups/{groupId}/lessons/next?limit=    -- «ближайшие уроки» (спека §5 Schedule tab)
PATCH /api/v1/scheduling/lessons/{lessonId}    { date?, start?, end?, teacherId?, status }  -- override одного урока
```

### 3.3 Конфликты и нагрузка учителей (авторитетно)

Портировать математику из `operations.ts` (`slotsOverlap`, `groupAlerts`, `teacherConflicts`,
`teacherLoad`, `schoolConflictCount`):

```
GET /api/v1/scheduling/schools/{schoolId}/conflicts
    → [{ teacherId, groupA, groupB, day, time }]
GET /api/v1/scheduling/schools/{schoolId}/teachers/{userId}/load
    → { hours, max, pct, overloaded, groups, conflicts }
GET /api/v1/scheduling/schools/{schoolId}/timetable     -- для Teacher Timetable view (спека §5)
    → { teachers:[{ userId, hours, max, groups, conflicts, lessons:[{day,start,end,groupId,lang,isSub}] }] }
```

Конфликт = пересечение слотов одного учителя по разным активным группам (тот же weekday + пересечение времени).

> **Расширение под Teacher Management (спека §5, §6):** базовый `load` = contact-часы недостаточен.
> Добавить **prep-часы** (`contact·0.30 + 1.0·distinctCourses`), `effectiveLoad`, `dayPeak`, `consecPeak`,
> `softCost` и **`healthState` (`ok|warn|danger`)** по классификации §5. Константы политики (`PREP_FACTOR`,
> `DAILY_CONTACT_CAP`, `MAX_CONSECUTIVE`, `NEAR_CAP_RATIO`, …) — **редактируемы admin/principal** (Appendix B),
> хранить per-school с дефолтами. `validateAssignment` (§6.1) hard-constraints: `overlap | room_double_book |
> availability | language | cap_exceeded`. Math зеркалит фронтовый `src/lib/groups/operations.ts`.

```
GET   /api/v1/scheduling/schools/{schoolId}/command-center   -- composite для §4.1
      → { kpis:{utilization,spareCap,overloaded,clashes,vacancies}, teachers:[loadRow+health], violations:[...], vacancies:[...], roomLoad:[...] }
GET   /api/v1/scheduling/schools/{schoolId}/workload-policy
PATCH /api/v1/scheduling/schools/{schoolId}/workload-policy   { prepFactor?, dailyCap?, maxConsecutive?, nearCapRatio?, ... }  -- admin/principal
```

### 3.4 Кросс-групповой клэш студента (для статуса `clash`)

```
GET /api/v1/scheduling/schools/{schoolId}/students/{userId}/clashes
    → [{ groupA, groupB, day, time }]   -- пересечение слотов групп, где состоит студент
```

Используется Student Management для статуса `clash` и pre-check при add-to-group.

### 3.5 Бронь комнат (HYBRID) — позже

`room`-доступность, чтобы слот/урок не садился в занятую комнату. Можно вторым этапом.

### 3.6 Кросс-сервисная проверка при публикации группы

org-service `POST /groups/{id}/publish` должен убедиться, что у группы ≥1 слот — синхронный вызов
`GET /scheduling/groups/{id}/slots` или scheduling-service публикует событие готовности. Зафиксировать
контракт при реализации.

### 3.7 Дашбордные агрегаты — остаются в analytics

Дашборд уже ждёт `analytics/.../dashboard/groups-health` и `/teacher-load`
([`src/lib/dashboard/queries.ts`](../src/lib/dashboard/queries.ts)). Analytics-service должен потреблять
события scheduling-service (slots/lessons changed) в свою проекцию и отдавать эти агрегаты. То есть
**source of truth — scheduling-service, дашбордная витрина — analytics**.

### 3.8 На будущее

ICS-экспорт, синхронизация с внешними календарями, видеозвонки (ссылка на урок), напоминания о занятии
через notification-service, праздники/исключения term-календаря.

---

### 3.9 Absence / leave (график отпусков) — НОВОЕ (спека §3.2, §7 step 1)

Сущность отсутствия учителя (sick / leave / vacancy). Владелец — scheduling-service (резолвит затронутые уроки).

```
teacher_absence
├─ id, school_id, teacher_id
├─ kind     ENUM(sick | leave | vacancy)
├─ scope    ENUM(today | window | permanent)
├─ from     DATE,  to DATE NULL    -- permanent → to=null
├─ reason   TEXT
└─ created_by, created_at
```

```
GET  /api/v1/scheduling/schools/{schoolId}/absences          -- график отпусков (лента/календарь)
GET  /api/v1/scheduling/teachers/{teacherId}/absences
POST /api/v1/scheduling/teachers/{teacherId}/absences
     { kind, scope, from, to?, reason }
     → 201 { absenceId, createdRequests:[SubstituteRequest] }   -- авто-scope уроков
DELETE /api/v1/scheduling/absences/{absenceId}
```

**Серверный эффект `POST` (= событие `TEACHER_ABSENCE_REPORTED`):** найти уроки teacher в окне →
пометить availability blocked → **авто-создать `SUBSTITUTE_REQUEST_CREATED` на каждый непокрытый урок** →
синхронно запустить генерацию кандидатов (§3.10). Права (§1.2): свой absence — сам teacher; чужой —
owner/admin/scheduler.

### 3.10 Substitution engine (план подмен) — НОВОЕ (спека §7, §12.1, §12.4)

```
substitute_request
├─ id, school_id, lesson_id, group_id, original_teacher_id
├─ cover_window {from,to}, urgency ENUM(today|upcoming|open)
├─ status ENUM(open|closed|cancelled)

substitute_assignment
├─ id, request_id, original_teacher_id, substitute_teacher_id, lesson_id
├─ cover_window {from,to}, fit_score, status ENUM(proposed|confirmed|rejected|expired)
```

```
GET  /api/v1/scheduling/schools/{schoolId}/substitutions          -- cover queue (open requests + absences)
POST /api/v1/scheduling/schools/{schoolId}/substitutions          -- ручной "Arrange cover" → request
GET  /api/v1/scheduling/substitutions/{requestId}/candidates      -- ранжированные кандидаты (§7.2)
     → [{ teacherId, eligible, fitScore, classification, factors:{canLang,free,spareRatio,familiar,wouldOverload,subLoop} }]
POST /api/v1/scheduling/substitutions/{requestId}/assign
     { substituteTeacherId, override?:bool }
     → 200 { ok } | 409 { conflictType }    -- confirm-time re-check (§7.3)
POST /api/v1/scheduling/substitutions/{requestId}/cancel
```

**Candidate ranking (§7.2, детерминировано 0–100):** HARD G1 speaks lang, G2 free → fail ⇒ eligible=false.
SOFT: `capScore(0..40)+famScore(0..25)+disrScore(0..20)+availScore(0..15)`. Кэш кандидатов с TTL,
инвалидируется `TEACHER_AVAILABILITY_UPDATED|LESSON_*|SUBSTITUTE_ASSIGNED` в окне.
**Confirm-time (§7.3):** на `assign` заново G1/G2 против текущего состояния; `contact(sub)+dur > cap` →
блок, **кроме** override owner/principal-уровнем (→ аудит + overload-алерт). Fail → `409`, request open.
**Edge:** §12.1 no-candidate → `CONFLICT_DETECTED(no_candidate)` + uncovered-alert; §12.4 sub-loop →
candidate `eligible=false` factor `sub_loop`, движок берёт следующий.

**Назад в org-service:** при `confirmed` — записать `group_teacher role=substitute` (окно+reason) как
teacher-of-record-проекцию (событие `substitute.confirmed` → org-consumer, идемпотентно).

### 3.11 Curriculum plan (операционный слой) — НОВОЕ (спека §2.5, §4.3, §12.5)

> Не редактор контента (он в content-service). Это порядок прохождения / целевые часы / прогресс доставки
> на группу. Владелец — scheduling-service (знает уроки); `requiredLevel` сверяется с content-метаданными.

```
curriculum_plan (group_id) ├─ target_weekly_hours, progress_pct(DERIVED)
curriculum_unit  ├─ plan_id, title, order, planned_sessions, delivered_sessions, required_level, status(planned|active|done|overridden)
```

```
GET   /api/v1/scheduling/groups/{groupId}/curriculum
PUT   /api/v1/scheduling/groups/{groupId}/curriculum            -- units + targetWeeklyHours
PATCH /api/v1/scheduling/curriculum/units/{unitId}              -- edit/deliver/override(reason)
POST  /api/v1/scheduling/curriculum/units/reorder
POST  /api/v1/scheduling/lessons/{lessonId}/curriculum-unit     { unitId }   -- unit→lesson mapping
```

**Override (§12.5):** требует reason (аудит); если поднимает `requiredLevel` выше языков/уровня учителя
урока → `CONFLICT_DETECTED(curriculum_override)` + пометка уроков «needs reassignment» (не авто-отмена);
если меняет `targetWeeklyHours` → forecast inputs dirty.

### 3.12 Forecast (прогноз найма) — НОВОЕ (спека §10)

Чистая математика §10. **Вариант A (рекомендуется для MVP):** считается на фронте (`forecast()` в
operations) поверх текущих counts — бэкенд не нужен сразу. **Вариант B (позже):** analytics-service
отдаёт проекцию из своих агрегатов (см. §3.7) — фронт переключается без изменения UI.

```
POST /api/v1/analytics/schools/{schoolId}/forecast    { growth, terms, groupSize, hoursPerGroup, contractPerTeacher }
     → { projection:[...], perLanguage:[{lang,teachersNeeded,teachersHaving,gap,utilProjected,risk}], bottleneck, hireGap }
GET/POST/DELETE /api/v1/analytics/schools/{schoolId}/forecast/scenarios   -- сохранённые сценарии
```

### 3.13 Alerts & escalation — НОВОЕ (спека §9) → notification-service

Виды: overload(danger) · near-cap(warn) · daily/consec(warn) · conflict(danger) · vacancy(danger) ·
uncovered(danger) · sub-overload(warn) · bottleneck(warn). Модель `raised→acknowledged→resolved`.

```
GET  /api/v1/scheduling/schools/{schoolId}/alerts
POST /api/v1/scheduling/alerts/{alertId}/acknowledge      → ALERT_ACKNOWLEDGED
POST /api/v1/scheduling/alerts/{alertId}/resolve
```

**Серверная эскалация (таймеры от `occurredAt`):** overload без ack 24h → notify Principal; vacancy
unfilled 48h → notify Admin+Principal; uncovered lesson за <24h → escalate Principal override. Доставка —
через **notification-service** (новые типы in-app/email).

---

## 4. Teacher Management — org-service / profile / notification — ✅ Реализовано (2026-06-08)

> Frontend-план [`plan/teacher-management/`](plan/teacher-management/). Дополняет уже готовые
> `school_teacher` (§1.3) и `group_teacher` (§1.2).

### 4.1 Роль `SCHEDULER` (org-service + auth) — ✅

Новая роль школьного членства (прецедент — `CONTENT_ADMIN`). Управляет расписанием/подменами/прогнозом,
но **не** настройками школы. `POST /schools/{id}/members { role:'SCHEDULER' }` + инвайты `role=SCHEDULER`.
Авторизация scheduling-эндпоинтов: `OWNER|ADMIN|SCHEDULER` — полный доступ; `TEACHER` — только свой
график (RO) + свой absence/availability. (`Principal`→`OWNER`, отдельной роли не вводим.)

### 4.2 `school_teacher` — доп. атрибуты (org-service) — ✅

К существующей таблице (§1.3: `max_weekly_hours`, `availability`) добавить:

```
school_teacher  += employment_type ENUM(full|part|contract)
                += status          ENUM(active|invited|inactive)
```

`GET /schools/{id}/teachers` дополнить `employmentType`, `status`, `name`, `avatarUrl` (денорм). Языки —
из teaching profile (profile-service), не дублируем.

### 4.3 Remove-teacher guard (org-service) — ✅

`DELETE /schools/{id}/members/{userId}` для TEACHER: если учитель — `primary` хотя бы одной **активной**
группы → `409 { error:'primary-of-active-groups', groups:[{id,name}] }`. Сначала переназначить primary.

### 4.4 Add-teacher invite (org-service) — ✅ реализовано

3-веточный flow как у студентов (lookup → invite `register`/`onboard_existing` / direct member), но
`role=TEACHER`. `POST /schools/{id}/invitations` принимает `role`, `kind` и `teachingLanguages[]` (§C).
При accept (обе ветки) выдаётся глобальная роль `teacher` и публикуется `school.teacher.accepted` →
user-profile-service создаёт `TeachingProfile` + материализует языки (идемпотентно).

### 4.5 notification-service — ✅ Типы добавлены

Под §3.13: типы уведомлений `TEACHER_ABSENCE`, `SUBSTITUTE_REQUEST`, `SUBSTITUTE_ASSIGNED`,
`OVERLOAD_ALERT`, `VACANCY_ALERT`, `UNCOVERED_LESSON` (in-app + email) + таймеры эскалации.

---

## Сводка задач (Teacher Management)

| #    | Сервис            | Задача                                                              | Статус | Блокирует фронт            |
| ---- | ----------------- | ------------------------------------------------------------------ | ------ | -------------------------- |
| 3.3+ | scheduling        | Расширенная нагрузка (prep/effectiveLoad/healthState) + policy      | ✅     | command center, schedule   |
| 3.9  | scheduling        | Absence / leave (график отпусков) + авто sub-requests              | ✅     | schedule view, console     |
| 3.10 | scheduling        | Substitution engine (candidates §7, assign confirm-recheck)        | ✅     | substitute console         |
| 3.11 | scheduling        | Curriculum plan (units/target/override/mapping)                    | ✅     | curriculum planner         |
| 3.12 | analytics/фронт   | Forecast (§10) — фронт-компьют сейчас, analytics позже             | 🟢 фронт | forecast (swap-ready)    |
| 3.13 | scheduling+notif  | Alerts + escalation                                                | ✅     | alerts delivery            |
| 4.1  | org+auth          | Роль `SCHEDULER`                                                   | ✅     | role-gating                |
| 4.2  | org               | `school_teacher` += employmentType/status                          | ✅     | roster attrs               |
| 4.3  | org               | Remove-teacher guard (primary активной группы)                     | ✅     | roster remove              |
| 4.4  | org/profile       | Add-teacher invite (TEACHER-ветка onboard_existing)               | ✅     | roster add                 |
| 4.5  | notification      | Типы уведомлений + эскалация                                       | ✅     | alerts delivery            |

---

## Сводка задач (Group/Student Management)

| #   | Сервис                 | Задача                                                                                 | Статус     | Блокирует фронт             |
| --- | ---------------------- | -------------------------------------------------------------------------------------- | ---------- | --------------------------- |
| 1.1 | org                    | Расширить `Group` (course/lang/level/status/mode/capacity/term-даты) + publish/archive | ✅ Готово  | список, детали, визард      |
| 1.2 | org                    | `group_teacher` junction + assign/remove + валидация                                   | ✅ Готово  | teacher-assign, detail      |
| 1.3 | org                    | `school_teacher` (maxWeeklyHours/availability) + GET teachers                          | ✅ Готово  | timetable, нагрузка         |
| 1.4 | org+content            | Авто-entitlement курса по членству (события + consumer)                                | ✅ Готово  | (фоновая логика)            |
| 1.5 | org                    | Расширенные GET-ответы групп                                                           | ✅ Готово  | список, детали              |
| 2.1 | analytics              | `GET /analytics/schools/{id}/students` — список + производный статус                  | ✅ Готово  | students list               |
| 2.2 | analytics              | `GET /analytics/schools/{id}/students/{userId}` — детали студента                     | ✅ Готово  | student detail              |
| 2.3 | profile/org            | `GET /users/lookup?email=` + 3-веточный invite/accept (kind + targetGroupId)           | ✅ Готово  | enroll/add-student          |
| 2.4 | notif/org              | Bulk message + сегменты                                                                | 🟢 отложен | (фиче-флаг)                 |
| 3.x | **scheduling (новый)** | slots/lessons/conflicts/load/timetable/clashes/absences/substitutions/curriculum/alerts | ✅ Готово (2026-06-08) | расписание, timetable |

---

## Invitation Management (`organization-service`) — ✅ Реализовано (2026-06-10)

> Цель: на фронте — таблица приглашений для учителей и студентов со статусом
> (`принят/онбординг пройден` · `отправлен` · `протух`), сроком жизни токена, кнопками
> **переотправить письмо** и **отозвать**. Сейчас на бэке есть только создание инвайта
> (`POST /schools/{id}/invitations`) и accept по токену — нет листинга, resend и revoke,
> а после accept запись инвайта, по-видимому, не сохраняет статус. Всё ниже — новые/доработка.

### 5.1 Персистентность статуса инвайта — ✅

`invitation` должен хранить полный жизненный цикл, а не удаляться после accept:

```
invitation
  id              UUID PK
  school_id       UUID FK
  email           CITEXT
  role            ENUM(ADMIN|CONTENT_ADMIN|TEACHER|STUDENT|SCHEDULER)
  kind            ENUM(register|onboard_existing)
  target_group_id UUID NULL FK
  invited_by      UUID            -- userId пригласившего
  token_hash      TEXT            -- хранить hash, не сырой токен
  status          ENUM(pending|accepted|expired|revoked)   -- вычисляется/материализуется
  created_at      TIMESTAMPTZ
  expires_at      TIMESTAMPTZ
  accepted_at     TIMESTAMPTZ NULL
  last_sent_at    TIMESTAMPTZ     -- для троттлинга resend и отображения «отправлено N назад»
  resend_count    INT DEFAULT 0
```

`status` определяется детерминированно (предпочтительно вычислять на чтении, чтобы не было
рассинхрона по `expires_at`):
- `accepted` — `accepted_at IS NOT NULL`
- `revoked`  — отозван вручную
- `expired`  — `now() > expires_at AND accepted_at IS NULL AND NOT revoked`
- `pending`  — иначе

> Уникальность активного инвайта: на пару `(school_id, lower(email), role)` допускать только один
> инвайт в статусе `pending`. Повторный `POST` на тот же email/role → либо `409`, либо идемпотентный
> resend существующего (решить; фронт ожидает 409 → показать «уже приглашён»).

### 5.2 `GET /api/v1/schools/{schoolId}/invitations` — ✅ листинг со статусом

Маршрут уже проксируется в BFF (`src/app/api/schools/[id]/invitations/route.ts`, метод GET), но
бэкенд-контракт не описан и, вероятно, не реализован. Нужно реализовать список **всех** инвайтов
школы (не только pending) с фильтрами.

Доступ: OWNER/ADMIN — все инвайты; TEACHER — допустимо отдавать только `role=STUDENT`-инвайты
своих групп (или вовсе скрывать — решить, фронт переживёт оба варианта).

```
?role=TEACHER|STUDENT|ADMIN|...     // опционально, фильтр
?status=pending|accepted|expired|revoked   // опционально, фильтр
?search=maria@                      // опционально, по email
```

```json
// 200
[{
  "invitationId": "uuid",
  "email": "student@example.com",
  "role": "STUDENT",
  "kind": "register",                 // "register" | "onboard_existing"
  "status": "pending",                // "pending" | "accepted" | "expired" | "revoked"
  "targetGroupId": "uuid | null",
  "targetGroupName": "Level A2 | null",   // денорм для удобства таблицы
  "invitedByName": "Ivan Petrenko | null", // денорм из profile-service
  "createdAt": "2026-06-10T10:00:00Z",
  "expiresAt": "2026-06-17T10:00:00Z",
  "acceptedAt": "2026-06-12T08:00:00Z | null",
  "lastSentAt": "2026-06-10T10:00:00Z",
  "resendCount": 0
}]
```

### 5.3 `POST /api/v1/schools/{schoolId}/invitations/{invitationId}/resend` — ✅

Переотправить письмо. Ротировать токен (старый инвалидировать), сдвинуть `expires_at` на полный TTL
от текущего момента, `last_sent_at = now()`, `resend_count += 1`, re-queue email через
notification-service.

```json
// 200
{ "invitationId": "uuid", "expiresAt": "2026-06-24T10:00:00Z", "deliveryStatus": "queued", "resendCount": 1 }
// 409 — инвайт уже accepted (нечего переотправлять)
// 410 — инвайт revoked
// 429 — троттлинг (не чаще, например, 1 раза в N минут) — опционально, но желательно
```

Доступ: OWNER/ADMIN (для TEACHER-инвайтов), OWNER/ADMIN/TEACHER (для STUDENT-инвайтов своих групп).

### 5.4 `DELETE /api/v1/schools/{schoolId}/invitations/{invitationId}` — ✅

Отозвать инвайт: `status = revoked`, токен инвалидируется (последующий accept → `410/404`).

```
// 204 No Content
// 409 — инвайт уже accepted (отзывать нечего; чтобы убрать участника — DELETE /members/{userId})
```

> `accept` (`POST /schools/invitations/{token}/accept`) должен проверять, что инвайт `pending`:
> для `expired`/`revoked` → `410 Gone` с понятным кодом, чтобы фронт показал «срок истёк / отозвано».

### 5.5 Tutoring-инвайты (`organization-service`) — ✅ доработка

`GET /api/v1/tutoring/group/invitations` уже есть, но возвращает только pending и без статуса.
Привести к тому же контракту, что §5.2 (добавить `status`, `acceptedAt`, `lastSentAt`, `resendCount`,
`invitationId`), и добавить две операции-близнецы:

```
POST   /api/v1/tutoring/group/invitations/{invitationId}/resend    → как §5.3
DELETE /api/v1/tutoring/group/invitations/{invitationId}           → как §5.4
```

(У тьюторинга нет `role`/`kind`/`targetGroup` — поля можно опускать/слать null.)

---

### 5.6 Accept-invitation preview — 🆕 НУЖНО (recipient-страница `/invite/{token}`)

> Фронт-план: [`plan/invitation-management/05-accept-flow.md`](plan/invitation-management/05-accept-flow.md),
> UI-спека: [`plan/invitation-management/accept-ui-spec.md`](plan/invitation-management/accept-ui-spec.md).

Посадочная страница приёма должна **верифицированно** показать, в какую школу и в какой роли зовут,
**до** аутентификации/accept. Клиенту нельзя доверять декоду JWT (подпись там не проверяется), а в
токене нет `schoolName`/`invitedByName` — только `schoolId`. Нужен публичный preview по токену:

```
GET /api/v1/schools/invitations/{token}        (без сессии; валидирует подпись + срок + статус)
→ 200 {
    schoolName, schoolSlug,
    role:  'ADMIN'|'CONTENT_ADMIN'|'TEACHER'|'STUDENT'|'SCHEDULER',
    kind:  'register'|'onboard_existing',
    email,                       // кому адресовано (для проверки «тот ли аккаунт»)
    invitedByName: string|null,
    status: 'pending'|'accepted'|'expired'|'revoked',
    expiresAt
  }
→ 404 (нет/повреждён/неверная подпись)   → 410 (срок истёк / отозван)
```

> Приватность: только поля выше, ничего лишнего о пользователе/школе.
> `accept` уже есть (§5 / `POST /schools/invitations/{token}/accept`). Tutoring — аналогичный preview
> `GET /api/v1/tutoring/invitations/{token}` с тем же контрактом (роль всегда `STUDENT`).
> **Опционально** (не блокер): claim `email` в access-JWT — фронт сверяет с `preview.email`, чтобы
> показать «вы вошли не тем аккаунтом» до accept. Если claim нет — guard просто пропускается; accept
> на бэке всё равно обязан отбивать чужой email (см. ниже).

> **Жёсткое правило accept:** email инвайта **должен** совпадать с email аутентифицированного юзера.
> Несовпадение → `403`. Не выдавать роль постороннему, кто завладел ссылкой, но залогинен иначе.

### 5.7 Атрибуты учителя при инвайте (`maxWeeklyHours` + `employmentType`) — 🆕 НУЖНО

Форма инвайта учителя на фронте уже собирает `maxWeeklyContactHours` и `employmentType`, но они
**теряются**: BFF/мутация шлют только `{ email, role, kind }`. Бэк их не принимает и не хранит. Нужно
довести «настройку нагрузки» с момента приглашения до материализации в `school_teacher` (§1.3).

**(1) Расширить payload создания инвайта** `POST /api/v1/schools/{schoolId}/invitations`:

```
{ email, role:'TEACHER', kind, targetGroupId?,
  maxWeeklyHours?:   INT,                       // для role=TEACHER
  employmentType?:   'full'|'part'|'contract' } // для role=TEACHER
```

Хранить эти атрибуты **на самом инвайте** (`invitation.teacher_max_weekly_hours`,
`invitation.teacher_employment_type`), т.к. на момент инвайта `user_id` ещё нет.

**(2) На `accept`** (kind `register`/`onboard_existing`) после создания `school_member(TEACHER)` —
материализовать атрибуты в `school_teacher`: `max_weekly_hours`, `employment_type` из инвайта.

**(3) Ветка B (прямое добавление, уже учитель)** — атрибуты применить сразу при добавлении в члены
(или follow-up `PATCH /schools/{id}/teachers/{userId}`).

**Семантика `employment_type`** (HR-метка под будущий payroll; scheduling её **не** использует):

| Значение | Смысл | Потолок часов | Будущий payroll/leave |
|---|---|---|---|
| `full` | штатный, полная ставка | фиксировано 40 (форма блокирует поле) | оклад; отпуск начисляется |
| `part` | штатный, неполная ставка | задаётся вручную (< 40) | оклад pro-rata; отпуск начисляется |
| `contract` | почасовик/подрядчик | `max_weekly_hours` = потолок **доступности**, не контрактное обязательство | оплата за проведённые уроки; отпуск обычно не начисляется |

> Сейчас различие `part`/`contract` ни на что не влияет (scheduling смотрит только на часы) — это
> **сознательно** заведённая метка под будущие модули зарплаты/отпусков (§3.9 leave). Документируем
> смысл, чтобы поле не стало dead data. Default при инвайте: `part`.

### 5.8 Авторизация создания инвайтов — 🆕 НУЖНО (грубый гейт сейчас)

`POST /schools/{schoolId}/invitations` (и tutoring-аналог) обязан проверять права вызывающего на
**сервере** — фронт-скрытие кнопки не защита. Правило (по решению владельца):

- **звать учителей/персонал** (`role` ∈ `TEACHER|ADMIN|CONTENT_ADMIN|SCHEDULER`) — только `OWNER`/`ADMIN`;
- **звать студентов** (`role=STUDENT`) — `OWNER`/`ADMIN` (и `TEACHER` для своих групп — как §5.3);
- `STUDENT`/`TEACHER` (вне своих групп) приглашать **никого не могут** → `403`.

> Гейт заменён на capability-based проверку в рамках эпика «Manager RBAC» (§R.2): MANAGER с
> `invitations:create_teacher` / `invitations:create_student` теперь может создавать инвайты;
> `requireCapability` вызывается внутри `SendInvitationHandler` без смены контракта эндпоинта.

---

## Сводка задач (Invitation Management)

| #   | Сервис | Задача                                                              | Статус | Блокирует фронт                |
| --- | ------ | ------------------------------------------------------------------ | ------ | ------------------------------ |
| 5.1 | org    | Персистентность инвайта + материализация `status`                  | ✅     | вся таблица инвайтов           |
| 5.2 | org    | `GET /schools/{id}/invitations` — листинг со статусом + фильтры     | ✅     | таблица (teachers + students)  |
| 5.3 | org    | `POST .../invitations/{invId}/resend` — ротация токена + re-queue   | ✅     | кнопка «переотправить»         |
| 5.4 | org    | `DELETE .../invitations/{invId}` — revoke + инвалидация токена      | ✅     | кнопка «отозвать»              |
| 5.5 | org    | Tutoring-инвайты: статус в листинге + resend/revoke                 | ✅     | таблица инвайтов у репетитора  |
| 5.6 | org    | `GET /schools/invitations/{token}` preview (+ tutoring-аналог); accept отбивает чужой email `403` | ✅ | страница `/invite/{token}` |
| 5.7 | org    | Атрибуты учителя в инвайте (`maxWeeklyHours`+`employmentType`) → материализация в `school_teacher` | ✅ | проброс полей формы инвайта |
| 5.8 | org    | Гейт авторизации создания инвайтов на сервере (OWNER/ADMIN; TEACHER — свои студенты) | ✅ | защита от чужих инвайтов |

> **Заметки для интеграции с фронтом** (план: [`plan/invitation-management/`](plan/invitation-management/00-overview.md)):
> - Счётчик «N приглашений ожидают» на ростер-страницах считается из листинга §5.2
>   (`?role=…&status=pending`) — **отдельный count-эндпоинт не нужен**.
> - Табы фронта (`Учителя`/`Студенты`/`Персонал`) — это клиентская группировка по `role`;
>   бэку достаточно фильтра `?role=`. Маппинг: `Персонал` = `ADMIN|CONTENT_ADMIN|SCHEDULER`.
> - Фронт до готовности §5.1–5.5 работает через `InvitationsProvider` (mock → real по флагу
>   `INVITATIONS_BACKEND=real`), контракт ответа = §5.2. UI при переключении не меняется.

---

# ▣ Manager RBAC — capability-based авторизация (эпик, `organization-service`) — ✅ Реализовано (2026-06-11)

> **Статус:** реализовано 2026-06-11.
> Продуктовое требование владельца: роль «менеджер школы», которой OWNER/ADMIN делегирует **часть**
> обязанностей (например «только звать студентов», или «формировать группы»), настраиваемо
> поштучно — «табличка доступа».

## 1. Принцип: права (capabilities), а не захардкоженные роли

Роль `MANAGER` с фиксированным набором действий не масштабируется (один менеджер только зовёт
студентов, другой только ведёт группы…). Поэтому: **роль = именованный пресет набора прав**, а тонкая
настройка — per-member набор capability-флагов. Проверяем **право**, не роль.

## 2. Фиксированный enum прав (capabilities)

Дискретный список в коде (стартовый набор под текущие фичи; расширяется добавлением значения, не схемы):

```
invitations:create_teacher      groups:create
invitations:create_student      groups:edit
invitations:manage              groups:publish      (resend/revoke)
members:remove                  groups:archive
students:message                schedule:manage
content:manage                  school:settings
```

Группировка для UI-матрицы: **Приглашения · Участники · Группы · Расписание · Контент · Школа**.

## 3. Модель данных

`school_member` уже несёт `role` (school-scoped). Добавляем слой прав, тоже school-scoped:

```
school_member_permissions
├─ school_id  UUID
├─ user_id    UUID            (PK: school_id+user_id, FK → school_member)
└─ capabilities  TEXT[]       -- набор выданных прав (или bitmask)
```

**Эффективные права** пользователя в школе:
- `OWNER` (создатель школы) → **все** права, неотчуждаемо (нельзя снять/понизить).
- `ADMIN` → все права, кроме owner-only (`school:delete`, биллинг — когда появятся).
- `MANAGER` → **ровно `capabilities`** из `school_member_permissions` (что выдал OWNER/ADMIN).
- `TEACHER`/`STUDENT` → фиксированный минимум (учитель — права на свои группы/студентов; см. §5.3).

> `CONTENT_ADMIN` и `SCHEDULER` (уже существуют) концептуально = пресеты `content:*` и `schedule:*`.
> Сейчас **не рефакторим** — оставляем как есть; позже можно свести к capability-пресетам.

## 4. Enforcement

- **Авторитетно на сервере:** хелпер `requireCapability(userId, capability, schoolId)` на каждом
  мутирующем эндпоинте school-раздела. Заменяет точечные проверки роли.
- **Зеркало для фронта (только скрытие UI, не безопасность):**
  ```
  GET /api/v1/schools/{schoolId}/me/permissions
  → { role, capabilities: string[], isOwner: boolean }
  ```
  Фронт по этому списку прячет кнопки/табы. Сервер всё равно ре-проверяет.
- Выдавать/менять права может только тот, у кого `school:settings` (OWNER/ADMIN); нельзя выдать
  право, которого нет у самого выдающего (no privilege escalation).

## 5. Эндпоинты управления менеджерами

```
POST   /api/v1/schools/{schoolId}/invitations          -- role:'MANAGER', capabilities:string[]
PATCH  /api/v1/schools/{schoolId}/members/{userId}/permissions   { capabilities:string[] }
GET    /api/v1/schools/{schoolId}/members?role=MANAGER  -- список менеджеров + их права
```

При инвайте менеджера `capabilities` хранятся на инвайте и материализуются на accept (как §5.7 для
учителя). Пресеты («Только приглашения студентов», «Координатор групп») — это просто заранее
заготовленные наборы значений enum на фронте; бэку прилетает уже массив прав.

## 6. Роль `MANAGER` в enum

Расширить `school_member.role` и `invitation.role`:
`ENUM(OWNER|ADMIN|MANAGER|CONTENT_ADMIN|SCHEDULER|TEACHER|STUDENT)`.
(`OWNER` — если ещё не выделен отдельным значением/флагом; уточнить текущую модель owner.)

## 7. v1 scope (чтобы не переинженерить)

**Входит:** enum прав (в коде) · `school_member_permissions` · пресеты + произвольный набор галочек ·
`requireCapability` на бэке · `GET …/me/permissions` · invite/edit менеджера.
**НЕ входит (позже):** кастомные именованные роли/конструктор ролей, ABAC по атрибутам, делегирование
прав вниз по иерархии, аудит-лог изменений прав, owner-only биллинг-права.

## 8. Открытые вопросы (решить до реализации)

1. **`OWNER` сейчас** — отдельное значение роли, флаг на `school_member`, или просто первый ADMIN?
   От этого зависит «неотчуждаемость всех прав».
2. **`TEACHER`-права на студентов своих групп** (§5.3) — оставляем хардкодом по роли или тоже
   выражаем capability (`invitations:create_student` со scope=своя группа)? Предлагаю v1 — хардкод,
   scope-права позже.
3. **Глобальные роли (`/auth/roles`) vs school-scoped (`school_member.role`)** — capabilities строго
   school-scoped; убедиться, что enforcement берёт роль из членства в школе, а не из глобального JWT.

## Сводка (Manager RBAC)

| # | Сервис | Задача | Статус |
| --- | --- | --- | --- |
| R.1 | org | enum прав + `school_member_permissions` + резолв эффективных прав | ✅ |
| R.2 | org | `requireCapability` enforcement на мутациях school-раздела | ✅ |
| R.3 | org | `GET …/me/permissions` (зеркало для фронт-гейтинга) | ✅ |
| R.4 | org | роль `MANAGER` в enum + invite/edit с `capabilities` (+ материализация на accept) | ✅ |
