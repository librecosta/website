import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { createTransformInspector, type TransformInspector } from '@/tools/transform-inspector/editor';
import { mountTransformInspector } from '@/tools/transform-inspector/panel';
import { mapJourneyProgress } from './journey-timing';
import { observationIds, observationRecords, type ObservationId } from './narrative';
import type { BoardPreviews, ObservationAnchors } from './ObservationProjection';
import { EXPANSE, type JourneySignal } from './parameters';

export type ExpanseEditorMount = {
  host: RefObject<HTMLDivElement | null>;
  open: boolean;
  close: () => void;
};

export default function ExpanseTransformEditor({ mount, stage, signal, reduced, previews, anchors, dragging }: {
  mount: ExpanseEditorMount;
  stage: RefObject<HTMLElement | null>;
  signal: RefObject<JourneySignal>;
  reduced: boolean;
  previews: RefObject<BoardPreviews>;
  anchors: ObservationAnchors;
  dragging: RefObject<boolean>;
}) {
  const { scene, camera, invalidate } = useThree();
  const { host, open, close } = mount;
  const reducedRef = useRef(reduced);
  const editorRef = useRef<TransformInspector | null>(null);
  useLayoutEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  useLayoutEffect(() => {
    const viewport = stage.current, node = host.current;
    if (!viewport || !node) return;
    const editor = createTransformInspector({
      scene, camera, viewport, invalidate,
      allowPointer: event => !(event.target instanceof Element &&
        event.target.closest('aside, a, button, input, select, summary, [data-transform-inspector]')),
      onDragChange: active => { dragging.current = active; },
      getContext: () => {
        const { width, height } = viewport.getBoundingClientRect();
        const { value, raw } = signal.current;
        return {
          scene: 'expanse',
          camera: {
            position: camera.getWorldPosition(new Vector3()).toArray(),
            quaternion: camera.getWorldQuaternion(new Quaternion()).toArray(),
            verticalFovDegrees: camera instanceof PerspectiveCamera ? camera.fov : undefined,
          },
          viewport: { width, height },
          chapter: { raw, smoothed: value,
            journey: reducedRef.current ? EXPANSE.journey.reducedProgress : mapJourneyProgress(value, EXPANSE.journey.timing) },
        };
      },
      targets: observationIds.map(id => {
        const pose = EXPANSE.observationBoards[id];
        const relative = 'relative' in pose;
        return {
          id, label: observationRecords[id].name,
          frameId: relative ? id + '-anchor' : 'scene-root',
          get parent() { return relative ? anchors[id] ?? undefined : undefined; },
          read: () => ({ position: [...pose.position], quaternion: [...pose.quaternion], scale: [...pose.scale] }),
          preview: draft => {
            if (draft) previews.current.drafts[id] = draft;
            else delete previews.current.drafts[id];
          },
        };
      }),
    });
    editorRef.current = editor;
    const unsubscribe = editor.subscribe(() => {
      const id = editor.getState().id as ObservationId | '';
      previews.current.selected = !node.hidden && id ? id : undefined;
    });
    const unmount = mountTransformInspector(node, editor, close, viewport);
    editor.select(observationIds[0]);
    return () => {
      unmount();
      unsubscribe();
      editor.dispose();
      editorRef.current = null;
      previews.current.selected = undefined;
    };
  }, [camera, scene, stage, signal, previews, anchors, invalidate, host, dragging, close]);
  useLayoutEffect(() => {
    editorRef.current?.setEnabled(open);
  }, [open]);
  return null;
}
