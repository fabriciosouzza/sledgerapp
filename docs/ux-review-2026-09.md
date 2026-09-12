# Revisão de usabilidade por personas — setembro de 2026

Três revisões independentes, cada uma feita por um agente que leu a spec
(`PROMPT.md`), as decisões (`DESIGN.md`), o guia interno e todo o código das
telas, componentes e serviços, e simulou a rotina de uma persona sem executar
o app. Os relatórios estão na íntegra nas seções 1–3; a seção 4 cruza os três.

Personas:

1. **Daniel, o registrador diário** — lança tudo, todo dia, dois cartões; compra cripto e dólar e quer registrar o valor de mercado quase diariamente.
2. **Marina, a revisora semanal** — domingo à noite lança a semana, baixa as contas pagas, aplica as recorrências (água e luz variáveis) e registra o rendimento da renda fixa uma vez por mês.
3. **Rafael, o conferidor quinzenal** — dia 5 e dia 20, só para saber se pagou tudo; quase não lança despesas; some por semanas.

---

# Relatório de usabilidade — persona "Daniel, o registrador diário"

Base: leitura de `PROMPT.md`, `DESIGN.md`, `app/(app)/**`, `components/**` e `lib/services/**` (sem executar o app).

## 1. Rotina simulada

**Chegar ao formulário.** FAB (`components/layout/add-sheet.tsx`) → sheet "What happened?" → tipo → `/add`. **2 toques** sempre; a sheet nunca é pulada. Alternativa: chip "Expense" em Quick actions de Today (1 toque, mas exige rolar).

**Despesa 1 — café, débito (R$ 6,50).** `/add` abre com foco no valor e teclado numérico (`components/forms/currency-input.tsx`). Valor (digita) · data = hoje (0) · categoria e conta lembradas por tipo em `localStorage` (`entry-form.tsx`, `MEMORY_KEY`) · descrição obrigatória (1 toque + digitar) · **"Already paid?" começa desligado** (`useState(entry?.status === "settled")` → `false`) — se não ligar (1 toque), o café vira *planned* e aparece amanhã como **overdue** em Today · Save. **~4 toques + 2 campos digitados.** Após salvar o formulário permanece em `/add` com tipo/categoria/conta/data/toggle preservados (só `formKey` remonta os campos não controlados) — bom.

**Despesa 2 — Uber, cartão A.** Trocar conta no `<select>` nativo (2 toques). Ao escolher cartão, o toggle some e a entrada nasce settled (`lib/services/entries.ts`, `onCard`). Categoria lembrada é a do café → mais 2 toques. **~7 toques + 2 campos.**

**Despesas 3–6** (mercado no cartão B, padaria no débito, farmácia cartão A, almoço no débito): cada troca de conta/categoria custa 2 toques; a memória guarda **um** par por tipo (`Memory[EntryKind]`), então alternar entre débito/cartão A/cartão B nunca "acerta". Média **6–7 toques + descrição digitada** por despesa; **~40 toques/dia** só nas despesas. Descrição não tem sugestões (`autoComplete="off"`), então "Café" é digitado todo dia.

**Transferência (checking → Reserva).** FAB → Transfer → valor, From/To lembrados, **descrição obrigatória** (schema `requiredText` em `lib/schemas/entries.ts`), Save. **~4 toques + 2 campos.**

**Compra de cripto com dinheiro saindo da conta.** Caminho correto: Portfolio (1) → ativo (1) → "Add movement" (1) → kind já é Contribution → valor → "Record the cash entry" ligado por padrão com From = 1ª conta cash, To = 1ª brokerage → Save. **~4 toques + 1 campo**, descrição gerada ("Aporte BTC"). Armadilha: o FAB oferece "Contribution" (`add-sheet.tsx`), que cria só a entry e **não toca o portfólio**; se ele depois registrar o movimento com o toggle padrão ligado, conta duas vezes.

**Atualizar valor de mercado (cripto e dólar, quase diário).** Por ativo: Portfolio → ativo → Add movement → select Kind → "Market adjustment" (2) → **calcular de cabeça** saldo da corretora − saldo mostrado → digitar → toggle "Loss" se caiu (1) → Save → volta ao ativo (`router.push`) → nav Portfolio → segundo ativo, repete. **~7–8 toques + aritmética por ativo, ~15/dia.** Kind não é lembrado (`movement-form.tsx` sempre inicia em `contribution`).

