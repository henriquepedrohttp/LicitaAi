"use client";
import { useEffect, useState } from "react";
import CompanyComparison from "./company-comparison";
const categories:Record<string,string>={technical:"Técnica",financial:"Financeira",legal:"Jurídica",fiscal:"Fiscal",contractual:"Contratual",other:"Outra"};
const states:Record<string,string>={pending:"Pendente",confirmed:"Confirmado",corrected:"Corrigido",rejected:"Rejeitado",specialist_review:"Revisão especializada"};
type Requirement={stage:string;id:string;title:string;category:string;review_status:string;version:number;origin:string;model:string|null;source:{page:number;excerpt:string;filename:string;verified:boolean};history:Array<{action:string;author:string;at:string;reason?:string;before?:{title:string};after?:{title:string}}>};
type Data={requirements:Requirement[];runs:Array<{page:number;requirement_count:number}>;total_pages:number;ai_configured:boolean;model:string};
type Workflow={batch_pages:number;total_pages:number;blocked_pages:number[];snapshot:string;unresolved:number;conformity_complete:boolean;conformity_approved:boolean;stages:Record<string,{processed_pages:number;job:{status:string;current_page:number|null;current_page_end:number|null;error:string|null}|null}>};
async function result(response:Response){const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Confira os campos e tente novamente.");return data;}
export default function Requirements({documentId,page,pageText,pageStatus,onSource}:{documentId:string;page:number;pageText:string;pageStatus:string;onSource:(page:number,excerpt:string)=>void}){
 const [workflow,setWorkflow]=useState<Workflow|null>(null);
 const [stage,setStage]=useState("conformity");
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [author,setAuthor]=useState("");
 const [selected,setSelected]=useState<Requirement|null>(null);
 const [title,setTitle]=useState("");
 const [category,setCategory]=useState("technical");
 const [reason,setReason]=useState("");
 const [filter,setFilter]=useState("all");
 const [categoryFilter,setCategoryFilter]=useState("all");
 const [manual,setManual]=useState(false);
 const [excerpt,setExcerpt]=useState("");
 const [message,setMessage]=useState("");
 const base=`/api/documents/${documentId}`;
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const [requirements,analysis]=await Promise.all([
     fetch(`${base}/requirements`,{cache:"no-store",signal:controller.signal}).then(result),
     fetch(`${base}/analysis`,{cache:"no-store",signal:controller.signal}).then(result)
    ]);
    if(!controller.signal.aborted){setData(requirements);setWorkflow(analysis);}
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Falha ao atualizar análise.");}
  }
  void load();
  const timer=setInterval(()=>{void load();},4000);
  return ()=>{controller.abort();clearInterval(timer);};
 },[base]);
 async function refresh(){
  const [requirements,analysis]=await Promise.all([fetch(`${base}/requirements`,{cache:"no-store"}).then(result),fetch(`${base}/analysis`,{cache:"no-store"}).then(result)]);
  setData(requirements);setWorkflow(analysis);
 }
 function open(item:Requirement){setSelected(item);setTitle(item.title);setCategory(item.category);setReason("");setManual(false);onSource(item.source.page,item.source.excerpt);}
 async function extract(){
  setBusy(true);setError("");setMessage("");
  try{await result(await fetch(`${base}/analysis`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage})}));await refresh();setMessage("Análise solicitada. O sistema percorre o documento automaticamente; acompanhe o progresso abaixo. Você pode sair desta tela e voltar.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao iniciar análise.");}finally{setBusy(false);}
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
  try{const created=await result(await fetch(`${base}/requirements`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page,title,category,excerpt,author,stage})}));await refresh();open(created);setMessage("Requisito manual salvo. A origem foi conferida no texto da página.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao registrar.");}finally{setBusy(false);}
 }
 const stageRequirements=data?.requirements.filter(item=>item.stage===stage)??[];
 const filtered=stageRequirements.filter(item=>(filter==="all"||item.review_status===filter)&&(categoryFilter==="all"||item.category===categoryFilter));
 const categoryCounts=Object.fromEntries(Object.keys(categories).map(key=>[key,stageRequirements.filter(item=>item.category===key).length]));
 const current=workflow?.stages[stage];
 const running=current?.job?.status==="running";
 return <section className="requirements-section" aria-label="Análise do documento em etapas">
  <div className="requirements-heading"><div><h2>Análises independentes do documento</h2><p>Documentação e conformidade e requisitos do objeto/projeto podem ser analisados em qualquer ordem.</p></div></div>
  <div className="review-actions">{[["conformity","Documentação e conformidade"],["technical","Objeto e projeto"],["legacy","Extrações anteriores"]].map(([value,label])=><button key={value} className={stage===value?"":"secondary"} disabled={busy} aria-pressed={stage===value} onClick={()=>{setStage(value);setCategoryFilter("all");setFilter("all");setSelected(null);setManual(false);}}>{label}</button>)}</div>
  <p className="notice">A seleção da página serve apenas para consultar fontes ou incluir uma exigência manual. A análise automática percorre todas as páginas deste arquivo. Anexos em outros arquivos precisam de análise própria. A comparação com a empresa é uma avaliação separada da leitura do edital.</p>
  {stage!=="legacy"&&<>
   <h3>{stage==="conformity"?"Documentos, certidões, declarações e comprovações exigidas do licitante":"Funcionalidades, capacidades, entregáveis e critérios técnicos do objeto"}</h3>
   <p role="status">{current?.processed_pages??0}/{workflow?.total_pages??data?.total_pages??0} páginas analisadas nesta etapa. {running?`Processando páginas ${current?.job?.current_page??"…"} a ${current?.job?.current_page_end??current?.job?.current_page??"…"}.`:current?.job?.status==="completed"?"Leitura automática concluída; confira os resultados.":""}</p>
   {current?.job?.error&&<p className="notice">{current.job.error}</p>}
   {!!workflow?.blocked_pages.length&&<p className="notice">Cobertura incompleta: páginas {workflow.blocked_pages.join(", ")} precisam de OCR, revisão da extração ou divisão do conteúdo. A cobertura continua incompleta até resolver essas páginas.</p>}
   <div className="review-actions"><button disabled={busy||!data?.ai_configured||!workflow||current?.job?.status==="completed"} onClick={extract}>{current?.job?.status==="completed"?"Análise desta etapa concluída":running?"Retomar se o processamento foi interrompido":current?.processed_pages?"Continuar análise do documento":"Analisar documento inteiro"}</button><button className="secondary" disabled={busy||!data||pageStatus!=="text_extracted"} onClick={()=>{setManual(true);setSelected(null);setTitle("");setCategory(stage==="conformity"?"legal":"technical");setExcerpt("");}}>Adicionar manualmente</button></div>
   {data?.ai_configured&&<p>O texto das páginas será enviado ao OpenRouter ({data.model}), em lotes de até {workflow?.batch_pages??4} páginas por chamada. Páginas concluídas nesta etapa são reaproveitadas ao retomar.</p>}
   {stage==="conformity"&&<CompanyComparison documentId={documentId} onSource={onSource}/>}
  </>}
  {stage==="legacy"&&<p className="notice">Resultados anteriores foram preservados sem classificação de etapa. Eles permanecem disponíveis para consulta.</p>}
  {data&&!data.ai_configured&&<p className="notice">Configure a chave OpenRouter no backend para iniciar a análise.</p>}
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  <label htmlFor="review-author">Responsável pela revisão</label><input id="review-author" className="field" value={author} onChange={e=>setAuthor(e.target.value)} maxLength={100} placeholder="Seu nome"/>
  <div className="requirement-layout"><div>
   <label htmlFor="category-filter">Filtrar categoria</label><select id="category-filter" className="field" value={categoryFilter} disabled={busy} onChange={e=>{setCategoryFilter(e.target.value);setSelected(null);}}><option value="all">Todas as categorias ({stageRequirements.length})</option>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value} ({categoryCounts[key]})</option>)}</select>
   <label htmlFor="requirement-filter">Filtrar revisão</label><select id="requirement-filter" className="field" value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setSelected(null);}}><option value="all">Todos</option>{Object.entries(states).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select>
   <p role="status">Exibindo {filtered.length} de {stageRequirements.length} requisitos nesta etapa.</p>
   {(categoryFilter!=="all"||filter!=="all")&&<button className="secondary" disabled={busy} onClick={()=>{setCategoryFilter("all");setFilter("all");}}>Limpar filtros</button>}
   {!filtered.length&&<p>{stageRequirements.length?"Nenhum requisito corresponde aos filtros selecionados. Isso não comprova ausência dessa exigência no edital.":"Nenhum requisito registrado nesta etapa. Inicie a análise do documento ou acompanhe o progresso."}</p>}
   {filtered.map(item=><button key={item.id} disabled={busy} className={`requirement-item ${selected?.id===item.id?"selected":""}`} onClick={()=>open(item)}><strong>{item.title}</strong><span>{categories[item.category]} · pág. {item.source.page} · {states[item.review_status]}</span><span>{item.origin==="ai"?"Sugestão de IA":"Registro manual"} · trecho localizado na fonte</span></button>)}
  </div><div className="card">
   {manual?<form onSubmit={saveManual}><h2>Novo requisito · página {page}</h2><label>Título<input className="field" value={title} onChange={e=>setTitle(e.target.value)} required minLength={5} maxLength={1000}/></label><label>Categoria<select className="field" value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>Trecho exato da página<textarea className="field" value={excerpt} onChange={e=>setExcerpt(e.target.value)} required minLength={15} maxLength={4000} rows={5}/></label><p>Copie um trecho contínuo do texto extraído. Não altere palavras ou quantidades.</p><button disabled={busy||author.trim().length<2}>Salvar requisito</button><details><summary>Consultar texto da página</summary><pre className="source-excerpt">{pageText}</pre></details></form>:
   selected?<><h2>Fonte e interpretação do requisito</h2><p>{selected.source.filename} · página {selected.source.page}</p><blockquote className="source-excerpt">{selected.source.excerpt}</blockquote><button className="secondary" onClick={()=>onSource(selected.source.page,selected.source.excerpt)}>Conferir fonte na página {selected.source.page}</button><details><summary>Revisar interpretação da extração</summary><p>Estas ações corrigem a leitura do edital. Para avaliar a empresa, use a comparação documental acima.</p><label>Requisito<input className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={1000}/></label><label>Categoria<select className="field" value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>Justificativa da revisão<textarea className="field" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label><div className="review-actions"><button disabled={busy} onClick={()=>review("confirmed")}>Confirmar interpretação</button><button disabled={busy} onClick={()=>review("corrected")}>Corrigir extração</button><button className="secondary" disabled={busy} onClick={()=>review("rejected")}>Descartar sugestão</button><button className="secondary" disabled={busy} onClick={()=>review("specialist_review")}>Pedir revisão especializada</button></div></details><details><summary>Histórico · versão {selected.version}</summary>{selected.history.map((event,index)=><p key={index}><strong>{event.author}</strong> · {event.action} · {new Date(event.at).toLocaleString("pt-BR")}<br/>{event.reason}{event.before&&<><br/>Antes: {event.before.title}<br/>Depois: {event.after?.title}</>}</p>)}</details></>:<p>Selecione um requisito para conferir a fonte e registrar sua revisão.</p>}
  </div></div>
 </section>;
}
