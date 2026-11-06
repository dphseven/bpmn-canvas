import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageExporter } from '../src/ImageExporter.js';

describe('ImageExporter', () => {
  let mockCanvas;
  let nodes;
  let edges;
  let exporter;

  function createMockNode({ id, type = 'task', x = 100, y = 100, width = 120, height = 80, isExpanded = false }) {
    const domElement = document.createElement('div');
    domElement.className = `bpmn-node bpmn-node-${type}`;
    if (isExpanded) domElement.classList.add('expanded');
    domElement.style.left = `${x}px`;
    domElement.style.top = `${y}px`;
    domElement.style.width = `${width}px`;
    domElement.style.height = `${height}px`;

    // Port to verify stripping
    const port = document.createElement('div');
    port.className = 'bpmn-port';
    domElement.appendChild(port);

    return {
      id,
      type,
      x,
      y,
      width,
      height,
      isExpanded,
      domElement
    };
  }

  function createMockEdge({ id, waypoints = [{ x: 150, y: 150 }, { x: 300, y: 150 }] }) {
    const groupElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    groupElement.classList.add('bpmn-edge');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('bpmn-edge-path');
    groupElement.appendChild(path);

    const handlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handlesGroup.classList.add('bpmn-edge-handles-group');
    groupElement.appendChild(handlesGroup);

    return {
      id,
      waypoints,
      groupElement
    };
  }

  beforeEach(() => {
    nodes = new Map();
    edges = new Map();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<marker id="arrowhead"></marker>';
    svg.appendChild(defs);

    const container = document.createElement('div');
    container.setAttribute('data-bpmn-theme', 'dark');

    mockCanvas = {
      nodes,
      edges,
      svg,
      container,
      currentThemeClass: null
    };

    exporter = new ImageExporter(mockCanvas);
  });

  describe('getDiagramBounds', () => {
    it('returns default bounds when canvas has no nodes', () => {
      const bounds = exporter.getDiagramBounds(30);
      expect(bounds.width).toBe(660);
      expect(bounds.height).toBe(460);
      expect(bounds.offsetX).toBe(30);
      expect(bounds.offsetY).toBe(30);
    });

    it('accurately calculates bounding box enclosing all nodes and padding', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 50, y: 80, width: 100, height: 60 }));
      nodes.set('n2', createMockNode({ id: 'n2', x: 250, y: 120, width: 120, height: 80 }));

      const bounds = exporter.getDiagramBounds(40);
      // minX = 50, maxX = 250 + 120 = 370 => span = 320 + 80 = 400
      // minY = 80, maxY = 120 + 80 = 200 => span = 120 + 80 = 200
      expect(bounds.minX).toBe(50);
      expect(bounds.maxX).toBe(370);
      expect(bounds.minY).toBe(80);
      expect(bounds.maxY).toBe(200);
      expect(bounds.width).toBe(400);
      expect(bounds.height).toBe(200);
      expect(bounds.offsetX).toBe(-10); // -50 + 40
      expect(bounds.offsetY).toBe(-40); // -80 + 40
    });

    it('expands bounding box if edge waypoints extend beyond node boundaries', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 100, y: 100, width: 100, height: 50 }));
      edges.set('e1', createMockEdge({
        id: 'e1',
        waypoints: [{ x: 100, y: 100 }, { x: 500, y: 400 }]
      }));

      const bounds = exporter.getDiagramBounds(20);
      expect(bounds.maxX).toBe(500);
      expect(bounds.maxY).toBe(400);
      expect(bounds.width).toBe((500 - 100) + 40);
      expect(bounds.height).toBe((400 - 100) + 40);
    });

    it('accounts for floating labels attached to events or gateways', () => {
      const node = createMockNode({ id: 'n1', type: 'event', x: 100, y: 100, width: 50, height: 50 });
      const label = document.createElement('div');
      label.className = 'bpmn-event-floating-label';
      Object.defineProperty(label, 'offsetTop', { value: 60 });
      Object.defineProperty(label, 'offsetHeight', { value: 25 });
      node.domElement.appendChild(label);
      nodes.set('n1', node);

      const bounds = exporter.getDiagramBounds(10);
      // node.y (100) + offsetTop (60) + offsetHeight (25) = 185
      expect(bounds.maxY).toBe(185);
      expect(bounds.height).toBe((185 - 100) + 20);
    });

    it('falls back to default dimensions when node coordinates are non-finite', () => {
      nodes.set('invalid', { id: 'invalid', type: 'task', x: NaN, y: Infinity, width: NaN, height: NaN });
      const bounds = exporter.getDiagramBounds(20);
      expect(bounds.width).toBe(640);
      expect(bounds.height).toBe(440);
    });
  });

  describe('Theme resolution', () => {
    it('detects theme class or data attribute correctly', () => {
      expect(exporter.getTheme()).toBe('theme-dark');

      mockCanvas.currentThemeClass = 'theme-light';
      expect(exporter.getTheme()).toBe('theme-light');

      mockCanvas.currentThemeClass = null;
      mockCanvas.container.setAttribute('data-bpmn-theme', 'ocean');
      expect(exporter.getTheme()).toBe('theme-ocean');

      // Test body class fallback
      mockCanvas.container = null;
      document.body.classList.add('theme-light');
      expect(exporter.getTheme()).toBe('theme-light');
      document.body.classList.remove('theme-light');

      document.body.classList.add('theme-ocean');
      expect(exporter.getTheme()).toBe('theme-ocean');
      document.body.classList.remove('theme-ocean');

      expect(exporter.getTheme()).toBe('theme-dark');
    });

    it('maps theme identifier to solid background hex', () => {
      expect(exporter.getThemeBgColor('theme-light')).toBe('#f8fafc');
      expect(exporter.getThemeBgColor('theme-ocean')).toBe('#0c1a2e');
      expect(exporter.getThemeBgColor('theme-dark')).toBe('#0f172a');
    });
  });

  describe('buildSvg', () => {
    it('generates a root SVG element with valid dimensions and defs', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 0, y: 0, width: 100, height: 100 }));
      const { svgElement, bounds } = exporter.buildSvg({ padding: 20 });

      expect(svgElement.tagName.toLowerCase()).toBe('svg');
      expect(svgElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
      expect(svgElement.getAttribute('width')).toBe(String(bounds.width));
      expect(svgElement.getAttribute('height')).toBe(String(bounds.height));

      const defs = svgElement.querySelector('defs');
      expect(defs).not.toBeNull();
      expect(defs.querySelector('#arrowhead')).not.toBeNull();
    });

    it('renders solid background rect by default and omits when transparent', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 0, y: 0, width: 100, height: 100 }));

      const { svgElement: themedSvg } = exporter.buildSvg({ background: 'theme' });
      const bgRect = themedSvg.querySelector('rect');
      expect(bgRect).not.toBeNull();
      expect(bgRect.getAttribute('fill')).toBe('#0f172a');

      const { svgElement: transSvg } = exporter.buildSvg({ background: 'transparent' });
      expect(transSvg.querySelector('rect')).toBeNull();

      const { svgElement: customSvg } = exporter.buildSvg({ background: '#ef4444' });
      expect(customSvg.querySelector('rect')?.getAttribute('fill')).toBe('#ef4444');
    });

    it('gracefully skips nodes without domElement in buildSvg', () => {
      nodes.set('bare', { id: 'bare', type: 'task', x: 10, y: 10, width: 100, height: 60 });
      const { svgElement } = exporter.buildSvg();
      expect(svgElement).toBeDefined();
    });

    it('strips interactive ports and handles in exported DOM elements', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 0, y: 0, width: 100, height: 100 }));
      edges.set('e1', createMockEdge({ id: 'e1' }));

      const { svgElement } = exporter.buildSvg();
      expect(svgElement.querySelector('.bpmn-port')).toBeNull();
      expect(svgElement.querySelector('.bpmn-edge-handles-group')).toBeNull();
    });

    it('layers expanded subprocesses below edges and foreground nodes above edges', () => {
      nodes.set('sub1', createMockNode({
        id: 'sub1',
        type: 'subprocess',
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        isExpanded: true
      }));
      nodes.set('task1', createMockNode({
        id: 'task1',
        type: 'task',
        x: 50,
        y: 50,
        width: 100,
        height: 60
      }));
      edges.set('e1', createMockEdge({ id: 'e1' }));

      const { svgElement } = exporter.buildSvg();
      const subObj = svgElement.querySelector('.bpmn-node-subprocess');
      const edgesGroup = svgElement.querySelector('.bpmn-export-edges');
      const taskObj = svgElement.querySelector('.bpmn-node-task');

      const subLayer = subObj.parentElement.parentElement;
      const taskLayer = taskObj.parentElement.parentElement;
      const childNodes = Array.from(svgElement.childNodes);
      const subIndex = childNodes.indexOf(subLayer);
      const edgesIndex = childNodes.indexOf(edgesGroup);
      const taskIndex = childNodes.indexOf(taskLayer);

      expect(subIndex).toBeGreaterThanOrEqual(0);
      expect(edgesIndex).toBeGreaterThan(subIndex);
      expect(taskIndex).toBeGreaterThan(edgesIndex);
    });
  });

  describe('toSvgString and exportSvg', () => {
    it('serializes SVG element into valid XML string', () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 10, y: 10, width: 80, height: 80 }));
      const xml = exporter.toSvgString();

      expect(typeof xml).toBe('string');
      expect(xml).toContain('<svg');
      expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(xml).toContain('bpmn-export-edges');
    });

    it('creates an SVG Blob with correct mime type', async () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 10, y: 10, width: 80, height: 80 }));
      const downloadSpy = vi.spyOn(exporter, 'downloadBlob').mockImplementation(() => {});

      const blob = await exporter.exportSvg({ download: true, fileName: 'test.svg' });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/svg+xml;charset=utf-8');
      expect(downloadSpy).toHaveBeenCalledWith(blob, 'test.svg');
    });

    it('strips interactive :hover, :active, and :focus rules from exported SVG styles', () => {
      const style = document.createElement('style');
      style.textContent = `
        .test-btn:hover { transform: translateY(-2px); }
        .test-btn:active { transform: translateY(0); }
        .static-card { color: red; }
      `;
      document.head.appendChild(style);

      try {
        const svgString = exporter.toSvgString();
        expect(svgString).not.toContain(':hover');
        expect(svgString).not.toContain(':active');
        expect(svgString).toContain('pointer-events: none !important');
      } finally {
        document.head.removeChild(style);
      }
    });

    it('applies sans-serif font family to edge labels in exported SVG', () => {
      const edge = createMockEdge({ id: 'e1' });
      edges.set('e1', edge);
      const xml = exporter.toSvgString();
      expect(xml).toContain('.bpmn-edge-label-text');
      expect(xml).toContain("'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif");
    });

    it('exports PNG blob and triggers download', async () => {
      const mockCanvasEl = document.createElement('canvas');
      mockCanvasEl.toBlob = vi.fn(function(cb, mime) {
        cb(new Blob(['png-bytes'], { type: mime }));
      });
      vi.spyOn(exporter, 'toCanvas').mockResolvedValue(mockCanvasEl);
      const downloadSpy = vi.spyOn(exporter, 'downloadBlob').mockImplementation(() => {});

      const blob = await exporter.exportPng({ fileName: 'my-flow.png' });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(downloadSpy).toHaveBeenCalledWith(blob, 'my-flow.png');
    });

    it('exports JPEG blob with theme background and triggers download', async () => {
      const mockCanvasEl = document.createElement('canvas');
      mockCanvasEl.toBlob = vi.fn(function(cb, mime) {
        cb(new Blob(['jpeg-bytes'], { type: mime }));
      });
      const toCanvasSpy = vi.spyOn(exporter, 'toCanvas').mockResolvedValue(mockCanvasEl);
      const downloadSpy = vi.spyOn(exporter, 'downloadBlob').mockImplementation(() => {});

      const blob = await exporter.exportJpeg({ fileName: 'my-flow.jpg', quality: 0.9 });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
      expect(toCanvasSpy).toHaveBeenCalledWith(expect.objectContaining({ background: '#0f172a' }));
      expect(downloadSpy).toHaveBeenCalledWith(blob, 'my-flow.jpg');
    });

    it('rejects exportPng when canvas.toBlob returns null', async () => {
      const mockCanvasEl = document.createElement('canvas');
      mockCanvasEl.toBlob = vi.fn(function(cb) {
        cb(null);
      });
      vi.spyOn(exporter, 'toCanvas').mockResolvedValue(mockCanvasEl);

      await expect(exporter.exportPng({ download: false })).rejects.toThrow('Failed to generate PNG blob');
    });

    it('rejects exportJpeg when canvas.toBlob returns null', async () => {
      const mockCanvasEl = document.createElement('canvas');
      mockCanvasEl.toBlob = vi.fn(function(cb) {
        cb(null);
      });
      vi.spyOn(exporter, 'toCanvas').mockResolvedValue(mockCanvasEl);

      await expect(exporter.exportJpeg({ download: false })).rejects.toThrow('Failed to generate JPEG blob');
    });
  });

  describe('toCanvas rasterization', () => {
    it('creates canvas and loads image from Base64 data URI', async () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 0, y: 0, width: 100, height: 100 }));

      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        scale: vi.fn(),
        drawImage: vi.fn()
      });

      const origImage = global.Image;
      class MockImage {
        constructor() {
          this._src = '';
          this.onload = null;
          this.onerror = null;
        }
        set src(val) {
          this._src = val;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
        get src() {
          return this._src;
        }
      }
      global.Image = MockImage;

      try {
        const canvas = await exporter.toCanvas({ scale: 2 });
        expect(canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(canvas.width).toBeGreaterThan(0);
        expect(canvas.height).toBeGreaterThan(0);
      } finally {
        global.Image = origImage;
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }
    });

    it('rejects when image loading fails', async () => {
      nodes.set('n1', createMockNode({ id: 'n1', x: 0, y: 0, width: 100, height: 100 }));

      const origImage = global.Image;
      class FailingImage {
        set src(val) {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Network error'));
          }, 0);
        }
      }
      global.Image = FailingImage;

      try {
        await expect(exporter.toCanvas()).rejects.toThrow('Failed to load SVG for rasterization');
      } finally {
        global.Image = origImage;
      }
    });
  });

  describe('downloadBlob', () => {
    it('creates an anchor element, triggers click, and removes it', () => {
      const blob = new Blob(['hello'], { type: 'text/plain' });
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      exporter.downloadBlob(blob, 'download-test.txt');

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Canvas integration', () => {
    it('triggers exportImage from canvas and emits event', async () => {
      const emitSpy = vi.fn();
      mockCanvas.emit = emitSpy;

      // Mock imageExporter methods on mockCanvas
      const exportSvgSpy = vi.fn().mockResolvedValue(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }));
      exporter.exportSvg = exportSvgSpy;
      mockCanvas.imageExporter = exporter;
      mockCanvas.exportImage = async function(format, options) {
        let blob;
        if (format === 'svg') blob = await this.imageExporter.exportSvg(options);
        this.emit('canvas:export', { format, size: blob?.size });
        return blob;
      };

      const result = await mockCanvas.exportImage('svg', { download: false });
      expect(result).toBeInstanceOf(Blob);
      expect(emitSpy).toHaveBeenCalledWith('canvas:export', expect.objectContaining({ format: 'svg' }));
    });
  });
});
