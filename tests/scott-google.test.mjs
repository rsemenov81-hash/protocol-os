import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('legacy push content is never displayed; activation dismisses old notifications', async () => {
  const handlers = {}, notifications = []; let closed = 0;
  const self = { addEventListener(name, fn) { handlers[name] = fn; }, registration: {
    showNotification(title, options) { notifications.push({ title, options }); },
    async getNotifications() { return [{ close() { closed++; } }]; },
  }, clients: { async claim() {} } };
  vm.runInNewContext(readFileSync(new URL('../scott/sw.js', import.meta.url), 'utf8'), { self });
  let pending;
  handlers.push({ data: { json() { throw Error('must not read legacy payload'); } }, waitUntil(p) { pending = p; } });
  await pending;
  assert.equal(notifications[0].title, 'Google it.');
  assert.equal(notifications[0].options.body, 'Google it.');
  handlers.activate({ waitUntil(p) { pending = p; } }); await pending;
  assert.equal(closed, 1);
});
