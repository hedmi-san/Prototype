---
name: code-reviewer
description: Review a backend (Node/Express) + frontend (Vue) diff or codebase for cross-file issues that a build or linter won't catch — stack-specific anti-patterns (blocking calls in async handlers, hidden N+1 queries, unguarded promises), layer violations (DB/HTTP access leaking into the wrong layer), frontend↔backend contract drift (frontend calling a route the backend doesn't have), duplicate logic, deep nesting, missing error handling, and confusing naming. Use this after generating or editing backend/frontend code, when the user asks for a code review, "does this look right," a pre-merge review, or wants to check that the frontend and backend actually agree with each other. Read-only: reports findings, doesn't rewrite code unless asked. Does not cover hardcoded secrets — that's the security-reviewer skill's job.
---

# Code Reviewer — Cross-File Review (Node/Express + Vue)

Review code for the kind of problems that only show up when you look
across files — not the kind a linter or the build already catches.
This is a **review** skill: report findings with file/line and a fix
suggestion, but don't rewrite the user's code unless they ask you to.

## Scope note: not a linter, not a secrets scanner

Skip anything a basic linter already handles — TODO/FIXME comments,
magic numbers, `console.log` calls, overly long methods by line count
alone, commented-out code blocks, basic naming-convention violations.
If the user wants that, a linter (ESLint, etc.) is the right tool, not
this review.

**Hardcoded secrets are explicitly out of scope here** — that
detection lives entirely in the `security-reviewer` skill (API keys,
tokens, credentials in source, CWE-798). If you spot something that
looks like a secret while doing this review, mention it once in
passing, but point to a full security review rather than trying to
classify it yourself here — keeping secrets detection in one place
avoids two skills disagreeing about the same finding.

## What to look for

Group findings into these categories. For each, the check requires
looking at more than one line/function — that's what makes it worth a
dedicated pass instead of a regex-only lint.

### 1. Backend anti-patterns (Node/Express)

- **Blocking I/O in an async handler**: `fs.readFileSync`,
  `execSync`, or other synchronous calls inside a route handler that's
  otherwise async — blocks the event loop for every concurrent request.
- **Unhandled promise rejections**: a `Promise` or `async` call with no
  `.catch()` and not inside a `try/catch`, especially in a route
  handler (an unhandled rejection here can crash the process or hang
  the response).
- **`await` inside `forEach`**: `arr.forEach(async (x) => { await ... })`
  — `forEach` doesn't wait for the async callback, so this silently
  runs all iterations concurrently/out of order when the author
  probably wanted sequential or properly awaited-parallel execution.
  Fix: `for...of` with `await`, or `Promise.all(arr.map(...))` if
  parallel is actually intended.
- **Hidden N+1 via ORM chaining**: e.g. `Model.findAll().then(items =>
items.map(i => i.getRelated()))` — looks like one query, issues N.
  Look for a fetch-then-loop-that-queries-again pattern. Fix: eager-load
  the relation (`include`), or batch the follow-up query.
- **Missing `CancellationToken`-equivalent / abort handling**: less
  common in Node, but flag long-running handlers with no timeout or
  abort path if the framework/library supports one and it's absent.

Severity: serious.

### 2. Frontend anti-patterns (Vue)

- **`v-for` without `:key`**, or `:key="index"` where the list can
  reorder/filter — causes incorrect DOM diffing and state bugs, not
  just a lint nag.
- **`reactive(props)`** — copies props into local reactive state,
  breaking the one-way data flow; changes to the parent's data won't
  propagate. Flag it and suggest `computed()` or `toRefs(props)` instead.
- **Direct prop mutation** — assigning to a prop inside the child
  component instead of emitting an event upward.
- **`watch(..., { immediate: true })` with no clear reason** — often
  papering over a data-flow problem (state that should just be
  computed). Worth a note, not necessarily wrong.

Severity: moderate.

### 3. Layer violations

Business logic, DB access, or raw HTTP calls showing up in the wrong
layer:

- Backend: a route handler in `routes/` or `controllers/` directly
  building a DB query, instead of calling into a `services/` or
  `repositories/` layer.
