# Phase 2B — Shared Schedule Management — Schedules v20

Build: schedules-phase2b-v20.

Schedules v20 uses the unchanged v17 GAS backend. Already configured v17 installations need no GAS update or reinitialization. New schedules default to Asia/Manila. Existing schedule time zones and unedited timestamp precision are preserved. Native date/time inputs use minutes; Same day as opening controls only the editor.

Classes and schedule plans share the existing authenticated GAS HTMLService bridge.
Add Schedules.gs to the existing Apps Script project, replace ClassesBridge.html with the Phase 2B version, run initializeSchedules once, then update the existing deployment to a new version. Keep the same /exec URL, execute-as and access settings. Do not replace Code.gs or Classes.gs; do not change Results or Classes headers, data or Script Properties.

The initializer adds only the Schedules sheet. It reuses the existing private Classes access key; no Spreadsheet ID or secret belongs in frontend code or GitHub.

Schedule records contain stable scheduleId, schoolId, teacherId, question-set testId, testName, classIds, UTC open/close timestamps, timeZone, enabled/disabled status, createdAt, updatedAt and optional legacyAssessmentId. Operation IDs, hashes and a commit flag support verified writes and safe retries.

Create Schedule / Edit / Disable Schedule / Enable Schedule manage planning metadata only. They do not publish student tests, issue student links, change the 50-question exam, or control student access. Results retrieval in the dashboard remains outside this phase.

Existing local drafts stay in jft-basic:portal:data:v1. Import drafts individually after importing their Classes. A legacy Session ID becomes the Schedule ID; the Assessment ID is retained. No automatic import or name-based deduplication occurs.

Unconfirmed operations stay in jft-basic:schedules-pending:v1:<schoolId>:<teacherId> without credentials. Reloading or reconnecting offers Retry saving with the exact operation and Schedule ID. Only a matching server-confirmed response produces a saved message. A rejected request can be discarded locally only when the server confirms it made no new write. No existing Sheets row is deleted.

The fixed teacher login is for development. Server-side access uses the existing private school key and scope validation. It is not production multi-school authentication.

V20 changes only optional legacyAssessmentId response validation: null, an omitted field (undefined), and the exact empty string represent no legacy import reference. A nonempty value must still be a valid UUID string. No response value, Sheet row, or local draft is rewritten. Both list and mutation confirmations use the same predicate. GAS remains unchanged. Public authenticated Google Sheets connection after this change has not been verified.