**Como está o mês.** Today já traz cash derivado, insight (`lib/domain/insights.ts`), "Leftover this month". Review (1 toque): tiles, linha de gasto diário vs mês passado, donut, tabela por categoria com caps. **1 toque.**

**Faturas e pagar uma.** Tile do cartão em Today (1) → `/cards?card=…` mostra fatura aberta com lançamentos; rolar até "Past statements" → Pay (1) → From (padrão 1ª conta) → data hoje → Pay (1). **~3 toques.** Porém a fatura **fechada e ainda não paga** não aparece no tile (mostra o ciclo *aberto*, `card-tile.tsx` usa `card.open`) nem em "Due in 7 days" (`lib/services/today.ts` exclui entradas de cartão e não soma faturas).

**Split do portfólio.** Portfolio (1): donut por classe, totais, lista de ativos. Sem % por ativo nem retorno por ativo.

**Semana:** ~30 despesas ≈ 200 toques; ~6 ajustes de mercado ≈ 90 toques; 1–2 aportes; 1 fatura. O gargalo é o ajuste de mercado, seguido da troca de conta na despesa.

## 2. O que funciona bem

- `/add` abre no valor, teclado numérico, centavos direto; formulário fica aberto após salvar com tipo/conta/categoria/data preservados — entrada em lote é rápida.
- Cartão: compra nasce settled, sem toggle; parcelamento com preview; fatura fechada por competência e pagamento como transfer (`lib/services/cards.ts`) — ele nunca precisa "pagar" compra a compra.
- Aporte a partir do ativo cria a entry pareada com descrição automática e a edita/deleta junto (`lib/services/portfolio.ts`).
- Saldo derivado em Today ("Cash on hand", `account-strip.tsx`) é exatamente o feedback "os números batem?" que ele quer: compara com o app do banco.
- Settle 1 toque com undo, long-press para outra data, swipe; "Settle N due today".
- Review dá o mês em uma tela, com linha diária e comparação com o mês anterior.

## 3. Atritos

| Atrito | Tela/arquivo | Gravidade | Por quê |
|---|---|---|---|
| "Already paid?" começa desligado a cada visita | `components/entries/entry-form.tsx` | alta | Registrador diário lança o que já pagou; esquecer gera overdue falso no dia seguinte |
| Market adjustment exige calcular a diferença e escolher sinal | `components/portfolio/movement-form.tsx` | alta | Operação quase diária; 7–8 toques + aritmética por ativo, sem mostrar o saldo atual no form |
| Kind/ativo do movimento não são lembrados; sempre volta ao ativo | `movement-form.tsx`, `app/(app)/portfolio/actions.ts` | alta | Dois ativos por dia = refazer a navegação inteira |
| Memória de conta/categoria é uma por tipo | `entry-form.tsx` (`Memory`) | média | Com 2 cartões + débito, a memória raramente acerta; select nativo custa 2 toques |
| FAB "Contribution" não cria movimento no portfólio | `components/layout/add-sheet.tsx`, `lib/services/entries.ts` | média | Duas portas para a mesma ação; uma deixa o portfólio desatualizado ou duplica |
| Fatura fechada não paga invisível em Today | `components/cards/card-tile.tsx`, `lib/services/today.ts` | média | Vencimento em 5 dias não entra em "Due in 7 days" nem no tile |
| Descrição obrigatória, sem sugestões | `entry-form.tsx`, `lib/schemas/entries.ts` | média | "Café", "Uber", "Transferência" digitados todo dia; transfer sequer precisaria |
| Sheet de tipo sempre aparece no FAB | `add-sheet.tsx` | baixa | 1 toque extra por sessão; mitigado por ficar em `/add` |
| Toast "Saved" sem valor/descrição; nenhuma lista dos últimos lançamentos em `/add` | `entry-form.tsx` | baixa | Confirmar que digitou certo exige ir a Entries |
| Sem botão voltar; editar entry sempre leva a `/entries` | `components/layout/page-header.tsx`, `entry-form.tsx` | baixa | Vindo de Today, perde o contexto |
| Sem % por ativo nem retorno por ativo | `app/(app)/portfolio/page.tsx` | baixa | "Split" só por classe |

## 4. O que falta

