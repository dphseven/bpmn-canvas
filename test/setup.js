// Polyfill SVG layout methods for jsdom
if (typeof SVGElement !== 'undefined') {
  if (!SVGElement.prototype.getBBox) {
    SVGElement.prototype.getBBox = function () {
      const width = parseFloat(this.getAttribute('width')) || 100;
      const height = parseFloat(this.getAttribute('height')) || 80;
      const x = parseFloat(this.getAttribute('x')) || 0;
      const y = parseFloat(this.getAttribute('y')) || 0;
      return { x, y, width, height };
    };
  }

  if (!SVGElement.prototype.getBoundingClientRect) {
    SVGElement.prototype.getBoundingClientRect = function () {
      const bbox = this.getBBox();
      return {
        top: bbox.y,
        left: bbox.x,
        bottom: bbox.y + bbox.height,
        right: bbox.x + bbox.width,
        width: bbox.width,
        height: bbox.height,
        x: bbox.x,
        y: bbox.y,
        toJSON: () => ({}),
      };
    };
  }

  if (!SVGElement.prototype.getScreenCTM) {
    SVGElement.prototype.getScreenCTM = function () {
      return {
        a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
        inverse: function () {
          return this;
        },
      };
    };
  }

  if (!SVGElement.prototype.createSVGPoint) {
    // SVGSVGElement point creation
    const pointPrototype = {
      x: 0,
      y: 0,
      matrixTransform: function (matrix) {
        return {
          x: this.x * matrix.a + this.y * matrix.c + matrix.e,
          y: this.x * matrix.b + this.y * matrix.d + matrix.f,
        };
      },
    };
    SVGElement.prototype.createSVGPoint = function () {
      return Object.create(pointPrototype);
    };
  }
}
