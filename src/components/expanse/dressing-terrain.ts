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
  const deposits = world.dressing.deposits.map(({ id, height, tail }) => {
    const item = monuments.find(monument => monument.id === id)!;
    const contact = ruinGroundContact(item, ground);
    const rotation = new Quaternion().fromArray(item.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(rotation);
    const front = new Vector3(0, 0, 1).applyQuaternion(rotation);
    const span = (axis: Vector3) =>
      (Math.abs(right.dot(axis)) * item.scale[0] + Math.abs(front.dot(axis)) * item.scale[2]) / 2;
    const gradient = (ground(contact.x + cross.x * 70, contact.z + cross.z * 70) -
      ground(contact.x - cross.x * 70, contact.z - cross.z * 70)) / 140;
    return { contact, height, tail, length: span(wind), width: span(cross),
      downslope: MathUtils.clamp(-gradient * 1.2, -0.42, 0.42) };
  });

  for (let i = 0; i < positions.length; i += 3) {
    for (const { contact, height, tail, length, width, downslope } of deposits) {
      const x = positions[i] - contact.x, z = positions[i + 2] - contact.z;
      const along = x * wind.x + z * wind.z;
      if (along < -length - 70 || along > length + tail) continue;
      const downstream = Math.max(0, along - length * 0.38);
      const lateral = Math.abs(x * cross.x + z * cross.z - downstream * downslope);
      // The bank crosses the face near grade, then thins into a downwind tongue.
      const bank = MathUtils.smoothstep(along, -length - 70, -length * 0.42);
      const wake = 1 - MathUtils.smoothstep(along, length * 0.25, length + tail);
      const spread = width + 32 + downstream * 0.13;
      const shoulder = 1 - MathUtils.smoothstep(lateral, spread * 0.18, spread);
      positions[i + 1] += height * bank * wake * shoulder;
    }
  }
}