- **Cotações/valor de mercado automático** — *fora do escopo da spec* (§5.7 "no quotes").
- **Modo "novo saldo é X"** para market adjustment: o app calcula a diferença e o sinal. Dentro do escopo.
- **Atalhos/favoritos de lançamento** (Café R$ 6,50 débito; Uber cartão A) e sugestão de descrições recentes.
- **Chips de conta recente** no lugar do select para despesa.
- **Vencimento de fatura em Today** ("Due in 7 days" + tile mostrando a fatura fechada quando existir).
- **Total gasto hoje / esta semana** em Today.
- **Token de API** para lançar via atalho do celular (`app/api/entries/route.ts` existe, mas só aceita sessão via cookie) — não é excluído pela §1, mas não está previsto.
- **Import OFX/CSV, Open Banking, app nativo** — *fora do escopo da spec* (§1).

## 5. Top 3 mudanças

1. **Ajuste de mercado por "saldo atual"**: no `MovementForm`, quando kind = `market_adjustment`, mostrar o saldo registrado e um campo "Balance at the broker"; calcular `amountCents` (com sinal) no cliente; lembrar último kind por ativo em `localStorage`; após salvar, oferecer "Next asset" em vez de `router.push`. Arquivos: `components/portfolio/movement-form.tsx`, `app/(app)/portfolio/new/page.tsx` (passar `summary.balanceCents` via `assetDetail`).
2. **Default de "Already paid?" = ligado para despesa/receita com data ≤ hoje, e lembrado na memória por tipo**: `entry-form.tsx` (`useState(settled)` + `Memory` ganha `settled`); zero mudança de schema.
3. **Chips de contas/categorias recentes acima dos selects em `/add`** (últimas 3 por tipo, em `Memory` como lista) e `<datalist>` de descrições recentes (`repos.entries.list` dos últimos 30 dias, distinct). Arquivos: `components/entries/entry-form.tsx`, `app/(app)/add/page.tsx`.

Bônus pequeno e de alto valor: unificar a porta do FAB "Contribution" com o movimento (redirecionar para `/portfolio/new?pair=1`) em `components/layout/add-sheet.tsx`, e incluir faturas fechadas não pagas em `dueSoonCents` e no `CardTile` (`lib/services/today.ts`, `components/cards/card-tile.tsx`).

---

# Revisão de usabilidade — persona "Marina, a revisora semanal"

## 1. Rotina simulada

**Cenário assumido:** Conta Corrente (caixa), Cartão (crédito, fecha dia 3, vence dia 10), Corretora; categorias semeadas com caps em Alimentação/Lazer/Transporte; recorrências Aluguel, Internet, Academia, Salário, Água e Luz (variáveis); ativos CDB e Tesouro Selic. Domingo 12/09.

**Domingo — abrir o app (0 toques).** `app/(app)/page.tsx` mostra: saldo em caixa (hero), frase de insight com anel de taxa de poupança, "Due in 7 days", "Leftover", faixa de contas/cartão, ações rápidas, bloco Overdue, "Next 7 days", patrimônio.

**Registrar ~10 lançamentos.** FAB (1) → "Expense" no sheet (1) → `/add` com valor focado e teclado numérico. Primeiro lançamento: valor + Data (2 toques: abrir sheet, tocar dia) + Categoria (2, select nativo) + Descrição + "Already paid?" (1) + Save (1) ≈ **8 toques, 2 campos digitados**. Nos seguintes, `EntryForm` remonta só o `<form>` (`formKey`) e mantém em estado `kind`, `date`, `categoryId`, `accountId` e `settled`, então o custo cai para valor + descrição + Save, mais 2 toques quando muda a data e 2 quando muda a categoria: **≈ 4 toques + 2 campos** cada. Total: **≈ 45 toques e 20 campos**. Três compras no cartão: trocar "Account" (2) e voltar (2); ao escolher o cartão o toggle some e o lançamento nasce liquidado na data da compra (`lib/services/entries.ts`, `onCard`). Ela precisa **lembrar** o que já digitou: `/add` não lista os lançamentos da sessão, só um toast "Saved".

**Baixar 4 contas pagas na semana.** No bloco Overdue da Today: 1 toque no círculo por conta = **4 toques**, com undo no toast — mas todas ficam `settled_on = domingo`. Para a data real: segurar 450 ms → sheet → Data (2) → Settle (1) = **4 interações por conta**. Seleção múltipla não existe na Today (`selectable={false}`); em `/entries` ou `/review` "Settle several…" (1) + n toques + Settle (1), sempre com data de hoje.

