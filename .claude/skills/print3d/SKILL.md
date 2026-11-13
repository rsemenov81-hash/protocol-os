---
name: print3d
description: 3D-printing workflow for the user's Bambu Lab H3C, from idea to sliced print file. Use when the user wants something designed, modeled, fixed or printed ("make me a bracket", "print a holder for…", "slice this STL"), asks what filament to use or buy, or wants their filament inventory checked or updated.
argument-hint: [what you want made]
---

# print3d: idea → approved model → print-ready file on the H3C

Workspace: `print3d/` at the repo root.
- `print3d/materials.md`: the inventory (filament, loaded tools, hardware, wish list). **Read it first, every time.**
- `print3d/projects/<slug>/`: one folder per job, holding `notes.md` (spec, decisions, status), `model.py`, exports and previews.

Scripts in this skill's directory:
- `check.py`: printability report plus a 4-view preview PNG.
- `flatten.py`: turns a Bambu Studio preset into one the command-line slicer can load.

Python deps: `pip install build123d trimesh matplotlib` (only if the import fails).

## Printer: Bambu Lab H3C
Checked against Bambu's spec page and the H3C presets in Bambu Studio 02.09.01.70 (Nov 2026).
- Tool changer with 9 PrintTools. Each has its own nozzle and heater and keeps its material loaded, so one print can use up to 9 materials or colours with no purging between them.
- Default layout: 8 standard tools plus one for 2.85 mm TPU. The real layout is in `materials.md`.
- Build volume 330 × 320 × 325 mm. Nozzles 0.2 / 0.4 / 0.6 / 0.8 mm, hardened steel, up to 350 °C. Bed up to 120 °C. Chamber actively heated to 65 °C.
- AMS 3H: 9 spool slots, 2 of them drying slots (up to 85 °C).

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
| Functional, tough, ≤ 70 °C | PETG | strings; poor bridging |
| Outdoor/UV, car interior, ≤ 90 °C | ASA | fumes, so ventilate; needs the warm chamber |
| Stiff and strong, ≤ 150 °C, gears, brackets under load | PA-CF / PAHT-CF | must be dried (AMS drying slot); hardened nozzle |
| Flexible: feet, bumpers, gaskets, grips | TPU 95A | slow; 2.85 mm TPU goes on the TPU tool, "TPU for AMS" on a standard one |
| Clean undersides on supported parts | a support interface that doesn't bond to the part: PETG under PLA, PLA under PETG, or Bambu Support for PLA/PETG | each on its own tool; Bambu documents the PLA Basic + PETG HF pair, other PLA types are hit and miss, so test small first |
| Food contact | avoid; FDM layer gaps hold bacteria | say so plainly, don't promise food safety |

## Design rules that make parts work (0.4 mm nozzle)
- **Clearance per side**: press fit 0.05–0.1, sliding fit 0.2, free or rotating 0.3, print-in-place joints 0.4 mm. Small holes print undersize, so add 0.2 mm to their diameter.
- **Walls**: at least 0.8 mm (2 lines). For structural walls use 1.6–2.4 mm, and add wall loops before adding infill.
- **Layer lines are the weak axis.** Orient the part so the load runs along the layers instead of peeling them apart. Hooks and brackets usually print on their side.
- **Overhangs** up to 45° print without support. Bridges up to ~20 mm are fine. Use 45° chamfers on edges that face down and fillets elsewhere. A 0.4 mm chamfer on the bottom edges counters elephant's foot.
- **Horizontal holes** larger than ~6 mm need a teardrop or diamond top so they print without support.
- **Fasteners**: an M3 self-tapping pilot is 2.5 mm. Heat-set inserts follow the insert's spec (usually ~4.0 mm for M3). Nut traps get +0.2 mm across flats. Print threads only at M8 and up; use inserts below that.
- **Text**: at least 0.6 mm raised or deep with strokes of 0.8 mm or more. Better: model it as its own body on another tool.

## Slicing: Bambu Studio CLI (on the computer next to the printer, not in cloud sessions)

**Status.** Flags, preset names and the preset loader were checked against the Bambu Studio 02.09.01.70 source, and `flatten.py` was run over all 155 H3C presets in it. The slice command itself has **never been run on a real install**. On the first run, fix whatever differs, then replace this paragraph with the version and date it worked, and commit.

| | Binary | Presets (`<profiles>`) |
|---|---|---|
| macOS | `/Applications/BambuStudio.app/Contents/MacOS/BambuStudio` | `/Applications/BambuStudio.app/Contents/Resources/profiles/BBL` |
| Windows | `C:\Program Files\Bambu Studio\bambu-studio.exe` | `C:\Program Files\Bambu Studio\resources\profiles\BBL` |

If `<profiles>` has no H3C files, Bambu Studio is too old: update it. A newer synced copy of the presets may sit in the user data folder (`~/Library/Application Support/BambuStudio/system/BBL`, `%APPDATA%\BambuStudio\system\BBL`); use it when it exists.

