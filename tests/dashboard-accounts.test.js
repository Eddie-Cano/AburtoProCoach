import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardConfigured,dashboardCoachConfigured,checkDashboardCredentials,dashboardCookie,dashboardSession} from '../lib/dashboard-auth.js';

const previous=Object.fromEntries(['DASHBOARD_ADMIN_EMAIL','ANDRES_DASHBOARD_EMAIL','DASHBOARD_PASSWORD','ANDRES_DASHBOARD_PASSWORD','DASHBOARD_SESSION_SECRET'].map(k=>[k,process.env[k]]));
test('independent dashboard identities, signed role, and disabled coach without config',()=>{
 try{
  process.env.DASHBOARD_ADMIN_EMAIL='ops@example.com';
  process.env.ANDRES_DASHBOARD_EMAIL='coach@example.com';
  process.env.DASHBOARD_PASSWORD='an-admin-test-password-only';
  process.env.DASHBOARD_SESSION_SECRET='this-is-a-test-session-secret-with-more-than-32-chars';
  delete process.env.ANDRES_DASHBOARD_PASSWORD;
  assert.equal(dashboardConfigured(),true);
  assert.equal(dashboardCoachConfigured(),false);
  assert.equal(checkDashboardCredentials('coach@example.com','an-admin-test-password-only'),null);
  const admin=checkDashboardCredentials('ops@example.com','an-admin-test-password-only');
  assert.equal(admin?.role,'admin');
  assert.equal(checkDashboardCredentials('ops@example.com','wrong'),null);
  process.env.ANDRES_DASHBOARD_PASSWORD='coach-test-password-not-the-same';
  assert.equal(dashboardCoachConfigured(),true);
  const coach=checkDashboardCredentials('coach@example.com','coach-test-password-not-the-same');
  assert.equal(coach?.role,'coach');
  assert.equal(checkDashboardCredentials('coach@example.com','an-admin-test-password-only'),null);
  const cookie=dashboardCookie('coach').split(';')[0];
  assert.equal(dashboardSession({headers:{cookie}})?.role,'coach');
  assert.equal(dashboardSession({headers:{cookie:cookie+'tampered'}}),null);
  delete process.env.ANDRES_DASHBOARD_PASSWORD;
  assert.equal(dashboardSession({headers:{cookie}}),null);
 }finally{
  for(const [key,value] of Object.entries(previous))value===undefined?delete process.env[key]:process.env[key]=value;
 }
});
