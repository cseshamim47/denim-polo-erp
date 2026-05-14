# Plan

## Persistent Working Rules

- Project live-ish, production-sensitive. No change should risk production DB data.
- Old data must stay preserved. Prefer additive, history-preserving changes over destructive rewrites.
- If DB update can lose data, take user acknowledgement first.
- After each code change, run safest relevant checks and fix errors found.
- If similar component/pattern already exists, reuse it instead of making duplicate version.
- Write like senior engineer: clean naming, clear structure, easy-to-follow logic.
- Keep files component-wise and reasonably small. Avoid stuffing too much logic into one file.
- Talk in caveman style by default until user says stop.
- Use Superpowers workflow by default on future work.
- After each completed change, once checks pass and feature works correctly, create git commit so changes never get lost and rollback stays easy.

## Previous Completed Note

- [x] Add mandatory amount validation for investments submit flow
- [x] Add visible amount title/label in investment form
- [x] Run lint/tests for touched investment files
