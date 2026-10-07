---
name: git-workflow
description: Git workflow and SemVer management for SatSend. Use when starting any new feature, fix, or release — creates the correct branch, enforces SemVer, and keeps CHANGELOG.md in sync. Always invoked before writing code on a new task.
---

# Git Workflow & Semantic Versioning

Git workflow management and Semantic Versioning (SemVer 2.0.0). Your primary goal is to manage the repository's evolution while ensuring `main` remains stable and documentation is never out of sync.

# Core Mandates:
1. NEVER provide code for the `main` branch. Every task must begin by checking out a new feature or fix branch.
2. Adhere strictly to SemVer 2.0.0 (MAJOR.MINOR.PATCH).
3. Every merge-ready task must include an update to `CHANGELOG.md` and `README.md`.
4. Use the GitHub CLI (`gh`) or Git Tagging commands to manage "Releases."

# Operational Workflow:

## Phase 1: Branching & Development
Before providing any code changes, you must output a shell block that:
- **For roadmap features:** use the branch name defined in `development/ROADMAP.md` (e.g., `v1.0/foundation`, `v1.1/invoice-crud`). Always read the roadmap first.
- **For ad-hoc fixes/features not in the roadmap:** create a descriptive branch name (e.g., `feat/login-system` or `fix/api-header`).
- Switches to that branch.
*Prompting Rule: If the user asks for a change, your first response must always be: "Creating branch [name] to implement [task]..." followed by the checkout command.*

## Phase 2: Versioning Logic
Evaluate the scope of the change:
- **PATCH:** Backward-compatible bug fixes. (Increment Z: 1.0.1)
- **MINOR:** New backward-compatible functionality or deprecations. (Increment Y and reset Z: 1.1.0)
- **MAJOR:** Incompatible API changes or breaking changes. (Increment X and reset Y/Z: 2.0.0)
*Note: During initial development (0.y.z), use Minor for new releases and Patch for fixes.*

## Phase 3: Documentation Updates
Every time you complete a feature or fix:
- **CHANGELOG.md:** Add a dated entry under the new version number. Categorize changes: [Added], [Changed], [Deprecated], [Removed], [Fixed], [Security].
- **README.md:** Update any installation instructions, API examples, or "Usage" sections affected by the new code.

## Phase 4: Release Management (The GitHub Bridge)
Interim feature branches should NOT be tagged as GitHub Releases. Follow this logic:
- **Feature/Fix Merges:** Provide commands to merge the branch into `main` and update documentation.
- **Official Releases:** When a MAJOR or MINOR milestone is reached, provide the following specific commands:
  ```bash
  git tag -a v1.0.0 -m "Release version 1.0.0 - [Summary of major changes]"
  git push origin v1.0.0
  gh release create v1.0.0 --title "v1.0.0" --notes-file temp_release_notes.md
  ```

# Forbidden Actions:
- Directly committing to `main`.
- Skipping version numbers (e.g., going from 1.0.0 to 1.0.5 without reason).
- Using "v" inside the actual SemVer string (use 1.0.0, not v1.0.0, though the Git tag may use the "v" prefix).
- Merging code without an accompanying update to `CHANGELOG.md`.

# Release Tagging Rules:
- **PATCH updates** (e.g., 1.0.1): Git Tag + CHANGELOG update only.
- **MINOR updates** (e.g., 1.1.0): Git Tag + CHANGELOG update only.
- **MAJOR updates** (e.g., 1.0.0, 2.0.0): Git Tag + CHANGELOG update + GitHub Release.
- **On every merge to `main`:** bump `package.json` to the merged version and push
  the matching tag (`git tag vX.Y.Z && git push origin vX.Y.Z`). Keep `package.json`,
  the tag, and `CHANGELOG.md` in lockstep. Use plain SemVer — no `v` inside the
  string, and no `-H` (that suffix is roadmap naming, not SemVer; in real SemVer it
  would mean a prerelease).

This keeps the GitHub Releases tab clean, showcasing only significant completed version milestones.

To summarize:
- All versions: Git Tag + CHANGELOG update.
- Major versions only: Git Tag + CHANGELOG update + GitHub Release.
