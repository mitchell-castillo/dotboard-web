import {useEffect,useState} from 'react';
import {LockKeyhole,LayoutGrid,RefreshCw,LogOut} from 'lucide-react';
import BoardApp from './app/board-app';
import {ACCESS_LOST,getApiClient} from './lib/api-client';
import type {Session} from './lib/api-core';
export default function App(){
 const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
 const configured=Boolean(import.meta.env.VITE_API_BASE_URL);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setSession(null);setError('');
  const lost=()=>{setSession(null);setError('Tu sesión terminó o no tiene acceso. Inicia sesión de nuevo.');};window.addEventListener(ACCESS_LOST,lost);
  if(configured){Promise.resolve().then(()=>getApiClient().getSession(controller.signal)).then(value=>{if(!controller.signal.aborted)setSession(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo verificar el acceso.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});}else setLoading(false);
  return()=>{controller.abort();window.removeEventListener(ACCESS_LOST,lost);};
 },[attempt,configured]);
 if(session)return <><header className="session-bar"><span>{session.actor.displayName} · Espacio compartido</span><button type="button" onClick={()=>void getApiClient().logout().catch(e=>setError(e instanceof Error?e.message:'No se confirmó el cierre.'))}><LogOut size={16}/>Salir</button></header><BoardApp/></>;
 return <main className="access-shell"><section className="access-card"><div className="access-brand"><LayoutGrid/>DotBoard</div><div className="access-symbol"><LockKeyhole size={30}/></div><h1>Tu espacio, protegido.</h1><p>La aplicación es pública. Tus proyectos y comentarios solo se muestran después de verificar tu acceso.</p>{loading?<p role="status">Verificando sesión…</p>:!configured?<div className="access-notice" role="status"><strong>Acceso aún sin configurar</strong><p>El backend y el proveedor de acceso todavía no están conectados. No se cargan tableros ni se recogen contraseñas aquí.</p></div>:<><button className="button primary" onClick={()=>{try{window.location.assign(getApiClient().loginUrl(new URL(import.meta.env.BASE_URL,window.location.origin).href));}catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar acceso.');}}}>Iniciar sesión</button><button className="button secondary" onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={16}/>Volver a comprobar</button></>}{error&&<p className="access-error" role="alert">{error}</p>}<small>Cuentas separadas. Un mismo espacio autorizado.</small></section></main>;
}
