# Health provider contract and conservative policy

Local provider support for P03–P09 and P18. The native adapter lives in the mobile package. This package alone cannot establish HealthKit availability, authorization or actual device operation.

`HealthDataProvider` separates availability and whether access was requested from returned data. It does **not** expose a granted/denied read-permission boolean. Each metric distinguishes present, no data, unavailable, failed query and malformed data. A present zero-step sample remains zero; an empty query remains no data.

`aggregateSteps` implements `single-approved-source-v1`:

1. The native adapter derives source category from supported native metadata. Raw source/sample identifiers stay on-device. Manual samples and unknown source categories cannot earn credit. A client category remains spoofable and is not cryptographic exercise evidence; server validation and review remain required.
2. On the first valid read of a task day, choose Apple Watch first, then Apple phone; break same-category ties by exact local source identifier. Choice is independent of sample order and step amount. Supply an app-generated UUID as `newPinToken`, persist the returned pin securely scoped to account and task date, and reuse it for that date. Upload only this opaque random token, never `sourceId`.
3. After pinning, another device/source cannot replace or supplement the pinned source. If that source disappears, eligible data is missing; no automatic fallback, zeroing or deduction is justified. Source/policy corrections go through review.
4. Never add different sources, even across partially overlapping or disjoint periods. Displayed steps are the greatest conservative per-source total, including displayable manual/unknown records, and may differ from eligible steps. The UI must explain this distinction. We make no equivalence claim to Apple Health's own display.
5. Identical sample IDs deduplicate. Conflicting duplicate IDs or malformed numeric/time fields invalidate the read. For same-source connected overlapping intervals, take the largest single sample count; sum only disjoint/adjacent groups. This deliberately undercounts ambiguous duplicate/overlapping records. A day-boundary-spanning sample is excluded, not prorated, because its exact per-day distribution is unknown.
6. Query and aggregation use Hong Kong day bounds. No raw samples are persisted or uploaded by this package. The adapter must handle native query range limits and cancellation.

`summarizeSleep` unions asleep/core/deep/REM intervals, ignoring in-bed and awake intervals as evidence of sleep. It retains genuine gaps and never invents a missing night. Sleep durations and heart-rate values have no reward path. `selectLatestHeartRate` preserves the measurement timestamp and explicit beats-per-minute value; the UI must present stale timestamps honestly. Raw sleep/heart-rate series stay on-device.

`ConsentUploadCoordinator` requires explicit consent before enqueueing, serializes work, immediately rejects queued work and aborts active transport when consent is withdrawn, and clears account context on `cancelAll`. It also releases the queue when a transport ignores cancellation. An abort cannot retract a request already received by a server; authenticated endpoints must check durable current consent and deletion state transactionally. Call `cancelAll` on logout and account switching.

`@healthloop/health-provider/synthetic` is a separately exported fixture provider with the persistent Simplified Chinese demo banner. It does not read/write HealthKit and must never be used as automatic fallback for a failed native read. No default entry imports it. Real builds must reject synthetic imports as a separate build gate.

`src/health.test.ts` exercises overlap, source replacement, manual/unknown data, invalid/zero/missing states, sleep union, latest-reading timestamps and upload cancellation. These are synthetic unit tests; two real iPhones are still required for native acceptance.
