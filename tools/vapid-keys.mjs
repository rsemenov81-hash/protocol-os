#!/usr/bin/env node
// tools/vapid-keys.mjs — generate the VAPID keypair for Protocol OS push reminders.
// Node 22, no dependencies:   node tools/vapid-keys.mjs        (add --json for machine-readable output)
//
// Prints VAPID_PUBLIC_KEY (base64url of the 65-byte uncompressed P-256 point) and VAPID_PRIVATE_KEY
// (base64url of the 32-byte private scalar d), exactly the formats protocol-sync-worker.js expects,
// plus the Cloudflare dashboard steps. Run it once and keep the private key secret: if you ever
// generate a new pair, every device has to enable reminders again.
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await subtle.exportKey('raw', kp.publicKey));
const jwk = await subtle.exportKey('jwk', kp.privateKey);
const d = Buffer.from(jwk.d, 'base64url');
if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) throw new Error('unexpected key shape from WebCrypto');

const PUBLIC = pub.toString('base64url');
const PRIVATE = d.toString('base64url');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ VAPID_PUBLIC_KEY: PUBLIC, VAPID_PRIVATE_KEY: PRIVATE, VAPID_SUBJECT: 'mailto:your@email' }, null, 2));
} else {
  console.log(`VAPID keys for Protocol OS push reminders — generated ${new Date().toISOString()}

VAPID_PUBLIC_KEY
${PUBLIC}

VAPID_PRIVATE_KEY   (secret — paste it into Cloudflare only, never into the app or a chat)
${PRIVATE}

VAPID_SUBJECT
mailto:your@email

Cloudflare dashboard → Workers & Pages → protocol-sync → Settings → Variables and Secrets → Add:
  1. VAPID_PUBLIC_KEY    type Secret    value: the public key above
  2. VAPID_PRIVATE_KEY   type Secret    value: the private key above
  3. VAPID_SUBJECT       type Text      value: mailto:<the email you want push services to contact>
  Click Deploy to apply the variables.
Then Settings → Triggers → Cron Triggers → Add Cron Trigger → */15 * * * * → Add.
Finally, in the app: Data & sync → Reminders → Enable on this device → Send test.`);
}
