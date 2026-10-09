# 🔐 FORMULÁRIO DE AUDITORIA DE SEGURANÇA — GadoManager

| Campo | Valor |
|---|---|
| **Projeto** | `gado-manager` (Next.js + API + Turso/Prisma + apps Android/Flutter) |
| **Auditoria** | 07/10/2026 |
| **Correções + Revisão** | 08/10/2026 (agente corretor + agente revisor re-executou a suíte de ataques) |
| **Dados de teste** | Todas as contas/fazendas de teste foram criadas isoladas e **apagadas ao final** de cada fase (verificado: 0 restantes); `server-url.json` restaurado |

## ⚠️ Veredito final: **NÍVEL DE PERIGO REDUZIDO DE ALTO → BAIXO/MÉDIO**

Corrigido em código e **verificado por re-ataque**: IDOR, roles, bypass de aprovação, rate limit spoofável, config sem auth, XSS de entrada, duplicado 500, senhas fracas, health com fingerprint. Restam apenas itens que dependem de decisão de upgrade/infra (deps breaking-major, revogação de sessão, CSP) — ver seção 6.

---

## 1. Falhas CRÍTICAS (🔴) — o que cada uma permitia

| # | Falha (original) | Onde foi corrigida | Evidência ANTES → DEPOIS |
|---|---|---|---|
| 1.1 | **RCE no Next.js** ("Unauthenticated RCE on windows-hosted servers" + AVIF + `next/og`) | `package.json` — `next` **16.3.2 → 16.4.0** (fix não-breaking disponível) | `npm audit`: next critical → **0 critical de next** |
| 1.2 | **IDOR de leitura**: pesos/ciclos/relatório de animais de outras fazendas vazados | `animals/[id]/route.ts`, `[id]/weights`, `[id]/cycles`, `[id]/report` — `getCurrentFarm()` + `animalBelongsToFarm()` obrigatórios | Atacante outra fazenda: 200 + dados → **403** (re-testado) |
| 1.3 | **Roles não aplicadas**: MEMBER vendia boi, criava animal/pesagem | Todas as rotas de escrita (`animals` POST, `weights`, `sell`, `cycles` POST, `vaccinations`, `vermifuges`, `vitamins`) chamam `userCanWriteToFarm()` | MEMBER: pesagem 201/venda 200 → **403 em tudo**; leitura continua 200 (re-testado) |
| 1.4 | **Cadastro com `farmCode` pulava aprovação** | `api/auth/register/route.ts` — `farmCode` cria `FarmRequest PENDENTE`, não membership | Invasor registrado no código da vítima: membro direto → **membros da vítima continuaram 1** (pedido pendente só vira membro via PATCH de OWNER/ADMIN) |
| 1.5 | **Rate limit spoofável** (`x-forwarded-for` do cliente) | Nova `lib/client-ip.ts` (usa `cf-connecting-ip` do Cloudflare primeiro) + **limite adicional por CONTA (email)** no login | 7 tentativas com IPs falsos: todas 401 → **t6 = 429** mesmo com 6 IPs distintos (re-testado) |
| 1.6 | **`POST /api/config/*` sem auth** = veneno de configuração pela internet | `api/config/tunnel/route.ts` + `server-url/route.ts` — bloqueia requisição de túnel via headers `cf-*` (não-forjáveis) e Origin/Referer remotos; exige `https://`; GET continua público (app Flutter) | POST remoto: 200 + arquivo reescrito → **403, arquivo intacto**; POST local (`.bat`): **200**; `http://`: **400** (re-testado) |
| 1.7 | **`.env` com credenciais do Turso na máquina** (combinava com RCE para tomada total) | Mitigado indiretamente: RCE fechado com next 16.4.0 + config/hardening. Recomendação mantida: rodar sem compartilhar o disco e rotacionar o token do Turso | — (infra) |

## 2. Falhas de risco ALTO (🟠) — status

| # | Falha (original) | Correção | Status |
|---|---|---|---|
| 2.1 | **17 vulnerabilidades** (15 high, 1 critical) | `next` + deps transitivas atualizadas via `npm audit fix` | ⚠️ **Parcial**: restam 10 high sem fix não-break (`xlsx` Prototype Pollution/ReDoS, `prisma→mysql2`, `eslint-config-next`). Prisma 6/xlsx(mouse) exigem mudança major — **ação pendente do dono** |
| 2.2 | **500 com detalhes** (ciclo inexistente, `periodDays` estourado) | `weight-service`: ciclo inexistente/ciclo de outro animal → `ValidationError` (400); `report-service`: `periodDays` clamped em 3650 | ciclo inválido → 400 ✅ · `periodDays=999999999` → **200** (re-testado) |
| 2.3 | **JWT 30d sem revogação** | Logout delete cookie (token Bearer segue válido até expirar) | 🔴 **Pendente** (precisa tabela de sessões/jti) |
| 2.4 | **Farms enumeráveis via `/api/farms/join`** | Aprovação obrigatória agora (1.4) remove o ganho prático; mensagens mantidas | ⚠️ Parcial (enumeração técnica continua, mas não dá acesso) |
| 2.5 | **Duplicado → 500** | `ConflictError` (409) no `animal-service` | 2ª criação → **409** (re-testado) |

