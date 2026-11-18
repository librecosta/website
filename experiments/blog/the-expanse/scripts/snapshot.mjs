import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const workspace = fileURLToPath(new URL('../', import.meta.url));
export const next = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

export async function snapshot(output) {
  const base = join(root, '.local', 'expanse-evidence');
  await mkdir(base, { recursive: true });
  const site = await mkdtemp(join(base, 'site-'));
  await Promise.all(['src', 'config', 'public', 'next.config.ts', 'package.json', 'tsconfig.json'].map(name =>
    cp(join(root, name), join(site, name), { recursive: true })));
  const source = join(site, 'src', 'components', 'expanse');
  const manifest = {};
  async function patch(filename, edits) {
    const file = join(source, filename);
    const original = await readFile(file, 'utf8');
    let contents = `import { evidence${filename === 'SandDust.tsx' ? ', controls' : filename === 'ExpanseCanvas.tsx' ? ', gpuProbe' : ''} } from './evidence-probe';\n` + original;
    if (original.startsWith("'use client';")) {
      contents = "'use client';\n" + contents.replace("'use client';", '');
    }
    for (const [from, to] of edits) {
      if (contents.split(from).length !== 2) throw new Error(`${filename} probe anchor changed: ${from}`);
      contents = contents.replace(from, () => to);
    }
    manifest[filename] = {
      original: createHash('sha256').update(original).digest('hex'),
      isolated: createHash('sha256').update(contents).digest('hex'),
    };
    await writeFile(file, contents);
  }
  await cp(join(workspace, 'scripts', 'probe.ts'), join(source, 'evidence-probe.ts'));
  await patch('ExpanseExperience.tsx', [
    ['debug={debug} skyView={skyView} windView={windView}',
      'debug={debug || !!evidence} skyView={evidence ? evidence.sky as typeof skyView : skyView} windView={evidence ? evidence.wind as typeof windView : windView}'],
  ]);
  await patch('ExpanseCanvas.tsx', [
    ['const smoothed = signal.current.value;', 'const smoothed = evidence?.position ?? signal.current.value;'],
    ['    <group ref={opaque}>', `    {evidence?.mode === 'wire' && <mesh geometry={terrain.geometry} renderOrder={2}>
      <meshBasicMaterial color="#302c27" wireframe transparent opacity={0.64} depthWrite={false} />
    </mesh>}
    <group ref={opaque}>`],
    ['  // Submit the usual R3F draw', `  const probe = useMemo(() => evidence?.shot === 'F10' ? gpuProbe(gl.getContext() as WebGL2RenderingContext) : null, [gl]);
  // Submit the usual R3F draw`],
    ['      gl.render(scene, camera);', `      const finish = probe?.begin();
      gl.render(scene, camera);
      finish?.(gl.info.render.calls, gl.info.render.triangles);`],
    ["powerPreference: 'high-performance'", "powerPreference: 'high-performance', preserveDrawingBuffer: !!evidence && evidence.shot !== 'F10'"],
  ]);
  await patch('aeolian-material.ts', [
    ['    Object.assign(shader.uniforms, uniforms);', `    Object.assign(shader.uniforms, uniforms);
    const mode = evidence?.mode;
    if (mode === 'smooth' || mode === 'broad' || mode === 'fine') {
      shader.uniforms.duneBedRelief = shader.uniforms.duneBedTint = shader.uniforms.duneRoughness = { value: 0 };
      if (mode !== 'broad') uniforms.duneBroad.value.y = 0;
      if (mode !== 'fine') uniforms.duneFine.value.y = 0;
    }`],
  ]);
  // The second shader edit only bypasses footprint attenuation. Depth fades and variation stay active.
  const materialPath = join(source, 'aeolian-material.ts');
  const material = await readFile(materialPath, 'utf8');
  const filterPattern = /\(1\.0 - smoothstep\(duneAA\.x, duneAA\.y, (?:duneFootprint\(phaseGradient, pixelX, pixelY\)|bedFootprint)\)\)/g;
  if ([...material.matchAll(filterPattern)].length !== 2) throw new Error('The two dune footprint filters changed');
  const noAA = material.replace(filterPattern, term => `\${evidence?.mode === 'no-aa' ? '1.0' : '${term}'}`);
  await writeFile(materialPath, noAA);
  manifest['aeolian-material.ts'].isolated = createHash('sha256').update(noAA).digest('hex');
  await patch('sandstorm.ts', [
    ['    vec3 scatterSandstorm(vec3 base, vec3 cameraToSurface) {',
      "    vec3 scatterSandstorm(vec3 base, vec3 cameraToSurface) {\n      ${evidence?.mode === 'no-veil' ? 'return base;' : ''}"],
  ]);
  await patch('atmosphere.ts', [
    ['            gl_FragColor.rgb = mix(gl_FragColor.rgb, scatter, fogAmount);',
      "            ${evidence?.mode === 'no-aerial' ? '' : 'gl_FragColor.rgb = mix(gl_FragColor.rgb, scatter, fogAmount);'}"],
  ]);
  await patch('FutureCity.tsx', [
    ['    const time = elapsed.current;', "    if (evidence && evidence.shot !== 'F10') elapsed.current = evidence.time;\n    const time = elapsed.current;"],
  ]);
  await patch('SandDust.tsx', [
    ['    if (clock.current.running) clock.current.remainder += Math.min(delta, 0.09);',
      `    if (evidence && evidence.shot !== 'F10') {
      clock.current.remainder = Math.max(0, evidence.time - simulation.time);
      if (evidence.shot === 'F05') controls.sand = () => {
        const first = simulation.firstRow * config.resolution[0];
        return { time: simulation.time, camera: camera.position.toArray(), exposure, firstRow: simulation.firstRow,
          windowStart: simulation.windowStart, windowDepth: simulation.windowDepth, budget: simulation.measureBudget(),
          values: Array.from(simulation.concentration.subarray(first, first + config.resolution[0] * config.window.rows)) };
      };
    } else if (clock.current.running) clock.current.remainder += Math.min(delta, 0.09);`],
  ]);
  await mkdir(join(output, 'raw'), { recursive: true });
  await writeFile(join(output, 'raw', 'snapshot.json'), JSON.stringify(manifest, null, 2));
  return site;
}