- Frontend: a Vue component (`.vue` file, especially in `components/`)
  calling `fetch(...)` or `axios.*` directly, instead of going through
  a `services/`, `api/`, or composable layer.

This one needs judgment about the project's actual conventions — if
the codebase clearly doesn't separate these layers anywhere, don't
flag every file; note the pattern once and let the user decide if it's
worth restructuring. Severity: moderate (serious if the project has an
established services/ layer elsewhere that this code bypasses).

### 4. Frontend ↔ backend contract drift

This is usually the highest-value check, because it's not "code smell,"
it's "this will break in the browser."

1. From the backend, collect every route: grep for
   `app.get|app.post|app.put|app.delete|app.patch|router.get|router.post|...`
   and note `(method, path)` for each.
2. From the frontend, collect every HTTP call: grep for `fetch(`,
   `axios.get|axios.post|...`, or calls through a composable/service
   wrapper, and note `(method, path)` for each — resolve path prefixes
   /base URLs if they're defined in a config file.
3. **Frontend calls a path with no matching backend route** → flag as
   **critical** — this is a broken feature, not a style issue.
4. **Backend route with no frontend caller** → flag as **minor**, just
   informational (could be an endpoint used elsewhere, or dead code —
   not necessarily a problem).
5. Also check payload shape drift where visible: if the frontend sends
   a body with fields the backend's validation/schema doesn't expect
   (or vice versa), flag as serious.

### 5. Cross-file smells

For files or functions large enough that this actually matters
(roughly >100 lines / >30-line functions — don't bother on small files):

- **Duplicate logic**: two functions that are clearly doing the same
  thing with minor variations — flag and suggest extracting a shared
  helper. Moderate.
- **Deep nesting**: more than 3 levels of indentation sustained for
  several lines — usually extractable into early returns or a helper
  function. Moderate.
- **Missing error handling in context**: an `await` with no
  surrounding `try/catch` in a place where the call can plausibly fail
  (network, DB, file I/O, JSON parsing of external input) — not every
  `await` needs one, use judgment about what can actually throw.
  Serious.
- **Confusing naming**: a variable/function name that's actively
  misleading or too generic to convey intent in context (`data`, `tmp`,
  `x`, `helper`, `doStuff`) — flag sparingly, this is the lowest-value
  and most subjective category. Minor.

## Severity and verdict

Four levels: critical, serious, moderate, minor.

- 🟢 **Green** — no issues.
- 🟡 **Warn** — issues found, none at/above the user's threshold
  (default: critical) and no hard-blocking finding.
- 🔴 **Red** — any **frontend↔backend contract gap** (category 4,
  case 3) regardless of threshold, since that's a broken feature not a
  style opinion; or any issue at/above the threshold.

If the user hasn't specified a threshold, default to critical and say so.

## Output format

Lead with the verdict. Group by severity, and within each severity note
the category. For each finding: file + rough location, what's wrong,
why it matters in 1–2 sentences, and a concrete fix (not "handle
errors better" but "wrap this in try/catch and return a 4xx with the
validation message" or similar).

```
🔴 RED — 1 critical, 2 serious, 4 moderate

## Critical
- [Contract Drift] frontend calls DELETE /api/orders/:id, no matching
  backend route (only GET/POST /api/orders exist)
  This will 404 in production. Add the route or fix the frontend call.

## Serious
- [Unhandled Rejection] routes/users.js:34
  `db.query(...)` inside an async handler with no try/catch or .catch().
  A DB error here will hang the request or crash the process depending
  on Express version. Wrap in try/catch and return a proper error response.
...
```

If nothing was found, say so plainly — "reviewed N files, no issues
found" is a complete, useful answer on its own.

## What this skill does not do

- Doesn't modify code — report only, unless explicitly asked to apply
  a fix.
- Doesn't run the build, tests, or a linter itself — assumes those
  already ran; this is a read-through for what they don't catch.
- Doesn't scan for hardcoded secrets — see `security-reviewer`.
- Doesn't flag basic style/lint issues (TODOs, console.log, naming
  conventions, line/method length by itself) — that's a linter's job.
