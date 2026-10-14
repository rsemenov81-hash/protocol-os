// Execute the actual service worker with no page/window present. No real push is sent.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../jamal/sw.js',import.meta.url),'utf8');
function harness(windows=[]){
 const events={},notifications=[],opened=[],messages=[];let claimed=false,skipped=false,focused=false;
 const self={addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{skipped=true;},registration:{scope:'https://example.org/protocol-os/jamal/',showNotification:async(title,options)=>notifications.push({title,options})},clients:{claim:async()=>{claimed=true;},matchAll:async()=>windows,openWindow:async url=>{opened.push(url);}}};
 vm.runInNewContext(source,{self});
 return {events,notifications,opened,self,async dispatch(name,event={}){let pending;events[name]({...event,waitUntil:p=>pending=p});await pending;},get claimed(){return claimed;},get skipped(){return skipped;}};
}
test('a cold service worker displays a push with no open app window',async()=>{
 const h=harness();await h.dispatch('push',{data:{json:()=>({title:'Morning protocol',body:'Synthetic reminder',data:{tab:'protocol',tag:'fixture-am'}})}});
 assert.equal(h.notifications.length,1);assert.equal(h.notifications[0].title,'Morning protocol');assert.equal(h.notifications[0].options.body,'Synthetic reminder');assert.equal(h.notifications[0].options.tag,'fixture-am');
});
test('a test push without a tag does not set renotify',async()=>{
 const h=harness();await h.dispatch('push',{data:{json:()=>({body:'Synthetic test'})}});
 assert.equal(h.notifications[0].title,'Jamal · Protocol');assert.equal(h.notifications[0].options.renotify,undefined);
});
test('notification tap opens Jamal when the app is closed',async()=>{
 const h=harness();let closed=false;await h.dispatch('notificationclick',{notification:{data:{tab:'protocol'},close:()=>{closed=true;}}});
 assert.equal(closed,true);assert.deepEqual(h.opened,['./?tab=protocol']);
});
test('notification tap reuses the Jamal window without focusing another client',async()=>{
 let focused='',message;const h=harness([{url:'https://example.org/protocol-os/scott/',focus:async()=>{throw Error('wrong client');}},{url:'https://example.org/protocol-os/jamal/',focus:async()=>{focused='jamal';},postMessage:m=>message=m}]);
 await h.dispatch('notificationclick',{notification:{data:{tab:'supps'},close:()=>{}}});
 assert.equal(focused,'jamal');assert.equal(message.type,'open-tab');assert.equal(message.tab,'supps');assert.deepEqual(h.opened,[]);
});
test('empty and non-JSON pushes still display a visible notification',async()=>{
 const h=harness();await h.dispatch('push');await h.dispatch('push',{data:{json:()=>{throw Error('not JSON');},text:()=> 'Fixture text'}});
 assert.equal(h.notifications.length,2);assert.equal(h.notifications[1].options.body,'Fixture text');
});
test('service-worker activation claims the app without a page timer',async()=>{
 const h=harness();await h.dispatch('install');await h.dispatch('activate');assert.equal(h.skipped,true);assert.equal(h.claimed,true);assert.equal(h.events.fetch,undefined);
});
