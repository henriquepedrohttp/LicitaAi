'use client';
import { useState } from 'react';
import { empresasRequest, useAccess } from './access';
import { documentTypes, type Evidence } from './contracts';

export function Documents({ id, documents, reload }: { id: string; documents: Evidence[]; reload: () => Promise<void> }) {
  const { key } = useAccess();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState<Evidence>();
  const [preview, setPreview] = useState<Blob>();
  const [deleting, setDeleting] = useState<Evidence>();
  const [history, setHistory] = useState(false);
  async function operation(action: () => Promise<void>) {
    setError(''); setBusy(true);
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.'); } finally { setBusy(false); }
  }
  return <section><h2>Documentos e evidências</h2><p>PDF de até 10 MiB. O envio registra uma evidência não verificada. Validade é informada pelo usuário; não confirma autenticidade ou atendimento a um edital.</p>
    {error && <p className="alert" role="alert">{error}</p>}
    <form className="card" key={previous?.id ?? 'new'} onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      void operation(async () => {
        const file = data.get('arquivo') as File;
        if (!file?.size || file.size > 10 * 1024 * 1024 || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecione um arquivo PDF de até 10 MiB.');
        const query = new URLSearchParams({ tipo: String(data.get('tipo')) });
        if (data.get('validade')) query.set('validade', String(data.get('validade')));
        if (previous) query.set('anterior_id', previous.id);
        await empresasRequest(key, `/${id}/documentos?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Document-Title': encodeURIComponent(String(data.get('titulo'))) }, body: file });
        form.reset(); setPrevious(undefined); await reload();
      });
    }}><fieldset disabled={busy}><legend>{previous ? `Nova versão de ${previous.titulo}` : 'Enviar documento'}</legend><div className="fields">
      <label>Título do documento<input name="titulo" required maxLength={200} defaultValue={previous?.titulo} /></label>
      <label>Tipo documental<select name="tipo" defaultValue={previous?.tipo ?? 'juridico'}>{Object.entries(documentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Validade informada (opcional)<input name="validade" type="date" /></label>
      <label>Arquivo PDF<input name="arquivo" type="file" accept="application/pdf,.pdf" required /></label>
    </div><div className="actions"><button>{busy ? 'Enviando…' : previous ? 'Enviar nova versão' : 'Enviar PDF'}</button>{previous && <button type="button" className="secondary" onClick={() => setPrevious(undefined)}>Cancelar substituição</button>}</div></fieldset></form>
    {preview && <div className="card"><p>Arquivo recebido com autorização. A prévia não verifica o conteúdo.</p><button onClick={() => {
      const url = URL.createObjectURL(preview); const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); setPreview(undefined);
    }}>Abrir prévia em outra aba</button><button className="secondary" onClick={() => setPreview(undefined)}>Fechar prévia</button></div>}
    {deleting && <section className="card" aria-label="Confirmar exclusão"><h3>Excluir {deleting.titulo}, versão {deleting.versao}?</h3><p>Os bytes desta versão serão apagados. O registro de envio e exclusão será mantido; outras versões permanecem disponíveis.</p><div className="actions"><button className="danger" disabled={busy} onClick={() => void operation(async () => { await empresasRequest(key, `/${id}/documentos/${deleting.id}`, { method: 'DELETE' }); setDeleting(undefined); await reload(); })}>Confirmar exclusão definitiva do arquivo</button><button className="secondary" disabled={busy} onClick={() => setDeleting(undefined)}>Cancelar</button></div></section>}
    <label><span>Histórico documental</span><select value={history ? 'todas' : 'atuais'} onChange={e => setHistory(e.target.value === 'todas')}><option value="atuais">Somente versões atuais</option><option value="todas">Todas as versões e exclusões</option></select></label>
    {!documents.some(doc => doc.atual && !doc.excluido_em) && <p className="notice">Nenhum documento atual disponível. Ausência de evidência significa não verificado.</p>}
    {documents.filter(doc => history || doc.atual && !doc.excluido_em).map(doc => <article className="card" key={doc.id}><span className="badge">{doc.excluido_em ? 'Arquivo excluído' : 'Não verificado'} · {doc.atual ? 'Atual' : 'Histórico'}</span><h3>{doc.titulo} · v{doc.versao}</h3>
      <p>{documentTypes[doc.tipo]} · Enviado em {new Date(doc.enviado_em).toLocaleString('pt-BR')} · {(doc.tamanho / 1024).toFixed(1)} KiB</p>
      <p>{doc.validade ? `Validade informada: ${doc.validade.split('-').reverse().join('/')}${doc.vencido ? ' · Vencida' : ''}` : 'Validade não informada'}</p>
      <details><summary>Rastreabilidade</summary><p>ID: {doc.id}<br />SHA-256: {doc.sha256}<br />Versão anterior: {doc.anterior_id ?? 'Não se aplica'}</p></details>
      {!doc.excluido_em && <div className="actions"><button className="secondary" disabled={busy} onClick={() => void operation(async () => { const response = await empresasRequest(key, doc.referencia.replace('/api/empresas', '')); setPreview(await response.blob()); })}>Visualizar PDF</button>
        <button className="secondary" disabled={busy} onClick={() => void operation(async () => {
          const response = await empresasRequest(key, `${doc.referencia.replace('/api/empresas', '')}?download=true`);
          const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `documento-${doc.id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        })}>Baixar PDF</button>{doc.atual && <button className="secondary" disabled={busy} onClick={() => { setPrevious(doc); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Substituir por nova versão</button>}
        <button className="danger" disabled={busy} onClick={() => setDeleting(doc)}>Excluir arquivo</button></div>}
    </article>)}
  </section>;
}
