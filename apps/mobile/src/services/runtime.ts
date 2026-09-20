import { createClient } from '@supabase/supabase-js';
import { createCoreClient } from '@healthloop/api-client';
import { validateEnvironment } from '../utils/environment';
import { secureStorage } from './secure-storage';
export function createRuntime() {
  const env = validateEnvironment({ EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV, EXPO_PUBLIC_DATA_MODE:process.env.EXPO_PUBLIC_DATA_MODE, EXPO_PUBLIC_SUPABASE_URL:process.env.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_CORE_API_URL:process.env.EXPO_PUBLIC_CORE_API_URL });
  const auth = createClient(env.supabaseUrl,env.anonKey,{auth:{storage:secureStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  const api = createCoreClient({baseUrl:env.apiUrl,allowLocalDevelopment:env.environment!=='production',accessToken:async () => (await auth.auth.getSession()).data.session?.access_token ?? null});
  return { env, auth, api };
}
export type Runtime = ReturnType<typeof createRuntime>;