Preset names:
- machine: `Bambu Lab H3C 0.4 nozzle` (also 0.2, 0.6, 0.8)
- process: `0.20mm Standard @BBL H3C`; also `0.08mm` / `0.12mm` / `0.16mm` / `0.20mm High Quality`, `0.16mm` / `0.24mm Standard`. Other nozzles end in e.g. `@BBL H3C 0.6 nozzle`.
- filament: `<name> @BBL H3C`, e.g. `Bambu PLA Basic @BBL H3C`, `Bambu PETG HF @BBL H3C`, `Generic PETG @BBL H3C`. List the folder for the rest.

**1. Flatten the presets.** A stock preset holds only its differences from a parent, and the CLI does not follow that chain; loaded as-is it slices with wrong settings and no error. `flatten.py` writes complete files and applies the job's overrides:

```
python <skill-dir>/flatten.py "<profiles>" machine  "Bambu Lab H3C 0.4 nozzle" projects/<slug>/slice/machine.json
python <skill-dir>/flatten.py "<profiles>" process  "0.20mm Standard @BBL H3C" projects/<slug>/slice/process.json wall_loops=4 sparse_infill_density=25% enable_support=1 "support_type=tree(auto)"
python <skill-dir>/flatten.py "<profiles>" filament "Bambu PETG HF @BBL H3C"   projects/<slug>/slice/f1.json
```

Override keys that exist in this version:
- `layer_height`, `wall_loops`, `top_shell_layers`, `bottom_shell_layers`
- `sparse_infill_density` (with `%`), `sparse_infill_pattern`
- `enable_support` (0/1), `support_type` (`normal(auto)`, `tree(auto)`, `normal(manual)`, `tree(manual)`)
- `support_filament`, `support_interface_filament` (filament number; 0 = same as the part)
- `brim_type` (`auto_brim`, `outer_only`, `no_brim`), `brim_width`, `enable_prime_tower`

The slicer ignores a misspelled key without complaint, so copy the names from here or from the flattened file.

**2. Slice.**

```
"<binary>" --arrange 1 --slice 0 \
  --load-settings "projects/<slug>/slice/machine.json;projects/<slug>/slice/process.json" \
  --load-filaments "projects/<slug>/slice/f1.json" \
  --outputdir projects/<slug>/slice --export-3mf <part>.gcode.3mf \
  projects/<slug>/<part>.stl
```
- Give one filament file per filament in use, `;`-separated. The first is filament 1.
- Leave `--orient` off: the model is already oriented.
- A support interface in a second material needs no extra STL: add its filament file as number 2 and flatten the process with `support_interface_filament=2`.

**3. Read `projects/<slug>/slice/result.json`.**
- `return_code` must be 0; otherwise report `error_string`.
- `sliced_plates[0].total_predication` is the print time in seconds; `filaments[].total_used_g` the grams per filament; `warning_message` anything the slicer flagged.
- Top-level `layer_height`, `wall_loops` and `sparse_infill_density` show whether the overrides took effect.

**Parts made of several bodies in different materials or colours** are not automated: the CLI would arrange the STLs as separate objects and pull them apart. Hand them over through the app: drag all the part's STLs into Bambu Studio together, answer Yes to "load as a single object with multiple parts", and assign each part the filament listed in `notes.md`. (The CLI has `--load-assemble-list` for this; it is untested here.)

**If the CLI fails**, open the STL in the Bambu Studio app (`open -a BambuStudio <file>` on macOS, `start "" <file>` on Windows), give the user the settings from `notes.md`, and let them press Slice.

## Hand-off: starting the print
- **Default:** open the `.gcode.3mf` in Bambu Studio, check the tool/filament mapping, and press Print. That one tap is Gate 2, and it stays.
- **Hands-off sending (opt-in, not set up):** the printer must be in LAN-only mode with Developer Mode on. Then upload over FTPS and start over MQTT (for example the `bambulabs_api` Python package). This disconnects Bambu Cloud and Handy remote access. Set it up only if the user explicitly asks, and keep the plate-clear confirmation even then.

## Cloud sessions (Claude app on the phone)
Steps 1–6 run fully in a cloud session. There is no Bambu Studio and no printer on the network there. Commit and push the project folder; slicing and printing happen on the computer next to the printer:
- open this repo in Claude Code there and say "slice <slug>", or
- attach that computer to the cloud session through Remote Control.

## Model and effort
Run this on **Opus 5.5 or Fable 5.2 at high effort**. The skill does not pin a model: a pin lasts only for the turn that invokes the skill, and it would override a stronger model the user picked.
- Before step 3, if the session is on a smaller model (Sonnet, Haiku), say so and ask the user to switch with `/model`.
- Suggest Fable 5.2 for multi-part assemblies, mechanisms (gears, hinges, snap-fits, threads) and load-bearing parts, or when a design has come back wrong twice.
