---
name: print3d
description: 3D-printing workflow for the user's Bambu Lab H3C, from idea to sliced print file. Use when the user wants something designed, modeled, fixed or printed ("make me a bracket", "print a holder for…", "slice this STL"), asks what filament to use or buy, or wants their filament inventory checked or updated.
argument-hint: [what you want made]
model: opus
effort: high
---

# print3d: idea → approved model → print-ready file on the H3C

Workspace: `print3d/` at the repo root.
- `print3d/materials.md`: the inventory (filament, loaded tools, hardware, wish list). **Read it first, every time.**
- `print3d/projects/<slug>/`: one folder per job, holding `notes.md` (spec, decisions, status), `model.py`, exports and previews.
- `check.py` in this skill's directory: printability report plus a 4-view preview PNG.

Python deps: `pip install build123d trimesh matplotlib` (only if the import fails).

## Printer: Bambu Lab H3C
Facts below come from launch coverage (Nov 2026). Check them once against bambulab.com/en-us/h3c/specs and fix them here.
- 9-PrintTool tool changer. Each tool has its own nozzle and heater and keeps its material loaded, so one print can use up to 9 materials or colours.
- Build volume 330 × 320 × 325 mm. Hardened-steel nozzles up to 350 °C. 65 °C heated chamber.
- AMS 3H: 2 drying slots, up to 85 °C.
- Which material sits on which tool is listed in `materials.md`.

## Pipeline: two human gates, never skip them

1. **Brief.** Ask only for what is missing, in one round of 5 questions or fewer:
   - what the part does and what it mates with (get real measurements; a photo with calipers or a ruler in it works),
   - loads, heat, outdoor or UV exposure, food or skin contact,
   - looks or colours, and quantity.
   Write the spec to `notes.md`. Mark any number you assumed as **ASSUMED**.
2. **Material.** Choose from the table below and check the stock in `materials.md`.
   - Not in stock: name what to buy (generic spec plus a Bambu option, since Bambu spools have RFID and ready presets), and how much: ⌈needed g × 1.15 / spool g⌉ spools. Add it to the wish list. Also offer the best in-stock fallback and say what it costs in performance.
3. **Model.** Write `model.py` with build123d:
   - parametric, with every key dimension a named constant at the top,
   - the clearances from the rules below already designed in,
   - oriented the way it will print, bottom face at z = 0.
   Run it to export `<part>.step` and `<part>.stl`. For multi-material, export one STL per material body (`<part>-<material>.stl`).
4. **Check.** Run `python <skill-dir>/check.py <part>.stl`. Open the PNG and look at it yourself. Fix anything that is off before the user sees it: no fit, not watertight, more than one body by accident, avoidable overhangs.
5. **GATE 1: design approval.** Show:
   - the preview PNG (in the Claude app, send it with SendUserFile),
   - key dimensions, material, print orientation and why,
   - estimated grams against stock,
   - every ASSUMED value.
   Wait for an explicit approval. Any change sends you back to step 3. Record the approval in `notes.md`.
6. **Engineer the print.** Decide and record in `notes.md`:
   - orientation (strength first, then supports, then surface finish),
   - layer height, wall loops, infill % and pattern,
   - support type and where support interfaces go,
   - brim, and the tool or filament for each body.
7. **Slice.** Follow the Slicing section below. Report print time, grams per filament, and a stock check. If stock is short, stop and say so.
8. **GATE 2: start.** The user confirms the plate is clear and the right filament is on each tool, then starts the print (see Hand-off).
9. **Log.** After the print, subtract the grams used in `materials.md`, then write in `notes.md` what to change next time. Commit.

## Material choice

| Need | Use | Watch out for |
|---|---|---|
| Indoor, decorative, prototype, jigs | PLA / PLA Matte | softens at ~55 °C (hot car, sunny window) |
| Functional, tough, ≤ 70 °C | PETG | strings; poor bridging; don't pair with PLA as its own support |
| Outdoor/UV, car interior, ≤ 90 °C | ASA | fumes, so ventilate; needs the warm chamber |
| Stiff and strong, ≤ 150 °C, gears, brackets under load | PA-CF / PAHT-CF | must be dried (AMS drying slot); hardened nozzle |
| Flexible: feet, bumpers, gaskets, grips | TPU 95A | slow; use the TPU-capable tool |
| Clean undersides on complex parts | dedicated support material (or PVA) on its own tool | the H3C tool changer makes this cheap, so prefer it over tree supports when the finish matters |
| Food contact | avoid; FDM layer gaps hold bacteria | say so plainly, don't promise food safety |

