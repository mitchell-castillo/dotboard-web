"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Bold,Italic,Underline,List,ListOrdered,Heading2,Quote,Maximize2,Minimize2,Undo2,Redo2,Type} from 'lucide-react';
import {descriptionBlocks,descriptionInline,descriptionFromDOM,type DescriptionInline} from '@/lib/description-format';

function Inline({nodes}:{nodes:DescriptionInline[]}):ReactNode{return nodes.map((node,i)=>node.kind==='text'?<span key={i}>{node.text}</span>:node.kind==='bold'?<strong key={i}><Inline nodes={node.children??[]}/></strong>:node.kind==='italic'?<em key={i}><Inline nodes={node.children??[]}/></em>:<u key={i}><Inline nodes={node.children??[]}/></u>);}
export function RichDescription({value}:{value:string}){
 const blocks=descriptionBlocks(value);const output:ReactNode[]=[];
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i];const content=<Inline nodes={descriptionInline(block.text)}/>;
  if(block.kind==='bullet'||block.kind==='number'){
   const kind=block.kind,items:ReactNode[]=[];let j=i;
   while(j<blocks.length&&blocks[j].kind===kind){items.push(<li key={j}><Inline nodes={descriptionInline(blocks[j].text)}/></li>);j++;}
   output.push(kind==='bullet'?<ul key={i}>{items}</ul>:<ol key={i}>{items}</ol>);i=j-1;
  }else if(block.kind==='heading')output.push(block.level===1?<h1 key={i}>{content}</h1>:block.level===2?<h2 key={i}>{content}</h2>:<h3 key={i}>{content}</h3>);
  else if(block.kind==='quote')output.push(<blockquote key={i}>{content}</blockquote>);
  else output.push(<p key={i}>{block.text?content:<br/>}</p>);
 }
 return <>{output}</>;
}
function WritingSurface({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
 const [initial]=useState(value);const root=useRef<HTMLDivElement>(null);const selection=useRef<Range|null>(null);
 useEffect(()=>{const remember=()=>{const s=window.getSelection();if(s?.rangeCount&&root.current?.contains(s.anchorNode))selection.current=s.getRangeAt(0).cloneRange();};document.addEventListener('selectionchange',remember);return()=>document.removeEventListener('selectionchange',remember);},[]);
 function sync(){if(root.current)onChange(descriptionFromDOM(root.current));}
 function command(name:string,value?:string){if(disabled||!root.current)return;root.current.focus();if(selection.current){const s=window.getSelection();s?.removeAllRanges();s?.addRange(selection.current);}document.execCommand(name,false,value);sync();}
 const tools=[['bold','Negrita',Bold],['italic','Cursiva',Italic],['underline','Subrayado',Underline],['insertUnorderedList','Viñetas',List],['insertOrderedList','Lista numerada',ListOrdered],['formatBlock','Título',Heading2,'h2'],['formatBlock','Cita',Quote,'blockquote'],['formatBlock','Texto normal',Type,'p'],['undo','Deshacer formato',Undo2],['redo','Rehacer formato',Redo2]] as const;
 return <div className="word-editor"><div className="format-toolbar" role="group" aria-label="Formato de descripción">{tools.map(([name,label,Icon,arg],i)=><button key={i} type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command(name,arg)}><Icon size={17}/></button>)}</div><div ref={root} className="description-prose rich-editor" role="textbox" aria-label="Descripción con formato" aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning onInput={sync} onPaste={e=>{e.preventDefault();if(!disabled){document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));sync();}}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(!disabled){document.execCommand('insertText',false,e.dataTransfer.getData('text/plain'));sync();}}}><RichDescription value={initial}/></div></div>;
}
export default function DescriptionEditor({value,onChange,disabled,expanded,onExpand,existing}:{value:string;onChange:(value:string)=>void;disabled:boolean;expanded:boolean;onExpand:()=>void;existing:boolean}){
 const [editing,setEditing]=useState(!existing);const expand=useRef<HTMLButtonElement>(null);const read=useRef<HTMLDivElement>(null);const wasExpanded=useRef(false);
 useEffect(()=>{if(wasExpanded.current&&!expanded)expand.current?.focus();wasExpanded.current=expanded;if(expanded&&!editing)read.current?.focus({preventScroll:true});},[expanded,editing]);
 return <div className="description-field"><div className="description-heading"><span id="description-heading">Descripción</span><div><button type="button" disabled={disabled} aria-pressed={!editing} onClick={()=>setEditing(false)}>Leer</button><button type="button" disabled={disabled} aria-pressed={editing} onClick={()=>setEditing(true)}>Editar</button><button ref={expand} type="button" className="description-expand" disabled={disabled} onClick={onExpand} aria-expanded={expanded} aria-label={expanded?'Reducir descripción':'Maximizar descripción'} title={expanded?'Reducir descripción':'Maximizar descripción'}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button></div></div>{editing?<WritingSurface value={value} onChange={onChange} disabled={disabled}/>:<div ref={read} className="description-prose description-reader" tabIndex={0} role="region" aria-labelledby="description-heading">{value?<RichDescription value={value}/>:<p className="description-empty">Sin descripción. Pulsa Editar para escribir.</p>}</div>}<small className={value.length>5000?'description-limit invalid':'description-limit'} role={value.length>5000?'alert':undefined}>{value.length.toLocaleString()} / 5,000 caracteres{value.length>5000?' · Reduce el texto antes de guardar.':''}</small></div>;
}
