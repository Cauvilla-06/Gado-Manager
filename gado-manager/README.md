# 🐄 GadoManager — Sistema de Gestão de Gado

Sistema completo para gerenciamento de gado com controle de pesagens, vacinas, ciclos, relatórios e sincronização offline/online.

## 📋 Visão Geral

| Componente | Tecnologia |
|-----------|------------|
| **Web** | Next.js 16 + TypeScript + Tailwind CSS + Recharts |
| **Backend** | Next.js API Routes |
| **Banco** | SQLite (dev) / PostgreSQL (prod) + Prisma ORM |
| **Android** | Kotlin + Jetpack Compose + Room + WorkManager |
| **Testes** | Vitest |

## 🏗 Arquitetura

```
WEB (Next.js)
    ↓
API (Route Handlers)
    ↓
Serviços (Business Logic)
    ↓
Banco de Dados (Prisma → SQLite/PostgreSQL)

ANDROID (Jetpack Compose)
    ↓
Room Database (Offline)
    ↓
Fila de Sincronização (WorkManager)
    ↓
API → Banco Central
```

## ⚡ Funcionalidades

### Web
- ✅ Dashboard com estatísticas do rebanho
- ✅ Cadastro e busca de animais
- ✅ Ciclos de vida (histórico preservado)
- ✅ Pesagens com validação
- ✅ Vacinas
- ✅ Dashboard individual com gráficos
- ✅ Relatórios individuais e gerais
- ✅ Exportação PDF, CSV e XLSX
- ✅ Venda/reset seguro com confirmação
- ✅ Responsivo (mobile-first)

### Android
- ✅ Registro rápido de pesagem (número + peso)
- ✅ Registro rápido de vacina
- ✅ Armazenamento offline (Room)
- ✅ Fila de sincronização
- ✅ Sincronização automática (WorkManager)
- ✅ Indicador online/offline
- ✅ Proteção contra duplicação (UUID)

## 🚀 Como Instalar

### Pré-requisitos
- Node.js 18+
- npm
- Android Studio (para o app Android)

### 1. Configurar o projeto

```bash
cd gado-manager
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` com suas configurações. **Obrigatório:** troque o `NEXTAUTH_SECRET`
por um valor aleatório de pelo menos 32 caracteres. O servidor recusa o valor de
exemplo, porque com ele qualquer pessoa conseguiria forjar um login:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Para acessar o servidor de desenvolvimento pelo celular na rede local, coloque o
IP do PC em `DEV_ALLOWED_ORIGINS` (veja o `.env.example`).

### 3. Configurar banco de dados

```bash
# Cria/atualiza as tabelas no banco do TURSO_DATABASE_URL (Turso ou file:)
# Pode rodar quantas vezes quiser: só cria o que falta (tabelas, índices e
# colunas novas, como User.tokenVersion).
node scripts/push-schema-turso.ts    # Node 22.6+ (ou: npx tsx scripts/push-schema-turso.ts)

# O cliente Prisma é gerado automaticamente no npm install (postinstall).

# Popular dados de exemplo (opcional, só em banco local)
npx tsx prisma/seed.ts
```

O seed recusa rodar contra um banco remoto (Turso) — use `SEED_ALLOW_REMOTE=1`
se for intencional. A senha da conta demo vem de `SEED_DEMO_PASSWORD` ou é gerada
na hora e mostrada no terminal.

> A pasta `prisma/migrations` está desatualizada em relação ao schema (ex.: a
> migration inicial não tem `farmId`); o script acima é a fonte de verdade.

### 4. Executar o projeto

```bash
# Web
npm run dev

# Build de produção
npm run build
npm start
```

### 5. Executar testes

```bash
npm test
```

### 6. Android

Abra a pasta `android/` no Android Studio e aguarde a sincronização do Gradle.

## 🗄 Banco de Dados

### Estrutura

```
Animal
├── id (UUID)
├── numeroIdentificacao (único)
├── status (ATIVO | VENDIDO | INATIVO)
├── cicloAtualId
├── criadoEm
└── atualizadoEm

AnimalCycle
├── id (UUID)
├── animalId (FK)
├── numeroCiclo
├── dataInicio
├── dataFim
├── status (ATIVO | ENCERRADO)
└── observacoes

WeightRecord
├── id (UUID)
├── animalId (FK)
├── cicloId (FK)
├── pesoKg
├── dataPesagem
├── clientGeneratedId (único, para idempotência)
├── origem (WEB | ANDROID)
└── sincronizado

Vaccination
├── id (UUID)
├── animalId (FK)
├── cicloId (FK)
├── nomeVacina
├── dataAplicacao
├── dataProximaDose
├── lote
├── clientGeneratedId (único)
└── origem (WEB | ANDROID)
```

### Índices
- `numeroIdentificacao` (busca por número)
- `status` (filtros)
- `animalId`, `cicloId` (relacionamentos)
- `dataPesagem`, `dataAplicacao` (consultas por data)
- `clientGeneratedId` (idempotência na sincronização)

