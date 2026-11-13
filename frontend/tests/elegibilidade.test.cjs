/* eslint-disable @typescript-eslint/no-require-imports -- Mesmo runner nativo usado pelos testes do Radar e de Empresas. */
// Todos os dados abaixo são fixtures fictícias de teste.
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.css'] = () => {};

const { filtrar, resumo, filtrosVazios } = require('../src/app/elegibilidade/contracts.ts');
const { api, Cabecalho, Resumo, FiltrosForm, Matriz, Detalhe } = require('../src/app/elegibilidade/workspace.tsx');
const Page = require('../src/app/elegibilidade/page.tsx').default;
const proxy = require('../src/app/api/elegibilidade/[[...path]]/route.ts');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const render = element => renderToStaticMarkup(element);
const UUID = '00000000-0000-0000-0000-00000000000';

function item(n, extra = {}) {
  return { id: UUID + n, categoria: 'fiscal_social_trabalhista', categoria_original: 'fiscal', estado: 'nao_verificado', origem_estado: 'automatico',
    justificativa: 'Nenhum documento atual da categoria. Ausência de evidência é informação insuficiente.', evidencias: [], criticidade: null,
    revisado: false, reconferir: null, versao: 1, observacoes: [], historico: [{ acao: 'avaliacao_automatica', autor: 'sistema', justificativa: 'Inicial', em: '2026-11-13T12:00:00Z', antes: null, depois: { estado: 'nao_verificado' } }],
    requisito: { id: `aaaaaaaa-0000-0000-0000-00000000000${n}`, title: `Certidão de teste ${n} <b>`, category: 'fiscal', review_status: 'pending', version: 1,
      source: { document_id: UUID + '9', filename: 'edital-ficticio.pdf', sha256: 'a'.repeat(64), page: 3, excerpt: 'Trecho original fictício 720 h/mês', verified: true } },
    automatico: { estado: 'nao_verificado', justificativa: 'x', regra: 'sem_documento', metodo: 'regra_deterministica', incertezas: ['Capacidades declaradas não são evidência documental.'],
      quantidades: [{ valor: '720', unidade: 'h/mês', texto: '720 h/mês' }], declaracoes_relacionadas: ['Streaming declarado'], evidencias: [] },
    ...extra };
}
const itens = [item(1), item(2, { estado: 'atendido_preliminarmente', revisado: true, origem_estado: 'humano', criticidade: 'alta', categoria: 'qualificacao_tecnica' }),
  item(3, { estado: 'nao_atendido', revisado: true, reconferir: 'Perfil mudou' }), item(4, { estado: 'revisao_especializada' })];

test('filtros por categoria, estado, criticidade e revisão (reconferir conta como pendente)', () => {
  assert.equal(filtrar(itens, filtrosVazios).length, 4);
  assert.deepEqual(filtrar(itens, { ...filtrosVazios, categoria: 'qualificacao_tecnica' }).map(i => i.id), [UUID + 2]);
  assert.deepEqual(filtrar(itens, { ...filtrosVazios, estado: 'nao_atendido' }).map(i => i.id), [UUID + 3]);
  assert.equal(filtrar(itens, { ...filtrosVazios, criticidade: 'nao_informada' }).length, 3);
  assert.deepEqual(filtrar(itens, { ...filtrosVazios, revisao: 'revisados' }).map(i => i.id), [UUID + 2]);
  assert.deepEqual(filtrar(itens, { ...filtrosVazios, revisao: 'pendentes' }).map(i => i.id), [UUID + 1, UUID + 3, UUID + 4]);
  assert.deepEqual(resumo(itens), { total: 4, atendido_preliminarmente: 1, nao_atendido: 1, nao_verificado: 1, revisao_especializada: 1, pendentes: 3 });
});

