export interface MobileEnvironment { environment: 'development' | 'test' | 'production'; supabaseUrl: string; anonKey: string; apiUrl: string }
export function validateEnvironment(input: Record<string, string | undefined>): MobileEnvironment {
  const environment = input.EXPO_PUBLIC_APP_ENV;
  if (!['development', 'test', 'production'].includes(environment ?? '')) throw new Error('ENVIRONMENT_REQUIRED');
  if (input.EXPO_PUBLIC_DATA_MODE !== 'real') throw new Error('REAL_BUILD_ONLY');
  const anonKey = input.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey || anonKey.startsWith('sb_secret_')) throw new Error('PUBLIC_KEY_REQUIRED');
  if (anonKey.startsWith('ey')) {
    // Never accept a legacy privileged JWT in a client. Base64 decoding is runtime independent.
    const payload = anonKey.split('.')[1];
    if (!payload) throw new Error('INVALID_PUBLIC_KEY');
    try { if (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error('INVALID_ROLE'); }
    catch { throw new Error('PUBLIC_KEY_REQUIRED'); }
  }
  const supabase = new URL(input.EXPO_PUBLIC_SUPABASE_URL ?? '');
  const api = new URL(input.EXPO_PUBLIC_CORE_API_URL ?? '');
  if ([supabase,api].some(url => url.username || url.password || url.search || url.hash) || supabase.pathname !== '/') throw new Error('INVALID_URL_COMPONENTS');
  if (api.origin !== supabase.origin || api.pathname !== '/functions/v1/core') throw new Error('API_ORIGIN_MISMATCH');
  const localHost = (host: string) => {
    if (['localhost','127.0.0.1','[::1]'].includes(host)) return true;
    const parts=host.split('.'); if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))return false;
    const [a,b]=parts.map(Number); return a===10||(a===192&&b===168)||(a===172&&b!==undefined&&b>=16&&b<=31);
  };
  if (![supabase, api].every(url => url.protocol === 'https:' || (environment !== 'production' && url.protocol === 'http:' && localHost(url.hostname)))) throw new Error('HTTPS_REQUIRED');
  if (/lab|demo|synthetic/i.test(supabase.hostname)) throw new Error('CORE_BACKEND_REQUIRED');
  return { environment: environment as MobileEnvironment['environment'], supabaseUrl: supabase.origin, anonKey, apiUrl: api.href };
}
