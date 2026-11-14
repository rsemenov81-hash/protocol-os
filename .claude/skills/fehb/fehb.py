#!/usr/bin/env python3
"""FEHB advisor maths: plan data, claims audit, usage baseline, plan cost comparison.

  fehb.py plans '<OPM compare-plans URL>'   -> fehb/plans.json
  fehb.py audit                             -> flags in fehb/claims.json vs your current-year plan
  fehb.py usage                             -> last year's usage as a starting scenario
  fehb.py cost                              -> every plan priced against fehb/scenarios.json
  fehb.py selftest

Stdlib only. Everything is read from / written to fehb/ (gitignored: it holds health data).
"""
import collections, json, re, sys, urllib.parse, urllib.request
from pathlib import Path

DATA = Path("fehb")
PERIODS = {"c": 26, "d": 13, "b": 24, "a": 12}  # OPM payPeriod codes -> pay periods a year


# ---------- cost sharing (shared by audit and cost) ----------

def parse_term(text):
    """OPM benefit text -> (kind, number). Kinds: free, copay, coins, all, unknown."""
    t = (text or "").strip()
    if t in ("Member Pays Nothing",):
        return ("free", 0.0)
    if t in ("Member Pays All Charges", "Not Covered"):
        return ("all", 0.0)
    m = re.fullmatch(r"\$([\d,.]+)(?: Copayment)?", t)
    if m:
        return ("copay", float(m.group(1).replace(",", "")))
    m = re.fullmatch(r"([\d.]+)%(?: Coinsurance)?", t)
    if m:
        return ("coins", float(m.group(1)) / 100)
    return ("unknown", 0.0)  # "Covered", "N/A", "" - the brochure has the real number


def member_share(term, allowed, ded_left, ded_before_copay):
    """What the member owes for one service. Returns (cost_share, deductible_used, uncovered)."""
    kind, x = term
    if kind == "free":
        return 0.0, 0.0, 0.0
    if kind == "all":
        return 0.0, 0.0, allowed
    if kind == "copay" and not ded_before_copay:
        return min(x, allowed), 0.0, 0.0
    ded = min(ded_left, allowed)
    rest = allowed - ded
    if kind == "copay":
        return ded + min(x, rest), ded, 0.0
    # ponytail: "unknown" is priced like 20% coinsurance and reported, so it never looks free.
    return ded + rest * (x if kind == "coins" else 0.20), ded, 0.0


def price(plan, scenario, tax_rate=0.0):
    """Annual cost of one plan for one scenario (list of {benefit, n, allowed})."""
    hdhp = plan["account"] == "HSA"
    # ponytail: OPM's data does not say where the deductible applies. Assumed: HSA plans
    # deduct before copays, others only before coinsurance. Override per plan in overrides.json.
    ded_first = plan.get("ded_before_copay", hdhp)
    ded_left, share, uncovered, guessed = plan["deductible"], 0.0, 0.0, set()
    for item in scenario:
        text = plan["benefits"].get(item["benefit"])
        term = parse_term(text)
        if term[0] == "unknown":
            guessed.add(item["benefit"])
        for _ in range(int(item["n"])):
            s, d, u = member_share(term, float(item["allowed"]), ded_left, ded_first)
            ded_left -= d
            share += s
            uncovered += u
    share = min(share, plan["oop_max"]) if plan["oop_max"] else share
    premium = plan["premium_year"] * (1 - tax_rate)  # premiums come out pre-tax
    # HSA money is yours either way; HRA money only exists if you spend it.
    credit = plan["contribution"] if hdhp else min(plan["contribution"], share)
    return {"total": round(premium + share + uncovered - credit), "premium": round(premium),
            "cost_share": round(share), "uncovered": round(uncovered), "credit": round(credit),
            "guessed": sorted(guessed)}


# ---------- plans ----------

def extract_carriers(html):
    """The compare page embeds its whole dataset as JSON inside a script tag."""
    # ponytail: tied to OPM's page markup. If this raises, the page changed; re-read it.
    dec = json.JSONDecoder()
    start = html.index("new CarriersVM({ Carriers: ") + len("new CarriersVM({ Carriers: ")
    carriers, _ = dec.raw_decode(html, start)
    year = int(re.search(r"var year = (\d{4})", html).group(1))
    out = [(year, c) for c in carriers]
    for m in re.finditer(r'new CarrierVM\(\s*(?=\{")', html):  # the "current plan" rows
        c, end = dec.raw_decode(html, m.end())
        y = re.match(r",\s*true,\s*(\d{4})", html[end:end + 20])
        out.append((int(y.group(1)) if y else year, c))
    return year, out


