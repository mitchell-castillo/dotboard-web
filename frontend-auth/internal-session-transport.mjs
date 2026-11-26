import {currentOnlyRejection} from './current-only-policy.mjs';
const API_ORIGIN='https://dotboardfunctions-atfgg7bxeeh3eqdp.eastus-01.azurewebsites.net';
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
// No cookies or token persistence; the user logs in again after a reload.
export class InternalSessionTransport {
  #fetch; #token=null; #csrf=null; #epoch=0; #busy=false;
  constructor(fetchImpl=fetch){this.#fetch=fetchImpl;}
  get authorized(){return this.#token!==null;}
  invalidate(){this.#epoch++;this.#token=null;this.#csrf=null;}
  async initialize(){this.invalidate();return null;}
  #wire(path,method,body,signal,authenticated=false){
    const headers={Accept:'application/json'};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(authenticated){headers['X-DotBoard-Session']=this.#token;if(method==='POST')headers['X-CSRF-Token']=this.#csrf;}
    return this.#fetch(API_ORIGIN+'/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'omit',mode:'cors',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  }
  async login(username,password,{signal}={}){
    if(this.#busy||this.authorized)throw new Error('Ya hay una sesión o intento en curso.');
    if(typeof username!=='string'||typeof password!=='string'||!username||!password||username.length>64||password.length>256)throw new Error('Escribe tu usuario y contraseña.');
    this.#busy=true;this.invalidate();const epoch=this.#epoch;
    try{
      const r=await this.#wire('/auth/login','POST',{username,password},signal);
      if(r.redirected||!r.ok||!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')??''))throw Error('No autorizado');
      const data=await r.json();
      if(epoch!==this.#epoch||data?.authenticated!==true||data.actorKind!=='user'||typeof data.sessionToken!=='string'||typeof data.csrfToken!=='string'||!TOKEN.test(data.sessionToken)||!TOKEN.test(data.csrfToken))throw Error('Sesión inválida');
      this.#token=data.sessionToken;this.#csrf=data.csrfToken;return Object.freeze({actorKind:'user'});
    }catch{this.invalidate();throw Error('No se pudo iniciar sesión. Revisa tus datos o inténtalo más tarde.');}finally{this.#busy=false;}
  }
  async logout({signal}={}){
    if(!this.authorized)return;if(this.#busy)throw Error('Operación de sesión en curso.');
    this.#busy=true;
    try{const r=await this.#wire('/auth/logout','POST',undefined,signal,true);if(r.redirected||!(r.ok||r.status===401))throw Error('Resultado no confirmado');}
    finally{this.invalidate();this.#busy=false;}
  }
  async request(path,{method='GET',body,signal}={}){
    const workspace=path==='/workspace'&&['GET','POST'].includes(method);
    const backup=path==='/workspace/backup'&&method==='GET';
    const currentImport=path==='/workspace/current-import'&&method==='POST';
    let instructions=false;
    if(typeof path==='string'&&path.startsWith('/workspace/instructions?')&&method==='GET'&&!path.includes('#')){
      const query=new URLSearchParams(path.slice(path.indexOf('?')+1));
      const id=query.get('boardId');
      instructions=!!id&&id.length<=100&&query.getAll('boardId').length===1
        &&[...query.keys()].every(k=>k==='boardId'||k==='format')
        &&query.getAll('format').length<=1&&(!query.has('format')||query.get('format')==='md');
    }
    if(!(workspace||backup||currentImport||instructions)||(method==='GET'&&body!==undefined))throw Error('Ruta aún no disponible con el acceso interno.');
    if(this.#busy||!this.authorized)throw Error('Inicia sesión en DotBoard.');
    const denied=currentOnlyRejection(path,{method,body});if(denied)return denied;
    const epoch=this.#epoch;
    const r=await this.#wire('/local'+path,method,body,signal,true);
    if(epoch!==this.#epoch||this.#busy||r.redirected)throw Error('La sesión cambió.');
    if(r.status===401)this.invalidate();return r;
  }
}
