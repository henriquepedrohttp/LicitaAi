'use client';
import Link from 'next/link';
import { useState } from 'react';
import { filtrar, filtrosVazios, type Avaliacao, type Filtros } from '../contracts';
import { Cabecalho, Detalhe, FiltrosForm, Matriz, Resumo } from '../workspace';
import { demoAvaliacao, demoEvidencias, revisarDemo } from './example';
import edital from '../../demo/edital.json';

/** Matriz de Elegibilidade para o pitch: dados fictícios, sem backend e sem chave. Recarregar restaura o cenário. */
export default function DemoElegibilidade() {
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(filtrosVazios);
  const [selecionado, setSelecionado] = useState('');
  const [autor, setAutor] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  function comparar(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setErro(''); setMensagem('');
    // Pausa curta para a plateia ver o processamento; os dados já estão no navegador.
    window.setTimeout(() => {
      setAvaliacao(atual => atual ?? structuredClone(demoAvaliacao));
      setBusy(false);
      setMensagem(`Matriz atualizada com ${demoAvaliacao.itens.length} requisito(s). Revisões humanas anteriores foram preservadas.`);
    }, 1200);
  }

  function reiniciar() {
    setAvaliacao(null); setFiltros(filtrosVazios); setSelecionado(''); setErro(''); setMensagem('');
  }

  const visiveis = avaliacao ? filtrar(avaliacao.itens, filtros) : [];
  const atual = avaliacao?.itens.find(i => i.id === selecionado);
  const indice = visiveis.findIndex(i => i.id === selecionado);

  function salvar(acao: string, extra: Record<string, unknown>, justificativa: string) {
    if (!avaliacao || !atual) return;
    if (autor.trim().length < 2 || justificativa.trim().length < 3) { setErro('Informe o responsável e uma justificativa (mínimo 3 caracteres).'); return; }
    const item = revisarDemo(atual, acao, autor.trim(), justificativa.trim(), extra);
    setAvaliacao({ ...avaliacao, atualizada_em: new Date().toISOString(), itens: avaliacao.itens.map(i => i.id === item.id ? item : i) });
    setErro('');
    setMensagem(`Revisão salva por ${autor.trim()} às ${new Date().toLocaleTimeString('pt-BR')}. Histórico atualizado.`);
  }

  return <>
    <p className="notice">Demonstração com dados fictícios: edital, empresa e documentos são ilustrativos e nada é enviado ao servidor. Recarregue a página para recomeçar. Para dados reais, use a <Link href="/elegibilidade/matriz">matriz com chave de acesso</Link>.</p>
    <form className="card eleg-selecao" onSubmit={comparar}>
      <label>Oportunidade (edital importado na Análise)<select value="edital" disabled><option value="edital">{demoAvaliacao.documento_nome} · 8/8 páginas com texto</option></select></label>
      <label>Empresa<select value="empresa" disabled><option value="empresa">{demoAvaliacao.empresa_nome} · {demoAvaliacao.empresa_cnpj}</option></select></label>
      <label>Número de controle PNCP (opcional)<input value={demoAvaliacao.oportunidade_pncp ?? ''} readOnly /></label>
      <button disabled={busy}>{busy ? 'Comparando…' : avaliacao ? 'Atualizar comparação' : 'Comparar requisitos'}</button>
    </form>
    <div role="status" aria-live="polite">{busy && <p>Comparando {demoAvaliacao.itens.length} requisitos do edital com {demoEvidencias.length} documentos da empresa…</p>}{mensagem && <p className="eleg-ok">{mensagem}</p>}</div>
    {erro && <p className="error" role="alert">{erro}</p>}
    {!avaliacao && !busy && <section className="card"><h2>Pronto para comparar</h2><p>Edital e empresa já estão selecionados. Clique em “Comparar requisitos” para cruzar cada exigência do edital com os documentos da empresa.</p></section>}
    {avaliacao && <>
      <Cabecalho avaliacao={avaliacao} />
      <ul className="notice eleg-avisos">{avaliacao.avisos.map(a => <li key={a}>{a}</li>)}</ul>
      <Resumo itens={avaliacao.itens} />
      <FiltrosForm filtros={filtros} onChange={setFiltros} />
      <p className="eleg-contagem">{visiveis.length} de {avaliacao.itens.length} requisito(s) exibido(s) · <button type="button" className="secondary" style={{ margin: 0 }} onClick={reiniciar}>Reiniciar demonstração</button></p>
      <div className={atual ? 'eleg-workspace com-detalhe' : 'eleg-workspace'}>
        <Matriz itens={visiveis} selecionado={selecionado} onSelect={setSelecionado} />
        {atual && <Detalhe key={`${atual.id}-${atual.versao}`} item={atual} documentos={demoEvidencias} busy={busy} autor={autor} onAutor={setAutor}
          onSave={salvar} onClose={() => setSelecionado('')} urlFonte={edital.pdf} posicao={indice >= 0 ? `${indice + 1} de ${visiveis.length}` : 'Fora do filtro atual'}
          onMove={passo => visiveis.length && setSelecionado(visiveis[(Math.max(indice, 0) + passo + visiveis.length) % visiveis.length].id)} />}
      </div>
    </>}
  </>;
}