## 3. Falhas de risco MÉDIO (🟡) — status

| # | Falha (original) | Correção | Status |
|---|---|---|---|
| 3.1 | **XSS armazenado** (`numeroIdentificacao`, `observacao` crus) | `lib/validations.ts`: `safeText()` bloqueia `<tags>`, `on*=`, `javascript:`, `{{}}`, `${}`; regex de identificação restringe a `ações letras/números-_/.\`; `lib/sanitize.ts` p/ registro | `<script>` → **400**; `<svg onload>` em observação → **400**; SQLi/SSTI → **400**; texto legitimo → 201 (re-testado) |
| 3.2 | **CORS `*` + credentials** | `next.config.ts`: sem `CORS_ORIGIN` não emite headers CORS; com `CORS_ORIGIN` sai sem `*` | `curl -I /api/animals`: **nenhum header CORS genérico** (re-testado) |
| 3.3 | **Senha fraca** (`123456`) | mínimo **8 chars** + letras e números + bcrypt rounds 10→**12** | `123456` → 400; `abcdefgh` → 400 (re-testado) |
| 3.4 | **Token Turso leitura/escrita total** | (1.7) — mitigado com RCE fechado; rotação de token pendente de infra | ⚠️ Parcial |
| 3.5 | **Export/PDF renderizam strings cruas** | Raiz fechada na entrada (3.1): dado novo não entra mais sujo | ✅ (dado antigo sujo, se existir, precisa de migração de limpeza) |

## 4. Falhas de risco BAIXO (🟢) — status

| # | Falha | Correção | Status |
|---|---|---|---|
| 4.1 | Higiene dos usuários reais no banco prod | — | Informativo (dono decidir limpeza demo/trash) |
| 4.2 | `/api/health` expunha uptime/responseTime/DB | Route reescrita: só `{status}` — 200/503 | **healthy sem detalhes** (re-testado) |
| 4.3 | Sem CSP | Pendente (header `Content-Security-Policy` no next.config) | ⚠️ Pendente |
| 4.4 | Logs com dados de request | Melhorado em rotas corrigidas; outros consoles permanecem | ⚠️ Parcial |
| 4.5 | Criação de contas ilimitada | Senha forte + bcrypt12 elevam custo; rate-limit conta/IP endurece abuso | ⚠️ Parcial (sem verificação de e-mail ainda) |

## 5. Pontos FORTES mantidos

✅ Login sem enumeração de usuários · ✅ bcrypt · ✅ JWT HS256 (alg:none rejeitado) · ✅ middleware cobre /api
✅ `/api/sync` valida fazenda · ✅ Zod valida tipos/limites · ✅ SQL injection bloqueada (Prisma)
✅ Security headers (HSTS, nosniff, XFO, Referrer, Permissions) · ✅ Sem secrets no git

## 6. Roadmap restante (por prioridade)

1. **Upgrade Prisma 6+ e trocar `xlsx`** (ou isolar export em worker + CSP) — 10 high de `npm audit`
2. **Revogação de sessão** (`jti` + lista de sessões; logout invalida o Bearer)
3. **CSP** no `next.config.ts`
4. **Rotação do token do Turso** + verificação de e-mail no registro
5. Limpeza de contas demo/trash do banco de produção

---

### Metodologia da revisão (independente, pós-correção)
- Servidor **reiniciado** com o código novo (cache invalidado — o revisor detectou e corrigiu um falso-positivo de "200" servido pela build antiga)
- Ataques re-executados: IDOR ×3 endpoints, roles MEMBER (pesagem/venda/criação/leitura), registro com farmCode alheio (aprovação verificada), brute-force com 6+ IPs forjados (por-conta), config remota/local, XSS/SQLi/SSTI, duplicado, periodDays, CORS, health
- `npm test` **60/60** ✅ · `npm run lint` **0 erros** ✅ · `npx tsc --noEmit` ✅
- Contas de teste da revisão: **apagadas** (verificado: 0 restantes); `server-url.json` restaurado

---

## 7. Revisão de 09/10/2026 — falhas que a auditoria anterior deu como fechadas

Revisão independente do código encontrou caminhos que contornavam as correções
acima. Todos foram corrigidos e **verificados contra o servidor rodando** (roteiro
de 48 ataques/regressões, todos passando) + testes unitários (60 → 83).

### Decisão de produto: permissões (substitui a semântica da 1.3)
MEMBER **lança registros de manejo** (pesagem, vacina, vermífugo, vitamina) pelo
site e pelo app; **não** cadastra/exclui/vende boi nem inicia ciclo. Antes, o site
bloqueava o MEMBER, mas o `/api/sync` deixava passar sem checar nada.
Helper novo: `userCanRecordInFarm()`; `userCanWriteToFarm()` segue para gestão do rebanho.

| # | Falha encontrada | Correção |
|---|---|---|
| 7.1 | `/api/sync` sem checagem de nível, sem filtro XSS, sem limite de tamanho/requisições, aceitava `cicloId` de **outra fazenda** e animal vendido, vazava `error.message` | Validação por registro (recusados voltam em `rejeitados` e ficam pendentes no app), ciclo precisa ser do animal e ativo, animal precisa estar ATIVO, máx. 500/tipo, rate limit por usuário, `criadoPorId` gravado, erros genéricos |
| 7.2 | Vermífugo/vitamina sem Zod, sem XSS, sem checar ciclo/animal vendido; data inválida → 500 | `vermifugeSchema`/`vitaminSchema` + `assertCanRecord()` compartilhado com pesagem/vacina |
| 7.3 | **IDOR** em `/api/animals/:id/report?cicloId=` (ciclo de outra fazenda vazava registros) | Ciclo buscado com `{ id, animalId }` |
| 7.4 | Idempotência por `clientGeneratedId` devolvia registro de **outro animal** | `resolveExisting()` recusa (409) |
| 7.5 | `POST /api/config/*` aceitava qualquer um na **rede local** → redirecionar o app para servidor falso | Rotas POST removidas; scripts gravam o arquivo direto; GET só devolve URL `https://` |
| 7.6 | App Flutter enviava **e-mail e senha por HTTP** a IPs fixos em qualquer Wi-Fi; aceitava qualquer URL devolvida | Login só na URL do campo; sem IPs de roteador; só aceita túnel `https://`; sondagem da rede só quando o usuário pede |
| 7.7 | Login paralelo do **NextAuth** (`/api/auth/callback/credentials`) sem rate limit — força bruta por fora | NextAuth removido (não era usado) |
| 7.8 | Segredo JWT de exemplo (público no repo) era aceito → qualquer um forjaria login | Servidor recusa o valor de exemplo e segredos < 32 caracteres |
| 7.9 | Token de 30 dias sem revogação (era 2.3 pendente) | `User.tokenVersion` + "Sair de todos os dispositivos" (menu do site / `todosDispositivos` no logout) |
| 7.10 | `criadoPorId` descartado pelo Zod em pesagem/vacina | Incluído nos schemas |
| 7.11 | Erros 500 em: vender 2×, ciclo de animal inexistente, aprovar pedido 2×, data/status inválido, JSON malformado, e-mail não-texto no login | 400/404/409 com mensagem clara; aprovação em transação e só de pedido PENDENTE |
| 7.12 | E-mail com maiúscula virava outra conta | E-mail normalizado no cadastro/login; contas antigas encontradas sem diferenciar caixa |
| 7.13 | Pedido de entrada sem limite (spam/enumeração de códigos) | Rate limit 5/10 min + validação; código de fazenda novo com 10 hex (`crypto`) |
| 7.14 | Boi ATIVO duplicado em cadastros simultâneos | Índice único parcial `(farmId, numeroIdentificacao) WHERE status='ATIVO'` |
| 7.15 | Export **CSV** sem aspas e com risco de fórmula (`=...`) ao abrir no Excel | `lib/csv.ts`: aspas, neutralização de fórmula, BOM UTF-8 |
| 7.16 | `xlsx` 0.18.5 (Prototype Pollution/ReDoS, sem fix no npm) | SheetJS 0.20.3 (distribuição oficial cdn.sheetjs.com) |
| 7.17 | Seed com `demo@gado.com / 123456`, podendo rodar no Turso | Seed recusa banco remoto sem `SEED_ALLOW_REMOTE=1`; senha aleatória ou `SEED_DEMO_PASSWORD` |
| 7.18 | Headers `x-user-*` vindos do cliente não eram descartados | Proxy remove antes de tudo |

### Pendências conhecidas (decisão do dono / infra)
- **9 vulnerabilidades "high" no `npm audit`**: todas em ferramentas de desenvolvimento
  (`eslint-config-next` → braces/micromatch; CLI do `prisma` → mysql2/deepmerge-ts),
  não no código que roda para o usuário. O "fix" sugerido pelo npm é **rebaixar**
  (eslint-config-next 14 / prisma 6) — não aplicar; aguardar versões novas.
- **Rate limit em memória** zera ao reiniciar e vale por processo. Atrás do túnel,
  o IP vem do `cf-connecting-ip` (confiável); acesso direto pela rede local pode
  forjar esse header e contornar o limite por IP (o limite por e-mail no login segue valendo).
- **App Flutter**: token salvo em `SharedPreferences` (sem criptografia) e HTTP liberado
  para a rede local (`usesCleartextTraffic`) — aceitável em desenvolvimento; para
  produção, usar `flutter_secure_storage` e só HTTPS.
- Histórico do git ainda contém um `dev.db` antigo (só dados demo).
