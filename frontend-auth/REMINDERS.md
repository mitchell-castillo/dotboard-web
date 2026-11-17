# Reminder mirror

The dedicated sidebar entry opens Agenda and Calendar over the same reminder
occurrences. Counts in Agenda filters are occurrences; the title counts source
records. Today/week/date grouping uses each verified source timezone. The trial
always displays “Avisos apagados; RemindMe sigue enviando”. Completion and snooze
are local occurrence actions, preserving the series and literal source rule.

The calendar shows source-provided dates only. Unknown frequencies, leap days,
month ends and fixed annual dates are never converted into guessed future sends.
Two annual occurrences remain distinct from a six-month interval. Original dates,
hours, timezone, state and request are readable in the detail panel. Missing dates
or zones stay in “Por confirmar”. Original data remains available in full export.

Mutations use the existing verified session, revision, exact request receipt,
uncertain-write recovery and per-occurrence local revision. No notification
transport, secret, source API key or real reminder fixture ships to the browser.

The exact once-month/week legacy frequencies are shown as `1 random day a month`
or `1 random day a week`, consistent with their verified RemindMe calculators.
When explicitly confirmed, DotBoard stores typed local random-day intent with a
rule revision. The source frequency remains readable as provenance, and reimport
cannot replace the local intent. The UI states that local random selection is not
implemented and the recalculation basis is still unresolved. No dates are changed
and no fixed-date or calendar-period calculation is chosen.
