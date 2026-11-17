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

The detail panel offers **Editar recordatorio** for a local title and note.
An empty title restores the source display; an empty note removes it. The source
message remains readable. Notes persist until removed and do not create recurring
charges or occurrences. Cancel, Close, Escape and outside dismissal discard only
the unsent draft. Saving uses the workspace envelope/receipt and
local.revision compare-and-swap; double submission is blocked.

After an uncertain response, editing stays disabled. The dialog can be closed to
use **Recuperar resultado**, which resends the exact original envelope. Reopen the
record after confirmation to see accepted values. Conflicts retain the draft for
review and never silently overwrite another edit.

The editor explicitly excludes source frequency/date changes: no local recurrence
generator is implemented. Use the existing verified-timezone future-date snooze
control for one occurrence. Source data, all other occurrences, original dates,
history, RemindMe and notifications are preserved.
