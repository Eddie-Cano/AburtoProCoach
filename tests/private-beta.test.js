import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {communityAllowedEmail} from '../lib/community-handler.js';

const authorized={
 DASHBOARD_ADMIN_EMAIL:'raiznoblemx@gmail.com',
 ANDRES_DASHBOARD_EMAIL:'aburtocoaching@gmail.com'
};
const source=readFileSync(new URL('../lib/community-handler.js',import.meta.url),'utf8');
const screen=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');

test('private beta allows only two specifically configured accounts',()=>{
 assert.equal(communityAllowedEmail(' RAIZNOBLEMX@gmail.com ',authorized),true);
 assert.equal(communityAllowedEmail('AburtoCoaching@gmail.com',authorized),true);
 for(const email of ['other@gmail.com','user@example.com','','raiznoblemx@gmail.com.evil','a@aburtocoaching@gmail.com']){
  assert.equal(communityAllowedEmail(email,authorized),false);
 }
});
test('misconfigured beta fails closed',()=>{
 assert.equal(communityAllowedEmail('user@example.com',{}),false);
 assert.equal(communityAllowedEmail('raiznoblemx@gmail.com',{...authorized,ANDRES_DASHBOARD_EMAIL:''}),false);
 assert.equal(communityAllowedEmail('raiznoblemx@gmail.com',{...authorized,ANDRES_DASHBOARD_EMAIL:'raiznoblemx@gmail.com'}),false);
});
test('server enforces allowlist at every authentication boundary',()=>{
 assert.match(source,/if\(!communityAllowedEmail\(email\)\)return error\(res,403/);
 assert.match(source,/return rows\[0\]&&communityAllowedEmail\(rows\[0\]\.email\)\?rows\[0\]:null/);
 assert.match(source,/const m=await memberFromSession\(sql,req\)/);
 assert.match(source,/if\(!m\)return error\(res,401/);
 assert.match(source,/ON CONFLICT\(email\) DO UPDATE SET last_seen=now\(\),role=excluded\.role/);
});
test('private beta login is clearly explained',()=>{
 assert.match(screen,/Acceso privado/);
 assert.match(screen,/registro de atletas permanece cerrado/);
});
