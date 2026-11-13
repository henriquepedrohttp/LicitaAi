/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS loader compiles TSX tests without an extra runner. */
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = Module._load;
let pushed;
Module._load = function (name, parent, main) {
  if (name === 'server-only') return {};
  if (name === 'next/navigation') return { useRouter: () => ({ push: url => { pushed = url; } }), redirect: url => { throw new Error(`REDIRECT:${url}`); } };
  return load.call(this, name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
};
Module._extensions['.css'] = module => { module.exports = { radar: 'radar' }; };
const Radar = require('../src/app/radar/page.tsx').default;
const SearchForm = require('../src/app/radar/search-form.tsx').default;
const Loading = require('../src/app/radar/loading.tsx').default;
const { radarGet, RadarError } = require('../src/app/radar/api.ts');
const { searchQuery, money, dateTime } = require('../src/app/radar/query.ts');
// Dados exclusivos de teste, sem representação de consulta real.
const item = { id: '12345678000199-1-000123/2026', fonte: 'PNCP', orgao: 'Órgão de teste', cnpj: '12345678000199', objeto: 'Software de teste', municipio: 'Recife', uf: 'PE', modalidade: 'Pregão eletrônico', numero: '123', ano: 2026, valor_estimado: '100000.1234', publicado_em: '2026-11-12T12:00:00-03:00', abertura_em: null, encerramento_em: null, atualizado_em: null, situacao: 'Divulgada no PNCP', situacao_id: 1, criterio_julgamento: null, consultado_em: '2026-11-13T12:00:00Z', url_oficial: 'https://pncp.gov.br/app/editais/12345678000199/2026/123', url_api: 'https://pncp.gov.br/api/consulta/v1/orgaos/12345678000199/compras/2026/123' };
const results = { oportunidades: [item], total_fonte: 30, total_paginas: 2, pagina: 1, tamanho: 20, registros_na_pagina: 20, consultado_em: item.consultado_em, cobertura: 'pagina', aviso: 'Somente esta página', url_fonte: item.url_api };
const detail = { oportunidade: item, documentos: [], documentos_pagina: 1, documentos_proxima_pagina: false, documentos_consultados_em: item.consultado_em, avisos: [], analise_disponivel: false, encaminhamento: { versao: '1', oportunidade: item, documentos: [], referencias: [item.url_api], documentos_completos: true, documentos_consultados_em: item.consultado_em } };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function response(data, status = 200) { return { ok: status < 400, status, json: async () => data }; }
async function resolve(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function' && node.type.constructor.name === 'AsyncFunction') return resolve(await node.type(node.props));
  const children = await resolve(node.props.children);
  return Array.isArray(children) ? React.cloneElement(node, {}, ...children) : React.cloneElement(node, {}, children);
}
async function render(params = {}) { return renderToStaticMarkup(await resolve(await Radar({ searchParams: Promise.resolve(params) }))); }
function hrefs(html) { return [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&')); }

test('renderização inicial consulta o backend com Pernambuco e modalidade explícita', async () => {
  let url;
  global.fetch = async value => { url = value; return response(results); };
  const html = await render();
  assert.match(url, /\/api\/radar\/oportunidades\?/);
  assert.equal(new URL(url).searchParams.get('uf'), 'PE');
  assert.match(html, /Software de teste/);
  assert.match(html, /30 registros na consulta oficial/);
  assert.match(html, /100\.000,12/);
  assert.match(html, /locais à página/);
});
test('filtros são enviados e preservados nos links de paginação e detalhes', async () => {
  let url;
  global.fetch = async value => { url = value; return response(results); };
  const html = await render({ palavra: 'software', uf: 'BA', inicio: '2026-11-01', fim: '2026-11-13', ordem: 'maior' });
  assert.equal(new URL(url).searchParams.get('palavra'), 'software');
  const next = hrefs(html).find(url => new URL(url, 'http://test').searchParams.get('pagina') === '2');
  assert.ok(next);
  assert.equal(new URL(next, 'http://test').searchParams.get('uf'), 'BA');
  const detailUrl = hrefs(html).find(url => url.includes('oportunidade='));
  assert.equal(new URL(detailUrl, 'http://test').searchParams.get('palavra'), 'software');
});
test('formulário aplica filtros, reinicia página e oferece limpeza', () => {
  const realTransition = React.useTransition;
  React.useTransition = () => [false, action => action()];
  try {
    const tree = SearchForm({ values: { ...Object.fromEntries(searchQuery({})), palavra: 'software' } });
    const data = new FormData(); data.set('uf', 'PE'); data.set('palavra', 'software');
    const RealFormData = global.FormData;
    global.FormData = class { constructor() { return data; } };
    try { tree.props.onSubmit({ preventDefault() {}, currentTarget: {} }); }
    finally { global.FormData = RealFormData; }
    assert.equal(pushed, '/radar?uf=PE&palavra=software');
    const html = renderToStaticMarkup(tree);
    assert.match(html, /href="\/radar">Limpar filtros/);
    assert.match(html, /<label>UF<select/);
    assert.doesNotMatch(html, /name="pagina"/);
  } finally { React.useTransition = realTransition; }
});
test('busca em andamento desabilita controles e anuncia status', () => {
  const realTransition = React.useTransition;
  React.useTransition = () => [true, () => {}];
  try {
    const html = renderToStaticMarkup(SearchForm({ values: Object.fromEntries(searchQuery({})) }));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /fieldset disabled/);
    assert.match(html, /Busca em andamento/);
  } finally { React.useTransition = realTransition; }
});
test('detalhe mantém pesquisa, documentos e bloqueio da análise', async () => {
  global.fetch = async () => response({ ...detail, documentos: [{ id: 1, titulo: 'Edital de teste', tipo: 'Edital', publicado_em: null, url: 'https://pncp.gov.br/arquivo' }] });
  const html = await render({ oportunidade: item.id, palavra: 'software', pagina: '2', uf: 'PE' });
  assert.match(html, /Edital de teste/);
  assert.match(html, /button disabled/);
  assert.match(html, /Nenhuma análise foi iniciada/);
  const back = hrefs(html).find(url => url.startsWith('/radar?') && !url.includes('oportunidade='));
  assert.equal(new URL(back, 'http://test').searchParams.get('pagina'), '2');
  assert.equal(new URL(back, 'http://test').searchParams.get('palavra'), 'software');
});
test('documentos com erro preservam metadados e recuperação', async () => {
  global.fetch = async () => response({ ...detail, avisos: ['Documentos indisponíveis.'] });
  const html = await render({ oportunidade: item.id });
  assert.match(html, /Software de teste/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Documentos não confirmados/);
  assert.match(html, /Tentar novamente/);
});
test('estado vazio mantém próxima página da fonte', async () => {
  global.fetch = async () => response({ ...results, oportunidades: [] });
  const html = await render({ palavra: 'ausente' });
  assert.match(html, /Nenhuma oportunidade nesta página/);
  assert.match(html, /Próxima página/);
});
test('falha da API tem recuperação e loading é anunciado', async () => {
  global.fetch = async () => response({}, 504);
  const html = await render();
  assert.match(html, /PNCP não respondeu a tempo/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Tentar novamente/);
  assert.match(renderToStaticMarkup(React.createElement(Loading)), /role="status"/);
});
test('conexão e JSON inválido viram mensagens seguras', async () => {
  global.fetch = async () => { throw new Error('private infrastructure'); };
  await assert.rejects(radarGet('oportunidades'), error => error instanceof RadarError && !error.message.includes('private'));
  global.fetch = async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } });
  await assert.rejects(radarGet('oportunidades'), /resposta inválida/);
});
test('campos ausentes, datas e orçamento não são inventados', () => {
  assert.match(money(null), /Não informado/);
  assert.equal(dateTime(null), 'Não informado');
  assert.match(dateTime('2026-11-13T12:00:00Z'), /09:00/);
});
test('CSS mantém escopo do Radar, foco e layouts para celular', () => {
  const css = fs.readFileSync('src/app/radar/radar.css', 'utf8');
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /:global\(/);
  const page = fs.readFileSync("src/app/radar/page.tsx", "utf8");
  assert.match(page, /className="radar"/);
  assert.match(page, /key=\{JSON.stringify\(params\)\}/);
  assert.match(css, /max-width: 450px/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /min-height: 44px/);
});

