# ⚠️ IMPORTANTE — LER ANTES DE USAR ESTA VERSÃO

Esta branch (`fix/revisao-seguranca`) corrige as falhas da revisão de segurança de
09/10/2026. O detalhe técnico de cada correção está na **seção 7 do
`SECURITY-AUDIT.md`**. Aqui está só o que **você precisa fazer** e o que **ficou de fora**.

---

## ✅ O que você PRECISA fazer (nesta ordem)

### 1. Atualizar o banco do Turso — ANTES de rodar o código novo

O usuário ganhou uma coluna nova (`tokenVersion`), usada para "Sair de todos os
dispositivos". Também foi criada uma regra no banco que impede dois bois **ativos**
com o mesmo número na mesma fazenda.

```bash
npm install
node scripts/push-schema-turso.ts
# (Node antigo? use: npx tsx scripts/push-schema-turso.ts)
```

> 🔴 **Sem esse passo, o login e as rotas da API param de funcionar.** O código novo
> procura a coluna nova no banco.

O script pode rodar quantas vezes quiser: ele só cria o que falta.

Se aparecer um ❌ no índice `Animal_farm_numero_ativo_key`, é porque o banco **já
tem** dois bois ativos com o mesmo número na mesma fazenda. Resolva esses
duplicados (venda ou exclua um deles) e rode o script de novo.

### 2. Trocar o `NEXTAUTH_SECRET` no `.env`

Esse segredo é o que assina os logins. Se ele ainda estiver com o valor de exemplo
(`mude_este_secret_em_producao`), **qualquer pessoa consegue entrar como qualquer
usuário**, porque esse valor está no repositório público.

Agora o servidor **se recusa a subir** com o valor de exemplo ou com um segredo de
menos de 32 caracteres. Gere um novo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Cole o resultado no `.env`:

```
NEXTAUTH_SECRET="valor-gerado-aqui"
```

> Trocar o segredo desloga todo mundo uma vez (celular, bots e site). É normal:
> basta entrar de novo.

### 3. (Se for testar pelo celular na rede local) IP do PC no `.env`

O IP `192.168.1.175` saiu do `next.config.ts`. Se você acessa o servidor de
desenvolvimento pelo IP do PC, coloque no `.env`:

```
DEV_ALLOWED_ORIGINS="192.168.1.175"
```

### 4. Testar e gerar de novo o app Flutter

Não deu para compilar o Flutter na máquina onde as correções foram feitas. Rode:

```bash
cd flutter_app
flutter test
flutter build apk --release
```

O que mudou no app:
- **Login:** a senha só é enviada para o endereço que está no campo. Se não conectar,
  ele mostra a mensagem e você toca na 🔍 lupa para procurar o servidor.
- **Busca automática:** não testa mais IPs de roteador e só aceita endereço de túnel
  com `https://`.
- **Sincronização:** registros que o servidor recusar (texto inválido, boi vendido,
  data errada) **ficam pendentes** no app para você corrigir na tela de pendentes.
  Antes eles sumiam sem aviso.

### 5. Arquivo `.runtime-config/server-url.json`

Ele saiu do git, porque muda toda vez que o túnel sobe e expunha o endereço no
repositório. Quando você puxar esta branch, **o arquivo some do seu PC**. Não tem
problema: os scripts `start-*.bat` recriam na próxima vez que o túnel subir.

---

## 🆕 O que mudou e você vai notar

| O quê | Como ficou |
|---|---|
| **MEMBER** | Lança pesagem, vacina, vermífugo e vitamina (site e app). **Não** cadastra, vende ou exclui boi, nem inicia ciclo. |
| **Quem registrou** | Todo registro guarda o usuário que lançou, inclusive os que vêm do app. |
| **Sair de todos os dispositivos** | Novo item no menu da fazenda (site). Desloga celular, bots e outros navegadores na hora. |
| **Seed** | Não roda mais no Turso por engano (precisa de `SEED_ALLOW_REMOTE=1`). A senha da conta demo é aleatória e aparece no terminal, ou vem de `SEED_DEMO_PASSWORD`. |
| **URL do túnel** | Não existe mais rota de API para trocar. Só os scripts locais gravam o arquivo. |
| **Login do NextAuth** | Removido. Não era usado e aceitava tentativas de senha sem limite. |
| **CSV** | Agora abre certo no Excel: acentos, vírgulas nos nomes e proteção contra fórmula maliciosa. |
| **`test-bot.ps1`** | Removido (estava quebrado). |

---

## ⏸️ O que ficou de fora (e por quê)

### Decisão sua
- **Pasta `android/` (app em Kotlin):** parece ser uma versão antiga, substituída pelo
  `flutter_app/`. Se não usa mais, vale apagar para não confundir. Não apaguei sem você
  confirmar.
- **`dev.db` antigo no histórico do git:** tem só dados de demonstração, então o risco
  é baixo. Remover exige reescrever o histórico e fazer `push --force`.
- **Token do app guardado sem criptografia:** o app usa `SharedPreferences`. Para
  produção, o ideal é usar a biblioteca `flutter_secure_storage`. Isso adiciona uma
  dependência nova, então ficou para você decidir.
- **HTTP liberado no app (`usesCleartextTraffic`):** necessário para testar na rede
  local sem HTTPS. Em produção, deixe só HTTPS.
