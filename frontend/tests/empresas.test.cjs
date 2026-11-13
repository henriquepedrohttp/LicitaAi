/* eslint-disable @typescript-eslint/no-require-imports -- Mesmo runner nativo usado pelos testes do Radar. */
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'next/navigation') return { useRouter: () => ({ push: () => {} }) };
  return originalLoad.call(this, name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);

const { emptyProfile, profilePayload } = require('../src/app/empresas/contracts.ts');
const { ProfileForm } = require('../src/app/empresas/profile-form.tsx');
const Workspace = require('../src/app/empresas/workspace.tsx').default;
const { Facts, Pending } = require('../src/app/empresas/workspace.tsx');
const { Documents } = require('../src/app/empresas/documents.tsx');
const { empresasRequest } = require('../src/app/empresas/access.tsx');
const proxy = require('../src/app/api/empresas/[[...path]]/route.ts');
const { validCnpj, profileError } = require('../src/app/empresas/validation.ts');
const { demoProfile, demoDocuments } = require('../src/app/empresas/demo/example.ts');
const EmpresasPage = require('../src/app/empresas/page.tsx').default;
const PrivatePage = require('../src/app/empresas/cadastro/page.tsx').default;
const DemoSection = require('../src/app/empresas/demo/sections.tsx').default;
const { DEMO_KEY, MAX_DEMO_FILE, parseDemo, serializeDemo, readDemo, saveDemo, subscribeDemo } = require('../src/app/empresas/demo/storage.ts');
const originalFetch = global.fetch;
const originalWindow = global.window;
const company = { ...emptyProfile, id: '00000000-0000-0000-0000-000000000001', razao_social: 'Empresa fictícia <script>teste</script>', cnpj: '11222333000181', revisao: 1, campos_pendentes: ['capacidades'], documentos_quantidade: 0, origem: 'declarado' };
afterEach(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });

test('perfil do pitch sobrevive a nova leitura e é transferível por JSON sem chaves privadas', () => {
  const values = new Map();
  global.window = Object.assign(new EventTarget(), { localStorage: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  } });
  let notifications = 0;
  const unsubscribe = subscribeDemo(() => { notifications++; });
  assert.equal(readDemo(), null);
  const edited = { ...demoProfile, nome_fantasia: 'Aurora Pitch', projetos: 'Projeto salvo para a gravação' };
  saveDemo(edited);
  assert.equal(notifications, 1);
  assert.deepEqual(parseDemo(readDemo()), edited);
  const exported = serializeDemo(parseDemo(readDemo()));
  assert.deepEqual(Object.keys(JSON.parse(exported)), ['formato', 'perfil']);
  assert.doesNotMatch(exported, /EMPRESAS_ACCESS_KEY|Bearer|documentos/);
  values.clear();
  assert.equal(readDemo(), null);
  saveDemo(parseDemo(exported));
  assert.deepEqual(parseDemo(readDemo()), edited);
  unsubscribe();
  saveDemo(demoProfile);
  assert.equal(notifications, 2);
  assert.deepEqual(parseDemo(values.get(DEMO_KEY)), demoProfile);
});

test('importação rejeita estrutura, versão, campos e limites inválidos antes de sobrescrever o perfil', () => {
  const wrap = perfil => JSON.stringify({ formato: DEMO_KEY, perfil });
  for (const text of ['not json', 'null', '{}', JSON.stringify({ formato: 'v0', perfil: demoProfile }), wrap({}),
    wrap({ ...demoProfile, uf: 'XX' }), wrap({ ...demoProfile, porte: 'inexistente' }),
    wrap({ ...demoProfile, cnpj: '123' }), wrap({ ...demoProfile, capacidades: [1] }),
    wrap({ ...demoProfile, tecnologias: Array(51).fill('A') }), wrap({ ...demoProfile, nome_fantasia: 'A'.repeat(201) }),
    wrap({ ...demoProfile, razao_social: null }), wrap({ ...demoProfile, segredo: 'extra' }),
    'x'.repeat(MAX_DEMO_FILE + 1)]) assert.throws(() => parseDemo(text));
  let saved = serializeDemo(demoProfile);
  global.window = Object.assign(new EventTarget(), { localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } } });
  assert.throws(() => saveDemo({ ...demoProfile, cnpj: 'invalid' }));
  assert.deepEqual(parseDemo(readDemo()), demoProfile);
  global.window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => saveDemo({ ...demoProfile, nome_fantasia: 'Não deve sobrescrever' }), /Não foi possível salvar/);
  assert.deepEqual(parseDemo(readDemo()), demoProfile);
  global.window.localStorage.getItem = () => { throw new Error('SecurityError'); };
  assert.equal(readDemo(), 'armazenamento-indisponivel');
});

