"use client";
import { useEffect, useRef, useState } from "react";
import Requirements from "./requirements";
type Summary = { id:string;filename:string;page_count:number;extracted_pages:number;ocr_pending_pages:number;failed_pages:number;coverage:string };
type Page = { page:number;text:string;status:string;warning:string|null };
type Document = Summary & {pages:Page[]};
async function readResponse(response:Response) {
 const result=await response.json();
 if(!response.ok)throw new Error(typeof result.detail === "string" ? result.detail : "Não foi possível concluir a operação.");
 return result;
}
export default function AnalysisWorkspace(){
 const [documents,setDocuments]=useState<Summary[]>([]);
 const [document,setDocument]=useState<Document|null>(null);
 const [page,setPage]=useState(1);
 const [sourceExcerpt,setSourceExcerpt]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const input=useRef<HTMLInputElement>(null);
 const selection=useRef(0);
 const sourcePanel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/documents",{signal:controller.signal,cache:"no-store"}).then(readResponse).then(setDocuments)
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[]);
 async function select(id:string){
  const current=++selection.current;
  setBusy(true);setError("");
  try{const result=await readResponse(await fetch(`/api/documents/${id}`,{cache:"no-store"}));if(current===selection.current){setDocument(result);setPage(1);setSourceExcerpt("");}}
  catch(e){if(current===selection.current)setError(e instanceof Error?e.message:"Falha ao abrir documento.");}
  finally{if(current===selection.current)setBusy(false);}
 }
 async function upload(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const file=input.current?.files?.[0];if(!file)return;
  setError("");if(file.size>20*1024*1024){setError("O limite é de 20 MB por arquivo.");return;}
  setBusy(true);++selection.current;
  try{
   const form=new FormData();form.append("file",file);
   const result:Document=await readResponse(await fetch("/api/documents",{method:"POST",body:form}));
   setDocument(result);setPage(1);setSourceExcerpt("");
   setDocuments(previous=>[result,...previous.filter(item=>item.id!==result.id)]);
   if(input.current)input.current.value="";
  }catch(e){setError(e instanceof TypeError ? "Falha de conexão durante o envio. Tente novamente." : e instanceof Error?e.message:"Falha ao enviar documento.");}finally{setBusy(false);}
 }
 const active=document?.pages[page-1];
 return <>
  <form className="card upload-form" onSubmit={upload}>
   <div><label htmlFor="pdf"><strong>Importar edital ou anexo</strong></label><p>PDF de até 20 MB e 200 páginas. Documentos ficam salvos para esta demonstração.</p><input ref={input} id="pdf" type="file" accept=".pdf,application/pdf" required disabled={busy}/></div>
   <button disabled={busy||loading} type="submit">{busy?"Processando…":"Enviar e extrair texto"}</button>
  </form>
  {error&&<p className="error" role="alert">{error}</p>}
  <div aria-live="polite" role="status">{busy&&<p>Processando documento. Aguarde a conclusão.</p>}{loading&&<p>Carregando documentos…</p>}</div>
  <section className="document-list" aria-label="Documentos importados">
   {documents.map(item=><button className={document?.id===item.id?"document-item selected":"document-item"} key={item.id} onClick={()=>select(item.id)} disabled={busy} aria-pressed={document?.id===item.id}><strong>{item.filename}</strong><span>{item.extracted_pages}/{item.page_count} páginas com texto · {item.ocr_pending_pages} com OCR pendente</span></button>)}
  </section>
  {!document&&!loading&&<section className="card"><h2>Selecione ou importe um documento</h2><p>O PDF e o texto extraído aparecerão lado a lado. Depois, extraia os requisitos da página selecionada e confira suas fontes.</p></section>}
  {document&&active&&<>
   <div className="notice"><strong>{document.extracted_pages} de {document.page_count} páginas com texto extraído.</strong> {document.coverage==="partial"?"Cobertura parcial: há páginas que exigem OCR ou revisão manual.":"A extração de texto não garante leitura correta de tabelas nem identificação de todas as exigências."} OCR ainda não executado. A cobertura de requisitos é informada abaixo.</div>
   <div className="page-controls" ref={sourcePanel}><label htmlFor="page">Página do arquivo PDF</label><select id="page" value={page} onChange={event=>{setPage(Number(event.target.value));setSourceExcerpt("");}}>{document.pages.map(item=><option value={item.page} key={item.page}>{item.page}{item.status!=="text_extracted"?" — revisão necessária":""}</option>)}</select><a href={`/api/documents/${document.id}/file#page=${page}`} target="_blank" rel="noreferrer">Abrir original em outra aba ↗</a></div>
   <div className="analysis-columns"><section className="card pdf-panel"><h2>Documento original</h2><iframe key={`${document.id}-${page}`} title={`${document.filename}, página ${page}`} src={`/api/documents/${document.id}/file#page=${page}`} /></section><section className="card text-panel"><h2>Texto extraído · página {page}</h2><p className="eyebrow">{active.status==="text_extracted"?"TEXTO NATIVO · NÃO REVISADO":active.status==="ocr_pending"?"OCR PENDENTE":"FALHA DE EXTRAÇÃO"}</p>{active.warning&&<p className="notice">{active.warning}</p>}{sourceExcerpt&&<blockquote className="source-excerpt"><strong>Trecho do requisito selecionado</strong><br/>{sourceExcerpt}</blockquote>}<pre>{active.text||"Nenhum texto utilizável extraído. Confira o documento original."}</pre></section></div>
  <Requirements key={document.id} documentId={document.id} page={page} pageText={active.text} pageStatus={active.status} onSource={(target,excerpt)=>{setPage(target);setSourceExcerpt(excerpt);sourcePanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}/>
  </>}
 </>;
}
