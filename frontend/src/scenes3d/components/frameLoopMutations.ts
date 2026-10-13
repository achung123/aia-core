export interface RotationTarget {
  rotation?:
    | {
        x?: number;
        y?: number;
        z?: number;
        set?: (x: number, y: number, z: number) => void;
      }
    | [number, number, number];
  setAttribute?: (qualifiedName: string, value: string) => void;
  userData?: Record<string, unknown>;
}

export interface OpacityTarget {
  opacity?: number;
  setAttribute?: (qualifiedName: string, value: string) => void;
}

export interface TextContentTarget {
  text?: string;
  sync?: () => void;
  setAttribute?: (qualifiedName: string, value: string) => void;
}

export function setYRotation(target: RotationTarget | null, rotationY: number) {
  if (!target) return;

  const rotation = target.rotation;
  if (rotation && typeof rotation === 'object') {
    if ('set' in rotation && typeof rotation.set === 'function') {
      rotation.set(0, rotationY, 0);
    } else {
      if ('x' in rotation) rotation.x = 0;
      if ('y' in rotation) rotation.y = rotationY;
      if ('z' in rotation) rotation.z = 0;
    }
  } else {
    target.rotation = [0, rotationY, 0];
  }

  target.setAttribute?.('rotation', `0,${rotationY},0`);
}

export function setOpacity(target: OpacityTarget | null, opacity: number) {
  if (!target) return;
  target.opacity = opacity;
  target.setAttribute?.('opacity', String(opacity));
}

export function setTextContent(target: TextContentTarget | null, text: string) {
  if (!target) return;
  target.text = text;
  target.setAttribute?.('data-text', text);
  target.sync?.();
}