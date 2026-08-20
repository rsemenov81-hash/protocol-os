---
type: context
status: durable
confidence: established
tags: [clinical, protocol, pointer]
source: STATE_Roman.md
created: 2026-06-23
---

# Protocol (pointer)

The single source of truth for the clinical protocol is **`/STATE_Roman.md`** (loads every turn,
"answer the delta"). Do not duplicate it here. This file exists so the brain's routing knows where
clinical knowledge lives. Hard Stops in STATE are invariants for the whole brain.
