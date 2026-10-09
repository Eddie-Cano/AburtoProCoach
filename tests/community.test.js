import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const routes=read('api/access.js');
const handler=read('lib/community-handler.js');
const schema=read('database/community.sql');
const manifest=JSON.parse(read('manifest.webmanifest'));
const page=read('app/index.html');
const ui=read('app/app.js');
test('community operates behind existing API access function',()=>{
 assert.match(routes,/req\.query\?\.community==='1'/);
 assert.match(routes,/community-handler\.js/);
 assert.match(handler,/no-store/);
 assert.match(handler,/sameHash/);
 assert.match(handler,/origin!==/);
});
test('verified email is required for community session',()=>{
 assert.match(handler,/randomInt\(100000,1000000\)/);
 assert.match(handler,/expires_at>now\(\)/);
 assert.match(handler,/DELETE FROM aburto_team\.login_codes/);
 assert.match(handler,/HttpOnly; Secure; SameSite=Strict/);
 assert.match(handler,/m\.status='active'/);
});
test('private messages require authorization on both read and write',()=>{
 assert.match(handler,/allowedChannel\(sql,m,String\(req\.query\?\.channel/);
 assert.match(handler,/allowedChannel\(sql,m,String\(body\.channel/);
 assert.match(handler,/allowedChannel\(sql,m,target\[0\]\.channel_slug\)/);
 assert.match(handler,/founding/);
 assert.match(handler,/channel_members/);
 assert.match(handler,/role NOT IN \('admin','coach'\)/);
});
test('persistent data includes channels, members, messages and sessions',()=>{
 for(const table of ['members','login_codes','sessions','channels','channel_members','messages','audit_events','rate_limits'])
  assert.ok(schema.includes('aburto_team.'+table));
 assert.match(schema,/CHECK \(access IN/);
 assert.match(schema,/ON CONFLICT \(slug\) DO NOTHING/);
});
test('PWA boots into community and renders mobile screens',()=>{
 assert.equal(manifest.start_url,'/app/');
 assert.equal(manifest.display,'standalone');
 assert.match(page,/app\/app\.js/);
 assert.match(page,/app\/admin\.js/);
 for(const screen of ['chatView','resourcesView','storeView','profileView','adminView'])assert.ok(page.includes('id="'+screen+'"'));
 assert.match(ui,/textContent/);
 assert.doesNotMatch(ui,/localStorage/);
});