**Aplicar recorrências com Água variável.** Ação rápida "Generate 6 recurring" (1) → card no topo de `/review` (`components/recurrences/generate-month.tsx`) com valor editável por linha: Água (1 toque + campo), Luz (idem) → "Add 6 entries" (1) = **4 toques + 2 campos**. Bom. Mas é tudo ou nada: não dá para pular a Academia num mês; e se a conta de água ainda não chegou, ela aceita a estimativa e depois edita o lançamento (linha → `/entries/[id]` → valor → Save changes, que sempre a devolve a `/entries`, não de onde veio).

**Rendimento mensal em 2 ativos.** Portfolio (1) → ativo (1) → Add movement (1) → Kind, que sempre nasce "Contribution" (2) → valor → Data se não for hoje (2) → Save (1) = **6–8 toques + 1 campo por ativo**; entre um e outro, Portfolio de novo (1). Total ≈ **15 toques**. Nenhuma tela "rendimento do mês de todos os ativos".

**Revisar o mês.** Review (1). Vê 8 tiles iguais (renda, despesa, contribuições, sobra, duas taxas de poupança, custo fixo, runway), linha de gasto diário, barra "R$ X of R$ Y · Z%", donut, tabela por categoria com cap e barra vermelha no estouro, últimos 6 meses, "Still planned". Cobre tudo que ela quer; a taxa de poupança não tem destaque entre os 8.

**Próxima semana e cartão.** "Due in 7 days" e a lista "Next 7 days" (0 toques) — **excluem a fatura**. A tile do cartão mostra apenas o ciclo *aberto* (`lib/services/cards.ts`, `open = cycle containing today`): no dia 12, com fatura fechada dia 3 e vencendo dia 10, a tile diz "due in ~28d" do próximo ciclo enquanto a fatura vencida aparece só em More → Cards → cartão → "Past statements" (3 toques + rolagem). Pagar: Pay (1) → From (2) → Paid on (2) → Pay (1) ≈ **6 toques**.

**Saldo em caixa.** Hero da Today = saldo inicial + lançamentos liquidados (`lib/domain/balances.ts`). Como ela lança de memória, o número diverge do banco e o guia manda "add an entry" — sem ajuda para achar a diferença.

## 2. O que funciona bem para essa persona

- **Regras de dinheiro honestas**: cartão é dívida, fatura é transfer, rendimento fica fora da taxa de poupança, `—` em vez de zero (`lib/domain/metrics.ts`, `insights.ts`).
- **Formulário rápido em sequência**: valor focado, teclado numérico, memória de categoria/conta por tipo (`localStorage`), estado preservado entre saves.
- **Aplicar mês com valores editáveis** direto na Review, com badge "variable" e idempotência.
- **Baixa em 1 toque com undo** em toda lista; linhas baixadas permanecem visíveis (`OverdueBlock`, `recent`).
- **Review completa**: caps com barra vermelha, orçamento = soma dos caps, donut, 6 meses.
- **Guia interno** (`guide/page.tsx`) explica exatamente os termos que ela veria.

## 3. Atritos