test('CNPJ valida formato, repetição e dígitos verificadores numéricos e alfanuméricos', () => {
  for (const cnpj of ['11.222.333/0001-81', '11222333000181', '12.ABC.345/01DE-35', '12abc34501de35']) assert.equal(validCnpj(cnpj), true, cnpj);
  for (const cnpj of ['', '00000000000000', '11111111111111', '11222333000182', '1122233300018', '11!222333000181', '12ABC34501DE36']) assert.equal(validCnpj(cnpj), false, cnpj);
});

test('formulário valida obrigatórios, CNAEs e listas antes de salvar o exemplo', () => {
  assert.equal(profileError(demoProfile), null);
  assert.match(profileError({ ...demoProfile, razao_social: '  ' }), /razão social/);
  assert.match(profileError({ ...demoProfile, cnpj: '123' }), /CNPJ inválido/);
  assert.match(profileError({ ...demoProfile, cnae_principal: '123' }), /CNAE principal/);
  assert.match(profileError({ ...demoProfile, cnaes_secundarios: ['123'] }), /CNAE secundário/);
  assert.match(profileError({ ...demoProfile, capacidades: Array(51).fill('Teste') }), /até 50 itens/);
  assert.match(profileError({ ...demoProfile, tecnologias: ['x'.repeat(501)] }), /500 caracteres/);
  const data = new FormData(); data.set('razao_social', '  '); data.set('cnpj', '');
  const payload = profilePayload(data, demoProfile);
  assert.equal(payload.razao_social, ''); assert.equal(payload.cnpj, '');
  assert.match(profileError(payload), /razão social/);
});

test('Empresas abre direto no perfil completo de demonstração, sem chave nem acesso à API', () => {
  global.fetch = () => { throw new Error('Demonstração não pode acessar a API'); };
  for (const [field, value] of Object.entries(demoProfile)) assert.ok(Array.isArray(value) ? value.length : value, `Campo demonstrativo vazio: ${field}`);
  const html = renderToStaticMarkup(React.createElement(EmpresasPage));
  assert.match(html, /Demonstração · Dados fictícios/);
  assert.match(html, /11.222.333\/0001-81/);
  assert.match(html, /Aurora Tecnologia/);
  assert.match(html, /Editar perfil/);
  for (const label of ['Visão geral', 'Capacidade técnica', 'Documentos', 'Pendências']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /Não informado/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /name="key"/);
  assert.match(html, /href="\/empresas\/cadastro"/);
  assert.match(html, /Restaurar exemplo fictício/);
  assert.match(html, /Exportar perfil do pitch/);
  assert.match(html, /Importar perfil do pitch/);
  assert.match(html, /Configuração mantida neste navegador/);
  assert.match(renderToStaticMarkup(React.createElement(PrivatePage)), /name="key"/);
});

test('seções do pitch mostram capacidades preenchidas e documentos explicitamente ilustrativos', () => {
  const technical = renderToStaticMarkup(React.createElement(DemoSection, { profile: demoProfile, tab: 'tecnica' }));
  for (const value of ['Portal Conecta', 'Python e FastAPI', 'APIs integradas']) assert.ok(technical.includes(value));
  const documents = renderToStaticMarkup(React.createElement(DemoSection, { profile: demoProfile, tab: 'documentos' }));
  assert.equal(demoDocuments.length, 4);
  assert.match(documents, /sem arquivos anexados ou verificação/);
  assert.match(documents, /Não verificado/);
  assert.doesNotMatch(documents, /href=/);
  for (const doc of demoDocuments) assert.ok(documents.includes(doc.titulo));
  const pending = renderToStaticMarkup(React.createElement(DemoSection, { profile: demoProfile, tab: 'pendencias' }));
  assert.match(pending, /Cadastro preenchido/);
  assert.match(pending, /aguardando evidência real e revisão/);
  assert.match(pending, /Preenchimento não significa habilitação/);
  const incomplete = renderToStaticMarkup(React.createElement(DemoSection, { profile: { ...demoProfile, tecnologias: [] }, tab: 'pendencias' }));
  assert.match(incomplete, /1 campo pendente/);
  assert.match(incomplete, /Tecnologias e especialidades/);
});

test('edição progressiva preserva campos fora da seção e normaliza listas', () => {
  const data = new FormData(); data.set('razao_social', ' Empresa fictícia '); data.set('nome_fantasia', ''); data.set('areas_atuacao', ' Vídeo \n\n Software ');
  const result = profilePayload(data, { ...emptyProfile, capacidades: ['Capacidade já salva'] });
  assert.equal(result.razao_social, 'Empresa fictícia');
  assert.equal(result.nome_fantasia, null);
  assert.deepEqual(result.areas_atuacao, ['Vídeo', 'Software']);
  assert.deepEqual(result.capacidades, ['Capacidade já salva']);
  assert.equal(Object.hasOwn(result, 'revisao'), false);
});

