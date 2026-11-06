# Review Packet — Second Brain Plan

The plan in `SECOND_BRAIN_PLAN.md` (now **v2**) needs an independent review from **Gemini** and
**GPT/Codex** before we build. This remote Claude session can't reach `agy` or `codex` (they're on your
laptop), so run one of these. Each returns a verdict: **APPROVE / APPROVE-WITH-CHANGES / REJECT** + reasons.

> **Status:** an internal round-1 adversarial review (two Claude stand-in agents) is already done and folded
> into §8 of the plan — both said APPROVE-WITH-CHANGES and the changes are incorporated. This packet is
> for the **real Gemini + GPT pass**, which is the actual headline requirement and still pending.

## Fastest path — on your laptop, in this repo

**Gemini** (uses your Ultra via Antigravity):
```
/gemini-verify Review SECOND_BRAIN_PLAN.md. Is the architecture sound for a dual-agent
(Claude+Codex) second brain built on a git markdown repo? Attack design decisions D1–D6 and
the risks in §6. Verdict: APPROVE / APPROVE-WITH-CHANGES / REJECT, with specific changes.
```

**GPT / Codex** (in the repo, so it reads the file):
```
codex "Read SECOND_BRAIN_PLAN.md. You are the Codex half of this dual-agent setup — does the
AGENTS.md contract + write protocol in §4 actually work for you, or will it cause conflicts with
Claude? Pressure-test §6 open questions. Verdict: APPROVE / APPROVE-WITH-CHANGES / REJECT."
```

## If you'd rather paste into the web apps

Copy `SECOND_BRAIN_PLAN.md` and prepend this:

> You are reviewing an architecture plan for a personal "second brain" — a git-backed markdown
> knowledge repo shared between two AI coding agents (Claude Code and OpenAI Codex), with an
> ingest → index → verify → organize loop. The author already has a hand-built clinical living-doc
> (`STATE_Roman.md`), a GitHub repo, and Gemini-cross-check commands. Review for: soundness of the
> git-markdown substrate for dual-agent sharing; whether the verify layer is real or hand-wavy; the
> concurrency/write-conflict story; and anything missing. Give a verdict: APPROVE /
> APPROVE-WITH-CHANGES / REJECT, and list concrete required changes.

## Record verdicts here

| Reviewer | Verdict | Key required changes | Date |
|---|---|---|---|
| Gemini |  |  |  |
| GPT/Codex |  |  |  |

Once both are APPROVE (or you've folded in their changes), tell me and I'll build P0 + P1.
