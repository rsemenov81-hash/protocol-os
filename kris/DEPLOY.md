# Kris Protocol — deployment

The app is served by GitHub Pages at
**https://rsemenov81-hash.github.io/protocol-os/kris/**.
Its existing backend is **https://kris-protocol.rsemenov81.workers.dev**.

## Frontend

Merge verified frontend changes to `main`; GitHub Pages publishes that branch.
Kris shares the selected blue-hour neighborhood film and logo from `../scott/assets/`.
Keep those shared files when deploying this app. The styles and motion preference
are scoped to Kris. Reduced motion and data saving use the still poster.

Run `npm run check`, `npm test` and `npm run e2e:kris` plus `npm run e2e:kris-cinematic` before publication.
The browser suite uses synthetic records and intercepts every backend request.

## Worker and private records

Deploy `kris/worker.js` to the existing `kris-protocol` Worker, retaining its
`KRIS_KV` binding and `ADMIN_CODE` / `MEMBER_CODE` secrets. Keep deployment
credentials, namespace identifiers, state backups and current health records
outside this public repository.

Check `/health` after deployment. `/state`, `/admin` and `/log` require an access
code; the public frontend never embeds one. Administration uses revision checks
so an older edit cannot overwrite a newer save.

Current protocols are stored privately. Date-effective changes retain prior
snapshots in `scheduleHistory`, each with an inclusive `through` calendar date.
`startDate` / `endDate` constrain active dates; the UI and dose gate resolve the
same historical directions. Deactivation preserves the compound ID and logs.

For IU compounds, the legacy `doseMcg` field stores the IU amount when `unit` is
`IU`; `mcgPerUnit` then means IU per U-100 syringe unit. Fractional IU values are
preserved. Do not infer a vial size or dilution when it has not been supplied.

## Access

Kris signs in with his existing member code. Roman uses his existing admin code.
On iPhone, use Safari → Share → Add to Home Screen. Codes remain Cloudflare
secrets and can be rotated there without changing the app source.