## Design rules that make parts work (0.4 mm nozzle)
- **Clearance per side**: press fit 0.05–0.1, sliding fit 0.2, free or rotating 0.3, print-in-place joints 0.4 mm. Small holes print undersize, so add 0.2 mm to their diameter.
- **Walls**: at least 0.8 mm (2 lines). For structural walls use 1.6–2.4 mm, and add wall loops before adding infill.
- **Layer lines are the weak axis.** Orient the part so the load runs along the layers instead of peeling them apart. Hooks and brackets usually print on their side.
- **Overhangs** up to 45° print without support. Bridges up to ~20 mm are fine. Use 45° chamfers on edges that face down and fillets elsewhere. A 0.4 mm chamfer on the bottom edges counters elephant's foot.
- **Horizontal holes** larger than ~6 mm need a teardrop or diamond top so they print without support.
- **Fasteners**: an M3 self-tapping pilot is 2.5 mm. Heat-set inserts follow the insert's spec (usually ~4.0 mm for M3). Nut traps get +0.2 mm across flats. Print threads only at M8 and up; use inserts below that.
- **Text**: at least 0.6 mm raised or deep with strokes of 0.8 mm or more. Better: model it as its own body on another tool.

## Slicing: Bambu Studio CLI (runs on the user's computer, not in cloud sessions)
Binary:
- macOS: `/Applications/BambuStudio.app/Contents/MacOS/BambuStudio`
- Windows: `C:\Program Files\Bambu Studio\bambu-studio.exe`
- Linux: `bambu-studio`

System presets live in the app's `resources/profiles/BBL/{machine,process,filament}/`. Pick the ones whose names contain `H3C`.

**Not yet verified on the H3C.** On the first run:
1. Check the flags against `--help`.
2. If the CLI rejects a preset with `inherits`, merge it with its parent chain into one standalone JSON.
3. Write the per-job overrides into `projects/<slug>/process.json`: `layer_height`, `wall_loops`, `sparse_infill_density`, `sparse_infill_pattern`, `enable_support`, `support_type`, `brim_type`. Check the key names against the preset JSON.
4. Once a command works, **replace the template below with the exact working command and commit.**

```
"<binary>" --arrange 1 \
  --load-settings "<machine H3C>.json;projects/<slug>/process.json" \
  --load-filaments "<filament for T1>.json;<filament for T2>.json" \
  --slice 0 --export-3mf projects/<slug>/<part>.gcode.3mf  projects/<slug>/<part>.stl
```
Time and grams are in `Metadata/slice_info.config` inside the output `.gcode.3mf` (it is a zip).

Fallback when the CLI fails: open the project in the Bambu Studio GUI (`open -a BambuStudio <file>` on macOS, `start <file>` on Windows) with the settings from `notes.md`. The user presses Slice.

## Hand-off: starting the print
- **Default:** open the `.gcode.3mf` in Bambu Studio, check the tool/filament mapping, and press Print. That one tap is Gate 2, and it stays.
- **Hands-off sending (opt-in, not set up):** the printer must be in LAN-only mode with Developer Mode on. Then upload over FTPS and start over MQTT (for example the `bambulabs_api` Python package). This disconnects Bambu Cloud and Handy remote access. Set it up only if the user explicitly asks, and keep the plate-clear confirmation even then.

## Cloud sessions (Claude app on the phone)
Steps 1–6 run fully in a cloud session. There is no Bambu Studio and no printer on the network there. Commit and push the project folder; slicing and printing happen on the computer next to the printer:
- open this repo in Claude Code there and say "slice <slug>", or
- attach that computer to the cloud session through Remote Control.

## Model and effort
This skill pins **Opus at high effort** for the turn that invokes it. Revisions in later turns use the session's model, so keep the session on Opus (`/model`). Raise effort to **xhigh** for multi-part assemblies, mechanisms (gears, hinges, snap-fits, threads) and load-bearing parts. Don't go lower than high for anything that has to fit something real.
