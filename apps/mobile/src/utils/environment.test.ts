import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';
const base = { EXPO_PUBLIC_APP_ENV:'development',EXPO_PUBLIC_DATA_MODE:'real',EXPO_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',EXPO_PUBLIC_CORE_API_URL:'http://127.0.0.1:54321/functions/v1/core',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_localtest' };
describe('native environment guard', () => {
  it('accepts explicit local real build', () => expect(validateEnvironment(base).environment).toBe('development'));
  it.each([{EXPO_PUBLIC_DATA_MODE:'demo'},{EXPO_PUBLIC_DATA_MODE:undefined},{EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_bad'},{EXPO_PUBLIC_CORE_API_URL:'https://other.supabase.co/functions/v1/core'},{EXPO_PUBLIC_APP_ENV:'production'}])('fails closed for %o', bad => expect(() => validateEnvironment({...base,...bad})).toThrow());
});
it.each(['localhost.evil.example','10.evil.example','192.168.1.evil','172.20.evil','10.999.1.1'])('rejects misleading local host %s', host=>{expect(()=>validateEnvironment({...base,EXPO_PUBLIC_SUPABASE_URL:`http://${host}:54321`,EXPO_PUBLIC_CORE_API_URL:`http://${host}:54321/functions/v1/core`})).toThrow()});
it.each(['http://user@127.0.0.1:54321','http://127.0.0.1:54321/path','http://127.0.0.1:54321/?x=1','http://127.0.0.1:54321/#a'])('rejects unexpected URL components %s',url=>expect(()=>validateEnvironment({...base,EXPO_PUBLIC_SUPABASE_URL:url})).toThrow());
