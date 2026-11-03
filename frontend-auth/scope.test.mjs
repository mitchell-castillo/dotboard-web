import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from './transport.mjs';
const origin='https://web.example.test';
const prefix='https://remindmeapp.onmicrosoft.com/8f4aea5c-0f25-465e-91ea-e035233859c6/';
const base={provider:'entra',clientId:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',apiBaseUrl:'https://api.example.test/api',redirectUri:origin+'/'};
// Synthetic suffix only: this is not a configured or verified production scope.
test('exact verified HTTPS API URI permits explicit synthetic delegated scope',()=>assert.equal(validateConfig({...base,apiScope:prefix+'Synthetic.Access'},origin).apiScope,prefix+'Synthetic.Access'));
test('existing api scheme remains supported',()=>assert.equal(validateConfig({...base,apiScope:'api://dotboard/DotBoard.Access'},origin).apiScope,'api://dotboard/DotBoard.Access'));
const invalid=[
 prefix,prefix+'.default',prefix+'.',prefix+'..',prefix+'Synthetic/Access',prefix+'/Access',prefix+'../Access',
 prefix+'Access?x=1',prefix+'Access#fragment',prefix+'Access%2Fother',prefix+'Access%23fragment',prefix+'Access\\other',prefix+'Access other',prefix+'Access\n',
 prefix.replace('https:','http:')+'Access',prefix.replace('remindmeapp.onmicrosoft.com','remindmeapp.onmicrosoft.com.evil.test')+'Access',
 prefix.replace('https://','https://user@')+'Access',prefix.replace('https://','https://user:pass@')+'Access',
 prefix.replace('.com/','.com:443/')+'Access',prefix.replace('8f4aea5c','9f4aea5c')+'Access',
 'https://other.example.test/Access','api://dotboard/.default','api://dotboard/Access other',null,undefined,
];
for(const scope of invalid)test('rejects unsafe or unsupported scope '+JSON.stringify(scope),()=>assert.throws(()=>validateConfig({...base,apiScope:scope},origin)));
test('empty deployment config remains fail-closed',()=>assert.throws(()=>validateConfig({provider:'unconfigured',tenantId:'',clientId:'',redirectUri:'',apiBaseUrl:'',apiScope:''},origin)));