| Atrito | Tela/arquivo | Gravidade | Por quê |
|---|---|---|---|
| Fatura fechada e não paga não aparece em "Due in 7 days" nem na tile do cartão (que mostra o ciclo aberto) | `lib/services/today.ts`, `components/cards/card-tile.tsx`, `lib/services/cards.ts` | alta | O maior pagamento do mês fica invisível na tela que responde "o que devo fazer agora"; ela pode atrasar a fatura. |
| Baixa em lote e baixa rápida gravam `settled_on = hoje` | `entry-list.tsx` (`settleSelected`), `entries/actions.ts` (`settleManyAction`) | média | Quem revisa no domingo liquida tudo com a data errada; saldo por dia e "paid on" ficam falsos. O caminho certo (long-press) é invisível e custa 4× mais. |
| Sem lista do que foi lançado na sessão em `/add` | `app/(app)/add/page.tsx`, `entry-form.tsx` | média | Com 10–20 lançamentos de memória ela perde a conta e duplica; conferir exige More → Entries. |
| Insight "Spending down 58% vs last month" compara mês parcial com mês cheio | `lib/domain/insights.ts`, `review/page.tsx` (`deltaHint`) | média | É a primeira frase da Today e quase sempre engana antes do dia 25; contradiz "calm, clear picture". |
| Rendimento: 6–8 toques por ativo, Kind sempre volta a "Contribution", sem batch | `components/portfolio/movement-form.tsx`, `portfolio/[id]/page.tsx` | média | Tarefa mensal repetitiva; com 5 ativos vira 40 toques. |
| Gerar mês é tudo-ou-nada | `generate-month.tsx` | média | Um mês sem academia ou sem internet obriga gerar e depois apagar. |
| "Still planned" na Review e `/entries` mostram parcelas de cartão com círculo de baixa | `review/page.tsx` (`summary.planned`), `entry-list.tsx` | média | Today filtra cartão (`toSettle`), Review não; baixar uma parcela ali contorna o fluxo "pagar fatura". |
| Sem botão "voltar" nos subpáginas; editar lançamento sempre cai em `/entries` | `components/layout/page-header.tsx`, `entry-form.tsx` (`router.push("/entries")`) | média | Corrigir o valor da água a partir da Review a joga em outra tela; em PWA sem gesto de voltar é pior. |
| "Paid on" não acompanha a data quando ela muda a data no lançamento seguinte com o toggle já ligado | `entry-form.tsx` (`DatePicker defaultValue` não controlado) | baixa | `settled_on` fica com a data do lançamento anterior; erro silencioso. |
| "Repeat monthly" no `/add` cria recorrência sem opção "variable" | `lib/services/entries.ts` (`isVariable: false`) | baixa | Água/Luz criadas por ali exigem ir em Recurrences editar. |
| Saldo diverge do banco e só há o conselho "add an entry" | `net-worth/page.tsx`, `guide/page.tsx` | baixa/média | Registro de memória sempre deriva; sem ajuda ela desiste de confiar no hero. |

## 4. O que falta

- **Fatura como item devido**: a fatura fechada/não paga listada em "Next 7 days"/Overdue com ação "Pay". Dentro do escopo (§7 Today: "days to due date").
- **"Fix balance"** (digitar saldo do banco → diferença vira lançamento). Discutido e deixado de fora em DESIGN.md; dentro da spec.
- **Rendimento em lote** (uma tela "yield deste mês" com um campo por ativo). Dentro de §7 Portfolio.
- **Data na baixa em lote** e "Paid on" opcional no toque simples.
- **Checkbox por linha ao gerar mês** (pular uma recorrência neste mês).
- **Filtro "esta semana" em Entries** (o que lancei hoje).
- Importar notificações do banco/OFX — **fora do escopo da spec (§1)**.
- Lembretes/push de vencimento — **fora do escopo** (DESIGN.md "Notification bell").

## 5. Top 3 mudanças

1. **Fatura fechada e não paga na Today e no "Due in 7 days".** Em `lib/services/today.ts`, somar `card.past` com `paidOn === null` e `daysToDue ≤ 7` em `dueSoonCents` e renderizar uma linha "Fatura Cartão · due dd/MM" com `PayStatementDialog`; em `card-tile.tsx`, quando existir fatura fechada não paga, mostrar ela (não o ciclo aberto).
2. **Data na baixa em lote + "lançados hoje" no `/add`.** Em `entry-list.tsx`, a barra de seleção ganha um `DatePicker` (default hoje) e passa `settledOn` a `settleManyAction`; em `entry-form.tsx`, após `createEntryAction`, acumular `result` num estado e listar abaixo do botão (descrição · valor · data) com link para editar.
3. **Rendimento mensal em uma tela.** Nova `app/(app)/portfolio/yield/page.tsx` que lista ativos ativos com um `CurrencyInput` cada e uma data, e uma action que chama `addMovement` (kind `yield`) por ativo preenchido — mesmo padrão do `GenerateMonth`. Link "Record this month's yield" no topo de `/portfolio`.

---

# Revisão de usabilidade — persona "Rafael, o conferidor quinzenal"

Base: `PROMPT.md`, `DESIGN.md`, `app/(app)/guide/page.tsx`, todas as telas em `app/(app)/**`, componentes em `components/**` e serviços em `lib/services/**`. Nenhum arquivo foi alterado.

## 1. Rotina simulada

**Contexto:** Rafael tem `Conta Corrente` (saldo inicial informado), um cartão (`Nubank`, fecha dia 3, vence dia 10), 6 recorrências (aluguel, luz, água, internet, salário, "Fatura Nubank") e um parcelamento de 10x. Não lança compras. Última visita: 20/07 (aplicou julho). Hoje é 05/09.

