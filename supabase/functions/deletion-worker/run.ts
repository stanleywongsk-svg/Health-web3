/** Trusted operator job; never bundle into mobile/browser, never expose as a public route. */
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../core/handler.ts';
const config=loadConfig((key)=>Deno.env.get(key));
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be securely configured for the worker.');
const client=createClient(config.url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:jobs,error}=await client.rpc('hl_deletion_jobs');
if(error) throw new Error('Deletion queue could not be read.');
if(!Array.isArray(jobs)) throw new Error('Unexpected deletion queue response.');
let completed=0;
for(const job of jobs) {
  if(typeof job.id!=='string'||typeof job.user_id!=='string') throw new Error('Invalid deletion job.');
  const purge=await client.rpc('hl_purge_deletion',{p_job_id:job.id});
  if(purge.error) throw new Error('Core purge failed; job remains pending for retry.');
  const removed=await client.auth.admin.deleteUser(job.user_id);
  // Retrying after a crash between Auth deletion and completion is safe.
  if(removed.error && removed.error.code!=='user_not_found') throw new Error('Auth removal failed; job remains pending for retry.');
  const finish=await client.rpc('hl_complete_deletion',{p_job_id:job.id});
  if(finish.error) throw new Error('Deletion completion failed; job remains pending for retry.');
  completed++;
}
console.log(`Completed ${completed} deletion job(s). No user identifiers are logged.`);
