export type DescriptionBlock = {kind:'paragraph'|'heading'|'quote'|'bullet'|'number';level?:number;text:string};
export type DescriptionInline = {kind:'text'|'bold'|'italic'|'underline';text?:string;children?:DescriptionInline[]};

// A deliberately small Markdown subset. User HTML is always ordinary text.
export function descriptionBlocks(value:string):DescriptionBlock[]{
 return value.split(/\r?\n/).map(line=>{
  const heading=/^(#{1,3})\s+(.+)$/.exec(line);if(heading)return {kind:'heading',level:heading[1].length,text:heading[2]};
  const quote=/^>\s?(.*)$/.exec(line);if(quote)return {kind:'quote',text:quote[1]};
  const bullet=/^[-*]\s+(.*)$/.exec(line);if(bullet)return {kind:'bullet',text:bullet[1]};
  const number=/^\d+[.)]\s+(.*)$/.exec(line);if(number)return {kind:'number',text:number[1]};
  return {kind:'paragraph',text:line};
 });
}
export function descriptionInline(value:string,depth=0):DescriptionInline[]{
 if(depth>6)return [{kind:'text',text:value}];
 const out:DescriptionInline[]=[];let plain='';
 const flush=()=>{if(plain){out.push({kind:'text',text:plain});plain='';}};
 for(let i=0;i<value.length;){
  if(value[i]==='\\'&&i+1<value.length&&'\\*_+[]`>#-'.includes(value[i+1])){plain+=value[i+1];i+=2;continue;}
  const marker=value.startsWith('**',i)?'**':value.startsWith('++',i)?'++':value[i]==='*'?'*':'';
  if(marker){let end=i+marker.length;while((end=value.indexOf(marker,end))>=0&&value[end-1]==='\\')end+=marker.length;if(end>i+marker.length){flush();out.push({kind:marker==='**'?'bold':marker==='++'?'underline':'italic',children:descriptionInline(value.slice(i+marker.length,end),depth+1)});i=end+marker.length;continue;}}
  plain+=value[i++];
 }
 flush();return out;
}
export function descriptionPlainText(value:string){
 const text=(nodes:DescriptionInline[]):string=>nodes.map(n=>n.text??text(n.children??[])).join('');
 return descriptionBlocks(value).map(b=>text(descriptionInline(b.text))).join('\n');
}
function escapeInline(text:string){return text.replace(/[\\*_+\[\]`]/g,'\\$&');}
// Only text and the formatting we support are serialized. No HTML is stored.
export function descriptionFromDOM(root:HTMLElement):string{
 const ignored=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','IMG']);
 const inline=(node:Node):string=>{
  if(node.nodeType===3)return escapeInline(node.textContent??'');
  if(node.nodeType!==1)return '';
  const element=node as HTMLElement;if(ignored.has(element.tagName))return '';
  if(element.tagName==='BR')return '\n';
  const body=Array.from(element.childNodes).map(inline).join('');
  if(['STRONG','B'].includes(element.tagName))return '**'+body+'**';
  if(['EM','I'].includes(element.tagName))return '*'+body+'*';
  if(element.tagName==='U')return '++'+body+'++';
  if(['P','DIV','BLOCKQUOTE'].includes(element.tagName))return body+'\n';
  return body;
 };
 const lines:string[]=[];let loose='';
 const flush=()=>{if(loose){lines.push(loose);loose='';}};
 const block=(node:Node)=>{
  if(node.nodeType!==1){loose+=inline(node);return;}
  const el=node as HTMLElement;if(ignored.has(el.tagName))return;
  if(['UL','OL'].includes(el.tagName)){flush();Array.from(el.children).filter(c=>c.tagName==='LI').forEach((li,i)=>lines.push((el.tagName==='UL'?'- ':`${i+1}. `)+inline(li).replace(/\n/g,' ')));return;}
  if(/^(P|DIV|H[1-3]|BLOCKQUOTE)$/.test(el.tagName)){
   flush();if(el.tagName==='DIV'&&Array.from(el.children).some(c=>['P','DIV','UL','OL','H1','H2','H3','BLOCKQUOTE'].includes(c.tagName))){Array.from(el.childNodes).forEach(block);flush();return;}
   const prefix=el.tagName==='BLOCKQUOTE'?'> ':/^H/.test(el.tagName)?'#'.repeat(Number(el.tagName[1]))+' ':'';
   const body=inline(el).replace(/\n$/,'');lines.push(...body.split('\n').map(line=>prefix+line));return;
  }
  loose+=inline(el);
 };
 Array.from(root.childNodes).forEach(block);flush();return lines.join('\n');
}
