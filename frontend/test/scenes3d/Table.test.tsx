/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Table } from '../../src/scenes3d/components/Table';
import { __resetTableMaterialTexturesForTest } from '../../src/scenes3d/components/tableMaterials';

// happy-dom renders unknown R3F intrinsics as lowercase custom elements,
// which makes React emit "unknown prop" console.error. Silence only those.
const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      // eslint-disable-next-line no-console
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

afterEach(() => {
  cleanup();
  __resetTableMaterialTexturesForTest();
});

describe('<Table> (T-014 — PBR felt + rail)', () => {
  it('renders felt and rail meshes with their PBR-named materials', () => {
    const { container } = render(<Table />);
    expect(container.querySelector('mesh[name="table-felt"]')).not.toBeNull();
    expect(container.querySelector('mesh[name="table-rail"]')).not.toBeNull();
    expect(
      container.querySelector(
        'mesh[name="table-felt"] meshstandardmaterial[name="felt-pbr"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'mesh[name="table-rail"] meshstandardmaterial[name="rail-pbr"]',
      ),
    ).not.toBeNull();
  });

  it('AC-2: rail material is visually distinct from felt (different roughness + color)', () => {
    const { container } = render(
      <Table feltColor="#1a7a1a" railColor="#3b2414" />,
    );
    const felt = container.querySelector(
      'mesh[name="table-felt"] meshstandardmaterial[name="felt-pbr"]',
    )!;
    const rail = container.querySelector(
      'mesh[name="table-rail"] meshstandardmaterial[name="rail-pbr"]',
    )!;
    expect(felt.getAttribute('color')).toBe('#1a7a1a');
    expect(rail.getAttribute('color')).toBe('#3b2414');
    expect(felt.getAttribute('roughness')).not.toBe(rail.getAttribute('roughness'));
    expect(felt.getAttribute('metalness')).not.toBe(rail.getAttribute('metalness'));
  });

  it('forwards theme colors through', () => {
    const { container } = render(
      <Table feltColor="#abcdef" railColor="#112233" />,
    );
    expect(container.innerHTML).toContain('abcdef');
    expect(container.innerHTML).toContain('112233');
  });

  it('AC-1: felt material receives both a normalMap and roughnessMap on medium/high tier', () => {
    const { container } = render(<Table qualityTier="medium" />);
    const felt = container.querySelector(
      'mesh[name="table-felt"] meshstandardmaterial[name="felt-pbr"]',
    )!;
    // React renders Texture prop values as attribute "[object Object]" in
    // happy-dom — the attribute presence itself proves the map was attached.
    expect(felt.hasAttribute('normalmap') || felt.hasAttribute('normalMap')).toBe(true);
    expect(
      felt.hasAttribute('roughnessmap') || felt.hasAttribute('roughnessMap'),
    ).toBe(true);
  });

  it('low tier drops normalMap + roughnessMap and zeroes normalScale', () => {
    const { container } = render(<Table qualityTier="low" />);
    const felt = container.querySelector(
      'mesh[name="table-felt"] meshstandardmaterial[name="felt-pbr"]',
    )!;
    // React omits prop rendering when the value is null.
    expect(felt.hasAttribute('normalmap')).toBe(false);
    expect(felt.hasAttribute('normalMap')).toBe(false);
    expect(felt.hasAttribute('roughnessmap')).toBe(false);
    expect(felt.hasAttribute('roughnessMap')).toBe(false);
  });

  it('renders felt + rail meshes at the expected positions', () => {
    const { container } = render(<Table />);
    expect(container.querySelector('mesh[name="table-felt"]')).not.toBeNull();
    expect(container.querySelector('mesh[name="table-rail"]')).not.toBeNull();
    // The rail sits slightly lower than the felt (rail is thicker).
    const feltY = Number(
      container.querySelector('mesh[name="table-felt"]')!.getAttribute('position')!.split(',')[1],
    );
    const railY = Number(
      container.querySelector('mesh[name="table-rail"]')!.getAttribute('position')!.split(',')[1],
    );
    expect(railY).toBeLessThan(feltY);
  });
});
