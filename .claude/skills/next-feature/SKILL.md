---
name: next-feature
description: Plan the next queued feature in the SatSend roadmap before any work begins. Use when user says "next feature", "move on", "what's next", or "continue". Reads development/ROADMAP.md, finds the first ⏳ section, and produces a planning brief (steps, automatic vs manual work, scope critique, manual-test plan, clarifying questions). Does NOT start implementation until the user gives the go-ahead.
---

# next-feature

This skill runs in two phases. **Phase 1 (Plan) is always required.** Do not begin implementation until the user explicitly approves Phase 1.

---

## Phase 1: Plan and align (do this first, every time)

1. Read `development/ROADMAP.md`. Find the first section marked ⏳. That is the candidate target.

2. Read the entire candidate section carefully (Context, Scope checklist, Tests, Done-when, and any embedded migration / file lists).

3. Skim the surrounding roadmap context: the previous 1 or 2 ✅ versions and the next 2 or 3 ⏳ versions. You are looking for:
   - Areas the previous version touched that this branch will also touch (regression risk).
   - Future versions that will rework, replace, or conflict with what this branch is about to build (avoid building something the next version will throw away).
   - Migration ordering issues (does this branch's migration sit cleanly after the latest one?).

4. Reply to the user with a single planning brief in this exact shape. Be concise. No filler.

   **Target:** `vX.Y.Z` (one-line summary), branch name from the roadmap.

   **Plan (in order):**
   1. Step one (e.g. "create branch via git-workflow skill")
   2. Step two (e.g. "write failing tests for server action validation")
   3. ... etc, end-to-end through to the ROADMAP ⏳ → ✅ flip and PR open

   **I will do automatically:** branch creation, code, automated tests (TDD), migration files, type checks, lint, commits, the manual-tests doc.

   **You will need to do manually:** anything I cannot do (apply migrations against remote via `supabase-migrate` if it touches data, run the dev server, set env vars, run any one-off SQL the migration needs you to authorise, perform the manual tests at the end, merge the PR).

   **Scope critique:** my honest read on whether the scope is right.
   - If it should be split, propose the split (e.g. "I'd ship the DB constraint as v1.4.16a and the form UX as v1.4.16b because ...").
   - If it looks overcomplicated, name the part I'd cut and why.
   - If it conflicts with a future ⏳ version or undoes a recent ✅ version, flag it explicitly with the version reference.
   - If none of the above apply, say "scope looks right" in one line. Do not invent concerns.

   **Manual tests I'll prepare (will live in `manual-tests/vX.Y.Z-<slug>.md`):** a short bulleted list, one line per test, of the specific scenarios you will need to verify by hand once the work is done. Decide these now so the implementation is shaped to make them runnable. Each line should name what it proves (e.g. "TEST 3 - marking paid writes a `marked_as_paid` row and updates the badge"). Cover the golden path, the obvious edge cases, and any negative / RLS / failure cases that automated tests cannot reach. If a real-money or external-service step is required (real email send, real BTC payment), call that out so the user knows what they will need.

   **Clarifying questions:** anything ambiguous in the roadmap section, anything I'd otherwise have to guess at, anything where there's more than one reasonable interpretation. If there are genuinely none, say "none" rather than inventing questions.

5. **Stop.** Wait for the user to confirm, push back, or amend before doing anything else. Do not create the branch, do not run tests, do not edit code.

---

## Phase 2: Execute (only after the user approves Phase 1)

Once the user has agreed to the plan (and any amendments):

1. Invoke the `git-workflow` skill to scaffold the branch using the branch name from the roadmap section.
2. Invoke the `tdd` skill with the version name and the Scope / Tests checklist items. Work through items in order, red-green-refactor per item.
3. Mark each checklist item with `[x]` in `development/ROADMAP.md` as it is completed.
4. **Before opening the PR**, write the manual-tests doc agreed in Phase 1 to `manual-tests/vX.Y.Z-<slug>.md`. Use the existing files in `manual-tests/` as the template. Each test should have: a one-line "Proves" claim, Setup, Run, Expect, and (where relevant) a DB confirmation snippet. Keep it as simple as possible to follow without prior context. Include a short "Quick smoke test" section listing the 2 or 3 tests the user should run if they only have a couple of minutes. For every HTTP test, make the command print the HTTP status code as well as the response body, and state that exact status code in **Expect**.
5. When all checklist items are done, change the section header emoji from ⏳ to ✅, tell the user the version is implementation-complete, point them at the manual-tests doc, and remind them what comes next in the roadmap. Do NOT auto-merge (see `no-auto-merge`).

---

## Notes

- This skill never commits to `main` (see memory: `feedback_never_commit_to_main`).
- If a migration is involved, follow `feedback_test_migrations_before_pr`: run `db push` against remote before opening the PR.
- If you hit a side-blocker during Phase 2, use the `obstacle-options` skill rather than silently routing around it.
- Be opinionated. The user has explicitly asked you not to be a yes-man. If you think the roadmap section is wrong, say so in Phase 1.
