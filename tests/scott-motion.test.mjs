import test from 'node:test';
import assert from 'node:assert/strict';
import { startMotion } from '../scott/motion.js';

function fixture({ reduced = false, saveData = false, speed = '4g', persisted = false, reject = false, hidden = false } = {}) {
  const emitter = extra => Object.assign({ events:{}, addEventListener(type, fn){ this.events[type] = fn; } }, extra);
  const video = emitter({ src:'', paused:true, starts:0, loads:0, muted:false, getAttribute(k){return this[k];}, removeAttribute(k){this[k]='';}, load(){this.loads++;}, pause(){this.paused=true;}, async play(){this.starts++;if(reject) throw new Error('NotAllowed'); this.paused=false;} });
  const button = emitter({ setAttribute(k,v){this[k]=v;} });
  const media = emitter({matches:reduced}), connection = emitter({saveData,effectiveType:speed});
  const doc = emitter({hidden,readyState:'complete'});
  let begin;
  const storage = { value:persisted?'1':'0', getItem(){return this.value;},setItem(_k,v){this.value=v;} };
  const control = startMotion({video,button,doc,storage,nav:{connection},win:{matchMedia(){return media;},requestIdleCallback(fn){begin=fn;}}});
  return {video,button,media,connection,doc,storage,control,begin};
}

test('deferred silent playback attaches one video source', async () => {
  const f=fixture(); assert.equal(f.video.src,''); f.begin(); await f.control.sync();
  assert.match(f.video.src,/water-motion.mp4$/); assert.equal(f.video.muted,true); assert.equal(f.video.paused,false);
});
test('reduced motion, data saver, slow network and saved pause prevent the download', async () => {
  for(const options of [{reduced:true},{saveData:true},{speed:'slow-2g'},{speed:'2g'},{persisted:true}]) {
    const f=fixture(options); f.begin(); await f.control.sync(); assert.equal(f.video.src,''); assert.equal(f.video.starts,0);
  }
});
test('visibility changes suspend and resume playback', async () => {
  const f=fixture(); f.begin(); await f.control.sync(); f.doc.hidden=true; await f.doc.events.visibilitychange(); assert.equal(f.video.paused,true);
  f.doc.hidden=false; await f.doc.events.visibilitychange(); assert.equal(f.video.paused,false);
});
test('pause persists across refresh and keeps video paused after returning to app', async () => {
  const f=fixture(); f.begin(); await f.control.sync(); f.button.events.click(); await f.control.sync();
  assert.equal(f.video.paused,true); assert.equal(f.storage.value,'1'); assert.equal(f.button['aria-pressed'],'true');
  f.doc.hidden=true; await f.control.sync(); f.doc.hidden=false; await f.control.sync(); assert.equal(f.video.paused,true);
  f.button.events.click(); await f.control.sync(); assert.equal(f.video.paused,false); assert.equal(f.storage.value,'0');
});
test('changing to reduced motion releases the media source', async () => {
  const f=fixture(); f.begin(); await f.control.sync(); f.media.matches=true; await f.media.events.change();
  assert.equal(f.video.src,''); assert.equal(f.video.paused,true); assert.equal(f.button.disabled,true); assert.equal(f.video.loads,1);
});
test('autoplay denial and media errors leave a working still background', async () => {
  const f=fixture({reject:true}); f.begin(); await f.control.sync(); assert.equal(f.button.textContent,'Play background');
  f.video.events.error(); assert.equal(f.button.textContent,'Motion off'); assert.equal(f.button.disabled,true);
});