test('acesso fechado e formulários com labels e obrigatórios', () => {
  const gate = renderToStaticMarkup(React.createElement(Workspace));
  assert.match(gate, /Chave privada de acesso/);
  assert.doesNotMatch(gate, /Empresa fictícia/);
  const form = renderToStaticMarkup(React.createElement(ProfileForm, { save: async () => {}, cancel: () => {} }));
  assert.match(form, /<input(?=[^>]*name="razao_social")(?=[^>]*required)[^>]*>/);
  assert.match(form, /<input(?=[^>]*name="cnpj")(?=[^>]*required)[^>]*>/);
  assert.match(form, /<label>UF<select/);
  assert.match(form, /não consultamos bases cadastrais/i);
  const technical = renderToStaticMarkup(React.createElement(ProfileForm, { current: company, section: 'tecnica', save: async () => {}, cancel: () => {} }));
  assert.match(technical, /Capacidades técnicas declaradas/);
  assert.doesNotMatch(technical, /name="cnpj"/);
});

test('perfil e pendências distinguem ausência, declarações e verificação', () => {
  const facts = renderToStaticMarkup(React.createElement(Facts, { company }));
  assert.match(facts, /Não informado/);
  assert.match(facts, /&lt;script&gt;/);
  const pending = renderToStaticMarkup(React.createElement(Pending, { company, documents: [] }));
  assert.match(pending, /Capacidades técnicas declaradas/);
  assert.match(pending, /ausência de evidência, sem juízo de habilitação/);
  assert.match(pending, /Não há documentos para verificar/);
  const evidence = { id: 'doc', titulo: 'Atestado de teste', tipo: 'atestado_tecnico', atual: true, excluido_em: null, vencido: true, validade: '2020-01-01' };
  const expired = renderToStaticMarkup(React.createElement(Pending, { company, documents: [evidence] }));
  assert.match(expired, /validade informada vencida/);
  assert.match(expired, /aguardando verificação/);
  const docs = renderToStaticMarkup(React.createElement(Documents, { id: company.id, documents: [], reload: async () => {} }));
  assert.match(docs, /accept="application\/pdf,.pdf"/);
  assert.match(docs, /Nenhum documento atual disponível/);
  assert.match(docs, /não confirma autenticidade/);
});

test('cliente envia chave em header e apresenta erros de validação e disponibilidade', async () => {
  global.fetch = async (url, init) => { assert.equal(url, '/api/empresas'); assert.equal(init.headers.get('authorization'), 'Bearer test'); assert.equal(init.cache, 'no-store'); return Response.json([]); };
  await empresasRequest('test');
  global.fetch = async () => Response.json({ detail: 'Banco indisponível.' }, { status: 503 });
  await assert.rejects(empresasRequest('test'), /Banco indisponível/);
  global.fetch = async () => Response.json({ detail: [{ loc: ['body', 'cnpj'], msg: 'CNPJ inválido' }] }, { status: 422 });
  await assert.rejects(empresasRequest('test'), /cnpj: CNPJ inválido/);
});

test('proxy impede acesso anônimo e destinos fora de Empresas', async () => {
  global.fetch = () => { throw new Error('Não deveria acessar o backend'); };
  const context = { params: Promise.resolve({}) };
  assert.equal((await proxy.GET(new Request('http://test/api/empresas'), context)).status, 401);
  assert.equal((await proxy.GET(new Request('http://test/api/empresas/http://evil', { headers: { authorization: 'Bearer x' } }), { params: Promise.resolve({ path: ['http:', 'evil'] }) })).status, 404);
});

test('proxy encaminha somente credencial apresentada, limita corpo e não segue redirects', async () => {
  let called = false;
  global.fetch = async (url, init) => {
    called = true;
    assert.match(url, /\/api\/empresas\?pagina=2$/);
    assert.equal(init.headers.get('authorization'), 'Bearer operador');
    assert.equal(init.headers.get('cookie'), null);
    assert.equal(init.redirect, 'error');
    return Response.json([]);
  };
  const response = await proxy.GET(new Request('http://test/api/empresas?pagina=2', { headers: { authorization: 'Bearer operador', cookie: 'private=secret' } }), { params: Promise.resolve({}) });
  assert.equal(called, true); assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const tooLarge = new Request('http://test/api/empresas', { method: 'POST', headers: { authorization: 'Bearer operador' }, body: new Uint8Array(10 * 1024 * 1024 + 1) });
  assert.equal((await proxy.POST(tooLarge, { params: Promise.resolve({}) })).status, 413);
  global.fetch = async () => { throw new Error('connection refused'); };
  assert.equal((await proxy.GET(new Request('http://test/api/empresas', { headers: { authorization: 'Bearer operador' } }), { params: Promise.resolve({}) })).status, 503);
});