def normalize(carrier, plan, coverage, periods):
    tier = next(t for n, t in plan["Tiers"].items() if n.lower().startswith("in"))
    costs = tier["EnrollmentTypes"][coverage]["PlanCosts"]
    num = lambda k: float(costs[k]["NumericValue"] or 0) if k in costs else 0.0
    benefits = {k: v["Value"] for k, v in tier["Benefits"].items() if "Medicare" not in (v["Group"] or "")}
    enr = plan["EnrollmentTypes"][coverage]
    return {
        "code": carrier["Code"] + enr["EnrollmentCode"],
        "carrier": carrier["Name"], "option": plan["Name"], "type": carrier["PlanType"],
        "brochure": carrier["BrochureNumber"], "website": carrier["Website"],
        "premium_year": round(enr["Rate"]["Employee"] * periods, 2),
        "deductible": num("Calendar Year Deductible"), "oop_max": num("Catastrophic Limit"),
        "contribution": num("Premium Pass Through HSA/HRA Contribution"),
        "account": (benefits.pop("Type of Account", "") or "").strip().replace("N/A", ""),
        "benefits": benefits,
    }


def cmd_plans(url, coverage="Self"):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    periods = PERIODS[q.get("payPeriod", ["c"])[0]]
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0"})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    year, rows = extract_carriers(html)
    plans, current = {}, None
    for y, c in rows:
        for p in c["Plans"]:
            n = normalize(c, p, coverage, periods)
            if y == year:
                plans[n["code"]] = n
            else:
                current = dict(n, year=y)  # this year's terms: what the claims audit checks against
    out = {"year": year, "coverage": coverage, "source": url, "current": current, "plans": plans}
    DATA.mkdir(exist_ok=True)
    (DATA / "plans.json").write_text(json.dumps(out, indent=1))
    print(f"{len(plans)} plans for {year} ({coverage}) -> {DATA / 'plans.json'}")
    if current:
        print(f"current {current['year']} plan: {current['carrier']} {current['option']} ({current['code']})")


def load_plans():
    d = json.loads((DATA / "plans.json").read_text())
    over = DATA / "overrides.json"  # {"<code>": {"deductible": 0, "ded_before_copay": true, "benefits": {...}}}
    if over.exists():
        for code, patch in json.loads(over.read_text()).items():
            target = d["current"] if code == "current" else d["plans"][code]
            target["benefits"].update(patch.pop("benefits", {}))
            target.update(patch)
    return d


# ---------- claims ----------

def load_claims():
    return json.loads((DATA / "claims.json").read_text())


def audit(claims, plan):
    """Flags to investigate. A flag is a question for the brochure, not a verdict."""
    flags, ded_total, share_total, seen = [], 0.0, 0.0, collections.Counter()
    flag = lambda c, why: flags.append({"id": c.get("id"), "date": c.get("date"), "provider": c.get("provider"), "why": why})
    for c in sorted(claims, key=lambda c: c.get("date", "")):
        m = {k: float((c.get("member") or {}).get(k) or 0) for k in ("deductible", "copay", "coinsurance", "not_covered")}
        allowed, paid = float(c.get("allowed") or 0), float(c.get("plan_paid") or 0)
        cost_share = m["deductible"] + m["copay"] + m["coinsurance"]
        key = (c.get("date"), c.get("provider"), c.get("billed"), c.get("benefit"))
        seen[key] += 1
        if seen[key] == 2:
            flag(c, "possible duplicate: same date, provider, service and billed amount")
        if c.get("status") == "denied":
            flag(c, f"denied: {c.get('remarks') or 'no reason captured'}")
            continue
        if m["not_covered"] > 0:
            flag(c, f"${m['not_covered']:.2f} marked not covered"
                    + ("; in-network providers cannot bill you above the allowed amount" if c.get("in_network") else ""))
        if abs(allowed - paid - cost_share) > 1:
            flag(c, f"does not add up: allowed {allowed:.2f} != plan paid {paid:.2f} + your share {cost_share:.2f}")
        if c.get("in_network", True) and c.get("benefit") in plan["benefits"]:
            term = parse_term(plan["benefits"][c["benefit"]])
            ded_left = max(plan["deductible"] - ded_total, 0)
            want, _, _ = member_share(term, allowed, ded_left, plan.get("ded_before_copay", plan["account"] == "HSA"))
            if term[0] != "unknown" and cost_share - want > 1:
                flag(c, f"you were charged {cost_share:.2f}; plan terms for '{c['benefit']}' "
                        f"({plan['benefits'][c['benefit']]}) suggest at most {want:.2f}")
        ded_total += m["deductible"]
        share_total += cost_share
        if plan["deductible"] and ded_total > plan["deductible"] + 1:
            flag(c, f"deductible charged year-to-date {ded_total:.2f} exceeds the plan's {plan['deductible']:.0f}")
        if plan["oop_max"] and share_total > plan["oop_max"] + 1:
            flag(c, f"cost sharing year-to-date {share_total:.2f} exceeds the out-of-pocket maximum {plan['oop_max']:.0f}")
    return flags


def usage(claims):
    """Paid claims grouped by benefit -> a scenario (count and average allowed amount)."""
    by = collections.defaultdict(list)
    for c in claims:
        if c.get("status") != "denied" and c.get("benefit"):
            by[c["benefit"]].append(float(c.get("allowed") or 0))
    return [{"benefit": b, "n": len(v), "allowed": round(sum(v) / len(v), 2)} for b, v in sorted(by.items())]


