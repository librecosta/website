"""Compose the article plates from captured buffers and solver output."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
from PIL import Image


WORKSPACE = Path(__file__).resolve().parents[1]
PAPER, INK, MUTED, ACCENT = "#f4f1ea", "#202e2e", "#51605b", "#287a78"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "text.color": INK, "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.edgecolor": "#b6bdb5",
    "axes.facecolor": PAPER, "font.size": 10,
})


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stamp(fig, x, y, message, **style):
    fig.text(x, y, message, va="center", **style)


def plate(id, title, note, commit):
    fig = plt.figure(figsize=(16, 9), dpi=100, facecolor=PAPER)
    stamp(fig, .05, .945, f"THE EXPANSE / {id}", weight="bold", color=ACCENT, fontsize=13)
    stamp(fig, .05, .88, title, weight="bold", fontsize=33)
    stamp(fig, .05, .043, note, color=MUTED, fontsize=11)
    stamp(fig, .95, .043, commit[:8], ha="right", family="monospace", fontsize=11)
    return fig


def axes(fig, box, label=None, hide=False):
    ax = fig.add_axes(box)
    if label:
        ax.set_title(label, loc="left", fontsize=13, fontweight="bold", pad=9)
    if hide:
        ax.axis("off")
    return ax


def frame(raw, id, name, crop=None):
    with Image.open(raw / id / f"{name}.png") as img:
        assert img.size == (1600, 900), (id, name, img.size)
        return np.asarray((img.crop(crop) if crop else img).convert("RGB"))


def compare(fig, raw, id, panels, boxes, crop=None, native=False):
    for (name, label), box in zip(panels, boxes, strict=True):
        axes(fig, box, label, hide=True).imshow(
            frame(raw, id, name, crop), interpolation="nearest" if native else "antialiased"
        )


def difference(first, second):
    delta = np.abs(first.astype(np.int16) - second.astype(np.int16))
    return {"channelMean": float(delta.mean()), "channelMax": int(delta.max()),
            "pixelsChanged": int(np.any(delta, axis=2).sum()), "pixels": int(delta.shape[0] * delta.shape[1])}


TWO = [(.05, .25, .44, .47), (.51, .25, .44, .47)]
FOUR = [(x, y, .44, .325) for y in (.46, .085) for x in (.05, .51)]


def heightfield(fig, raw):
    data = read(raw / "F01-height.json")
    cols, rows = data["resolution"]
    x0, x1, z0, z1 = data["bounds"]
    lo = min(panel["min"] for panel in data["panels"])
    hi = max(panel["max"] for panel in data["panels"])
    titles = ["A  Basin / absolute Y", "B  Crest ribbons / ΔY", "C  Crosswind folds / ΔY",
              "D  Masked noise / ΔY", "E  Aeolian dune relief / ΔY", "F  Complete mesh / absolute Y"]
    boxes = [(x, y, .204, .272) for y in (.484, .136) for x in (.062, .306, .55)]
    for panel, name, box in zip(data["panels"], titles, boxes, strict=True):
        ax = axes(fig, box, name)
        plot = ax.imshow(np.reshape(panel["values"], (rows, cols)), extent=(x0, x1, z0, z1),
                         origin="upper", aspect="auto", cmap="cividis", vmin=lo, vmax=hi)
        ax.set_xticks([-3600, 0, 3600])
        ax.set_yticks([-12000, -8000, -4000])
        ax.text(.985, .033, f'{panel["min"]:.2f} to {panel["max"]:.2f}',
                transform=ax.transAxes, ha="right", color="white", fontsize=10,
                bbox={"facecolor": INK, "alpha": .78, "pad": 3, "edgecolor": "none"})
    stamp(fig, .402, .093, "X (world units)", ha="center")
    stamp(fig, .018, .45, "Z (world units)", rotation=90, ha="center")
    bar = fig.colorbar(plot, cax=fig.add_axes((.814, .17, .018, .57)))
    bar.set_label("Shared height scale (world units)")
    return {key: data[key] for key in ("seed", "resolution", "bounds", "triangles",
            "fingerprint", "heightError", "floatMeshError")} | {
                "ranges": {panel["id"]: [panel["min"], panel["max"]] for panel in data["panels"]}
            }


def shader(fig, raw, id):
    if id == "F03":
        crop = (920, 620, 1540, 880)
        reference = "smooth"
        panels = [("smooth", "A  Ripple perturbation off"), ("broad", "B  Broad ripples"),
                  ("fine", "C  Fine ripples"), ("complete", "D  Production material")]
        boxes = FOUR
    else:
        crop = (500, 710, 1050, 900)
        reference = "filtered"
        panels = [("filtered", "A  Derivative filtering on"), ("unfiltered", "B  Derivative filtering off")]
        boxes = [(.05, .30, .44, .34), (.51, .30, .44, .34)]
    compare(fig, raw, id, panels, boxes, crop, native=True)
    full_ref, crop_ref = frame(raw, id, reference), frame(raw, id, reference, crop)
    deltas = {name: {"full": difference(full_ref, frame(raw, id, name)),
                     "crop": difference(crop_ref, frame(raw, id, name, crop))}
              for name, _ in panels if name != reference}
    assert all(values["full"]["pixelsChanged"] for values in deltas.values()), f"{id}: identical frames"
    if id == "F04":
        full = deltas["unfiltered"]["full"]
        stamp(fig, .05, .245,
              f'Full frame  ·  {full["pixelsChanged"]:,} of {full["pixels"]:,} pixels changed  ·  maximum RGB change {full["channelMax"]}/255',
              fontsize=13)
        stamp(fig, .05, .188, "Small difference in this still frame. Temporal aliasing was unmeasured.", color=MUTED)
    return {"differenceAgainst": reference, "cropPixelsLTRB": list(crop), "differences": deltas}


def concentration(fig, raw, config):
    offline = read(raw / "F05-offline.json")
    captured = read(raw / "F05/transport.json")
    sand = captured["sand"]
    debug = read(raw / "F05/density.json")["sand"]
    assert np.array_equal(sand["values"], debug["values"])
    delta = float(np.max(np.abs(np.subtract(sand["values"], offline["values"]))))
    assert delta < 1e-9 and sand["firstRow"] == offline["firstRow"]
    xmin, xmax, _, _ = config["bounds"]
    zmin, depth = sand["windowStart"], sand["windowDepth"]
    ax = axes(fig, (.105, .14, .26, .62), "A  Active transport cells")
    field = np.reshape(sand["values"], (config["window"]["rows"], config["resolution"][0]))
    plot = ax.imshow(field, origin="lower", aspect="auto", interpolation="nearest", cmap="magma",
                     extent=(xmin, xmax, zmin, zmin + depth), vmin=0, vmax=96)
    ax.set(xlabel="X (world units)", ylabel="Z (world units)")
    ax.set_xticks([-625, 0, 625])
    bar = fig.colorbar(plot, cax=fig.add_axes((.39, .14, .015, .62)))
    bar.set_label("Column mass (mg/m²)")
    compare(fig, raw, "F05", [("transport", "B  Integrated wind and dust"), ("density", "C  SandDust density debug")],
            [(.52, .456, .40, .328), (.52, .093, .40, .328)])
    return {"windowStart": zmin, "windowDepth": depth, "simulatedSeconds": sand["time"],
            "min": float(field.min()), "max": float(field.max()), "browserOfflineMaxDelta": delta,
            "fieldDisplayRange": [0, 96], "budget": sand["budget"], "camera": sand["camera"]}


def transport_window(fig, raw):
    data = read(raw / "F06-window.json")
    before, after = data["before"], data["after"]
    xmin, xmax, zmin, zmax = data["config"]["bounds"]
    width, depth = xmax - xmin, before["windowDepth"]
    ax = axes(fig, (.085, .153, .37, .61), "A  Computational domain and active rows")
    ax.add_patch(Rectangle((xmin, zmin), width, zmax - zmin, fc="#e4e2d9", ec=MUTED))
    ax.add_patch(Rectangle((xmin, after["windowStart"]), width, depth, fc="#85c1b4", ec=ACCENT))
    ax.add_patch(Rectangle((xmin, before["windowStart"]), width, depth, fill=False, ec="#a96835", ls="--", lw=2))
    ax.add_patch(Rectangle((xmin, before["windowStart"]), width, depth - data["stepWorldUnits"],
                           fc="#bae0d4", ec="none"))
    ax.scatter([before["cameraX"], after["cameraX"]], [before["cameraZ"], after["cameraZ"]], color=INK, s=18)
    ax.annotate("", (after["cameraX"], after["cameraZ"]), (before["cameraX"], before["cameraZ"]),
                arrowprops={"arrowstyle": "->", "color": INK, "lw": 1.3, "shrinkA": 0, "shrinkB": 0})
    ax.annotate(f'Camera follows −Z\n{data["stepWorldUnits"]:g} world units', (after["cameraX"], after["cameraZ"]),
                (175, -2600), fontsize=10, arrowprops={"arrowstyle": "->", "color": INK})
    ax.text(0, -3170, "168 overlapping rows\npreserved bit-for-bit", ha="center")
    ax.text(0, -1180, "Inactive rows", ha="center", color=MUTED)
    ax.text(0, -4960, "Inactive rows", ha="center", color=MUTED)
    for point in [(xmin, -2740), (xmax, -3130), (-300, after["windowStart"] + depth),
                  (350, after["windowStart"])]:
        x, z = point
        ax.annotate("", (x + 95, z - 47.5), (x - 95, z + 47.5),
                    arrowprops={"arrowstyle": "->", "color": "#914b2a", "lw": 1.5})
    ax.set(xlim=(-865, 865), ylim=(zmin - 160, zmax + 130), xlabel="X (world units)", ylabel="Z (world units)")
    ax.set_xticks([-625, 0, 625])
    stamp(fig, .53, .779, "B  State and mass budget", weight="bold", fontsize=14)
    stamp(fig, .53, .721, f'First active row  {before["firstRow"]} → {after["firstRow"]}')
    stamp(fig, .53, .687, "Arrows show nominal advection direction [1, −0.5].", color=MUTED)
    stamp(fig, .53, .653, "Dashed outline is the previous window. Teal is the new window.", color=MUTED)
    ax2 = axes(fig, (.53, .23, .41, .37), hide=True)
    fields = [("airborne", "Airborne"), ("lifted", "Lifted"), ("deposited", "Deposited"),
              ("escaped", "Escaped"), ("entered", "Entered"), ("fed", "Fed"),
              ("residual", "Air residual"), ("totalResidual", "Total residual")]
    rows = [[label, *(f"{state['budget'][key]:.2e}" if "residual" in key.lower() else
                      f"{state['budget'][key]:,.2f}" for state in (before, after))] for key, label in fields]
    table = ax2.table(cellText=rows, colLabels=["Mass (mg)", "Before", "After"], loc="center", cellLoc="right")
    table.set_fontsize(12)
    table.scale(1, 1.85)
    for (row, _), cell in table.get_celld().items():
        cell.set(facecolor="#e8ede6" if row % 2 == 0 else PAPER, edgecolor=PAPER)
    return {"before": before, "after": after, "overlapCells": data["overlapCells"],
            "bitIdentical": data["bitIdentical"], "cfl": data["cfl"], "shiftWorldUnits": data["stepWorldUnits"]}


def timing(fig, raw, settings):
    runs = read(raw / "F10-frames.json")
    summary = {}
    plots = [axes(fig, (.10, .31, .365, .41), "A  Frame submission intervals"),
             axes(fig, (.585, .31, .365, .41), "B  GPU render query")]
    for ax in plots:
        ax.set(xlabel="Milliseconds", ylabel="Cumulative share (%)", ylim=(0, 103))
        ax.grid(alpha=.3)
    for index, (preset, color) in enumerate([("desktop", ACCENT), ("mobile", "#a96835")]):
        group = [run for run in runs if run["preset"] == preset]
        assert [run["round"] for run in group] == list(range(1, settings["rounds"] + 1))
        values, rounds = [[], []], []
        all_samples = []
        for run in group:
            trace = run["trace"]
            samples = trace["samples"]
            assert len(samples) == settings["sampleFrames"] and not run["errors"]
            intervals = np.diff([row["frameAt"] for row in samples])
            assert np.all(intervals > 0)
            gpu = [row["gpuMs"] for row in samples if row.get("gpuMs") is not None]
            values[0].extend(intervals)
            values[1].extend(gpu)
            all_samples.extend(samples)
            rounds.append({"round": run["round"], "intervals": percentiles(intervals), "gpu": percentiles(gpu),
                           "gpuExtension": trace["support"], "disjoint": trace["disjoint"],
                           "camera": run["render"]["camera"], "quality": run["render"]["quality"]})
        for ax, sample in zip(plots, values, strict=True):
            if sample:
                ax.step(sorted(sample), np.arange(1, len(sample) + 1) * 100 / len(sample),
                        where="post", lw=2.2, color=color, label=preset.capitalize())
        calls = sorted({row["calls"] for row in all_samples})
        tris = sorted({row["triangles"] for row in all_samples})
        buffer = group[0]["trace"]["drawingBuffer"]
        gpu_summary = percentiles(values[1])
        if not values[1]:
            plots[1].text(.04, .20 - index * .08, f"{preset}: GPU timing unavailable",
                          transform=plots[1].transAxes, color=color)
        summary[preset] = {"rounds": rounds, "frameIntervals": percentiles(values[0]), "gpu": gpu_summary,
                           "drawCalls": calls, "triangles": tris, "drawingBuffer": buffer,
                           "renderer": group[0]["render"]["renderer"], "webgl": group[0]["render"]["webgl"]}
        stamp(fig, .10, .194 - index * .052,
              f"{preset.upper():9}  {buffer[0]} × {buffer[1]} buffer    ·    {calls[0]} calls    ·    {tris[0]:,} triangles",
              color=color, fontsize=13)
    for ax in plots:
        if ax.lines:
            ax.legend(loc="lower right", frameon=False)
    return summary


def percentiles(sample):
    if len(sample) == 0:
        return {"status": "unavailable", "samples": 0}
    p50, p95 = np.percentile(sample, [50, 95])
    return {"p50Ms": float(p50), "p95Ms": float(p95), "samples": len(sample)}


NOTES = {
    "F01": "Identical sample grid and color scale  ·  281 × 481 vertices  ·  Before local ruin deposits",
    "F02": "Production terrain vertices and diagonals  ·  Desktop mesh  ·  Static wind comparison",
    "F03": "Matched ground crop  ·  Original RGB values  ·  Bed and dune geometry remain fixed",
    "F04": "Identical nearest-neighbor crops  ·  Source RGB values preserved",
    "F05": "64 solver steps / 2.0 s  ·  Wind [1, −0.5]  ·  Simulated column mass",
    "F06": "One stride / 42.5 world units  ·  Solver time held at 2.0 s",
    "F07": "Near-camera scatter contribution only  ·  5 ray samples  ·  Ground transport and grit remain active",
    "F08": "Fixed view and time  ·  Browser sky debug modes  ·  Cloud-free aerial lookup held constant",
    "F09": "Same camera, lighting and sky  ·  Regional skyline cloud remains",
    "F10": "Same AMD laptop GPU  ·  Mobile viewport simulation  ·  3 × 100 frames per preset",
}


def render(fig, raw, id, source):
    if id == "F01":
        return heightfield(fig, raw)
    if id in ("F03", "F04"):
        return shader(fig, raw, id)
    if id == "F05":
        return concentration(fig, raw, source["parameters"]["windMotion"])
    if id == "F06":
        return transport_window(fig, raw)
    if id == "F10":
        return timing(fig, raw, source["fixture"])
    panels = {
        "F02": [("mesh", "A  Indexed wireframe"), ("final", "B  Shaded terrain")],
        "F07": [("veil-off", "A  Near scatter off"), ("veil-on", "B  Near scatter on")],
        "F08": [("background", "A  Background"), ("main", "B  Main cloud band"),
                ("secondary", "C  Secondary cloud band"), ("color", "D  Composite sky")],
        "F09": [("mix-off", "A  Aerial mix off"), ("mix-on", "B  Aerial mix on")],
    }[id]
    compare(fig, raw, id, panels, FOUR if id == "F08" else TWO)
    reference = frame(raw, id, panels[0][0])
    deltas = {name: difference(reference, frame(raw, id, name)) for name, _ in panels[1:]}
    assert all(item["pixelsChanged"] for item in deltas.values())
    result = {"differences": deltas}
    if id == "F08":
        result["continuity"] = read(raw / "F08-sky.json")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batch")
    parser.add_argument("figures", nargs="*")
    args = parser.parse_args()
    if not args.batch or not all(c.isascii() and (c.isalnum() or c in "_-") for c in args.batch) or args.batch == "publish":
        parser.error("Invalid batch name")
    specs = read(WORKSPACE / "figures.json")
    ids = args.figures or list(specs)
    if any(id not in specs for id in ids):
        parser.error("Figure IDs must be F01 through F10")
    batch = WORKSPACE / "outputs" / args.batch
    raw, final, publish = batch / "raw", batch / "figures", batch.parent / "publish"
    final.mkdir(parents=True, exist_ok=True)
    publish.mkdir(parents=True, exist_ok=True)
    source = read(raw / "source.json")
    browser_status = read(raw / "browser-status.json") if (raw / "browser-status.json").exists() else {}
    manifest_file = batch / "manifest.json"
    manifest = read(manifest_file) if manifest_file.exists() else {"figures": {}}
    if manifest.get("source", source) != source:
        parser.error("Source or fixture changed. Capture into a new batch.")
    manifest.update({"batch": args.batch, "source": source,
                     "browser": read(raw / "browser.json") if (raw / "browser.json").exists() else None})
    report = {}
    for id in ids:
        spec = specs[id]
        basename = f"{id}-{spec['slug']}.png"
        entry = {"type": spec["type"], "title": spec["title"], "limitation": spec.get("limitation"),
                 "commit": source["commit"], "seed": source["parameters"]["seed"],
                 "fixture": "source.fixture", "parameters": "source.parameters",
                 "commands": [
                     *([f"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/numeric.mjs {args.batch} {id}"]
                         if spec.get("numeric") else []),
                     *([f"node scripts/browser.mjs {args.batch} {id}"] if spec["type"] != "data" else []),
                     f"python scripts/figures.py {args.batch} {id}",
                 ]}
        manifest["figures"][id] = entry
        try:
            precondition = browser_status.get(id, {})
            if spec["type"] != "data" and (precondition.get("status") != "captured" or
                                             precondition.get("commit") != source["commit"]):
                raise ValueError(precondition.get("reason", "Browser capture for this source revision is unavailable."))
            inputs = []
            for path in [raw / name for name in spec["raw"]] + [raw / "source.json"] + (
                [raw / name for name in ("browser.json", "snapshot.json")] if spec["type"] != "data" else []
            ):
                assert path.exists(), path
                inputs.extend(sorted(path.iterdir()) if path.is_dir() else [path])
            entry["raw"] = {file.relative_to(batch).as_posix(): digest(file) for file in inputs if file.is_file()}
            fig = plate(id, spec["title"], NOTES[id], source["commit"])
            try:
                entry["measurements"] = render(fig, raw, id, source)
                fig.savefig(final / basename, dpi=100, facecolor=PAPER)
            finally:
                plt.close(fig)
            with Image.open(final / basename) as image:
                assert image.size == (1600, 900)
            shutil.copyfile(final / basename, publish / basename)
            entry.update({"status": "limited" if id == "F04" else "verified",
                          "image": f"figures/{basename}", "sha256": digest(final / basename),
                          "publish": f"../publish/{basename}"})
        except (AssertionError, OSError, ValueError, KeyError) as error:
            (final / basename).unlink(missing_ok=True)
            entry.update({"status": "blocked", "reason": str(error) or type(error).__name__})
        print(id, entry["status"], entry.get("reason", ""))
    for id, entry in manifest["figures"].items():
        report[id] = {key: entry[key] for key in ("status", "limitation", "measurements", "reason") if key in entry}
    write(manifest_file, manifest)
    write(batch / "report.json", report)
    tiles = [batch / manifest["figures"][id]["image"] for id in specs
             if manifest["figures"].get(id, {}).get("status") in ("verified", "limited")]
    if tiles:
        sheet = Image.new("RGB", (1120, 315 * ((len(tiles) + 1) // 2)), "#293532")
        for i, tile in enumerate(tiles):
            with Image.open(tile) as image:
                image.thumbnail((550, 309))
                sheet.paste(image, (5 + (i % 2) * 560, 3 + (i // 2) * 315))
        sheet.save(publish / "index.jpg", quality=88)
    if any(manifest["figures"][id]["status"] == "blocked" for id in ids):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