test('estrutura inesperada e links externos são rejeitados', async () => {
  for (const payload of [{}, { ...results, total_fonte: '30' }, { ...results, oportunidades: [{ ...item, url_oficial: 'javascript:alert(1)' }] }]) {
    global.fetch = async () => response(payload);
    await assert.rejects(radarGet('oportunidades?uf=PE'), /resposta inválida/);
  }
});

test('pesquisa renderiza somente um formulário após trocar os filtros', async () => {
  global.fetch = async () => response(results);
  for (const params of [{}, { municipio: '2611606', palavra: 'software', pagina: '2' }]) {
    const html = await render(params);
    assert.equal((html.match(/<form\b/g) || []).length, 1);
    assert.equal((html.match(/name="municipio"/g) || []).length, 1);
  }
});

test('HTML de outra aplicação é diagnosticado sem ser tratado como dado PNCP', async () => {
  const realError = console.error;
  const logs = [];
  console.error = message => logs.push(message);
  try {
    global.fetch = async () => new Response('<!doctype html><title>Just Analytics</title><p>Conteúdo privado de outra aplicação</p>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    await assert.rejects(radarGet('oportunidades?uf=PE'), /página web em vez dos dados/);
    assert.ok(logs.some(message => message.includes('Just Analytics') && message.includes('text/html')));
    assert.ok(logs.every(message => !message.includes('Conteúdo privado')));
  } finally { console.error = realError; }
});

test('consulta lenta aguarda o backend e timeout local tem mensagem própria', async () => {
  const realTimeout = AbortSignal.timeout;
  let timeout;
  AbortSignal.timeout = value => { timeout = value; return new AbortController().signal; };
  try {
    global.fetch = async () => response(results);
    await radarGet('oportunidades?uf=PE');
    assert.equal(timeout, 90000);
    global.fetch = async () => { throw new DOMException('aborted', 'TimeoutError'); };
    await assert.rejects(radarGet('oportunidades?uf=PE'), /Reduza o período/);
  } finally { AbortSignal.timeout = realTimeout; }
});

test('timeout ao receber o corpo não é confundido com JSON inválido', async () => {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new DOMException('aborted', 'AbortError'); } });
  await assert.rejects(radarGet('oportunidades?uf=PE'), /Reduza o período/);
});
