# Changelog

All notable changes to ViewLog, newest first. Everything ships continuously,
so each entry is filed under the day it went live.

## 2026-08-07
### Added
- Logs up to 500 MB and five million lines, whichever comes first. A larger file is turned away before being read, and the drop zone states the limit up front
- Waiting now shows: the logo's stacked lines roll while ViewLog works, and an import says which step it is on
### Changed
- Very large logs now take about a quarter of the memory they used to, and open several times faster
- The patterns view and the zone comparison are about twice as fast on large files, and any filter change now says it is working instead of freezing silently
### Fixed
- Large CSV logs now open instead of killing the tab
- Switching tabs and opening the file list stay fast when several large logs are stored
- Opening the zones to watch no longer takes seconds on logs whose messages are several kilobytes long

## 2026-08-06
### Changed
- The dashboard header is now a single low band: lines and time span on the left, every level with its count and share on the right, and the volume chart takes the full width below it
- The level breakdown separates `FATAL` from `ERROR`, which the "Errors" figure used to merge, and tells you whether the errors are one burst or a steady background
### Added
- Under "Volume over time", show the zones worth a look: they are drawn on the chart with what was found in each, and a click opens one already compared to the rest of the file. Marked experimental.
- A zone is found either on its concentration of errors or on an unusual volume of lines, so a burst your app filed as warnings instead of errors still surfaces, and each zone says which of the two brought it out.

## 2026-08-05
### Added
- Select a period, then compare that zone to the rest of the file: the patterns view tells you which ones exist only there, which ones are denser than elsewhere, and which ones have stopped. When nothing stands out, it says so.
- A "Use cases" page: how to analyse a spike in your logs, and how to trace the cause of a failure a user reported. Each one opens on the steps and an animated walkthrough.
### Changed
- Comparing a zone now measures each pattern against its usual share over a window of the same length elsewhere, instead of its share of the whole file
- "Absent here" now tells you how many occurrences were expected in the zone, and stays quiet on a zone where none were
- Grouping by pattern now masks a number stuck to its unit (`30000ms`, `512kB`), so one message no longer splits into as many patterns as it has values

## 2026-08-04
### Added
- Import several log files at once, by dropping them or picking them, from the home page and from the tab bar's "+" alike
- Drop a folder, or pick one, to import the logs it contains. Only the files directly inside are taken, not those in sub-folders.
- Give ViewLog more files than it can hold and it asks which ones to open instead of quietly dropping the rest. Tabs then appear in the order you selected them.

## 2026-08-03
### Added
- Switch between your open logs from a tab bar at the top of the dashboard, without going back to the file list. Each tab is labelled with the time you imported the log, in your language's own convention
- Every tab keeps its own search, level filters and time range: leave a log in the middle of an investigation, come back to it, and you find it exactly as you left it
- Rename a tab by double-clicking it, to label your logs the way you think of them
- Drag a tab to reorder it. New imports enter on the left, and the rightmost tab, shown faded, is the one replaced next: dragging a log left is how you keep it
- Import a log straight from the tab bar with the "+" button, without going through the home page
- Closing a tab asks for confirmation before deleting the log, showing that log's own colour so you can tell which one you are answering about. Deleting cannot be undone
- The tab bar now keeps a fixed width instead of resizing with every import: the "+" stays pinned on the left and only the tabs scroll, with a fade at the edge when one is out of sight
### Changed
- Dates in English now follow the US convention (08/03, 3:16 PM)

## 2026-07-29
### Added
- Turning on offline mode now shows a short notice explaining what it changes: no more anonymous usage measurements are sent, and the site's new features will not reach you while you stay offline
- Close the full journal banner with a cross to stay where you are, without going back to your results
### Changed
- Line actions are now stacked in a single column: copy on top, "See this line in the full journal" right below it, with a clearer icon
### Fixed
- Jumping to a line in the full journal now lands on it every time. It could previously stop short of the line, forcing a click on "Show the line again"
- The full journal banner no longer stays on screen after switching to the Patterns view
- Switching between Journal and Patterns now shows the list from the top, instead of keeping the scroll position of a much longer list

## 2026-07-28
### Added
- Jump from a filtered line to its place in the full journal: click the line number or the target icon, every filter is released and the journal scrolls to the line. It pulses on arrival, then keeps a discreet marker so you can still find it after scrolling, and a banner lets you show it again or go back to your results
- Offline mode: once ViewLog has been opened with a connection, it keeps working with no network at all (plane, isolated machine), can be installed as an app, and an "Offline" switch stops the only thing ViewLog ever sends, the anonymous usage measurements, on demand even when you are connected. The FAQ details what stays available, for how long, and what the switch does
### Fixed
- Multi-line messages (SQL dumps, tables, JSON payloads, stack traces) stay in a single log entry, even when a date appears inside their content

## 2026-07-27
### Added
- Select a period straight on the "Volume over time" chart by dragging across it, double-click to show everything again
- Copy a log line to the clipboard from the journal, stack trace included, to share it as is
### Changed
- The chart selection and the "Time range" slider now drive the same window, so both always reflect the log lines on screen

## 2026-07-26
### Added
- Friendly, log themed 404 page for unknown URLs

## 2026-07-25
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
- In-app changelog page (`/changelog`), rendered from this file
