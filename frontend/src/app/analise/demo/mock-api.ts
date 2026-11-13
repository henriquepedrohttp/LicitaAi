import edital from '../../demo/edital.json';
import { demoAvaliacao, demoEvidencias } from '../../elegibilidade/demo/example';

// API simulada no navegador para a demo do pitch: responde às mesmas rotas do backend
// (/api/documents e /api/companies) com o edital fictício. Recarregar a página restaura o cenário.

const MODEL = 'qwen/qwen3.8-27b';
const BATCH = 4;
export const BATCH_MS = 3500;
const COMPANY = { id: '00000000-0000-4000-8000-0000000a0001', name: 'Aurora Tecnologia e Soluções Digitais Ltda.', demo: true };

type Stage = 'conformity' | 'technical';
type Requirement = { stage: string; id: string; title: string; category: string; review_status: string; version: number; origin: string; model: string | null;
  source: { page: number; excerpt: string; filename: string; verified: boolean }; history: { action: string; author: string; at: string; reason?: string; before?: { title: string }; after?: { title: string } }[] };
type Assessment = { status: string; author: string; reason: string; evidence_id: string | null; effort: string; estimated_days: number | null; estimated_cost: number | null };

const pages = edital.paginas.map((lines, i) => ({ page: i + 1, text: lines.join('\n'), status: 'text_extracted', warning: null }));
const summary = { id: edital.id, filename: edital.arquivo, page_count: pages.length, extracted_pages: pages.length, ocr_pending_pages: 0, failed_pages: 0, coverage: 'native_text_extracted' };
const normal = (s: string) => s.replace(/\s+/g, ' ').trim();
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export function createDemoApi(now: () => number = Date.now) {
  const jobs: Partial<Record<Stage, number>> = {};
  const edits = new Map<string, Requirement>();
  const manual: Requirement[] = [];
  const assessments = new Map<string, { assessment: Assessment; created_at: string }[]>();
  let next = 100;

  const processed = (stage: Stage) => {
    const start = jobs[stage];
    if (start === undefined) return 0;
    return Math.min(pages.length, Math.floor((now() - start) / BATCH_MS) * BATCH);
  };
  const aiRequirements = (): Requirement[] => edital.requisitos.map((r, i) => ({
    stage: r.etapa, id: uuid(i + 1), title: r.titulo, category: r.categoria, review_status: 'pending', version: 1, origin: 'ai', model: MODEL,
    source: { page: r.pagina, excerpt: r.trecho, filename: edital.arquivo, verified: true }, history: [],
  })).filter(r => r.source.page <= processed(r.stage as Stage)).map(r => edits.get(r.id) ?? r);
  const requirements = () => [...aiRequirements(), ...manual.map(r => edits.get(r.id) ?? r)];

  const job = (stage: Stage) => {
    if (jobs[stage] === undefined) return null;
    const done = processed(stage);
    if (done >= pages.length) return { status: 'completed', current_page: null, current_page_end: null, error: null };
    return { status: 'running', current_page: done + 1, current_page_end: Math.min(done + BATCH, pages.length), error: null };
  };
  const workflow = () => {
    const conformity = requirements().filter(r => r.stage === 'conformity');
    return { batch_pages: BATCH, total_pages: pages.length, blocked_pages: [], snapshot: 'demo', approval: null,
      unresolved: conformity.filter(r => !['confirmed', 'corrected', 'rejected'].includes(r.review_status)).length,
      conformity_complete: processed('conformity') === pages.length, conformity_approved: false,
      stages: Object.fromEntries((['conformity', 'technical'] as Stage[]).map(s => [s, { processed_pages: processed(s), job: job(s) }])) };
  };

  const evidence = demoEvidencias.map(e => ({ id: e.id, title: e.titulo, kind: e.tipo, demo: true, valid_until: e.validade, filename: null,
    text: `${e.titulo} (documento fictício da demonstração). Validade informada: ${e.validade ?? 'não se aplica'}.` }));
  const automatic = (r: Requirement) => {
    const item = demoAvaliacao.itens.find(i => i.requisito.source.excerpt === r.source.excerpt);
    const ids = item?.evidencias.map(e => e.documento_id) ?? [];
    if (item?.estado === 'nao_atendido') return { status: 'incompatibility', reason: item.justificativa, evidence_ids: ids };
    if (ids.length) return { status: 'needs_validation', reason: 'Documento candidato encontrado pelo tipo documental. Confira o conteúdo antes de concluir.', evidence_ids: ids };
    return { status: 'needs_validation', reason: 'Nenhum documento do tipo exigido foi localizado no cadastro. Ausência de evidência não é descumprimento.', evidence_ids: [] };
  };
  const comparison = () => ({
    company: COMPANY, reference_date: new Date(now()).toISOString().slice(0, 10), evidence,
    method: 'Triagem por tipo documental e validade informados no cadastro; não há validação semântica automática do conteúdo.',
    results: requirements().filter(r => r.stage === 'conformity' && r.review_status !== 'rejected').map(r => {
      const history = assessments.get(r.id) ?? [];
      return { requirement_id: r.id, title: r.title, page: r.source.page, excerpt: r.source.excerpt, snapshot: `v${r.version}`,
        automatic: automatic(r), assessment: history[0]?.assessment ?? null, assessment_stale: false, history };
    }),
  });

  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const fail = (detail: string, status = 422) => json({ detail }, status);

  return async function handle(path: string, method: string, body: unknown): Promise<Response> {
    const b = (body ?? {}) as Record<string, unknown>;
    const parts = path.split('/').filter(Boolean).slice(1); // remove "api"
    const [area, id, sub, sub2, sub3] = parts;
    await new Promise(r => setTimeout(r, 250)); // latência perceptível, como na API real

    if (area === 'documents') {
      if (!id) return method === 'POST' ? fail('Modo demonstração: use o edital de exemplo já importado. Para enviar PDFs reais, abra Análise com dados reais.', 409) : json([summary]);
      if (id !== edital.id) return fail('Documento não encontrado.', 404);
      if (!sub) return json({ ...summary, sha256: edital.sha256, pages });
      if (sub === 'analysis' && !sub2) {
        if (method === 'POST') {
          const stage = b.stage as Stage;
          if (stage !== 'conformity' && stage !== 'technical') return fail('Etapa inválida.');
          if (jobs[stage] === undefined) jobs[stage] = now();
          return json({ stage, status: 'requested' }, 202);
        }
        return json(workflow());
      }
      if (sub === 'requirements' && !sub2) {
        if (method === 'POST') {
          const page = pages[Number(b.page) - 1];
          const excerpt = String(b.excerpt ?? '');
          if (!page) return fail('Página inválida.');
          if (String(b.author ?? '').trim().length < 2) return fail('Informe o responsável.');
          if (String(b.title ?? '').trim().length < 5) return fail('O título precisa ter pelo menos 5 caracteres.');
          if (normal(excerpt).length < 15 || !normal(page.text).includes(normal(excerpt))) return fail(`O trecho não foi encontrado na página ${page.page}. Copie um trecho contínuo do texto extraído.`);
          const created: Requirement = { stage: String(b.stage), id: uuid(next++), title: String(b.title).trim(), category: String(b.category), review_status: 'pending',
            version: 1, origin: 'manual', model: null, source: { page: page.page, excerpt, filename: edital.arquivo, verified: true },
            history: [{ action: 'created', author: String(b.author).trim(), at: new Date(now()).toISOString(), reason: 'Registro manual' }] };
          manual.push(created);
          return json(created, 201);
        }
        return json({ requirements: requirements(), runs: [], total_pages: pages.length, ai_configured: true, model: MODEL });
      }
      if (sub === 'requirements' && sub3 === 'review') {
        const current = requirements().find(r => r.id === sub2);
        if (!current) return fail('Requisito não encontrado.', 404);
        if (String(b.author ?? '').trim().length < 2 || String(b.reason ?? '').trim().length < 3) return fail('Informe seu nome e uma justificativa para registrar a revisão.');
        if (b.expected_version !== current.version) return fail('Este requisito foi alterado por outra pessoa. Recarregue antes de revisar.', 409);
        const title = String(b.title ?? current.title).trim();
        const updated: Requirement = { ...current, title, category: String(b.category ?? current.category), review_status: String(b.status), version: current.version + 1,
          history: [...current.history, { action: String(b.status), author: String(b.author).trim(), at: new Date(now()).toISOString(), reason: String(b.reason).trim(),
            ...(title !== current.title ? { before: { title: current.title }, after: { title } } : {}) }] };
        edits.set(updated.id, updated);
        return json(updated);
      }
      return fail('Rota indisponível na demonstração.', 404);
    }

    if (area === 'companies') {
      if (!id) return json({ companies: [COMPANY] });
      if (id !== COMPANY.id) return fail('Empresa não encontrada.', 404);
      if (sub === 'comparison' && sub2 === edital.id) return json(comparison());
      if (sub === 'assessments' && sub2 && method === 'POST') {
        const status = String(b.status);
        if (String(b.author ?? '').trim().length < 2 || String(b.reason ?? '').trim().length < 3) return fail('Informe responsável e justificativa.');
        if (status === 'conforming' && !b.evidence_id) return fail('Selecione a evidência que comprova a conformidade.');
        const entry = { assessment: { status, author: String(b.author).trim(), reason: String(b.reason).trim(), evidence_id: (b.evidence_id as string) || null,
          effort: String(b.effort ?? ''), estimated_days: (b.estimated_days as number) ?? null, estimated_cost: (b.estimated_cost as number) ?? null }, created_at: new Date(now()).toISOString() };
        assessments.set(sub2, [entry, ...(assessments.get(sub2) ?? [])]);
        return json(entry.assessment, 201);
      }
      return fail('Rota indisponível na demonstração.', 404);
    }
    return fail('Rota indisponível na demonstração.', 404);
  };
}

let installs = 0;
let original: typeof fetch | null = null;
const api = createDemoApi();

/** Intercepta fetch para /api/documents e /api/companies enquanto a demo da Análise estiver montada. Idempotente por contagem. */
export function installDemoFetch() {
  if (typeof window === 'undefined') return () => {};
  if (installs++ === 0) {
    original = window.fetch;
    const real = original;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
      if (url.origin !== window.location.origin || !/^\/api\/(documents|companies)(\/|$)/.test(url.pathname)) return real(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      let body: unknown = null;
      if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = null; } }
      return api(url.pathname, method, body);
    };
  }
  let done = false;
  return () => { if (done) return; done = true; if (--installs === 0 && original) { window.fetch = original; original = null; } };
}

// A instalação feita na renderização (antes dos efeitos dos filhos) é única e entregue ao efeito do componente.
let renderRelease: (() => void) | null = null;
export function ensureDemoFetch() { if (!renderRelease) renderRelease = installDemoFetch(); }
export function holdDemoFetch() {
  const release = installDemoFetch();
  renderRelease?.(); renderRelease = null;
  return release;
}
