import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDashboardCredentials,dashboardCookie,requireDashboard} from '../lib/dashboard-auth.js';

const keys=['DASHBOARD_ADMIN_EMAIL','ANDRES_DASHBOARD_EMAIL','DASHBOARD_PASSWORD','ANDRES_DASHBOARD_PASSWORD','DASHBOARD_SESSION_SECRET'];
function fakeResponse(){
 const res={statusCode:200,body:null,headers:{}};
 res.setHeader=(k,v)=>{res.headers[k]=v;return res;};
 res.status=(code)=>{res.statusCode=code;return res;};
 res.json=(value)=>{res.body=value;return res;};
 return res;
}
test('only Raiz Noble admin can perform privileged library operations',()=>{
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
  Object.assign(process.env,{
   DASHBOARD_ADMIN_EMAIL:'raiz-admin@example.com',
   ANDRES_DASHBOARD_EMAIL:'coach@example.com',
   DASHBOARD_PASSWORD:'ExampleTestPassword123',
   ANDRES_DASHBOARD_PASSWORD:'ExampleTestPassword123',
   DASHBOARD_SESSION_SECRET:'test-secret-longer-than-thirty-two-characters-for-role-test'
  });
  assert.equal(checkDashboardCredentials('raiz-admin@example.com','ExampleTestPassword123')?.role,'admin');
  assert.equal(checkDashboardCredentials('coach@example.com','ExampleTestPassword123')?.role,'coach');
  const req=(role)=>({headers:{cookie:dashboardCookie(role).split(';')[0]}});
  let res=fakeResponse();
  assert.equal(requireDashboard(req('admin'),res,'admin'),true);
  assert.equal(res.statusCode,200);
  res=fakeResponse();
  assert.equal(requireDashboard(req('coach'),res,'admin'),false);
  assert.equal(res.statusCode,403);
  res=fakeResponse();
  assert.equal(requireDashboard(req('coach'),res),true);
  res=fakeResponse();
  assert.equal(requireDashboard({headers:{cookie:''}},res,'admin'),false);
  assert.equal(res.statusCode,401);
 } finally {
  for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
