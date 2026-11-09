"""Pack the two supplied CC BY Sketchfab GLBs into the scene's geometry-only GLB."""

import json
import math
from pathlib import Path
import struct
import sys


def read_mesh(path):
    blob = path.read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    gltf = json.loads(blob[20:20 + size])
    payload = 28 + size
    primitive, = gltf['meshes'][0]['primitives']

    def read(index, fmt, group=1):
        attr = gltf['accessors'][index]
        view = gltf['bufferViews'][attr['bufferView']]
        offset = payload + view.get('byteOffset', 0) + attr.get('byteOffset', 0)
        stride = view.get('byteStride', struct.calcsize(fmt))
        return [struct.unpack_from(fmt, blob, offset + i * stride) for i in range(attr['count'] // group)]

    positions = read(primitive['attributes']['POSITION'], '<3f')
    normals = read(primitive['attributes']['NORMAL'], '<3f')
    return positions, normals, read(primitive['indices'], '<3I', 3), gltf['asset']['extras']


def compact(positions, normals, triangles):
    used = set(i for triangle in triangles for i in triangle)
    axes = [[positions[i][a] for i in used] for a in range(3)]
    sizes = [max(a) - min(a) for a in axes]
    centers = [(max(a) + min(a)) / 2 for a in axes]
    vertices, indices, keys = [], [], {}
    for triangle in triangles:
        face = []
        for i in triangle:
            p = [(v - c) / s for v, c, s in zip(positions[i], centers, sizes)]
            n = [v * s for v, s in zip(normals[i], sizes)]
            length = math.hypot(*n) or 1
            key = tuple(round(v, 6) for v in p) + tuple(round(127 * v / length) for v in n)
            if key not in keys:
                keys[key] = len(vertices)
                vertices.append(key)
            face.append(keys[key])
        if len(set(face)) == 3:
            indices.extend(face)
    return vertices, indices


def pack(ring_path, tower_path, output):
    ring, ring_normals, ring_faces, ring_credit = read_mesh(ring_path)
    tower, tower_normals, tower_faces, tower_credit = read_mesh(tower_path)
    tower_faces = [face for face in tower_faces if max(tower[i][1] for i in face) < 7950]
    meshes = [('Ring', ring, ring_normals, ring_faces), ('Tower', tower, tower_normals, tower_faces)]
    data = bytearray()
    gltf = dict(asset=dict(version='2.0', extras={'sources': [ring_credit, tower_credit]}),
                extensionsUsed=['KHR_mesh_quantization'], extensionsRequired=['KHR_mesh_quantization'],
                scene=0, scenes=[{'nodes': list(range(len(meshes)))}], nodes=[], meshes=[], accessors=[], bufferViews=[])

    def append(blob, count, kind, component, target, **fields):
        view = len(gltf['bufferViews'])
        gltf['bufferViews'].append(dict(buffer=0, byteOffset=len(data), byteLength=len(blob), target=target))
        data.extend(blob)
        data.extend(bytes(-len(data) % 4))
        gltf['accessors'].append(dict(bufferView=view, count=count, type=kind, componentType=component, **fields))
        return len(gltf['accessors']) - 1

    for i, (name, positions, normals, faces) in enumerate(meshes):
        vertices, indices = compact(positions, normals, faces)
        points = [tuple(round(32766 * p) for p in v[:3]) for v in vertices]
        coords = list(zip(*points))
        position = append(b''.join(struct.pack('<3h2x', *p) for p in points), len(vertices), 'VEC3', 5122, 34962,
                          normalized=True, min=list(map(min, coords)), max=list(map(max, coords)))
        gltf['bufferViews'][-1]['byteStride'] = 8
        normal = append(b''.join(struct.pack('<3bx', *v[3:]) for v in vertices), len(vertices), 'VEC3', 5120, 34962,
                        normalized=True)
        gltf['bufferViews'][-1]['byteStride'] = 4
        index = append(struct.pack(f'<{len(indices)}H', *indices), len(indices), 'SCALAR', 5123, 34963)
        gltf['meshes'].append(dict(name=name, primitives=[dict(attributes={'POSITION': position, 'NORMAL': normal}, indices=index)]))
        gltf['nodes'].append(dict(name=name, mesh=i))
        print(f'{name}: {len(indices) // 3} triangles, {len(vertices)} vertices')
    gltf['buffers'] = [{'byteLength': len(data)}]
    manifest = json.dumps(gltf, separators=(',', ':')).encode()
    manifest += b' ' * (-len(manifest) % 4)
    output.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(manifest) + len(data))
                       + struct.pack('<I4s', len(manifest), b'JSON') + manifest
                       + struct.pack('<I4s', len(data), b'BIN\0') + data)


if __name__ == '__main__':
    pack(*map(Path, sys.argv[1:]))