## 📡 API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/animals` | Listar animais |
| `POST` | `/api/animals` | Criar animal |
| `GET` | `/api/animals/:id` | Buscar animal por ID |
| `POST` | `/api/animals/:id/weights` | Registrar pesagem |
| `GET` | `/api/animals/:id/weights` | Listar pesagens |
| `POST` | `/api/animals/:id/vaccinations` | Registrar vacina |
| `GET` | `/api/animals/:id/vaccinations` | Listar vacinas |
| `POST` | `/api/animals/:id/sell` | Marcar como vendido |
| `POST` | `/api/animals/:id/cycles` | Criar novo ciclo |
| `GET` | `/api/animals/:id/cycles` | Listar ciclos |
| `GET` | `/api/animals/:id/report` | Relatório individual |
| `GET` | `/api/reports/general` | Relatório geral |
| `POST` | `/api/animals/:id/vermifuges` | Registrar vermífugo |
| `GET` | `/api/animals/:id/vermifuges` | Listar vermífugos |
| `POST` | `/api/animals/:id/vitamins` | Registrar vitamina |
| `GET` | `/api/animals/:id/vitamins` | Listar vitaminas |
| `POST` | `/api/sync` | Sincronização offline (até 500 registros por tipo) |
| `POST` | `/api/auth/logout` | Sair; com `{"todosDispositivos": true}` invalida todos os tokens |
| `GET` | `/api/config/server-url` | URL atual do túnel (somente leitura) |

### Permissões por nível

| Ação | OWNER | ADMIN | MEMBER |
|------|:-----:|:-----:|:------:|
| Ver rebanho e relatórios | ✅ | ✅ | ✅ |
| Lançar pesagem, vacina, vermífugo, vitamina (site e app) | ✅ | ✅ | ✅ |
| Cadastrar, excluir ou vender boi; iniciar ciclo | ✅ | ✅ | ❌ |
| Aprovar pedidos de entrada | ✅ | ✅ | ❌ |

Todo registro guarda quem lançou (`criadoPorId`), inclusive os que chegam pelo app.

### URL do túnel

A URL do Cloudflare Tunnel é gravada em `.runtime-config/server-url.json` pelos
scripts locais (`start-*.bat`, `scripts/*.ps1`). Não existe rota de API para
alterá-la — só quem tem acesso ao disco do PC consegue trocar.

## 🔄 Sincronização Offline/Online

### Fluxo
1. **Offline**: App Android salva registros no Room com UUID único
2. **Online**: WorkManager detecta conexão e envia pendentes
3. **Idempotência**: API verifica `clientGeneratedId` antes de inserir
4. **Conflitos**: Registros são eventos independentes (não há edição)

### Status de Sincronização
- 🟢 ONLINE — Conectado ao servidor
- 🔴 OFFLINE — Sem conexão, dados salvos localmente
- 🔄 SINCRONIZANDO — Enviando dados pendentes
- ✅ SINCRONIZADO — Todos os dados enviados
- ⚠️ ERRO — Falha na sincronização (retry automático)

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes em watch mode
npm run test:watch
```

### Cobertura
- **Unitários**: Cálculos de ganho, percentual, média, variação
- **Validações**: Schemas Zod para animal, pesagem, vacina
- **Regras de negócio**: Ciclos, venda, preservação de histórico

## 📁 Estrutura do Projeto

```
gado-manager/
├── prisma/
│   ├── schema.prisma          # Schema do banco
│   ├── migrations/            # Migrations
│   └── seed.ts                # Dados de exemplo
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── animals/       # CRUD de animais
│   │   │   ├── reports/       # Relatórios
│   │   │   └── sync/          # Sincronização
│   │   ├── animals/           # Páginas de animais
│   │   └── reports/           # Páginas de relatórios
│   ├── lib/                   # Utilitários
│   │   ├── db.ts              # Cliente Prisma
│   │   ├── calculations.ts    # Cálculos centralizados
│   │   ├── validations.ts     # Schemas Zod
│   │   └── utils.ts           # Funções auxiliares
│   ├── services/              # Lógica de negócio
│   │   ├── animal-service.ts
│   │   ├── weight-service.ts
│   │   ├── vaccination-service.ts
│   │   ├── cycle-service.ts
│   │   ├── report-service.ts
│   │   └── sync-service.ts
│   └── types/                 # Tipos TypeScript
├── android/                   # App Android
│   ├── app/src/main/
│   │   ├── java/com/gadomanager/
│   │   │   ├── data/          # Room + Retrofit
│   │   │   ├── sync/          # WorkManager sync
│   │   │   └── ui/            # Jetpack Compose
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── .env.example
└── README.md
```

## 🔒 Segurança

- Validação de input no frontend e backend (Zod)
- UUIDs para idempotência na sincronização
- Sem secrets no repositório (.env.example)
- Tratamento de erros com mensagens amigáveis
- Login próprio com JWT (HS256) em cookie httpOnly (site) ou Bearer (app/bots)
- "Sair de todos os dispositivos" invalida todos os tokens do usuário
- Rate limit em login, cadastro, sincronização e pedidos de entrada
- Histórico de auditorias em `SECURITY-AUDIT.md`

## 📊 Cálculos

Todos os cálculos estão centralizados em `src/lib/calculations.ts`:

```typescript
calculateWeightGain(pesoAtual, pesoInicial)      // Ganho em kg
calculateWeightGainPercentage(pesoAtual, pesoInicial) // Ganho %
calculateAverageWeight(pesos)                     // Média
calculateMaxWeight(pesos)                         // Maior peso
calculateMinWeight(pesos)                         // Menor peso
calculatePeriodDays(dataInicio, dataFim)          // Período em dias
calculateWeightVariation(anterior, atual)         // Variação completa
generateInterpretation(pesoAtual, pesoInicial)    // Interpretação textual
```

## 📱 Design

- **Mobile-first**: Interface otimizada para celular
- **shadcn/ui inspired**: Design system consistente
- **Tipografia**: Sistema de_fonts do sistema
- **Cores**: Verde (primary) com neutros
- **Animações**: Fade-in, skeleton loading
- **Estados vazios**: Mensagens + ação sugerida

## 📄 Licença

MIT
