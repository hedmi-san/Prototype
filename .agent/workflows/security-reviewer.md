---
name: security-reviewer
description: Review code for security vulnerabilities against the OWASP Top 10 2021 — hardcoded secrets, SQL/command injection, XSS, broken access control (missing auth checks on endpoints), IDOR, weak crypto (MD5/SHA1/ECB), permissive CORS, insecure cookies, missing security headers, unsafe deserialization, SSRF, and secrets in logs or exposed stack traces. Use this whenever the user asks for a security review, a security audit, "check this for vulnerabilities," "is this code safe," a pre-merge/pre-deploy security pass, or after generating/editing backend or frontend code that handles auth, user input, external URLs, database queries, or secrets — even if they don't say the word "security." Strictly a review skill: read and report, don't silently rewrite the user's code.
---

# Security Reviewer — OWASP Top 10 2021

Review code for security vulnerabilities and report findings with a clear
verdict. This is a **review** skill, not an auto-fix skill: read the code,
classify what you find, explain the risk, suggest a fix — but let the user
decide whether and how to apply it. Don't rewrite their files unless they
ask you to.

## When to go deep vs. go light

- A few files, a diff, or "review what I just wrote" → do the scan inline
  in the conversation, no report file needed.
- A whole repo, a pre-merge gate, or the user wants something to save/share
  → still do the scan inline, but offer to write it to a markdown file if
  they want a record.

Either way, the process below is the same.

## Process

1. **Find the code in scope.** If the user pointed at specific files or a
   diff, use those. Otherwise, look for recently changed or generated
   source files (backend and frontend) — don't try to scan an entire large
   repo from scratch unless asked; that burns budget on unrelated code.
2. **Grep for the pattern classes below**, category by category.
3. **For every match, reason about it before flagging it.** A regex hit is
   a candidate, not a finding — you have to look at the surrounding code.
   `process.env.DB_PASSWORD` is fine; `password = "hunter2"` is not. A
   `<Foo id={id}>` isn't XSS; `dangerouslySetInnerHTML={{__html: userInput}}`
   is. This cross-checking is most of the actual work — a plain grep pass
   without it produces mostly noise.
4. **Apply the exclusions** (test files, env var references, dev-only
   config, conventionally-public endpoints — see below) before flagging.
5. **When a match is genuinely ambiguous** — you can't tell if input is
   sanitized upstream, or if an endpoint's auth is enforced by middleware
   you can't see — don't drop it and don't hard-fail on it either. Flag it
   as a lower-confidence note so the user can confirm, rather than silently
   omitting a possible real issue.
6. **Report** using the format in "Output format" below.

## OWASP categories and what to look for

For each category: the pattern to grep for, the reasoning check to apply
before flagging, and the severity. Categories marked **hard-blocking**
force a 🔴 finding regardless of overall severity threshold — these are
the ones that are almost never a false positive and almost always
exploitable.

### Hardcoded secrets — hard-blocking

Look for `api_key =`, `password =`, `secret =`, `token =` followed by a
literal string (not a variable/env lookup); cloud-specific formats like
AWS keys (`AKIA[0-9A-Z]{16}`), GitHub tokens (`ghp_`, `gho_`, `github_pat_`),
Slack tokens (`xox[baprs]-`), private key headers (`-----BEGIN PRIVATE KEY`),
JWT-looking literals (`eyJ...` assigned to a constant).

- **Exclude**: `process.env.X`, `os.environ.get("X")`,
  `Environment.GetEnvironmentVariable("X")`, `System.getenv("X")`,
  `@Value("${X}")` — these are the correct pattern, never flag them.
- **Downgrade, don't drop**: a literal secret in `appsettings.Development.json`
  or similarly named dev-only config is still worth noting, but as a
  moderate "don't let this reach prod" note rather than a critical finding.
- CWE-798.

### SQL injection — hard-blocking

String concatenation or f-strings/template literals building a SQL query
from user input (`"SELECT * FROM users WHERE id = " + userId`, f-strings
with `{request...}` inside a query, string-built `WHERE` clauses). Flag
unless the query is fully parameterized (`?`, `$1`, named params, or an
ORM call). CWE-89.

### Command injection — hard-blocking

User input passed into `exec()`, `subprocess.run(..., shell=True)`,
`child_process.exec()`, `os.system()`, backticks/`` `${...}` `` in shell
contexts, `Runtime.exec()` with concatenated strings. Flag unless the
input is passed as a properly separated argument array with `shell=False`
or equivalent. CWE-78.

### XSS

`dangerouslySetInnerHTML` (React), `v-html` (Vue), `[innerHTML]` (Angular),
raw `innerHTML =` assignment, or template output that isn't
auto-escaped, where the source is user-controlled. Severity: serious on
backend-rendered HTML, moderate on frontend if a sanitizer library is
present but possibly misconfigured. CWE-79.

### Broken access control — hard-blocking

This one needs structural reasoning, not just a regex: for every route
handler (`app.get/post`, `@GetMapping/@PostMapping`, `app.MapGet`, FastAPI
`@app.get`, etc.), check whether an auth guard appears nearby — decorator,
middleware, `[Authorize]`, `@PreAuthorize`, `Depends(get_current_user)`,
or an app-level auth middleware that covers the route. If you can't find
one, flag it.