test('matriz exibe colunas, fonte, estados e escapa texto; vazio orienta a limpar filtros', () => {
  const html = render(React.createElement(Matriz, { itens, selecionado: UUID + 2, onSelect: () => {} }));
  for (const coluna of ['Requisito', 'Categoria', 'Descrição', 'Fonte no edital', 'Evidências da empresa', 'Estado', 'Justificativa', 'Ações']) assert.match(html, new RegExp(`<th scope="col">${coluna}</th>`));
  assert.match(html, /role="region" aria-label="Matriz de elegibilidade" tabindex="0"/);
  assert.match(html, /edital-ficticio\.pdf<small>pág\. 3/);
  assert.match(html, /Não verificado/); assert.match(html, /Revisado por analista/); assert.match(html, /reconferir/);
  assert.match(html, /aria-selected="true"/); assert.match(html, /aria-label="Revisar requisito R1"/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(render(React.createElement(Matriz, { itens: [], onSelect: () => {} })), /Limpe os filtros/);
});

test('detalhe mostra origem, interpretação, incertezas, evidências e histórico, com campos rotulados', () => {
  const html = render(React.createElement(Detalhe, { item: item(1), documentos: [{ id: 'd1', titulo: 'CRF fictícia', validade: null, vencido: false }], busy: false, autor: '',
    onAutor: () => {}, onSave: () => {}, onClose: () => {}, onMove: () => {}, posicao: '1 de 4' }));
  assert.match(html, /Texto original/); assert.match(html, /Trecho original fictício 720 h\/mês/);
  assert.match(html, /href="\/api\/documents\/0{8}-0{4}-0{4}-0{4}-0{11}9\/file#page=3"/);
  assert.match(html, /cláusula não informada pela Análise/);
  assert.match(html, /720 h\/mês \(sem comparador inferido\)/);
  assert.match(html, /não são evidência/);
  assert.match(html, /Nenhuma evidência associada/);
  assert.match(html, /Histórico de revisão · versão 1/);
  for (const rotulo of ['Responsável', 'Justificativa ou observação', 'Corrigir estado', 'Criticidade', 'Associar evidências da empresa']) assert.match(html, new RegExp(rotulo));
  for (const acao of ['Confirmar conclusão', 'Marcar revisão especializada', 'Adicionar observação', 'Salvar correção', 'Definir criticidade', 'Salvar evidências']) assert.match(html, new RegExp(acao));
  assert.match(html, /aria-label="Próximo requisito"/);
  assert.match(html, /<button type="button" class="secondary" disabled="">Salvar correção/);  // sem mudança de estado
});

test('cabeçalho, resumo e filtros acessíveis; PNCP ausente aparece como Não informado', () => {
  const html = render(React.createElement(Cabecalho, { avaliacao: { documento_nome: 'edital.pdf', documento_sha256: 'f'.repeat(64), oportunidade_pncp: null, empresa_nome: 'Fictícia',
    empresa_cnpj: '11222333000181', empresa_revisao: 2, criada_em: '2026-11-13T12:00:00Z', atualizada_em: '2026-11-13T12:00:00Z', processamento: 'concluido', requisitos_excluidos: 1 } }));
  assert.match(html, /PNCP Não informado/); assert.match(html, /revisão do perfil 2/); assert.match(html, /1 rejeitado/);
  assert.match(render(React.createElement(Resumo, { itens })), /<strong>3<\/strong><span>Pendentes de revisão humana/);
  const filtros = render(React.createElement(FiltrosForm, { filtros: filtrosVazios, onChange: () => {} }));
  for (const rotulo of ['Categoria', 'Estado da avaliação', 'Criticidade', 'Revisão humana']) assert.match(filtros, new RegExp(`<label>${rotulo}<select`));
  assert.match(filtros, /Limpar filtros/);
});

test('página pede a chave de Empresas e não declara habilitação', async () => {
  const html = render(await Page({ searchParams: Promise.resolve({ documento: 'x', estado: ['a', 'b'] }) }));
  assert.match(html, /Matriz de Elegibilidade/); assert.match(html, /não declara habilitação jurídica/);
  assert.match(html, /Chave privada de acesso/);
});

test('cliente envia credencial e converte falhas em mensagens', async () => {
  let enviado;
  global.fetch = async (url, init) => { enviado = init; return new Response(JSON.stringify({ detail: 'Empresas: registro não encontrado.' }), { status: 404 }); };
  await assert.rejects(api('chave', '/api/elegibilidade/avaliacoes', { method: 'POST', body: '{}' }), /registro não encontrado/);
  assert.equal(enviado.headers.get('Authorization'), 'Bearer chave');
  global.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(api('chave', '/x'), /Falha de conexão/);
  global.fetch = async () => new Response(JSON.stringify({ detail: [{ msg: 'campo inválido' }] }), { status: 422 });
  await assert.rejects(api('chave', '/x'), /Confira os campos: campo inválido/);
});

test('BFF aceita só rotas da matriz, exige credencial, limita corpo e trata indisponibilidade', async () => {
  const ctx = path => ({ params: Promise.resolve({ path }) });
  const auth = { authorization: 'Bearer ' + 'k'.repeat(40) };
  assert.equal((await proxy.GET(new Request('http://x/api/elegibilidade/outra'), ctx(['..', 'empresas']))).status, 404);
  assert.equal((await proxy.GET(new Request('http://x'), ctx(['avaliacoes', UUID + 1]))).status, 401);
  let destino;
  global.fetch = async (url, init) => { destino = [url, init]; return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const ok = await proxy.PATCH(new Request('http://x', { method: 'PATCH', headers: auth, body: '{"acao":"confirmar"}' }), ctx(['avaliacoes', UUID + 1, 'itens', UUID + 2]));
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  assert.match(destino[0], /\/api\/elegibilidade\/avaliacoes\/0{8}-0{4}-0{4}-0{4}-0{11}1\/itens\//);
  assert.equal(destino[1].redirect, 'error'); assert.equal(destino[1].body, '{"acao":"confirmar"}');
  assert.equal((await proxy.POST(new Request('http://x', { method: 'POST', headers: auth, body: 'x'.repeat(70000) }), ctx(['avaliacoes']))).status, 413);
  global.fetch = async () => { throw new Error('down'); };
  assert.equal((await proxy.GET(new Request('http://x', { headers: auth }), ctx(['avaliacoes', UUID + 1, 'relatorio']))).status, 503);
});
