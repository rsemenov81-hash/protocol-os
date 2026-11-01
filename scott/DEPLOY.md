# Scott — Google it replacement

The Scott frontend now displays only `Google it.`. Query tabs, hashes and saved
login state do not expose the former interface. No record data is fetched.
The worker returns HTTP 410 for all former record read/write/download routes,
including for administrators. KV records, browser records and Git history are preserved.

## Deployment order (not performed by this change)

1. Deploy `scott/worker.js` to the existing `scott-protocol` worker, preserving
   SCOTT_KV, existing access-code secrets, VAPID keys and subscriptions.
2. Keep the existing `*/15 * * * *` cron. Each subscribed device receives at most
   one send attempt per UTC hour during normal sequential cron execution.
   Hour markers prevent repeated sends by subsequent ticks; KV is eventually
   consistent, so concurrent executions are not a strict exactly-once guarantee.
3. Merge the frontend through the existing Pages workflow. Returning devices
   must load the new page/service worker. Already-open old pages cannot be
   remotely erased; record API access is blocked as soon as the worker deploys.

Push payloads and test pushes contain only `Google it.`. The new service worker
also replaces queued legacy payloads and dismisses existing notifications when
it activates. Existing subscribed devices use server push; no new permission
requests or subscriptions are created. OS delivery timing remains best effort.

Devices without a push subscription get a `Google it.` browser dialog after
one hour while the page is visible, then hourly. Hidden/suspended pages defer
until visible; closed apps without push cannot notify. Local storage and Web
Locks suppress duplicate foreground dialogs across tabs where supported.
No live worker deployment, merge, or subscription change is performed by tests.

## Checks

`npm run ci` includes the Scott blank-screen browser checks in Chromium and
WebKit plus the unchanged Trey/Jamal browser harnesses. Scott worker tests use
synthetic records and decrypt mocked Web Push to check its exact content,
authentication, hourly deduplication and preservation of stored records.
