"use client";
import { useEffect, useState } from "react";
const categories:Record<string,string>={technical:"Técnica",financial:"Financeira",legal:"Jurídica",fiscal:"Fiscal",contractual:"Contratual",other:"Outra"};
const states:Record<string,string>={pending:"Pendente",confirmed:"Confirmado",corrected:"Corrigido",rejected:"Rejeitado",specialist_review:"Revisão especializada"};
type Requirement={id:string;title:string;category:string;review_status:string;version:number;origin:string;model:string|null;source:{page:number;excerpt:string;filename:string;verified:boolean};history:Array<{action:string;author:string;at:string;reason?:string;before?:{title:string};after?:{title:string}}>};
type Data={requirements:Requirement[];runs:Array<{page:number;requirement_count:number}>;total_pages:number;ai_configured:boolean;model:string};
async function result(response:Response){const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Confira os campos e tente novamente.");return data;}
export default function Requirements({documentId,page,pageText,pageStatus,onSource}:{documentId:string;page:number;pageText:string;pageStatus:string;onSource:(page:number,excerpt:string)=>void}){
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [author,setAuthor]=useState("");
 const [selected,setSelected]=useState<Requirement|null>(null);
 const [title,setTitle]=useState("");
 const [category,setCategory]=useState("technical");
 const [reason,setReason]=useState("");
 const [filter,setFilter]=useState("all");
 const [manual,setManual]=useState(false);
 const [excerpt,setExcerpt]=useState("");
 const [message,setMessage]=useState("");
 const base=`/api/documents/${documentId}`;
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`${base}/requirements`,{cache:"no-store",signal:controller.signal}).then(result).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return ()=>controller.abort();
 },[base]);
 async function refresh(){setData(await result(await fetch(`${base}/requirements`,{cache:"no-store"})));}
 function open(item:Requirement){setSelected(item);setTitle(item.title);setCategory(item.category);setReason("");setManual(false);onSource(item.source.page,item.source.excerpt);}
 async function extract(){
  setBusy(true);setError("");setMessage("");
  try{const response=await result(await fetch(`${base}/extract-requirements`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page})}));await refresh();setMessage(response.already_processed?"Esta página já foi processada. Os requisitos e as revisões foram preservados.":`${response.created} requisito(s) registrado(s) para revisão na página ${page}.`);}
  catch(e){setError(e instanceof Error?e.message:"Falha ao extrair requisitos.");}finally{setBusy(false);}
 }
 async function review(status:string){
  if(!selected)return;
  if(author.trim().length<2||reason.trim().length<3){setError("Informe seu nome e uma justificativa para registrar a revisão.");return;}
  setBusy(true);setError("");
  try{const updated=await result(await fetch(`${base}/requirements/${selected.id}/review`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,author,title,category,reason,expected_version:selected.version})}));setSelected(updated);await refresh();setMessage("Revisão salva com autor, horário e histórico.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao revisar.");}finally{setBusy(false);}
 }
 async function saveManual(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError("");
  try{const created=await result(await fetch(`${base}/requirements`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page,title,category,excerpt,author})}));await refresh();open(created);setMessage("Requisito manual salvo. A origem foi conferida no texto da página.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao registrar.");}finally{setBusy(false);}
 }
 const filtered=data?.requirements.filter(item=>filter==="all"||item.review_status===filter)??[];
 const processed=data?.runs.some(run=>run.page===page);
 return <section className="requirements-section" aria-label="Requisitos rastreáveis">
  <div className="requirements-heading"><div><h2>Requisitos rastreáveis</h2><p>{data?`${data.runs.length}/${data.total_pages} páginas processadas por IA · ${data.requirements.length} requisitos registrados`:"Carregando requisitos…"}</p></div><div><button disabled={busy||!data?.ai_configured||pageStatus!=="text_extracted"||processed} onClick={extract}>{busy?"Aguarde…":processed?`Página ${page} já processada`:`Extrair requisitos da página ${page}`}</button><button className="secondary" disabled={busy||!data} onClick={()=>{setManual(true);setSelected(null);setTitle("");setCategory("technical");setExcerpt("");}}>Adicionar manualmente</button></div></div>
  <p className="notice">Análise parcial: cada extração usa somente a página selecionada. Requisitos podem depender de outras páginas ou anexos. A referência é conferida por correspondência textual; a interpretação exige revisão humana.</p>
  {data&&!data.ai_configured&&<p className="notice">A chave OpenRouter não está configurada no backend. Você pode registrar requisitos manualmente.</p>}
  {data?.ai_configured&&<p>Ao extrair, o texto desta página será enviado ao OpenRouter ({data.model}).</p>}
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  <label htmlFor="review-author">Responsável pela revisão</label><input id="review-author" className="field" value={author} onChange={e=>setAuthor(e.target.value)} maxLength={100} placeholder="Seu nome"/>
  <div className="requirement-layout"><div><label htmlFor="requirement-filter">Filtrar revisão</label><select id="requirement-filter" className="field" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(states).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select>
   {!filtered.length&&<p>Nenhum requisito neste filtro. Extraia a página selecionada ou adicione um requisito com fonte.</p>}
   {filtered.map(item=><button key={item.id} disabled={busy} className={`requirement-item ${selected?.id===item.id?"selected":""}`} onClick={()=>open(item)}><strong>{item.title}</strong><span>{categories[item.category]} · pág. {item.source.page} · {states[item.review_status]}</span><span>{item.origin==="ai"?"Sugestão de IA":"Registro manual"} · trecho localizado na fonte</span></button>)}
  </div><div className="card">
   {manual?<form onSubmit={saveManual}><h2>Novo requisito · página {page}</h2><label>Título<input className="field" value={title} onChange={e=>setTitle(e.target.value)} required minLength={5} maxLength={1000}/></label><label>Categoria<select className="field" value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>Trecho exato da página<textarea className="field" value={excerpt} onChange={e=>setExcerpt(e.target.value)} required minLength={15} maxLength={4000} rows={5}/></label><p>Copie um trecho contínuo do texto extraído. Não altere palavras ou quantidades.</p><button disabled={busy||author.trim().length<2}>Salvar requisito</button><details><summary>Consultar texto da página</summary><pre className="source-excerpt">{pageText}</pre></details></form>:
   selected?<><h2>Conferir e revisar</h2><p>{selected.source.filename} · página {selected.source.page}</p><blockquote className="source-excerpt">{selected.source.excerpt}</blockquote><button className="secondary" onClick={()=>onSource(selected.source.page,selected.source.excerpt)}>Conferir fonte na página {selected.source.page}</button><label>Requisito<input className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={1000}/></label><label>Categoria<select className="field" value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>Justificativa da revisão<textarea className="field" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label><div className="review-actions"><button disabled={busy} onClick={()=>review("confirmed")}>Confirmar</button><button disabled={busy} onClick={()=>review("corrected")}>Corrigir</button><button className="secondary" disabled={busy} onClick={()=>review("rejected")}>Rejeitar</button><button className="secondary" disabled={busy} onClick={()=>review("specialist_review")}>Pedir revisão especializada</button></div><details><summary>Histórico · versão {selected.version}</summary>{selected.history.map((event,index)=><p key={index}><strong>{event.author}</strong> · {event.action} · {new Date(event.at).toLocaleString("pt-BR")}<br/>{event.reason}{event.before&&<><br/>Antes: {event.before.title}<br/>Depois: {event.after?.title}</>}</p>)}</details></>:<p>Selecione um requisito para conferir a fonte e registrar sua revisão.</p>}
  </div></div>
 </section>;
}
