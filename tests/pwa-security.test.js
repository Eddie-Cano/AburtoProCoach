import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const header=(source,key)=>config.headers.find(row=>row.source===source)?.headers.find(item=>item.key.toLowerCase()===key.toLowerCase())?.value;

test('public browser security headers',()=>{
 assert.equal(header('/(.*)','X-Content-Type-Options'),'nosniff');
 assert.equal(header('/(.*)','X-Frame-Options'),'DENY');
 assert.match(header('/(.*)','Referrer-Policy'),/strict-origin/);
});
test('private routes are not cached by Vercel',()=>{
 assert.match(header('/api/(.*)','Cache-Control'),/no-store/);
 assert.match(header('/dashboard/(.*)','Cache-Control'),/no-store/);
 assert.match(header('/biblioteca.html','Cache-Control'),/no-store/);
});
test('service worker only handles safe navigations',()=>{
 assert.match(sw,/request\.method!=='GET'/);
 assert.match(sw,/request\.mode!=='navigate'/);
 for(const prefix of ['/api/','/dashboard/','/biblioteca','/productos/'])assert.ok(sw.includes(prefix));
 assert.ok(!sw.includes('cache.put('));
});
test('PWA manifest is standalone and matches page link',()=>{
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'/');
 assert.ok(manifest.icons?.length);
 assert.match(index,/rel="manifest" href="\/manifest\.webmanifest"/);
 assert.match(index,/src="\/pwa-install\.js"/);
 assert.ok(!index.includes('\\n  <meta name="apple'));
});

test('real PNG icons have the declared sizes',()=>{
 for(const n of [192,512]){
  const b=readFileSync(new URL('../assets/pwa/icon-'+n+'.png',import.meta.url));
  assert.equal(b.subarray(1,4).toString(),'PNG');
  assert.equal(b.readUInt32BE(16),n);
  assert.equal(b.readUInt32BE(20),n);
  const icon=manifest.icons.find(x=>x.src.endsWith('icon-'+n+'.png'));
  assert.equal(icon?.sizes,n+'x'+n);
 }
});