# ---------- cost ----------

def cmd_cost():
    d = load_plans()
    sc = json.loads((DATA / "scenarios.json").read_text())
    names = list(sc["scenarios"])
    rows = []
    for code, p in d["plans"].items():
        if code in sc.get("exclude", []):
            continue
        r = {n: price(p, items, sc.get("tax_rate", 0)) for n, items in sc["scenarios"].items()}
        worst = round(p["premium_year"] * (1 - sc.get("tax_rate", 0)) + p["oop_max"]
                      - (p["contribution"] if p["account"] == "HSA" else 0))
        rows.append({"code": code, "plan": f"{p['carrier']} {p['option']}", "account": p["account"],
                     "premium_year": p["premium_year"], "worst_case": worst, "scenarios": r})
    main = "expected" if "expected" in names else names[0]
    rows.sort(key=lambda r: r["scenarios"][main]["total"])
    (DATA / "comparison.json").write_text(json.dumps(rows, indent=1))
    print(f"{'code':5}{'plan':44}" + "".join(f"{n:>10}" for n in names) + f"{'worst':>10}  notes")
    for r in rows:
        g = sorted({b for s in r["scenarios"].values() for b in s["guessed"]})
        print(f"{r['code']:5}{r['plan'][:42]:44}" + "".join(f"{r['scenarios'][n]['total']:>10,}" for n in names)
              + f"{r['worst_case']:>10,}  " + (f"GUESSED: {', '.join(g)}" if g else ""))
    print(f"\nsorted by '{main}'; full breakdown in {DATA / 'comparison.json'}")


# ---------- self-check ----------

def selftest():
    assert parse_term("$15 Copayment") == ("copay", 15.0)
    assert parse_term("25% Coinsurance") == ("coins", 0.25)
    assert parse_term("Member Pays Nothing")[0] == "free" and parse_term("Covered")[0] == "unknown"
    ppo = {"account": "", "deductible": 500, "oop_max": 3000, "contribution": 0, "premium_year": 2600,
           "benefits": {"PCP": "$20 Copayment", "Inpatient": "20% Coinsurance", "Dental": "Not Covered"}}
    hdhp = dict(ppo, account="HSA", deductible=1800, contribution=1000, premium_year=2000)
    # copay skips the deductible; coinsurance pays it first: 500 + 20% of 9,500 = 2,400
    r = price(ppo, [{"benefit": "PCP", "n": 4, "allowed": 150}, {"benefit": "Inpatient", "n": 1, "allowed": 10000}])
    assert (r["cost_share"], r["total"]) == (2480, 5080), r
    # out-of-pocket maximum caps cost sharing but not uncovered services
    r = price(ppo, [{"benefit": "Inpatient", "n": 1, "allowed": 90000}, {"benefit": "Dental", "n": 1, "allowed": 300}])
    assert (r["cost_share"], r["uncovered"], r["total"]) == (3000, 300, 5900), r
    # HSA plan: visits hit the deductible first, and the contribution is yours even if unused
    r = price(hdhp, [{"benefit": "PCP", "n": 2, "allowed": 150}])
    assert (r["cost_share"], r["credit"], r["total"]) == (300, 1000, 1300), r
    assert price(ppo, [], tax_rate=0.25)["premium"] == 1950

    claims = [
        {"id": "ok", "date": "2026-01-05", "provider": "A", "benefit": "PCP", "status": "paid", "in_network": True,
         "billed": 300, "allowed": 150, "plan_paid": 130, "member": {"copay": 20}},
        {"id": "over", "date": "2026-02-01", "provider": "A", "benefit": "PCP", "status": "paid", "in_network": True,
         "billed": 300, "allowed": 150, "plan_paid": 100, "member": {"copay": 50}},
        {"id": "den", "date": "2026-03-01", "provider": "B", "benefit": "Inpatient", "status": "denied", "remarks": "no prior auth"},
    ]
    flags = {f["id"]: f["why"] for f in audit(claims, ppo)}
    assert set(flags) == {"over", "den"} and "at most 20.00" in flags["over"], flags
    assert usage(claims) == [{"benefit": "PCP", "n": 2, "allowed": 150.0}]

    html = ('var year = 2027; Carriers = new CarriersVM({ Carriers: [{"Code":"B6","Plans":[]}] });'
            'unshift(new CarrierVM({"Code":"B6","Plans":[]}, true, 2026));')
    assert [(y, c["Code"]) for y, c in extract_carriers(html)[1]] == [(2027, "B6"), (2026, "B6")]
    print("selftest ok")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "plans" and len(sys.argv) > 2:
        cmd_plans(sys.argv[2], *sys.argv[3:4])
    elif cmd == "audit":
        flags = audit(load_claims(), load_plans()["current"])
        print(json.dumps(flags, indent=1))
        print(f"{len(flags)} flags", file=sys.stderr)
    elif cmd == "usage":
        print(json.dumps(usage(load_claims()), indent=1))
    elif cmd == "cost":
        cmd_cost()
    elif cmd == "selftest":
        selftest()
    else:
        sys.exit(__doc__)
