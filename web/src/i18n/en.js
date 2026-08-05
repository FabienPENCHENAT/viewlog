// English dictionary. Flat key → text object (interpolation {var}).
export default {
  "lang.switch": "Switch language",

  "offline.label": "Offline",
  "offline.hint_off":
    "Switch to offline mode: ViewLog will send nothing at all, not even the anonymous usage measurements.",
  "offline.hint_on":
    "Offline mode is on: ViewLog sends nothing. Click to re-enable the network.",
  "offline.hint_auto": "No connection detected. ViewLog keeps working normally, locally.",
  "offline.notice_title": "Offline mode is on",
  "offline.notice_body":
    "ViewLog now sends nothing at all: no anonymous usage measurement, and you will not get the site's new features while you stay offline.",
  "offline.notice_close": "Close",

  "home.title_pre": "Your log files, ",
  "home.title_accent": "finally pleasant to read.",
  "home.lead_pre":
    "Drop a log file, get a readable dashboard (charts, search, filters). And above all: ",
  "home.lead_local": "100% local",
  "home.lead_post":
    ". Your logs are parsed and formatted in your browser, and never sent to or stored on a server.",
  "home.recent": "Recent files",
  "home.recent_count": "({count}/5)",
  "home.storage_note":
    "Stored only in your browser. Remove them with the ✕, or clear the site's data to wipe everything.",
  "home.empty": "No files yet.",
  "home.file_meta": "{lines} lines · {size} · {date}",
  "home.badge_err": "{count} err",
  "home.badge_warn": "{count} warn",
  "home.delete": "Delete",

  "dropzone.analyzing": "Reading the file…",
  "dropzone.title": "Drop your log file here",
  "dropzone.wait": "One moment",
  "dropzone.hint": "or click to browse · several files accepted · .log / .txt / .csv",
  "dropzone.folder": "Or pick a folder",

  "paste.toggle": "Or paste your logs directly",
  "paste.placeholder": "Paste your logs here…",
  "paste.submit": "View",
  "paste.name": "Pasted logs",

  "picker.title_files": "{count} files selected",
  "picker.title_folder": "{count} files in this folder",
  "picker.lead":
    "ViewLog keeps {max} at a time. Choose which ones to open, the others will not be imported.",
  "picker.count": "{n} / {max} selected",
  "picker.cancel": "Cancel",
  "picker.confirm": "Import {n}",
  "import.progress": "Importing {done} / {total}",

  "stats.lines": "Lines",
  "stats.errors": "Errors",
  "stats.warnings": "Warnings",
  "stats.duration": "Time span",
  "stats.instant": "instant",

  "dash.back_home": "← Back",
  "dash.back_files": "← Files",
  "dash.loading": "Loading…",
  "dash.truncated": "Large file: only the first {max} lines were processed.",
  "dash.timeline": "Volume over time",
  "dash.levels": "Levels breakdown",
  "dash.journal": "Log",
  "dash.default_name": "Log",

  "tabs.aria_bar": "Open logs",
  "tabs.add": "Import a log",
  "tabs.add_hint": "Import a log. It enters here, on the left.",
  "tabs.close": "Close {label}",
  "tabs.confirm_aria": "Delete this log? This cannot be undone.",
  "tabs.confirm_go": "Delete",
  "tabs.confirm_no": "Cancel",
  "tabs.rename_aria": "Rename tab, {max} characters max",
  "tabs.tip_lines": "{lines} lines",
  "tabs.tip_doomed": "Will be replaced on the next import. Drag it left to keep it.",
  "tabs.tip_rename": "Double-click to rename.",

  "table.search": "Search logs…",
  "table.regex": "Regular expression search (regex)",
  "table.entries": "{count} entries",
  "table.shown": "· {count} shown",
  "table.col_line": "#",
  "table.col_ts": "Timestamp",
  "table.col_level": "Level",
  "table.col_msg": "Message",
  "table.empty": "No matching entries.",
  "table.period": "Time range",
  "table.period_all": "All",
  "table.period_from": "Range start",
  "table.period_to": "Range end",
  "table.actions": "Line actions",
  "table.copy": "Copy line",
  "table.copied": "Line copied",
  "table.view": "View",
  "table.view_journal": "Journal",
  "table.view_patterns": "Patterns",
  "patterns.unique": "{count} unique patterns",
  "patterns.example": "e.g. ",
  "patterns.more": "+ {count} more patterns",
  "patterns.filtered": "Pattern:",
  "patterns.clear": "Clear pattern filter",
  "patterns.compare": "Compare to the rest of the file",
  "patterns.compare_on": "Zone compared to the rest of the file",
  "patterns.compare_off": "Leave the comparison",
  "patterns.only_here": "Only here",
  "patterns.only_here_sub": "absent from the rest of the file",
  "patterns.over": "Over-represented here",
  "patterns.over_sub":
    "{ratio}× more present here than over a comparable window elsewhere",
  "patterns.absent": "Absent here",
  "patterns.absent_sub": "expected here at the usual rhythm, never seen",
  "patterns.group_count": "{count} patterns",
  "patterns.rates": "{inside} here, {outside} elsewhere",
  "patterns.expected": "expected ~{count} here, saw 0",
  "patterns.fold_over": "{count} over-represented",
  "patterns.fold_absent": "{count} absent here",
  "patterns.fold_sep": ", ",
  "patterns.flat": "Same mix, just denser.",
  "patterns.flat_hint":
    "No pattern is specific to this zone: this is a volume spike, not new behaviour.",
  "patterns.thin": "The rest of the file is too thin.",
  "patterns.thin_hint":
    "The selection covers almost the whole file, leaving nothing to compare it against. Narrow the period.",

  "context.jump": "See this line in the full journal",
  "context.banner": "Full journal around line {line}, filters released.",
  "context.recenter": "Show the line again",
  "context.back": "Back to results",
  "context.dismiss": "Stay in the full journal and close this banner",

  "msg.collapse": "Collapse ▲",
  "msg.expand": "Show all ({count} lines) ▼",

  "chart.no_data": "No data.",
  "chart.entries": "Entries",
  "chart.no_ts": "No timestamps detected in this file.",
  "chart.total": "Total",
  "chart.errors": "Errors",
  "chart.select_hint": "Drag across the chart to select a period, double-click to show everything.",

  "unit.b": "B",
  "unit.kb": "KB",
  "unit.mb": "MB",

  "dur.s": "s",
  "dur.min": "min",
  "dur.h": "h",
  "dur.d": "d",
  "dur.mo": "mo",
  "dur.y": "y",

  "errors.load_list": "Couldn't load the list",
  "errors.upload": "Upload failed",
  "errors.not_found": "File not found",
  "errors.delete": "Couldn't delete",
  "errors.rename": "Couldn't rename",
  "errors.reorder": "Couldn't reorder",
  "errors.no_file": "Nothing usable in what you dropped",
  "errors.import_partial": "Some files couldn't be imported",

  "uc.title": "Use cases",
  "uc.steps": "The steps",
  "uc.caps_title": "Features visible in this walkthrough",
  "uc.cap_explore": "Explore",
  "uc.cap_search": "Search",
  "uc.cap_analyse": "Analyse",
  "uc.feat_views": "Switch between the Journal and Patterns views.",
  "uc.feat_period": "Select a period straight from the chart.",
  "uc.feat_finetune": "Fine-tune your analysis window with the time range slider.",
  "uc.feat_hits": "See every occurrence of a pattern in one click.",
  "uc.feat_query": "Search as free text or with a regular expression.",
  "uc.feat_levels": "Filter events by severity level.",
  "uc.feat_compare": "Compare a period to the rest of the file.",
  "uc.feat_virtual": "Scroll hundreds of thousands of lines without a stutter.",
  "uc.spike_demo_alt":
    "Animated walkthrough: brushing the spike on the chart, comparing the zone to the rest of the file, then reading the three pattern groups",
  "uc.cta": "Open a log",

  "uc.spike_title": "How to analyse a spike in your logs",
  "uc.spike_desc":
    "You run a fleet of drink machines and notice an unusual burst of activity in one machine's logs. No user has reported anything yet, but you want to understand what happened before it gets worse.\n\nGrab the day's logs, open them in ViewLog, then select the period matching the spike. Within a few clicks, ViewLog compares that period to the rest of the logs and highlights the events that appear, disappear, or become unusually frequent.",
  "uc.spike_steps":
    "Grab the day's logs and open them in ViewLog.\nSelect the spike straight on the chart.\nReview the new, over-represented and absent patterns.",

  "uc.isolated_title": "How to trace the cause of a failure a user reported",
  "uc.isolated_desc":
    "A user tells you they could not order a Caramel Latte, but all you have is a rough time range.\n\nGrab the day's logs, open them in ViewLog, then select the period in question to focus straight away on the events that matter.\n\nWithin a few clicks, ViewLog surfaces the real cause of the failure:\n\n`ERROR Ingredient unavailable: caramel_syrup`",
  "uc.isolated_steps":
    "Select the time range the user reported.\nNarrow the analysis window step by step with the time range slider.\nReview the patterns for that period.\nOpen the lines involved to understand the cause of the failure.",
  "uc.isolated_demo_alt":
    "Animated walkthrough: selecting the reported time range, narrowing the window with the time range slider, spotting the missing ingredient in the patterns, then opening its three occurrences in the journal",

  "nav.use_cases": "Use cases",
  "nav.faq": "FAQ",

  "nf.title": "Page not found",
  "nf.log": "404 no route matched {path}",
  "nf.quip": "This page left no trace in the logs.",
  "nf.home": "Back to home",

  "footer.legal": "Legal notice",
  "footer.changelog": "Changelog",

  "changelog.title": "Changelog",
  "changelog.intro": "New features and improvements to ViewLog, newest first.",

  "legal.title": "Legal notice",
  "legal.editor_h": "Publisher",
  "legal.editor_body":
    "This site is published by Fabien P., who is also the publication director. Contact: contact@viewlog.io.",
  "legal.host_h": "Host",
  "legal.host_body":
    "Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (cloudflare.com).",
  "legal.data_h": "Personal data and cookies",
  "legal.data_body":
    "ViewLog collects no personal data, uses no cookies, and sets no identifier that could track you from one visit to the next. Your log files are parsed and formatted entirely in your browser; neither their content nor their name is ever sent to or stored on a server. Your language preference and your offline-mode preference are stored locally in your browser, and the application files are cached by your browser so that it stays usable without a connection.\n\nTo monitor the service's reliability and understand which features are useful, we record only anonymous, aggregate measurements: the pages viewed, whether a file is processed successfully or not, the import method (drag and drop, file picker or paste), the file extension, an approximate size range (never the exact size), whether the processing limit was reached, the features used (search, filters, patterns, switching to offline mode, and so on), and the visitor's country. No log content, no file name and no IP address are stored, and these measurements cannot identify you or reconstruct your individual activity. If your browser signals a \"Do Not Track\" or \"Global Privacy Control\" preference, none of these measurements are sent. The same applies when offline mode is on: ViewLog then sends nothing at all. Switching to offline mode is recorded at the moment of the click, so just before the cut: it is the last measurement of the session. Your browser alone may still check, when the page loads, whether a new version of the application is available.",

  "faq.title": "Frequently asked questions",
  "faq.group_usage": "Usage",
  "faq.group_privacy": "Privacy & data",
  "faq.group_meta": "The service",
  "faq.q_privacy": "Where do my log files go?",
  "faq.a_privacy":
    "Privacy by design: the content of your log files is processed entirely in your browser and never leaves your device.",
  "faq.q_sensitive": "Is ViewLog safe for sensitive or production logs?",
  "faq.a_sensitive":
    "Yes. ViewLog runs 100% in your browser and never uploads your logs to any server. The content of your files is parsed locally on your device, so sensitive and production logs never leave your machine. Nothing is sent over the network or stored server-side.",
  "faq.q_compare":
    "How does ViewLog protect my data privacy compared to other online log viewers?",
  "faq.a_compare":
    "Most online log viewers upload your files to a remote server to process them. ViewLog is different: it is 100% client-side, so your log content is never uploaded, stored, or transmitted. This privacy-first, zero-server design makes it well suited to GDPR and HIPAA sensitive logs.",
  "faq.q_offline_switch": "What is the \"Offline\" switch for?",
  "faq.a_offline_switch":
    "It cuts the network on demand, even when you are connected. Beyond loading the application itself, ViewLog sends exactly one thing: anonymous, aggregate usage measurements, whose only purpose is to know which features are useful and to improve the tool. The switch removes them entirely, and nothing is queued to be sent later: the measurements for that session are dropped. The click that turns the mode on is itself counted, just before the cut, so we know whether the feature is useful. Your choice is remembered in your browser until you turn it off.\n\nOne thing stays outside ViewLog's control: on a full page load, your browser may check by itself whether a new version of the application is available. It does not happen while you navigate inside the app, and preventing it would mean giving up offline support.\n\nWith no connection, the switch simply reports the state: there is nothing to turn on, ViewLog already runs locally.",
  "faq.q_retention": "How many files are kept?",
  "faq.a_retention":
    "The 5 most recently opened files are kept locally, in your browser, and automatically rotated as you import new ones.",
  "faq.q_delete": "How do I delete my data?",
  "faq.a_delete":
    "Each file can be removed from the recent files list. You can also wipe everything at once by clearing the site's data in your browser.",
  "faq.q_formats": "Which formats are supported?",
  "faq.a_formats":
    "Any .log or .txt text file. Parsing is generic: automatic detection of the timestamp, level (from TRACE to FATAL) and message, with multi-line stack traces attached to their entry. .csv files are supported too: the delimiter and the timestamp, level and message columns are detected automatically.",
  "faq.q_size": "Is there a size limit?",
  "faq.a_size":
    "Very large files are supported (tens of MB, hundreds of thousands of lines). Processing covers the first million lines. Everything happens in your browser and stays smooth thanks to virtualization.",
  "faq.q_how": "How does ViewLog work?",
  "faq.a_how":
    "Drop a .log or .txt file: ViewLog reads it directly in your browser and automatically detects, line by line, the timestamp, level and message (multi-line stack traces are attached to their entry). You then land on a clear dashboard. No install, no file upload.",
  "faq.q_features": "What are the main features?",
  "faq.a_features":
    "A dashboard with key stats (lines, errors, warnings, time span), volume over time and a breakdown by level. A full log with full-text search, level filters and a time-range slider. Plus a \"Patterns\" view that groups recurring errors.",
  "faq.q_patterns": "What is the \"Patterns\" view for?",
  "faq.a_patterns":
    "It turns thousands of lines into a handful of readable patterns. ViewLog normalizes messages (variable numbers, IDs, dates and addresses are masked) to group identical entries and surface the most recurring errors, sorted by frequency. Click a pattern to jump back to the log filtered on it.",
  "faq.q_search": "How do I search the logs?",
  "faq.a_search":
    "The search bar filters the log in real time. By default it matches plain text; toggle the \".*\" button to switch to a regular expression (regex). In both modes, matches are highlighted directly in the messages.",
  "faq.q_offline": "Can I use ViewLog without an internet connection?",
  "faq.a_offline":
    "Yes. After a first visit with a connection, your browser keeps the application files: ViewLog then opens and works with no network at all, on a plane or on an isolated machine. Import, search, filters, patterns and recent files all behave normally, because the processing was already fully local.\n\nYou can also install ViewLog as an app from your browser, to open it without typing an address. Two caveats: the very first visit must happen online, and private browsing keeps nothing once the window is closed.",
  "faq.q_offline_life": "How long does ViewLog stay available offline?",
  "faq.a_offline_life":
    "There is no fixed duration: it depends on your browser and on the free space on your disk.\n\nOn Chrome, Edge and Firefox, the application files stay as long as there is room. They are only removed when the disk fills up, starting with the least visited sites. In practice that means weeks or months.\n\nOn Safari (macOS and iOS), the rule is stricter: if you do not open ViewLog for 7 days, the browser clears the site data, recent files included. Installing ViewLog on the home screen or in the Dock lifts that limit.\n\nIn every browser, clearing site data or browsing history resets the counter: an online visit will be needed to arm offline mode again. Before a flight or an intervention with no network, the safest habit is simply to open ViewLog once before leaving.",
  "faq.q_offline_stale": "What happens if I stay offline for a long time?",
  "faq.a_offline_stale":
    "You keep working on the version saved during your last online visit. Fixes and new features released in the meantime will not appear, and nothing on screen tells you so.\n\nAs soon as the connection is back, ViewLog fetches the new version in the background and applies it without asking, usually on the next load. You lose nothing in the process: your recent files and your analyses live in your browser, independently of the application version.",
  "faq.q_free": "Is ViewLog free?",
  "faq.a_free":
    "Yes, ViewLog is completely free. Since everything runs in your browser, there's no account to create and no server to run.",
  "faq.q_contact": "How can I contact you or suggest an improvement?",
  "faq.a_contact":
    "Email us at contact@viewlog.io. Feedback, formats you'd like supported, bug reports: all welcome.",
};
