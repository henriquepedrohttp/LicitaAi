# LicitaAI

Base de desenvolvimento do hackathon: Next.js + TypeScript + Tailwind, FastAPI e PostgreSQL.

## Iniciar

Requisitos: Node.js 22.13+ e Docker com Compose, com acesso ao daemon.

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
docker compose up --build -d
cd frontend
npm ci
npm run dev
```

Abra http://localhost:3000. API: http://localhost:8000/docs.
A página inicial consulta o backend por uma rota do Next.js e mostra separadamente a disponibilidade do banco.

```bash
curl -f http://localhost:8000/health
curl -f http://localhost:8000/health/ready
docker compose logs -f backend
```

`/health` verifica o processo; `/health/ready` executa `SELECT 1` no PostgreSQL e retorna 503 se indisponível.

## Backend sem Docker

Python 3.12+ com suporte a venv e PostgreSQL acessível. Configure DATABASE_URL no .env da raiz.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

## Verificação

```bash
cd frontend
npm run lint
npm run build
```

## Organização

- `frontend/src/app`: cinco áreas de navegação; componentes iniciais sem dados simulados de análise.
- `backend/app`: API e verificações de infraestrutura.
- `docs`: PRD e divisão inicial de trabalho.
- `compose.yaml`: PostgreSQL persistente e backend com recarga automática.

Credenciais do exemplo são apenas locais. Não enviar `.env` ao Git. Esta base não implementa autenticação nem processamento documental. Nenhuma análise ou habilitação é apresentada como concluída.

## Encerrar

`docker compose down` preserva o banco. Não usar `down -v` se precisar conservar os dados.

## Análise documental — primeira entrega

Abra `/analise`, importe um PDF e selecione a página. O arquivo original e o texto por página são persistidos no PostgreSQL. Uploads idênticos reutilizam o registro por SHA-256. Nesta versão os documentos pertencem a um acervo único de demonstração, ainda sem vínculo com oportunidade ou organização.

Limites: 20 MB e 200 páginas por arquivo; PDFs protegidos são rejeitados. Páginas com menos de 30 caracteres alfanuméricos recebem status OCR pendente (heurística conservadora). OCR, extração de requisitos por IA e revisão humana estruturada ainda não foram implementados. O visualizador embutido depende do suporte a PDF do navegador; há link para abrir o original.

Ao atualizar dependências do backend em Docker, execute `docker compose up --build -d backend`.

Testes de integração (API e PostgreSQL locais em execução):

```bash
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

Os testes criam PDFs sintéticos e removem somente seus próprios registros. Não há envio de documentos a um provedor de IA nesta etapa.
