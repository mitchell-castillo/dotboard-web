import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { InternalSessionTransport, LOCAL_API_BASE } from './internal-session-transport.mjs';
import { bindTransport } from './lib/api-client';
import './app/globals.css';

const BoardApp = lazy(() => import('./app/board-app'));
type Status = 'loading' | 'unconfigured' | 'signed-out' | 'signing-in' | 'ready' | 'signing-out';

function App() {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [client] = useState(() => new InternalSessionTransport());
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const clearSession = () => {
      generation.current++;
      client.invalidate();
      bindTransport(null);
    };
    const expired = () => {
      clearSession();
      setError('Tu sesión terminó. Vuelve a iniciar sesión.');
      setStatus('signed-out');
    };
    const leave = () => {
      if (client.authorized) expired();
    };
    window.addEventListener('pagehide', leave);
    window.addEventListener('dotboard-auth-required', expired);

    async function loadConfig() {
      try {
        const response = await fetch('./dotboard-config.json', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error();
        const config = await response.json();
        if (config.provider !== 'internal' || config.apiBaseUrl !== LOCAL_API_BASE) throw Error();
        if (!controller.signal.aborted) setStatus('signed-out');
      } catch {
        if (!controller.signal.aborted) setStatus('unconfigured');
      }
    }
    void loadConfig();
    return () => {
      controller.abort();
      clearSession();
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('dotboard-auth-required', expired);
    };
  }, [client]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== 'signed-out') return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    form.reset();
    const attempt = ++generation.current;
    setStatus('signing-in');
    setError('');
    try {
      await client.login(String(fields.get('username')), String(fields.get('password')));
      if (attempt !== generation.current) return;
      bindTransport(client);
      setStatus('ready');
    } catch {
      if (attempt !== generation.current) return;
      setError('No se pudo iniciar sesión. Revisa tu usuario y contraseña e inténtalo de nuevo.');
      setStatus('signed-out');
    }
  }

  async function logout() {
    bindTransport(null);
    setError('');
    setStatus('signing-out');
    try {
      await client.logout();
    } catch {
      setError('Cerraste la sesión en este navegador. El servidor no confirmó la salida.');
    } finally {
      setStatus('signed-out');
    }
  }

  if (status === 'ready') return <>
    <div className="auth-bar"><span>DotBoard privado</span><button onClick={() => void logout()}>Cerrar sesión</button></div>
    <Suspense fallback={<p>Cargando tablero privado…</p>}><BoardApp /></Suspense>
  </>;

  return <main className="auth-gate">
    <h1>DotBoard</h1>
    {status === 'signed-out' ? <form method="post" onSubmit={login}>
      <label>Usuario <input name="username" autoComplete="username" required maxLength={64} /></label>
      <label>Contraseña <input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button type="submit">Entrar</button>
    </form> : <p role="status">{{
      loading: 'Comprobando acceso…', unconfigured: 'Acceso sin configurar.',
      'signing-in': 'Iniciando sesión…', 'signing-out': 'Cerrando sesión…'
    }[status]}</p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