- **Botões "Vender" e "Novo ciclo" aparecem para o MEMBER:** o servidor bloqueia
  (dá erro 403), mas seria melhor esconder esses botões para quem é MEMBER.

### Pendente de terceiros / infraestrutura
- **9 alertas "high" no `npm audit`:** todos em **ferramentas de desenvolvimento**
  (ESLint e a linha de comando do Prisma), não no que roda para o usuário.
  ⚠️ **Não rode `npm audit fix --force`**: ele **rebaixa** essas ferramentas para
  versões antigas e pode quebrar o projeto. Espere as próximas versões.
- **Limite de tentativas fica na memória:** ele zera quando o servidor reinicia. Atrás
  do túnel da Cloudflare, o IP é confiável. Acessando direto pela rede local, dá para
  falsificar o IP e contornar o limite por IP (o limite por e-mail no login continua
  valendo).
- **Modo de desenvolvimento (`npm run dev`) nos `.bat`:** ok por enquanto, já que o app
  não está no ar. **Quando for para produção**, troque por `npm run build` +
  `npm start`.
- **Pasta `prisma/migrations` desatualizada:** a migration inicial nem tem `farmId`. A
  fonte de verdade do banco é o `scripts/push-schema-turso.ts`.

---

## 🧪 Como foi verificado

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ (0 erros, 0 avisos) · `npm run build` ✅
- `npm test`: **83/83** ✅ (antes eram 60)
- Servidor real em modo produção com banco temporário: **48/48** ataques e
  verificações passaram. Alguns exemplos:
  - MEMBER lança pesagem e não consegue vender;
  - ciclo de outra fazenda é recusado;
  - texto malicioso no app é recusado;
  - token antigo para de valer depois de "sair de todos os dispositivos";
  - rotas antigas de troca de URL não existem mais.

Dúvidas: veja a seção 7 do `SECURITY-AUDIT.md` ou o `README.md` (passo a passo de
instalação e tabela de permissões).

---

# 🆕 Atualização: excluir boi, remover membros e velocidade das páginas

Branch `feat/gestao-fazenda-e-desempenho`, que continua a de segurança. **Não precisa
mudar nada no banco**: é só puxar e rodar.

## Excluir boi
- Botão **"Excluir Boi"** na ficha do animal, para **OWNER e ADMIN**.
- Pede confirmação e mostra quanto histórico vai junto (ciclos, pesagens, vacinas...).
- Se o boi foi vendido, a tela sugere usar **"Marcar como Vendido"**, que mantém o
  histórico.

## Remover membros
- Botão **"Remover"** na página de membros:
  - o **OWNER** remove ADMIN e MEMBER;
  - o **ADMIN** remove só MEMBER;
  - ninguém remove o dono, e ninguém remove a si mesmo.
- A pessoa perde o acesso **na hora**, no site e no app. Os registros que ela lançou
  continuam, com o nome dela.
- Não existe tela para promover alguém a ADMIN (já era assim antes). Se quiser, dá
  para fazer depois.

## Botões escondidos para quem não pode usar
Para o MEMBER, somem "Novo Animal", "Marcar como Vendido", "Novo Ciclo" e "Excluir
Boi". O servidor já bloqueava essas ações; agora a tela também não oferece.

## Por que estava lento e o que mudou (medido no navegador, modo dev, 200 bois)

| Problema encontrado | Correção | Resultado |
|---|---|---|
| O menu do topo disparava de **11 a 14 chamadas** à API em cada página (a mesma chamada repetida em cascata) | Uma chamada só (`/api/auth/me`), compartilhada entre menu e páginas | **2 chamadas** por página |
| No modo dev, a **primeira visita** a cada página espera o Next montá-la (até 7 s). O clique parecia "não funcionar" | Logo após o login, o site pede para o servidor montar as páginas em segundo plano (**só no `npm run dev`**, em produção não roda) | Ficha do boi: 5,0 s → **1,1 s**. Relatório do boi: 6,9 s → **2,2 s** |
| Relatório do boi carregava as bibliotecas de PDF e Excel ao abrir | Agora carregam só ao clicar em exportar | Página mais leve |
| Relatórios, membros e pedidos buscavam tudo de novo a cada visita | Cache (mostra na hora e atualiza por trás) | Voltar a membros/pedidos: ~0,1 s |
| Dashboard desenhava **todos** os bois de uma vez | Mostra 30 e botão "Mostrar mais" (a busca procura em todos) | Voltar ao dashboard: 0,7 s → **0,2 s** |
| Depois de lançar uma pesagem, a tela **piscava** o carregamento | Os dados antigos continuam na tela enquanto atualiza | Sem piscar |
| Cartões "Pesagens" e "Vacinas" do dashboard mostravam **sempre 0** | A API agora calcula os totais | Números reais |
| Rotas do servidor consultavam o banco em sequência e repetiam consultas | Consultas em paralelo e sem repetição | Menos idas ao Turso por clique |

> No Turso (banco na nuvem) o ganho tende a ser **maior** do que nas medições acima,
> que foram feitas com banco local: cada chamada e cada consulta a menos economiza
> uma ida pela internet.

**Aviso:** o Next 16 cria sozinho um arquivo `AGENTS.md` na pasta do projeto quando
roda `npm run dev`. Ele não faz parte do app. Se não quiser que ele apareça, coloque
`agentRules: false` no `next.config.ts`, ou só não faça commit dele.
