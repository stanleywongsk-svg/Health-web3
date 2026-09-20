import { createClient } from '@supabase/supabase-js';
import { createCoreHandler, loadConfig } from './handler.ts';
const config=loadConfig((name)=>Deno.env.get(name));
Deno.serve(createCoreHandler(config,{
  client(token) {
    return createClient(config.url,config.anonKey,{
      global:{headers:{Authorization:`Bearer ${token}`}},
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    });
  },
}));
