"use client";
import {useRef,useState,useEffect,type FormEvent} from 'react';
import {MessageSquare,Send,UserRound,Sparkles,Loader2} from 'lucide-react';
import type {Card} from '@/lib/board-types';
import type {Action} from '@/lib/workspace-store';
const dates=new Intl.DateTimeFormat('es-DO',{timeZone:'America/Santo_Domingo',dateStyle:'medium',timeStyle:'short'});
export default function CardComments({card,busy,mutate,fullHeight=false}:{card:Card;busy:boolean;mutate:(operation:Action)=>Promise<unknown>;fullHeight?:boolean}){
 const [body,setBody]=useState('');const [error,setError]=useState('');const [sending,setSending]=useState(false);const [saved,setSaved]=useState('');
 const request=useRef<{body:string;id:string}|null>(null);const lock=useRef(false);
 const compose=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const textarea=compose.current;if(!textarea)return;textarea.style.height='';if(fullHeight){textarea.style.height='0px';textarea.style.height=Math.max(94,textarea.scrollHeight+2)+'px';}},[fullHeight,body]);
 const comments=card.comments??[];
 async function submit(event:FormEvent){
  event.preventDefault();if(lock.current||busy)return;
  const text=body.trim();if(!text){setError('Escribe un comentario antes de publicarlo.');return;}
  if(text.length>5000){setError('Usa un máximo de 5,000 caracteres.');return;}
  if(!request.current||request.current.body!==text)request.current={body:text,id:crypto.randomUUID()};
  lock.current=true;setSending(true);setError('');setSaved('');
  try{await mutate({action:'add-comment',cardId:card.id,body:text,requestId:request.current.id});setBody('');request.current=null;setSaved('Comentario guardado');}
  catch(e){setError(e instanceof Error?e.message:'No se pudo guardar. Tu comentario sigue aquí para reintentarlo.');}
  finally{lock.current=false;setSending(false);}
 }
 return <section className="card-comments" aria-label="Comentarios de la tarjeta">
  <header className="comments-heading"><h3><MessageSquare size={18}/>Comentarios <span>{comments.length}</span></h3><small>Hora de Rep. Dominicana</small></header>
  {comments.length?<ol className="comments-list">{comments.map(comment=><li key={comment.id} className={'comment comment-'+comment.author.kind}>
   <div className="comment-meta"><span className="comment-author">{comment.author.kind==='dot'?<Sparkles size={15}/>:<UserRound size={15}/>}<strong>{comment.author.kind==='dot'?'dot':'Juan'}</strong><span className="comment-role">{comment.author.kind==='dot'?'Asistente':'Tú'}</span></span><time dateTime={new Date(comment.createdAt).toISOString()}>{dates.format(comment.createdAt)}</time></div>
   <p>{comment.body}</p>
  </li>)}</ol>:<p className="comments-empty">Todavía no hay comentarios. Puedes dejar contexto o una pregunta aquí.</p>}
  <form className="comment-compose" onSubmit={submit}>
   <label htmlFor={'comment-'+card.id}>Agregar comentario como Juan</label>
   <textarea ref={compose} id={'comment-'+card.id} value={body} maxLength={5000} rows={3} placeholder="Escribe tu comentario…" disabled={busy||sending} onChange={e=>{setBody(e.target.value);setError('');setSaved('');}}/>
   <div className="comment-compose-bottom"><small>{body.length.toLocaleString('es-DO')} / 5,000</small><button type="submit" className="button primary" disabled={busy||sending||!body.trim()}>{sending?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>} {sending?'Guardando…':'Comentar'}</button></div>
   {error&&<p className="inline-error" role="alert">{error}</p>}{saved&&<p className="comment-saved" role="status">{saved}</p>}
  </form>
 </section>;
}
