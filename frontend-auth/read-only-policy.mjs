export const readOnlyMessage='Vista de solo lectura: los cambios estan deshabilitados hasta completar la migracion y la recuperacion segura.';
export function readOnlyRejection(method='GET'){
 if(method==='GET')return null;
 return new Response(JSON.stringify({error:'invalid_operation',message:readOnlyMessage,localReadOnly:true}),{status:400,headers:{'Content-Type':'application/json'}});
}