- **Exclude by convention**: `/health`, `/metrics`, `/swagger`,
  `/openapi.json`, and auth endpoints themselves
  (`/login`, `/register`, `/forgot-password`, `/reset-password`).
- If the app clearly wires global auth middleware ahead of all routes,
  don't flag every individual route — note the pattern once. CWE-862.

### IDOR (Insecure Direct Object Reference)

An endpoint that takes an `{id}` / `{userId}` path or query param and
fetches/mutates a record by that id, with no visible check that the
record belongs to the requesting user (no `ownerId ==`, no
`currentUser.id ==` comparison nearby). Serious. CWE-639.

### Weak cryptography

MD5 or SHA1 used for password hashing (not for non-security checksums),
hashing without a salt, AES in ECB mode, `Math.random()` or similar
non-cryptographic RNG used to generate tokens/session ids/reset codes.
Serious. CWE-327 / CWE-330 / CWE-759.

### Permissive CORS

`Access-Control-Allow-Origin: *` combined with credentials, or a CORS
config that reflects any origin. Also flag the _absence_ of any CORS
config at all on a backend that's clearly serving a separate-origin
frontend (SPA) — that's a different failure mode (accidentally open by
default) worth a lower-severity note. Serious / moderate. CWE-942.

### Insecure cookies

Session or auth cookies set without `Secure`, `HttpOnly`, or a
`SameSite` attribute. Moderate. CWE-614.

### Missing security headers

No `Strict-Transport-Security`, no `Content-Security-Policy`, or
obviously permissive `X-Frame-Options` absence on an app serving HTML.
Moderate — this is a "nice to flag," not usually hard-blocking on its own.

### Unsafe deserialization — hard-blocking

`pickle.loads()` on untrusted input, Java native deserialization of
untrusted streams, `yaml.load()` without `SafeLoader`, PHP `unserialize()`
on user input. CWE-502.

### SSRF (Server-Side Request Forgery) — hard-blocking

A user-supplied URL or hostname passed directly into an outbound
HTTP call (`fetch(userProvidedUrl)`, `requests.get(url)` where `url`
comes from a request body/param) with no allowlist or validation.
CWE-918.

### Logging failures

Secrets, tokens, or full request bodies logged (`console.log(req.body)`
on an auth endpoint, `logger.info(f"token={token}")`); `catch` blocks
that swallow exceptions with no log at all; stack traces or internal
error details returned directly in an API response body. Serious. CWE-532.

## Cross-cutting exclusions

Apply these before flagging anything, across every category:

- Test files: `**/test_*`, `**/*.test.*`, `**/__tests__/**`, `**/*Tests/**`.
- Correct env-var access patterns (see hardcoded secrets above) — these
  are the fix, not the problem.
- Comments, docs, and example/fixture code clearly marked as such.
- If you're not sure whether something is test/fixture code, say so in
  the finding rather than silently excluding or silently flagging it.

## Severity and verdict

Use four levels: **critical, serious, moderate, minor**.

Compute an overall verdict:

- 🟢 **Green** — no issues found.
- 🟡 **Warn** — issues found, but none at or above the user's stated
  threshold (default: critical) and none of the hard-blocking classes.
- 🔴 **Red** — any hard-blocking class matched (secrets, SQL injection,
  command injection, broken access control, unsafe deserialization,
  SSRF), regardless of how minor it looks, or any issue at/above the
  threshold.

If the user hasn't told you what to fail on, default the threshold to
critical, and say so.

## Output format

Lead with the verdict, then group findings by severity, then category.
For each finding give: file + rough location, what the pattern is, why
it's a risk (1–2 sentences), and a concrete fix — not just "sanitize
input" but the actual mechanism (parameterized query, `shell=False` +
arg list, `SafeLoader`, ownership check, etc.). Tag each with its OWASP
category and CWE where applicable so the user can look it up.

Keep it scannable:

```
🔴 RED — 2 critical, 1 serious, 3 moderate

## Critical
- [SQL Injection] api/users.py:42 (A03, CWE-89)
  Query built with an f-string from `request.args['id']`. An attacker
  controlling `id` can alter the query.
  Fix: use a parameterized query — `cursor.execute("... WHERE id = %s", (id,))`.

- [Hardcoded Secret] config/settings.py:8 (CWE-798)
  AWS access key literal in source.
  Fix: move to environment variable / secrets manager; rotate this key,
  it's already been committed.

## Serious
...
```

If nothing was found, say so plainly rather than padding the report —
"scanned N files, no issues found" is a complete answer.

## What this skill does not do

- Doesn't modify the user's code — report only, unless they explicitly
  ask you to apply a fix.
- Doesn't run the code, tests, or a linter — this is a static read-through.
- Isn't a substitute for pre-development threat modeling — it reviews
  code that already exists, not a design.
- Isn't legal or compliance advice (PCI-DSS, HIPAA, SOC2, etc.) — flag
  the technical issue; let the user or their compliance team map it to
  a framework requirement.
