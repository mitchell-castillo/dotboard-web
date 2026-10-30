// Retains the exact original envelope until an acknowledged successful response.
// An unrelated GET revision is not proof of this command's outcome.
export class PendingWrite {
 private envelope:string|null=null;
 begin(body:unknown):string {if(this.envelope!==null)throw new Error('Hay un resultado pendiente. Usa Recuperar resultado antes de enviar otro cambio.');this.envelope=JSON.stringify(body);return this.envelope;}
 replay():string {if(this.envelope===null)throw new Error('No hay un resultado pendiente.');return this.envelope;}
 hasPending():boolean{return this.envelope!==null;}
 rejectDefinitively(status:number, code:unknown):boolean {
  const codes=new Set(['invalid_request','invalid_operation','invalid_backup','invalid_commit','json_required','body_too_large','revision_conflict']);
  if(![400,409,413,415].includes(status)||typeof code!=='string'||!codes.has(code))return false;
  if(code==='revision_conflict'&&status!==409)return false;
  this.envelope=null;return true;
 }
 acknowledgeSuccess():void{this.envelope=null;}
}