**Visita do dia 5 (após ~6 semanas)**

| Passo | O que ele vê / faz | Toques |
|---|---|---|
| Abrir Today (`app/(app)/page.tsx`) | Primeiro na tela: "Cash on hand" derivado (`lib/domain/balances.ts`) — inflado, porque nenhuma compra foi lançada; abaixo, o card de insight "You kept 71% of what came in" em tom verde (`lib/domain/insights.ts`). Só depois de hero, insight, 2 stats, strip de contas e quick actions vem o bloco **Overdue**. No mobile (coluna única) é a 6ª seção: rolagem obrigatória antes de responder "paguei tudo?". | 0 + rolagem |
| Agosto não aplicado | **Nada avisa.** `todayOverview` chama `previewGeneration` só para o mês corrente (`lib/services/today.ts`), e `/recurrences` mostra "This month and next" (`components/recurrences/months-status.tsx`). O aluguel de agosto nunca virou entrada, logo nunca aparece como atrasado. Descobrir isso exige More → Recurrences (não mostra) ou Review → seletor de mês → agosto → card "6 recurring entries not applied". | 4–5, e só se desconfiar |
| Aplicar setembro | Chip "Generate 6 recurring" nas quick actions (`components/today/quick-actions.tsx`) — é o 5º chip de uma `tile-strip` com rolagem horizontal, provavelmente fora da tela a 360 px. Tocar → `/review` → card `GenerateMonth` com valores editáveis → "Add 6 entries". | 2 (+ rolagem lateral) |
| Ver o que venceu | Bloco Overdue com "Overdue · 4 to settle · R$ 2.310,00" (`components/entries/entry-list.tsx`, `summary`). Bom resumo. | 0 |
| Baixar 5 contas | No Today `selectable={false}`: um toque no círculo por linha, cada um com toast + Undo. Alternativa no `/review` "Still planned": "Settle several…" + 5 checkboxes + "Settle 5" = 7 toques, pior. | 5 |
| Fatura do cartão | Tile mostra "R$ 0,00 · due in 5d · 10/09" (`components/cards/card-tile.tsx`). Em `/cards`, "Pay statement" está **desabilitado** (`totalCents <= 0` em `pay-statement-dialog.tsx`) e "Past statements" está vazio (`groupByCycle` só agrupa ciclos com entradas). Sem compras lançadas, o cartão é inerte. A saída é a recorrência "Fatura Nubank" — como *expense* (contra o guia) ou como *transfer* (aí Review mostra despesa zero). | Impossível pelo fluxo oficial; via recorrência: 1 |
| "Está tudo pago?" | Se o bloco Overdue sumiu (`OverdueBlock` retorna `null` quando não há nada) e "Next 7 days" está limpo, sim. Sinal por ausência, sem confirmação positiva; e a fatura não entra na conta. | ~40 s se ele ignorar os números do topo |

**Visita do dia 20:** mesmo caminho. As contas entre os dias 13 e 19 nunca apareceram como "upcoming" na visita do dia 5 (janela de 7 dias, `UPCOMING_DAYS` em `lib/services/today.ts`) — só surgem agora, já como atrasadas. Parcela do dia 20: aparece como "Today"; chip "Settle 1 due today" resolve com 1 toque.

## 2. O que funciona bem para essa persona

- **Baixa em um toque com undo** (`entry-list.tsx`): rápido, reversível, sem formulário. Long-press para escolher a data é opcional, não obriga precisão.
- **Resumo no título do Overdue** ("4 to settle · R$ X" / "all settled"): responde a pergunta dele numa linha.
- **Entradas atrasadas de qualquer mês** aparecem: `repos.entries.list({ status: "planned", to: hoje+7 })` não tem `from`, então um boleto de junho ainda está lá.
- **Geração com valores editáveis** e "variable" como estimativa (`generate-month.tsx`): não pede o valor exato da água no dia 5.
- **Idempotência da geração**: apertar duas vezes não duplica nada.
- **"Settle N due today"** e o card `GenerateMonth` no topo do Review: dois atalhos certos para ele.
- **Parcelamentos** criados de uma vez e visíveis como entradas planejadas normais (se na conta corrente).

## 3. Atritos

