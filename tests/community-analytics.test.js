import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const page=read('app/index.html'),client=read('app/app.js'),admin=read('app/admin.js');
const server=read('lib/community-handler.js'),schema=read('database/community-usage.sql');
const privacy=read('aviso-de-privacidad.html');

test('courses and tools are independent app sections',()=>{
 assert.match(page,/data-view="resources" aria-label="Herramientas"/);
 assert.match(page,/data-view="store" aria-label="Cursos"/);
 assert.match(page,/id="courseCards"/);
 assert.match(client,/x\.type==='tool'/);
 assert.match(client,/x\.type==='course'/);
 assert.doesNotMatch(page,/id="merchCards"/);
 assert.doesNotMatch(server,/posing-timer/);
});
test('member usage requires verified sign-in and does not use device fingerprint',()=>{
 assert.match(server,/const m=await memberFromSession\(sql,req\)/);
 assert.match(server,/if\(!m\)return error\(res,401/);
 assert.match(server,/action==='usage'/);
 assert.match(server,/action==='analytics'/);
 assert.match(server,/if\(!isStaff\(m\)\)return error\(res,403/);
 assert.match(server,/member_app_usage/);
 assert.match(server,/member_activity_days/);
 assert.match(client,/window\.addEventListener\('appinstalled'/);
 assert.match(client,/display-mode: standalone/);
 assert.match(client,/trackUsage\('open'\)/);
 assert.match(client,/trackUsage\('active'\)/);
 assert.doesNotMatch(client,/localStorage/);
 assert.match(privacy,/ABURTO TEAM/);
});
test('admin report shows registrations, installations and usage per member',()=>{
 assert.match(admin,/loadMetrics/);
 assert.match(admin,/installed_at/);
 assert.match(admin,/last_active_at/);
 assert.match(admin,/open_count/);
 assert.match(page,/id="communityMetrics"/);
 assert.match(schema,/PRIMARY KEY REFERENCES aburto_team\.members/);
 assert.match(schema,/installed_platform/);
 assert.match(schema,/member_activity_days/);
});
