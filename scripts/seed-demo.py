#!/usr/bin/env python3
"""
Two years of realistic data for the local test user — months in the black
and in the red, a card that hits its limit, a card with an empty statement,
installments, recurrences, investments with yield, market swings and a
withdrawal. Emits SQL on stdout; run with:
    python3 scripts/seed-demo.py | docker exec -i supabase_db_sledger psql -U postgres -v ON_ERROR_STOP=1
Wipes the user's entries, statements, recurrences, assets and movements first.
"""
import calendar
import random
import uuid
from datetime import date, timedelta

UID = "81b1fb80-460a-4bfb-a4db-5509edb4ed91"
TODAY = date(2026, 9, 12)
START = date(2024, 9, 1)
rng = random.Random(42)

# ---- helpers ---------------------------------------------------------------
def q(s): return "'" + s.replace("'", "''") + "'"
def clamp(y, m, d): return date(y, m, min(d, calendar.monthrange(y, m)[1]))
def add_months(d, n):
    y, m = d.year, d.month - 1 + n
    return clamp(y + m // 12, m % 12 + 1, d.day)
def months():
    d = START
    while d <= TODAY.replace(day=1):
        yield d
        d = add_months(d, 1)

def cycle(closing, due, d):
    """Mirror of lib/domain/statements.ts resolveCycle."""
    closes_this = d <= clamp(d.year, d.month, closing)
    cp = d.replace(day=1) if closes_this else add_months(d.replace(day=1), 1)
    cycle_end = clamp(cp.year, cp.month, closing)
    prev = add_months(cp, -1)
    cycle_start = clamp(prev.year, prev.month, closing) + timedelta(days=1)
    dp = cp if due > closing else add_months(cp, 1)
    return cycle_start, cycle_end, clamp(dp.year, dp.month, due)

CARDS = {"Nubank": (20, 28), "Inter": (14, 25)}
ACC = lambda name: f"(select id from accounts where user_id = '{UID}' and name = {q(name)})"
CAT = lambda name: f"(select id from categories where user_id = '{UID}' and name = {q(name)})"

sql = []
entries = []   # dicts
def entry(**e):
    e.setdefault("id", str(uuid.uuid4()))
    e.setdefault("settled_on", e["date"] if e.get("status", "settled") == "settled" else None)
    e.setdefault("status", "settled" if e["settled_on"] else "planned")
    e.setdefault("category", None); e.setdefault("counter", None); e.setdefault("source", "manual")
    e.setdefault("recurrence_id", None); e.setdefault("period", None)
    e.setdefault("group", None); e.setdefault("no", None); e.setdefault("total", None)
    e.setdefault("notes", None)
    entries.append(e); return e

# ---- wipe & starting points ------------------------------------------------
sql.append(f"delete from asset_movements where user_id = '{UID}';")
sql.append(f"delete from assets where user_id = '{UID}';")
sql.append(f"delete from entries where user_id = '{UID}';")
sql.append(f"delete from statements where user_id = '{UID}';")
sql.append(f"delete from recurrences where user_id = '{UID}';")
sql.append(f"update accounts set opening_on = '{START}', opening_balance_cents = case name when 'Conta Corrente' then 620000 when 'Dinheiro' then 15000 when 'Reserva' then 1200000 else 0 end where user_id = '{UID}';")
# The sign-in seed only creates the basic set; the demo needs two cards and three more categories.
sql.append(f"insert into accounts (user_id, name, type, institution, closing_day, due_day, credit_limit_cents, sort_order) values ('{UID}', 'Nubank', 'credit_card', 'Nubank', 20, 28, 400000, 10), ('{UID}', 'Inter', 'credit_card', 'Inter', 14, 21, 300000, 11) on conflict (user_id, name) do nothing;")
sql.append(f"insert into categories (user_id, name, applies_to, is_benefit, sort_order) values ('{UID}', 'Salário', '{{income}}', false, 20), ('{UID}', 'Vale-refeição', '{{income}}', true, 21), ('{UID}', 'Restaurantes', '{{expense}}', false, 22) on conflict (user_id, parent_id, name) do nothing;")
sql.append(f"update categories set monthly_cap_cents = case name when 'Alimentação' then 180000 when 'Transporte' then 60000 when 'Lazer' then 50000 when 'Assinaturas' then 30000 when 'Restaurantes' then 70000 else monthly_cap_cents end where user_id = '{UID}';")

# ---- recurrences -----------------------------------------------------------
recs = {}
def recurrence(key, description, kind, category, account, amount, due_day, starts, counter=None, variable=False, ends=None):
    rid = str(uuid.uuid4()); recs[key] = dict(id=rid, description=description, kind=kind, category=category, account=account, amount=amount, due_day=due_day, starts=starts, counter=counter, variable=variable, ends=ends)
    sql.append(
        f"insert into recurrences (id, user_id, description, kind, category_id, account_id, counter_account_id, amount_cents, due_day, starts_on, ends_on, is_variable) values "
        f"('{rid}', '{UID}', {q(description)}, '{kind}', {CAT(category) if category else 'null'}, {ACC(account)}, {ACC(counter) if counter else 'null'}, {amount}, {due_day}, '{starts}', {q(str(ends)) if ends else 'null'}, {'true' if variable else 'false'});")

recurrence("salary", "Salário", "income", "Salário", "Conta Corrente", 800000, 5, START)
recurrence("vr", "Vale-refeição", "income", "Vale-refeição", "Conta Corrente", 90000, 1, START)
recurrence("rent", "Aluguel", "expense", "Moradia", "Conta Corrente", 250000, 10, START)
recurrence("internet", "Internet", "expense", "Assinaturas", "Conta Corrente", 12000, 20, START)
recurrence("gym", "Academia", "expense", "Saúde", "Conta Corrente", 12000, 17, START)
recurrence("water", "Água", "expense", "Moradia", "Conta Corrente", 9000, 12, START, variable=True)
recurrence("power", "Luz", "expense", "Moradia", "Conta Corrente", 22000, 15, START, variable=True)
recurrence("stream", "Streaming", "expense", "Assinaturas", "Nubank", 5590, 8, START)
recurrence("cdb", "Aporte CDB", "contribution", None, "Conta Corrente", 100000, 6, START, counter="Corretora")

def apply_recurrences(month):
    for key, r in recs.items():
        d = clamp(month.year, month.month, r["due_day"])
        if d < r["starts"] or (r["ends"] and d > r["ends"]): continue
        amount = r["amount"]
        if key == "salary" and month >= date(2026, 1, 1): amount = 880000  # raise
        if r["variable"]: amount = int(amount * rng.uniform(0.8, 1.6))
        if key == "cdb": continue  # contributions are recorded from the portfolio, paired with a movement
        settled = d <= TODAY
        if key == "stream": settled = True  # on the card: settled at purchase (statement pays it)
        entry(date=d, kind=r["kind"], amount=amount, description=r["description"], category=r["category"], account=r["account"], counter=r["counter"],
              source="recurrence", recurrence_id=r["id"], period=month, settled_on=d if settled else None, status="settled" if settled else "planned")

# ---- monthly life ----------------------------------------------------------
GROCERIES = ["Mercado", "Hortifruti", "Padaria", "Açougue", "Atacadão"]
REST = ["Almoço", "Jantar", "Pizza", "Sushi", "Café da manhã", "Lanche"]
TRANSPORT = ["Uber", "Gasolina", "Estacionamento", "Metrô", "99"]
LEISURE = ["Cinema", "Show", "Livro", "Jogo", "Bar com amigos"]
HEALTH = ["Farmácia", "Consulta", "Dentista"]
SHOP = ["Roupas", "Tênis", "Presente", "Casa e decoração"]
BIG = {date(2024, 12, 1): ("Viagem de fim de ano", 480000, "Lazer", "Nubank"),
       date(2025, 7, 1): ("Conserto do carro", 390000, "Transporte", "Conta Corrente"),
       date(2026, 2, 1): ("IPVA + seguro", 420000, "Transporte", "Conta Corrente"),
       date(2025, 3, 1): ("Curso de inglês (semestre)", 210000, "Educação", "Inter")}

def month_life(month):
    y, m = month.year, month.month
    last = min(calendar.monthrange(y, m)[1], TODAY.day if month == TODAY.replace(day=1) else 31)
    def day(): return clamp(y, m, rng.randint(1, last))
    lean = month in (date(2025, 1, 1), date(2025, 8, 1))  # tight months: fewer treats
    for _ in range(rng.randint(4, 7)):
        acc = rng.choice(["Conta Corrente", "Nubank", "Nubank", "Inter"])
        entry(date=day(), kind="expense", amount=rng.randint(8000, 42000), description=rng.choice(GROCERIES), category="Alimentação", account=acc)
    for _ in range(rng.randint(2, 6) if not lean else 1):
        entry(date=day(), kind="expense", amount=rng.randint(2500, 14000), description=rng.choice(REST), category="Restaurantes", account=rng.choice(["Nubank", "Inter", "Dinheiro"]))
    for _ in range(rng.randint(4, 8)):
        entry(date=day(), kind="expense", amount=rng.randint(1500, 25000), description=rng.choice(TRANSPORT), category="Transporte", account=rng.choice(["Conta Corrente", "Nubank"]))
    if rng.random() < 0.5:
        entry(date=day(), kind="expense", amount=rng.randint(4000, 32000), description=rng.choice(HEALTH), category="Saúde", account="Inter")
    for _ in range(rng.randint(0, 3) if not lean else 0):
        entry(date=day(), kind="expense", amount=rng.randint(3000, 22000), description=rng.choice(LEISURE), category="Lazer", account=rng.choice(["Nubank", "Conta Corrente"]))
    if rng.random() < 0.6:
        entry(date=day(), kind="expense", amount=rng.randint(9000, 45000), description=rng.choice(SHOP), category="Outros", account="Nubank")
    if month in BIG:
        desc, amount, cat, acc = BIG[month]
        entry(date=clamp(y, m, 12), kind="expense", amount=amount, description=desc, category=cat, account=acc)
    # cash withdrawal every month, sized to what gets spent in cash
    entry(date=clamp(y, m, 3), kind="transfer", amount=30000, description="Saque", account="Conta Corrente", counter="Dinheiro")
    if month.month in (6, 12):  # bonus months
        entry(date=clamp(y, m, 20), kind="income", amount=400000, description="13º / bônus", category="Salário", account="Conta Corrente")
    if month == date(2025, 10, 1):  # reserve top-up
        entry(date=clamp(y, m, 7), kind="transfer", amount=300000, description="Reforço da reserva", account="Conta Corrente", counter="Reserva")

# ---- installments ----------------------------------------------------------
def installments(description, total_parts, part, first, category, account):
    gid = str(uuid.uuid4())
    for i in range(total_parts):
        d = add_months(first, i)
        entry(date=d, kind="expense", amount=part, description=description, category=category, account=account, source="installment",
              group=gid, no=i + 1, total=total_parts, status="planned", settled_on=None)

installments("Notebook", 12, 34990, date(2025, 3, 8), "Educação", "Nubank")
installments("Sofá", 6, 48000, date(2026, 5, 22), "Moradia", "Inter")
installments("Celular", 10, 27990, date(2026, 8, 2), "Outros", "Nubank")

for month in months():
    apply_recurrences(month)
    month_life(month)
# Recurrences for next month not applied (Review shows the card); September planned rows after today stay planned.

# ---- a card that hits its limit (Nubank, Aug 2026 cycle Jul 21 – Aug 20) --
for d, desc, amt in [(date(2026, 8, 3), "Passagens aéreas", 268000), (date(2026, 8, 9), "Hotel", 152000), (date(2026, 8, 15), "Geladeira", 189000)]:
    entry(date=d, kind="expense", amount=amt, description=desc, category="Lazer" if "Hotel" in desc or "Passagens" in desc else "Moradia", account="Nubank")

# ---- statements: pay every closed cycle except the last two on Nubank ------
statements = {}  # (card, cycle_start) -> dict
for e in entries:
    if e["account"] in CARDS and e["kind"] in ("expense", "income"):
        cs, ce, due = cycle(*CARDS[e["account"]], e["date"])
        s = statements.setdefault((e["account"], cs), dict(id=str(uuid.uuid4()), card=e["account"], start=cs, end=ce, due=due, entries=[]))
        s["entries"].append(e); e["statement_id"] = s["id"]
# An empty statement for Inter (zeroed card) in Jan 2025: nothing was bought on it — enforce by moving Inter purchases of that cycle to Nubank
for key in list(statements):
    s = statements[key]
    if s["card"] == "Inter" and s["start"] == date(2025, 1, 15):
        for e in s["entries"]:
            e["account"] = "Nubank"; cs, ce, due = cycle(*CARDS["Nubank"], e["date"])
            t = statements.setdefault(("Nubank", cs), dict(id=str(uuid.uuid4()), card="Nubank", start=cs, end=ce, due=due, entries=[]))
            t["entries"].append(e); e["statement_id"] = t["id"]
        del statements[key]

for s in statements.values():
    total = sum(e["amount"] if e["kind"] == "expense" else -e["amount"] for e in s["entries"])
    closed = s["end"] < TODAY
    unpaid = s["card"] == "Nubank" and s["start"] >= date(2026, 7, 21)  # the limit-busting statement (due 28/08) is overdue, unpaid
    paid = closed and not unpaid and total > 0
    paid_on = s["due"] if paid and s["due"] <= TODAY else None
    if paid and paid_on is None: paid_on = None
    s["paid_on"] = paid_on
    if paid_on:
        entry(date=paid_on, kind="transfer", amount=total, description=f"Fatura {s['card']} {s['end'].strftime('%b/%y')}", account="Conta Corrente", counter=s["card"], statement_id=s["id"])
        for e in s["entries"]:
            if e["group"]: e["status"] = "settled"; e["settled_on"] = paid_on
    # card purchases that are not installments are settled at purchase
    for e in s["entries"]:
        if not e["group"] and e["kind"] == "expense": e["status"] = "settled"; e["settled_on"] = e["date"]

for s in statements.values():
    sql.append(f"insert into statements (id, user_id, account_id, cycle_start, cycle_end, due_date, paid_on) values ('{s['id']}', '{UID}', {ACC(s['card'])}, '{s['start']}', '{s['end']}', '{s['due']}', {q(str(s['paid_on'])) if s['paid_on'] else 'null'});")

# ---- investments -----------------------------------------------------------
assets = {"CDB 110% CDI": ("fixed_income", "CDB", "Nubank"), "Tesouro Selic 2029": ("fixed_income", "Tesouro Direto", "Corretora"),
          "Bitcoin": ("crypto", None, "Binance"), "Dólar": ("foreign_currency", "USD", "Wise")}
asset_ids = {}
for name, (cls, sub, broker) in assets.items():
    aid = str(uuid.uuid4()); asset_ids[name] = aid
    sql.append(f"insert into assets (id, user_id, name, asset_class, subclass, broker) values ('{aid}', '{UID}', {q(name)}, '{cls}', {q(sub) if sub else 'null'}, {q(broker)});")
movements = []
def movement(asset, d, kind, amount, entry_id=None, notes=None):
    movements.append(dict(asset=asset, date=d, kind=kind, amount=amount, entry_id=entry_id, notes=notes))

cdb_balance = 0; selic_balance = 0
for month in months():
    d = clamp(month.year, month.month, 6)
    if d > TODAY: break
    # paired contribution: cash leaves Conta Corrente into Corretora, movement records the asset
    e = entry(date=d, kind="contribution", amount=100000, description="Aporte CDB 110% CDI", account="Conta Corrente", counter="Corretora")
    movement("CDB 110% CDI", d, "contribution", 100000, entry_id=e["id"]); cdb_balance += 100000
    if month.month % 3 == 0:
        e2 = entry(date=clamp(month.year, month.month, 7), kind="contribution", amount=150000, description="Aporte Tesouro Selic", account="Conta Corrente", counter="Corretora")
        movement("Tesouro Selic 2029", clamp(month.year, month.month, 7), "contribution", 150000, entry_id=e2["id"]); selic_balance += 150000
    # yield at month end (0.85–1.05% a month), from the previous month's balance
    end = clamp(month.year, month.month, 28)
    if end <= TODAY and month > START:
        y1 = int(cdb_balance * rng.uniform(0.0085, 0.0105)); y2 = int(selic_balance * rng.uniform(0.008, 0.0095))
        if y1: movement("CDB 110% CDI", end, "yield", y1); cdb_balance += y1
        if y2: movement("Tesouro Selic 2029", end, "yield", y2); selic_balance += y2
# crypto and dollar: quarterly buys, monthly market adjustments both ways
btc_bal = 0; usd_bal = 0
for month in months():
    d = clamp(month.year, month.month, 15)
    if d > TODAY: break
    if month.month in (1, 4, 7, 10):
        e = entry(date=d, kind="contribution", amount=80000, description="Compra de Bitcoin", account="Conta Corrente", counter="Corretora")
        movement("Bitcoin", d, "contribution", 80000, entry_id=e["id"]); btc_bal += 80000
    if month.month in (2, 8):
        e = entry(date=d, kind="contribution", amount=120000, description="Compra de dólar", account="Conta Corrente", counter="Corretora")
        movement("Dólar", d, "contribution", 120000, entry_id=e["id"]); usd_bal += 120000
    end = clamp(month.year, month.month, 27)
    if end <= TODAY and btc_bal:
        adj = int(btc_bal * rng.uniform(-0.18, 0.28)); btc_bal += adj
        if adj: movement("Bitcoin", end, "market_adjustment", adj, notes="Ajuste pelo app da corretora")
    if end <= TODAY and usd_bal:
        adj = int(usd_bal * rng.uniform(-0.05, 0.06)); usd_bal += adj
        if adj: movement("Dólar", end, "market_adjustment", adj)
# a withdrawal with its tax, and the cash coming back
wd = date(2025, 11, 18)
movement("CDB 110% CDI", wd, "withdrawal", 300000, notes="Resgate para a viagem"); movement("CDB 110% CDI", wd, "fee_tax", 22500, notes="IR sobre o resgate")
entry(date=wd, kind="transfer", amount=277500, description="Resgate CDB", account="Corretora", counter="Conta Corrente")

# ---- entries ---------------------------------------------------------------
for e in entries:
    sql.append(
        "insert into entries (id, user_id, date, settled_on, kind, status, amount_cents, description, category_id, account_id, counter_account_id, notes, source, recurrence_id, period, installment_group_id, installment_no, installment_total, statement_id) values ("
        f"'{e['id']}', '{UID}', '{e['date']}', {q(str(e['settled_on'])) if e['settled_on'] else 'null'}, '{e['kind']}', '{e['status']}', {e['amount']}, {q(e['description'])}, "
        f"{CAT(e['category']) if e['category'] else 'null'}, {ACC(e['account'])}, {ACC(e['counter']) if e['counter'] else 'null'}, {q(e['notes']) if e['notes'] else 'null'}, '{e['source']}', "
        f"{q(e['recurrence_id']) if e['recurrence_id'] else 'null'}, {q(str(e['period'])) if e['period'] else 'null'}, {q(e['group']) if e['group'] else 'null'}, {e['no'] or 'null'}, {e['total'] or 'null'}, {q(e['statement_id']) if e.get('statement_id') else 'null'});")

for m in movements:
    sql.append(f"insert into asset_movements (user_id, asset_id, date, kind, amount_cents, entry_id, notes) values ('{UID}', '{asset_ids[m['asset']]}', '{m['date']}', '{m['kind']}', {m['amount']}, {q(m['entry_id']) if m['entry_id'] else 'null'}, {q(m['notes']) if m['notes'] else 'null'});")

print("begin;")
print("\n".join(sql))
print("commit;")
print(f"-- {len(entries)} entries, {len(statements)} statements, {len(movements)} movements", file=__import__('sys').stderr)