| Atrito | Tela/arquivo | Gravidade | Por quê |
|---|---|---|---|
| Mês anterior não aplicado passa em silêncio | `lib/services/today.ts`, `app/(app)/recurrences/page.tsx` | alta | Só o mês corrente é pré-visualizado; contas de agosto nunca existem, logo nunca ficam "overdue". O app diz "all settled" e mente. |
| Cartão sem compras = fatura impagável | `components/cards/pay-statement-dialog.tsx`, `lib/services/cards.ts` (`payStatement`), `app/(app)/cards/page.tsx` | alta | Total 0 desabilita o botão e o serviço lança "nothing to pay". A conta mais importante dele não tem lugar no modelo. |
| Overdue abaixo da dobra | `app/(app)/page.tsx` | alta | Hero, insight, stats, strip e quick actions vêm antes. A pergunta principal exige rolar. |
| Números do topo enganam com dados incompletos | `page.tsx` (hero + insight), `lib/domain/insights.ts`, `lib/domain/balances.ts` | alta | "Cash on hand" sobe todo mês (salário entra, compras não saem); insight verde "kept 71%". Ele pode acreditar. |
| Janela de 7 dias para quem volta em 15 | `lib/services/today.ts` (`UPCOMING_DAYS`) | média | Vencimentos entre visitas nunca são vistos antes de virar atraso. |
| Chip "Generate N recurring" escondido na rolagem lateral | `components/today/quick-actions.tsx`, `app/globals.css` (`tile-strip`) | média | Quinto chip; a 360 px fica fora da tela. |
| Parcelas no cartão somem do Today | `lib/services/today.ts` (filtro `cardIds`) | média | Se ele cadastrar "Geladeira 10x" no cartão, nunca aparece como vencida; a fatura mostra só a parcela e "Pay" paga o valor parcial. |
| Guia manda pagar fatura como transfer | `app/(app)/guide/page.tsx`, `components/layout/add-sheet.tsx` | média | Para quem não lança compras, transfer zera a despesa do Review; expense é o que representa a realidade dele. |
| Sem bulk settle no Today | `page.tsx` (`selectable={false}`) | baixa | 5 toques é aceitável, mas 8 contas atrasadas viram 8 toasts. |
| Review cheio de gráficos vazios/errados | `app/(app)/review/page.tsx` | baixa | Donut, spend line, budget e "Last 6 months" mostram só boletos. Ele passa por tudo isso para chegar em "Still planned". |
| Vocabulário em inglês (Settle, Leftover, Overdue, Generate recurring) | todas | baixa | Intencional pela spec, mas para ele é uma camada a mais de decodificação. |

## 4. O que falta / o que atrapalha

**Falta**
- **Catch-up automático ou em um toque** de todos os meses não aplicados desde a última geração (não só o corrente).
- **Fatura declarada**: digitar o total da fatura fechada (ou uma recorrência "variable" ligada ao cartão) para que ela entre no Overdue/Next e possa ser paga sem compras lançadas.
- **Checklist positivo do mês**: "Aluguel ✓ Luz ✓ Água ○ Nubank ○" — hoje entradas baixadas somem do Today (só `planned` é buscado), então "será que paguei o aluguel?" exige More → Entries.
- **Horizonte "até a próxima visita"** (15 dias ou "até o dia 20/5") em vez de 7 dias.
- Um modo "só contas" que esconda hero/insight/gráficos quando não há compras lançadas.

**Atrapalha**
- Hero e insight calculados sobre dados que ele nunca vai completar; a nota "if the bank shows something else, an entry is missing — add it" (`net-worth/page.tsx`, guia) pede exatamente o esforço que ele não faz.
- O Review como destino da geração: para aplicar o mês ele cai numa tela de análise.
- Card strip com "R$ 0,00 · due in 5d": informa a data, mas sem ação possível.

## 5. Top 3 mudanças

1. **Detectar e aplicar meses atrasados no Today.** Em `lib/services/today.ts`, rodar `previewGeneration` do último período com entradas geradas até o corrente e expor `toGenerate` por mês; chip único "Apply Aug + Sep" em `components/today/quick-actions.tsx` chamando um `generateMonthsAction` em `app/(app)/review/actions.ts` (loop sobre `generateMonth`), com toast de quantas contas nasceram atrasadas.

