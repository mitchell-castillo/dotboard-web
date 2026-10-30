import React,{useEffect,useRef,useState,lazy,Suspense} from 'react';import{createRoot}from'react-dom/client';
const BoardApp=lazy(()=>import('./app/board-app'));import{createDotBoardTransport}from'./entra.mjs';import{bindTransport}from'./lib/api-client';import type{DotBoardTransport}from'./transport.mjs';import'./app/globals.css';
function App(){
 const [state,setState]=useState<'loading'|'configuration'|'signed-out'|'ready'|'busy'>('loading');const[error,setError]=useState('');const transport=useRef<DotBoardTransport|null>(null);const[epoch,setEpoch]=useState(0);
 useEffect(()=>{let disposed=false;const controller=new AbortController();const reset=()=>{bindTransport(null);setState('signed-out');setError('Inicia sesión nuevamente para continuar.');};
 const resume=()=>{if(!transport.current?.msal.getActiveAccount())reset();};
 window.addEventListener('dotboard-auth-required',reset);window.addEventListener('pageshow',resume);window.addEventListener('popstate',resume);
 void(async()=>{try{const response=await fetch('./dotboard-config.json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('La configuración de acceso no está disponible.');const client=createDotBoardTransport(await response.json());transport.current=client;const account=await client.initialize();if(disposed)return;if(account){bindTransport(client);setState('ready');}else setState('signed-out');}catch(e){if(!disposed){setState('configuration');setError(e instanceof Error?e.message:'Acceso sin configurar.');}}})();
 return()=>{disposed=true;controller.abort();bindTransport(null);window.removeEventListener('dotboard-auth-required',reset);window.removeEventListener('pageshow',resume);window.removeEventListener('popstate',resume);};},[]);
 async function login(){const client=transport.current;if(!client||state==='busy')return;setState('busy');setError('');try{await client.login();}catch{setError('No se completó el inicio de sesión. Puedes intentarlo de nuevo.');setState('signed-out');}}
 async function logout(){const client=transport.current;if(!client||state==='busy')return;bindTransport(null);setEpoch(value=>value+1);setState('busy');try{await client.logout();}catch{setError('La salida del proveedor no se completó. Los datos locales ya se ocultaron.');setState('signed-out');}}
 if(state==='ready')return<><div className="auth-bar"><span>DotBoard privado</span><button onClick={()=>void logout()}>Cerrar sesión</button></div><Suspense fallback={<p>Cargando tablero privado…</p>}><BoardApp key={epoch}/></Suspense></>;
 return<main className="auth-gate"><h1>DotBoard</h1><p>{state==='loading'?'Comprobando acceso…':state==='configuration'?'Acceso aún sin configurar':state==='busy'?'Esperando autenticación…':'Tus proyectos requieren iniciar sesión.'}</p>{error&&<p role="alert">{error}</p>}{state==='signed-out'&&<button onClick={()=>void login()}>Iniciar sesión</button>}</main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
