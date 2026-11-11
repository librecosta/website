# Collaboration Playbook

## Start a change

1. Check the branch and working tree. Preserve existing edits and keep the diff focused on the requested scope.
2. Use [AGENTS.md](../AGENTS.md) to find the relevant architecture, creative direction, and implementation. If code and prose disagree about current behavior, verify the behavior and identify the mismatch. Keep approved creative decisions intact unless the task changes them.
3. Keep the English and Chinese root READMEs in sync for setup, public entry points, and verification. Use English for agent guidance and other README files. Keep technical experiments in research notes and retired workflows in the archive.

## Verify and hand off

- Use `pnpm check` as the repository-wide verification command. `pnpm check:world` is the fast check for deterministic geometry, travel clearance, and transport or city layout changes. [Command definitions](../package.json) · [World checks](../scripts/check-expanse.mjs)
- For visual or interaction changes, use the normal [Expanse preview](http://127.0.0.1:3000/lab/expanse) and the [debug view](http://127.0.0.1:3000/lab/expanse?debug=1) as appropriate. Check the relevant camera stops and viewport sizes. Exercise forward and reverse scrolling, reduced motion, and HTML fallback when the change touches them.
- Report what changed, the checks that ran, and any decisions or limits the reviewer should know. Review the diff and any staged file list before committing. When the task calls for a review first, hand off the working tree without committing or pushing.

## Assets and history

- Establish geometry, scale, composition, and light before detailed surface work. Prefer procedural techniques for terrain, repeated structures, layout, sky, atmosphere, and moving effects. Use Blender for distinct geometry or necessary offline baking. Review the result in the browser when it affects the site.
- Keep generated DCC projects, model exports, textures, videos, and routine screenshots local. The R1 directories retain reproducible research scripts, parameters, and verification results. Store temporary browser evidence in `.local/`. [Asset ignore rules](../.gitignore) · [Witness Core research](../art/witness-core/r1-b/README.md)
- For a runtime or shared asset approved for tracking, record its purpose, provenance, license, and optimized size. Use an exact-path ignore exception where required. Preserve the default allowance for website PNG and WebP assets. Stage and review specific paths.
- Use `git rm --cached` when a tracked research output should leave the index while its local copy is kept. The P1-A cleanup used this method for 81 files, about 122.2 MB. Earlier Git objects remain in history.
- Keep historical comparisons and performance figures with their original test conditions. Link to source or a historical commit for reproducible details. [Expanse archive](../docs/archive/expanse-legacy/README.md)
