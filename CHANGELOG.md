# Changelog

All notable changes to ViewLog are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); this project follows
Semantic Versioning.

## [Unreleased]
### Added
- In-app changelog page (`/changelog`), rendered from this file

## [1.0.0] - 2026-07-25
### Added
- Text log parsing (`.log` / `.txt`): automatic timestamp, level and message detection, with multi-line stack-trace stitching
- CSV parsing with automatic delimiter and column detection (timestamp / level / message)
- Import by drag and drop, file picker, or by pasting logs directly
- Dashboard with key stats, a volume-over-time chart and a level breakdown
- Virtualized journal with plain-text and regex search, matches highlighted
- Level filters and a time-range slider
- "Patterns" view grouping recurring errors
- Inline JSON pretty-printing and UUID / hash dimming in messages
- Local-only storage (IndexedDB, last 5 files) with automatic rotation
- French and English interface
- Anonymous, aggregate usage counter (no content, no IP) and a legal notice page
