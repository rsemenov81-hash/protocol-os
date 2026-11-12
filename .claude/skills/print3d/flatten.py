#!/usr/bin/env python3
"""Write a standalone Bambu Studio preset that the CLI can load.

--load-settings / --load-filaments read one JSON and do not follow "inherits" or
"include", so a stock preset (which holds only its differences) slices with wrong
settings. This merges parent -> includes -> preset, the order Bambu Studio's own
loader uses (PresetBundle.cpp), then applies key=value overrides.

    python flatten.py <profiles/BBL> process "0.20mm Standard @BBL H3C" out.json wall_loops=4 sparse_infill_density=25%
    python flatten.py --test
"""
import json
import sys
from pathlib import Path


def load(root, kind, name):
    """A preset by name. File names differ from names with '/' in them, so ask the index first."""
    root, index = Path(root), Path(root).with_suffix(".json")  # profiles/BBL -> profiles/BBL.json
    if index.exists():
        entries = json.loads(index.read_text(encoding="utf-8")).get(f"{kind}_list", [])
        sub = next((e["sub_path"] for e in entries if e["name"] == name), None)
        if sub:
            return json.loads((root / sub).read_text(encoding="utf-8"))
    return json.loads((root / kind / f"{name}.json").read_text(encoding="utf-8"))


def flatten(root, kind, name):
    d = load(root, kind, name)
    out = flatten(root, kind, d["inherits"]) if d.get("inherits") else {}
    inc = d.get("include") or []
    for i in [inc] if isinstance(inc, str) else inc:
        out.update(load(root, kind, i))
    out.update(d)
    out.pop("inherits", None)
    out.pop("include", None)
    return out


def main(root, kind, name, dest, *overrides):
    out = flatten(root, kind, name)
    for o in overrides:
        k, v = o.split("=", 1)
        if k not in out:
            # Options left at the slicer default (brim_type, for one) appear in no preset file,
            # so a missing key can't be rejected, only flagged.
            print(f"note: {k!r} is not set by this preset chain; added. The slicer ignores misspelled keys, so check it.")
        # ponytail: a list holds one value per extruder variant; the override goes in every slot.
        out[k] = [v] * len(out[k]) if isinstance(out.get(k), list) else v
    out.update({"from": "system", "type": kind})
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    Path(dest).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{dest}: {len(out)} keys from {kind}/{name}")


def _test():
    import tempfile
    with tempfile.TemporaryDirectory() as t:
        p = Path(t) / "process"
        p.mkdir()
        files = {
            "ba se": {"name": "ba/se", "a": "1", "b": "1", "c": "1", "v": ["1", "1"]},
            "gcode": {"name": "gcode", "instantiation": "false", "b": "2", "c": "2"},
            "leaf": {"name": "leaf", "inherits": "ba/se", "include": ["gcode"], "c": "3"},
        }
        for n, d in files.items():
            (p / f"{n}.json").write_text(json.dumps(d))
        index = {"process_list": [{"name": d["name"], "sub_path": f"process/{n}.json"} for n, d in files.items()]}
        Path(t + ".json").write_text(json.dumps(index))
        main(t, "process", "leaf", Path(t) / "out.json", "v=9")
        out = json.loads((Path(t) / "out.json").read_text())
        assert (out["a"], out["b"], out["c"]) == ("1", "2", "3"), out  # parent < include < own
        assert out["name"] == "leaf" and out["type"] == "process" and out["from"] == "system"
        assert out["v"] == ["9", "9"] and "inherits" not in out and "include" not in out
        Path(t + ".json").unlink()
    print("ok")


if __name__ == "__main__":
    _test() if sys.argv[1:] in ([], ["--test"]) else main(*sys.argv[1:])
