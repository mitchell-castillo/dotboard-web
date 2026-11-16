// Defense in depth: authorization remains enforced by the API, never by this UI.
export function currentOnlyRejection(path,{method='GET',body}={}){
 const allowed=method==='GET'&&!/\/(history|snapshots)(?:[/?]|$)/.test(path)
  ||method==='POST'&&path==='/workspace/current-import'
  ||method==='POST'&&path==='/workspace'&&typeof body?.operation?.action==='string'&&!body.operation.action.startsWith('delete-');
 if(allowed)return null;
 return new Response(JSON.stringify({error:'invalid_operation',message:'Acción no disponible en modo actual. No se conservan versiones históricas; eliminar está bloqueado hasta disponer de papelera recuperable.'}),{status:400,headers:{'Content-Type':'application/json'}});
}
