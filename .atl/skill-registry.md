# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Creating a pull request, opening a PR, or preparing changes for review | branch-pr | ~/.config/opencode/skills/branch-pr/SKILL.md |
| Writing Go tests, using teatest, or adding test coverage | go-testing | ~/.config/opencode/skills/go-testing/SKILL.md |
| Creating a GitHub issue, reporting a bug, or requesting a feature | issue-creation | ~/.config/opencode/skills/issue-creation/SKILL.md |
| "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | judgment-day | ~/.config/opencode/skills/judgment-day/SKILL.md |
| Creating a new skill, adding agent instructions, or documenting patterns for AI | skill-creator | ~/.config/opencode/skills/skill-creator/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Follow the issue-first enforcement system — no PRs without a linked issue
- PR title must match conventional commit format
- Body must include summary, linked issue, and testing notes
- Never force push to main/master
- Resolve all review comments before merge

### go-testing
- Use `teatest` for Bubbletea TUI component testing
- Table-driven tests for all Go functions
- Test golden files for TUI output snapshots
- Use `t.Parallel()` where tests are independent
- Mock external dependencies via interfaces, not globals

### issue-creation
- Issues MUST link to a problem or feature request, not a solution
- Include reproduction steps for bugs with Given/When/Then format
- Acceptance criteria must be testable and unambiguous
- Link related issues and PRs in the body
- Labels must reflect priority and type (bug/feature/chore)

### judgment-day
- Launches TWO independent blind judge sub-agents simultaneously
- Each judge reviews the same target without seeing the other's output
- Synthesizes findings from both judges
- Applies fixes and re-judges until both pass
- Escalates after 2 failed iterations — never silently passes

### skill-creator
- Skills follow the Agent Skills spec with frontmatter (name, description, license, metadata)
- Include trigger patterns in description for auto-detection
- Keep skills focused on a single concern — no mega-skills
- Compact rules section is mandatory for sub-agent consumption
- Version skills using semver in metadata

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| .gga | C:\Users\nicor\Desktop\Proyectos de IT\Proyecto-ReproductorPro\.gga | Guardian Angel config — PROVIDER=claude, FILE_PATTERNS=*.ts,*.tsx,*.js,*.jsx, STRICT_MODE=true |

No additional convention files (AGENTS.md, CLAUDE.md, .cursorrules, etc.) found in project root.

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
