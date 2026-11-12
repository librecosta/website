import { MathUtils, Quaternion, Vector3 } from 'three';
import type { WorldParameters } from './parameters';
import type { renderedGround } from './sand-transport';
import type { Monument } from './world';

type Ground = ReturnType<typeof renderedGround>;

// Locate the intersection of the tilted centreline and the actual dune.
export function ruinGroundContact(item: Monument, ground: Ground) {
  const rotation = new Quaternion().fromArray(item.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
  const origin = new Vector3(...item.position);
  const contact = origin.clone();
  for (let i = 0; i < 4; i++) {
    const y = ground(contact.x, contact.z);
    contact.copy(origin).addScaledVector(up, (y - origin.y) / up.y);
  }
  return contact;
}

export function addRuinDeposits(positions: Float32Array, monuments: Monument[], ground: Ground, world: WorldParameters) {
  const [wx, wz] = world.aeolian.wind;
  const wind = new Vector3(wx, 0, wz).normalize();
  const cross = new Vector3(-wind.z, 0, wind.x);
  const deposits = world.dressing.deposits.flatMap(({ id, height, tail }) => {
    const item = monuments.find(monument => monument.id === id);
    if (!item) return [];
    const contact = ruinGroundContact(item, ground);
    const rotation = new Quaternion().fromArray(item.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(rotation);
    const front = new Vector3(0, 0, 1).applyQuaternion(rotation);
    const span = (axis: Vector3) =>
      (Math.abs(right.dot(axis)) * item.scale[0] + Math.abs(front.dot(axis)) * item.scale[2]) / 2;
    const gradient = (ground(contact.x + cross.x * 70, contact.z + cross.z * 70) -
      ground(contact.x - cross.x * 70, contact.z - cross.z * 70)) / 140;
    // Locate the sheltered shoulder on the downwind edge of the front flange.
    const footing = item.id === world.futureCity.ruin.id
      ? right.clone().multiplyScalar(Math.sign(right.dot(wind)) * item.scale[0] * .42)
        .addScaledVector(front, item.scale[2] * .28)
      : null;
    return [{ contact, height, tail, length: span(wind), width: span(cross),
      downslope: MathUtils.clamp(-gradient * 1.2, -0.42, 0.42),
      shoulder: footing && { along: footing.dot(wind), across: footing.dot(cross) } }];
  });

  for (let i = 0; i < positions.length; i += 3) {
    for (const { contact, height, tail, length, width, downslope, shoulder } of deposits) {
      const x = positions[i] - contact.x, z = positions[i + 2] - contact.z;
      const along = x * wind.x + z * wind.z;
      if (along < -length - 70 || along > length + tail) continue;
      const across = x * cross.x + z * cross.z;
      if (shoulder) {
        const downstream = Math.max(0, along - length * .18) * MathUtils.smoothstep(along, length * .18, length * .43);
        const thinning = MathUtils.smoothstep(along, length * .42, length + tail);
        const spread = width * MathUtils.lerp(1.08, .61, thinning) + 28;
        const lateral = Math.abs(across - downstream * downslope);
        const wake = .82 * MathUtils.smoothstep(along, -length * .72, length * .38) * (1 - thinning)
          * (1 - MathUtils.smoothstep(lateral, spread * .14, spread));
        const shoulderDistance = Math.hypot((along - shoulder.along) / (length * .56 + 38),
          (across - shoulder.across) / (width * .48 + 38));
        const bank = .45 * (1 - MathUtils.smoothstep(shoulderDistance, .10, 1));
        positions[i + 1] += height * (wake + bank * (1 - wake));
        continue;
      }
      const downstream = Math.max(0, along - length * 0.38);
      const lateral = Math.abs(across - downstream * downslope);
      // The bank crosses the face near grade, then thins into a downwind tongue.
      const bank = MathUtils.smoothstep(along, -length - 70, -length * 0.42);
      const wake = 1 - MathUtils.smoothstep(along, length * 0.25, length + tail);
      const spread = width + 32 + downstream * 0.13;
      const falloff = 1 - MathUtils.smoothstep(lateral, spread * 0.18, spread);
      positions[i + 1] += height * bank * wake * falloff;
    }
  }
}
