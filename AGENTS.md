# Repository Guidelines

## Project Structure & Module Organization
This repository is currently minimal: only `.gitattributes` is tracked in Git, and no application stack has been committed yet. Keep new work organized from the start:
- `src/` — application or analysis code
- `tests/` — automated tests that mirror `src/`
- `assets/` — static inputs such as sample data, images, or reference files
- `docs/` — design notes, research summaries, or workflow docs

Example: place a parser in `src/parser.py` and its tests in `tests/test_parser.py`.

## Build, Test, and Development Commands
No project-specific build system is configured yet. Until one is added, use lightweight repo checks and document any new tooling in the same PR.

- `git status` — confirm the files you changed
- `git diff --check` — catch whitespace errors and conflict markers
- `git log --oneline -n 5` — review recent commit style before committing

If you introduce a runtime or package manager, also add repeatable commands such as `npm test`, `pytest`, or `make build` here and in the project README.

## Coding Style & Naming Conventions
Prefer small, focused modules and predictable paths. Use UTF-8 text files with LF endings; `.gitattributes` already normalizes line endings.

General defaults unless the chosen stack says otherwise:
- 2 spaces for JSON/YAML, 4 spaces for Python
- `snake_case` for Python files, `kebab-case` for Markdown/docs
- descriptive names over abbreviations

Add formatter and linter configuration with the first language-specific code you introduce.

## Testing Guidelines
Create tests alongside new functionality rather than batching them later. Mirror the source tree inside `tests/` and use names like `test_<feature>.*`.

Aim to cover the main path plus at least one failure case for each new module. Before opening a PR, run the relevant test command for the stack you added and mention it in the PR description.

## Commit & Pull Request Guidelines
The current history is minimal (`Initial commit`), so continue with short, imperative commit subjects. Prefer one logical change per commit.

Pull requests should include:
- a brief summary of the change
- testing performed
- linked issue or context, if available
- screenshots only when UI or visual assets are added