2. **Overdue no topo e com estado positivo.** Em `app/(app)/page.tsx`, mover `OverdueBlock` + "Next N days" para antes do hero; `components/today/overdue-block.tsx` renderiza "Nothing overdue" em verde em vez de `null`; `UPCOMING_DAYS` vira 15 (ou "até o próximo dia 5/20") em `lib/services/today.ts`; incluir faturas fechadas e não pagas na mesma lista.

3. **Fatura sem compras.** Em `components/cards/pay-statement-dialog.tsx` habilitar o botão com um campo "Statement total" quando `totalCents === 0`; `payStatement` em `lib/services/cards.ts` aceita `amountCents` opcional (schema em `app/(app)/cards/actions.ts`); `buildCard` passa a materializar o último ciclo fechado mesmo sem entradas, para que "Past statements" e o tile mostrem "unpaid · due 10/09" e o Today a trate como atraso.

---

# 4. Síntese cruzada

## O que as três personas apontaram (prioridade natural)

| Tema | Quem | Gravidade |
|---|---|---|
| **Fatura fechada e não paga é invisível no Today**: o tile mostra o ciclo aberto, "Due in 7 days" não soma faturas, e sem compras lançadas a fatura nem pode ser paga. | 1, 2, 3 | alta |
| **Data da baixa**: toque simples e baixa em lote gravam `settled_on = hoje`; quem baixa no domingo (ou dia 5) grava tudo com a data errada. O long-press existe mas ninguém descobre. | 2, 3 | média |
| **Registro repetitivo custa caro**: memória de conta/categoria é uma por tipo; descrição obrigatória e sem sugestão; Kind do movimento sempre volta a "Contribution"; sem lista do que já foi lançado na sessão. | 1, 2 | média/alta |
| **Meses não aplicados passam em silêncio**: o Today só pré-visualiza o mês corrente; agosto esquecido nunca vira conta atrasada. | 3 | alta |
| **Números do topo enganam com dados parciais**: "Spending down 58% vs last month" compara mês parcial com mês cheio; para quem não lança nada, caixa e taxa de poupança ficam otimistas e verdes. | 2, 3 | média |
| **Ajuste de mercado exige aritmética**: o usuário calcula a diferença e escolhe o sinal; o app poderia receber "saldo na corretora" e derivar. | 1 | alta (para a persona 1) |
| **Rendimento mensal um a um**: 6–8 toques por ativo, sem tela de "rendimento do mês". | 2 | média |
| **"Already paid?" nasce desligado** para quem lança o que já pagou → overdue falso no dia seguinte. | 1 | alta (para a persona 1) |
| Sem botão voltar; editar sempre cai em `/entries`. | 1, 2 | baixa/média |
| Gerar mês é tudo ou nada (não dá para pular a academia num mês). | 2 | média |
| "Still planned" (Review) e `/entries` ainda oferecem baixa em parcelas de cartão, que o Today já esconde. | 2 | média |

## Conflitos entre personas (decisões suas)

- **Todo o topo do Today** (caixa, insight, gráficos) é ouro para 1 e 2 e ruído para 3, que quer "Overdue" na primeira dobra. Opções: mover Overdue/Next para cima quando houver algo vencido; ou um modo compacto.
- **"Already paid?" ligado por padrão** ajuda 1 e 2 (lançam o passado) e não muda nada para 3 (não lança). Parece seguro.
- **Fatura sem compras** (persona 3 quer digitar o total da fatura fechada): resolve o caso dele, mas cria um segundo caminho para a dívida do cartão. Alternativa: uma recorrência marcada "fatura do cartão X", que nasce como transfer.

## Fora do escopo da spec, citado pelas três

Cotações automáticas, importação OFX/Open Banking, notificações/lembretes. Não entram sem decisão explícita sua.

## Sugestão de ordem, se for atacar

1. Fatura fechada não paga como item devido (Today, tile, "Due in 7 days", pagamento) — resolve o ponto mais grave e comum.
2. Data na baixa: toque simples = hoje; barra de lote ganha data; sheet de data mais descobrível.
3. Meses atrasados: detectar e aplicar em um toque a partir do Today.
4. `/add` em sequência: "Already paid?" lembrado, chips de contas/categorias recentes, sugestões de descrição, lista "lançados agora".
5. Portfolio: ajuste por "saldo na corretora" e tela "rendimento do mês".
6. Insight/deltas só quando o mês está comparável (ou comparar até o mesmo dia do mês anterior).
