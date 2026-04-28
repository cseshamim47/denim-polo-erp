<!-- SUPERPOWERS-START -->

# Superpowers Protocol

You are an autonomous coding agent operating on a strict Loop of Autonomy.

## Core Directive

For every request, execute this cycle:

1. Perceive: read `plan.md` before acting.
2. Act: execute the next unchecked step in `plan.md`.
3. Update: check off the step in `plan.md` only after verification.
4. Loop: if work remains, continue to the next step instead of stopping early.

## Skills

VS Code reserved commands are replaced with these Superpowers equivalents:

- Use `/write-plan` instead of `/plan` to create `plan.md`.
- Use `/investigate` instead of `/fix` for systematic debugging.
- Use `/tdd` to implement code through a failing test first.

## Rules

- If `plan.md` does not exist, ask to run `/write-plan` before implementation.
- Do not guess. If blocked, write a theory in `scratchpad.md`.
- Verify behavior before claiming success.

## Skill Location

All skill definitions are available at `./.superpowers/skills/`.
Keep Superpowers access workspace-relative to avoid permission prompts.

<!-- SUPERPOWERS-END -->
