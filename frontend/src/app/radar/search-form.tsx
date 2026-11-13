"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
const ufs = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const modalities = ["Leilão eletrônico", "Diálogo competitivo", "Concurso", "Concorrência eletrônica", "Concorrência presencial", "Pregão eletrônico", "Pregão presencial", "Dispensa", "Inexigibilidade", "Manifestação de interesse", "Pré-qualificação", "Credenciamento", "Leilão presencial"];
export default function SearchForm({ values }: { values: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <form className="card radar-filters" aria-label="Filtros do Radar" aria-busy={pending} action="/radar" onSubmit={event => {
    event.preventDefault();
    const query = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => query.set(key, String(value)));
    startTransition(() => router.push(`/radar?${query}`));
  }}>
    <fieldset disabled={pending}><legend>Consultar publicações oficiais</legend><div className="radar-fields">
      <label>UF<select name="uf" defaultValue={values.uf}><option value="">Todo o Brasil</option>{ufs.map(uf => <option key={uf}>{uf}</option>)}</select></label>
      <label>Município (código IBGE)<input name="municipio" defaultValue={values.municipio} inputMode="numeric" pattern="[0-9]{7}" placeholder="Ex.: 2611606" /></label>
      <label>Modalidade<select name="modalidade" defaultValue={values.modalidade}>{modalities.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select></label>
      <label>Publicado de<input type="date" name="inicio" required defaultValue={values.inicio} /></label>
      <label>Publicado até<input type="date" name="fim" required defaultValue={values.fim} /></label>
      <label>Por página<select name="tamanho" defaultValue={values.tamanho}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label>
    </div></fieldset>
    <details className="radar-refinements" open={Boolean(values.palavra || values.situacao || values.minimo || values.maximo)}><summary>Refinar esta página <span>Palavra-chave, situação e valores</span></summary><fieldset disabled={pending} aria-describedby="page-scope"><legend className="radar-sr-only">Refinar a página consultada</legend><p id="page-scope">Palavra-chave, situação, valores e ordenação afetam somente os registros desta página. Explore as demais páginas para ampliar a triagem.</p><div className="radar-fields">
      <label>Palavra-chave no objeto<input name="palavra" defaultValue={values.palavra} maxLength={200} placeholder="Ex.: software" /></label>
      <label>Situação oficial<select name="situacao" defaultValue={values.situacao}><option value="">Todas</option><option value="1">Divulgada no PNCP</option><option value="2">Revogada</option><option value="3">Anulada</option><option value="4">Suspensa</option></select></label>
      <label>Valor mínimo (R$)<input name="minimo" type="number" min="0" step="0.0001" defaultValue={values.minimo} /></label>
      <label>Valor máximo (R$)<input name="maximo" type="number" min="0" step="0.0001" defaultValue={values.maximo} /></label>
      <label>Ordenar nesta página<select name="ordem" defaultValue={values.ordem}><option value="publicacao">Publicação mais recente</option><option value="prazo">Encerramento mais próximo</option><option value="maior">Maior valor estimado</option><option value="menor">Menor valor estimado</option></select></label>
    </div></fieldset></details>
    <div className="radar-actions"><button type="submit" disabled={pending}>{pending ? "Consultando PNCP…" : "Pesquisar oportunidades"}</button><Link href="/radar">Limpar filtros</Link></div>
    {pending && <p role="status">Busca em andamento. Aguarde a resposta da fonte oficial.</p>}
  </form>;
}
