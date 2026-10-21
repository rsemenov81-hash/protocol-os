# verify/ — the safety layer
claims.md = deterministic claims index (key | claim | confidence | source | note). New claims are diffed
against prior claims sharing a key; collisions are flagged here as contradiction reports. High-stakes
claims also get a Gemini + GPT cross-model record. See CONVENTIONS §5.
