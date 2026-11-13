'use client';
import { useState } from 'react';

const opcoes = ['Participar', 'Participar com ressalvas', 'Não participar'] as const;
type Registro = { opcao: string; autor: string; justificativa: string; em: string };
type Erros = Partial<Record<'opcao' | 'autor' | 'justificativa', string>>;

export function Imprimir() {
  return <button type="button" onClick={() => window.print()}>Imprimir relatório</button>;
}

/** Registro Go/No-Go só no navegador: nada é salvo no servidor; recarregar apaga. */
export default function Decisao() {
  const [historico, setHistorico] = useState<Registro[]>([]);
  const [editando, setEditando] = useState(true);
  const [opcao, setOpcao] = useState('');
  const [autor, setAutor] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const atual = historico.at(-1);

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    const novos: Erros = {};
    if (!opcao) novos.opcao = 'Escolha uma decisão.';
    if (!autor.trim()) novos.autor = 'Informe o nome de quem decide.';
    if (justificativa.trim().length < 3) novos.justificativa = 'Escreva uma justificativa com pelo menos 3 caracteres.';
    setErros(novos);
    if (Object.keys(novos).length) return;
    const em = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });
    setHistorico(h => [...h, { opcao, autor: autor.trim(), justificativa: justificativa.trim(), em }]);
    setEditando(false);
  }

  const erro = (campo: keyof Erros) => erros[campo] && <span id={`rel-erro-${campo}`} className="rel-erro">{erros[campo]}</span>;

  return <section className="card" aria-labelledby="rel-decisao">
    <h2 id="rel-decisao">Decisão: participar ou não?</h2>
    <div role="status" aria-live="polite">{atual && <div className="rel-registro">
      <p><strong>Decisão registrada: {atual.opcao}</strong></p>
      <p>{atual.justificativa}</p>
      <p className="rel-nota">Por {atual.autor} em {atual.em} (horário de Recife).</p>
    </div>}</div>
    {atual && !editando && <button type="button" className="secondary rel-sem-margem" onClick={() => setEditando(true)}>Alterar decisão</button>}
    {editando && <form onSubmit={salvar} noValidate className="rel-form">
      <fieldset aria-describedby={erros.opcao ? 'rel-erro-opcao' : undefined}>
        <legend>Escolha uma opção</legend>
        {opcoes.map(o => <label key={o} className="rel-opcao"><input type="radio" name="opcao" value={o} checked={opcao === o} onChange={() => setOpcao(o)} /> {o}</label>)}
        {erro('opcao')}
      </fieldset>
      <label>Responsável pela decisão
        <input className="field" value={autor} onChange={e => setAutor(e.target.value)} aria-invalid={!!erros.autor} aria-describedby={erros.autor ? 'rel-erro-autor' : undefined} autoComplete="name" />
      </label>
      {erro('autor')}
      <label>Justificativa
        <textarea className="field" rows={3} value={justificativa} onChange={e => setJustificativa(e.target.value)} aria-invalid={!!erros.justificativa} aria-describedby={erros.justificativa ? 'rel-erro-justificativa' : undefined} />
      </label>
      {erro('justificativa')}
      <div className="review-actions">
        <button type="submit">Registrar decisão</button>
        {atual && <button type="button" className="secondary" onClick={() => { setEditando(false); setErros({}); }}>Cancelar</button>}
      </div>
    </form>}
    {historico.length > 1 && <details className="rel-historico"><summary>Decisões anteriores ({historico.length - 1})</summary>
      <ol>{historico.slice(0, -1).reverse().map((h, n) => <li key={n}><strong>{h.opcao}</strong> · {h.autor} · {h.em}<br />{h.justificativa}</li>)}</ol>
    </details>}
  </section>;
}
