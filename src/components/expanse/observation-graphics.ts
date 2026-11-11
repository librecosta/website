import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { observationRecords, type ObservationId } from './narrative';

export const signalPanel = {
  width: 340,
  height: 142,
} as const;

const chinese = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const digits = '"Oxanium", monospace';

function makeTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d')!;
  context.scale(2, 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { context, texture };
}

function stroke(context: CanvasRenderingContext2D, color: string, width: number, points: number[]) {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function paintPanel(context: CanvasRenderingContext2D, id: ObservationId) {
  const { width, height } = signalPanel;
  const record = observationRecords[id];
  context.clearRect(0, 0, width, height);

  const glass = context.createLinearGradient(10, 4, width - 10, height);
  glass.addColorStop(0, 'rgba(232, 237, 236, .40)');
  glass.addColorStop(.44, 'rgba(212, 218, 217, .29)');
  glass.addColorStop(1, 'rgba(161, 169, 169, .20)');
  context.beginPath();
  context.roundRect(3, 3, width - 6, height - 6, 13);
  context.fillStyle = glass;
  context.fill();
  context.lineWidth = 1.15;
  context.strokeStyle = 'rgba(251, 253, 252, .60)';
  context.stroke();
  context.beginPath();
  context.roundRect(6, 6, width - 12, height - 12, 10);
  context.strokeStyle = 'rgba(35, 47, 47, .24)';
  context.stroke();

  stroke(context, '#26333293', 2, [8, 30, 8, 16, 17, 7, 44, 7]);
  stroke(context, '#fbfffcdf', 1, [10, 25, 10, 17, 18, 9, 36, 9]);
  stroke(context, '#29343281', 2, [width - 8, height - 30, width - 8, height - 16,
    width - 17, height - 7, width - 44, height - 7]);
  stroke(context, '#f7fcf9c2', 1, [width - 10, height - 24, width - 10, height - 17,
    width - 18, height - 9, width - 36, height - 9]);
  stroke(context, '#ffffff9c', 1, [20, 48, width - 20, 48]);
  stroke(context, '#2c3a3554', .75, [20, 49.5, width - 20, 49.5]);

  context.textBaseline = 'middle';
  context.fillStyle = '#32413d';
  context.font = `600 14px ${digits}`;
  context.fillText(record.id, 21, 28);
  context.fillStyle = '#182321';
  context.font = `600 18px ${chinese}`;
  context.fillText(record.name, 63, 27.5);
  context.font = `500 18px ${chinese}`;
  context.shadowColor = '#f1f2f0aa';
  context.shadowBlur = 2;
  let baseline = 69;
  for (const paragraph of record.lines) {
    let line = '';
    for (const character of paragraph) {
      if (line && context.measureText(line + character).width > width - 44) {
        context.fillText(line, 21, baseline);
        baseline += 22;
        line = '';
      }
      line += character;
    }
    context.fillText(line, 21, baseline);
    baseline += 22;
  }
  context.shadowBlur = 0;
}

export function createObservationGraphics() {
  const sheet = makeTexture(signalPanel.width, signalPanel.height);
  const material = new MeshBasicMaterial({ map: sheet.texture, transparent: true, depthWrite: false,
    toneMapped: false, fog: false });
  const geometry = new PlaneGeometry(1, 1);
  const panel = new Mesh(geometry, material);
  panel.visible = false;
  return {
    panel,
    paint(id: ObservationId) { paintPanel(sheet.context, id); sheet.texture.needsUpdate = true; },
    dispose() { geometry.dispose(); material.dispose(); sheet.texture.dispose(); },
  };
}
