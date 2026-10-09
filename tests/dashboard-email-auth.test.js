import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardConfigured,dashboardCoachConfigured,checkDashboardCredentials,dashboardCookie,dashboardSession} from '../lib/dashboard-auth.js';

const keys=['DASHBOARD_ADMIN_EMAIL','ANDRES_DASHBOARD_EMAIL','DASHBOARD_PASSWORD','ANDRES_DASHBOARD_PASSWORD','DASHBOARD_SESSION_SECRET'];
const originals=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
Object.assign(process.env,{
 DASHBOARD_ADMIN_EMAIL:'ops@example.com',
 ANDRES_DASHBOARD_EMAIL:'coach@example.com',
 DASHBOARD_PASSWORD:'ExampleTestPassword#345',
 ANDRES_DASHBOARD_PASSWORD:'AnotherTestPassword#456',
 DASHBOARD_SESSION_SECRET:'a'.repeat(64)
});
after(()=>{for(const key of keys){if(originals[key]===undefined)delete process.env[key];else process.env[key]=originals[key];}});

test('only two exact allowed email addresses authenticate',()=>{
 assert.equal(dashboardConfigured(),true);
 assert.equal(dashboardCoachConfigured(),true);
 assert.deepEqual(checkDashboardCredentials(' OPS@EXAMPLE.COM ','ExampleTestPassword#345'),{role:'admin',user:'ops@example.com'});
 assert.deepEqual(checkDashboardCredentials('coach@example.com','AnotherTestPassword#456'),{role:'coach',user:'coach@example.com'});
 assert.equal(checkDashboardCredentials('AburtoPC','ExampleTestPassword#345'),null);
 assert.equal(checkDashboardCredentials('AndresAburto','AnotherTestPassword#456'),null);
 assert.equal(checkDashboardCredentials('intruder@example.com','ExampleTestPassword#345'),null);
 assert.equal(checkDashboardCredentials('coach@example.com','ExampleTestPassword#345'),null);
});
test('session cookie binds user identity and cannot survive email change',()=>{
 const token=dashboardCookie('coach').split(';')[0];
 assert.deepEqual(dashboardSession({headers:{cookie:token}}),{role:'coach',user:'coach@example.com'});
 process.env.ANDRES_DASHBOARD_EMAIL='newcoach@example.com';
 assert.equal(dashboardSession({headers:{cookie:token}}),null);
 process.env.ANDRES_DASHBOARD_EMAIL='coach@example.com';
});
test('configuration refuses duplicate accounts',()=>{
 process.env.ANDRES_DASHBOARD_EMAIL='ops@example.com';
 assert.equal(dashboardConfigured(),false);
 process.env.ANDRES_DASHBOARD_EMAIL='coach@example.com';
});
