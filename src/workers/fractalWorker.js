const lerp = (a, b, t) => a + (b - a) * t;

let palette = new Float32Array(0);
let paletteLength = 0;

self.onmessage = (event) => {
  const { data } = event;

  if (data.type === 'set-palette') {
    palette = data.colors ?? new Float32Array(0);
    paletteLength = palette.length / 3;
    return;
  }

  if (data.type !== 'render') {
    return;
  }

  if (!paletteLength || !data.width || !data.height) {
    self.postMessage({
      type: 'render-result',
      width: data.width,
      height: data.height,
      buffer: null,
    });
    return;
  }

  const {
    width,
    height,
    fractalType,
    fractalVariant = 'classic',
    juliaSeed,
    maxIterations,
    view,
  } = data;

  const buffer = new Uint8ClampedArray(width * height * 4);

  const scale = view.scale;
  const aspectRatio = view.aspectRatio;
  const scaledHeight = scale * aspectRatio;

  const minRe = view.centerX - scale / 2;
  const maxRe = view.centerX + scale / 2;
  const minIm = view.centerY - scaledHeight / 2;
  const maxIm = view.centerY + scaledHeight / 2;

  const reStep = (maxRe - minRe) / width;
  const imStep = (maxIm - minIm) / height;

  let rowIndex = 0;

  for (let y = 0; y < height; y += 1) {
    const imaginary = maxIm - y * imStep;

    for (let x = 0; x < width; x += 1) {
      const real = minRe + x * reStep;

      let zx;
      let zy;
      let cx;
      let cy;

      if (fractalType === 'mandelbrot') {
        zx = 0;
        zy = 0;
        cx = real;
        cy = imaginary;
      } else {
        zx = real;
        zy = imaginary;
        cx = juliaSeed?.x ?? 0;
        cy = juliaSeed?.y ?? 0;
      }

      let iteration = 0;
      let zx2 = zx * zx;
      let zy2 = zy * zy;

      while (zx2 + zy2 <= 4 && iteration < maxIterations) {
        if (fractalType === 'mandelbrot') {
          if (fractalVariant === 'burning-ship') {
            const absX = Math.abs(zx);
            const absY = Math.abs(zy);
            zy = 2 * absX * absY + cy;
            zx = absX * absX - absY * absY + cx;
          } else if (fractalVariant === 'cubic') {
            const zxTmp = zx;
            const zyTmp = zy;
            const zxSq = zxTmp * zxTmp;
            const zySq = zyTmp * zyTmp;
            const zxCubed = zxSq * zxTmp - 3 * zxTmp * zySq;
            const zyCubed = 3 * zxSq * zyTmp - zySq * zyTmp;
            zx = zxCubed + cx;
            zy = zyCubed + cy;
          } else if (fractalVariant === 'perpendicular') {
            zy = Math.abs(2 * zx * zy) + cy;
            zx = zx2 - zy2 + cx;
          } else {
            zy = 2 * zx * zy + cy;
            zx = zx2 - zy2 + cx;
          }
        } else {
          zy = 2 * zx * zy + cy;
          zx = zx2 - zy2 + cx;
        }
        zx2 = zx * zx;
        zy2 = zy * zy;
        iteration += 1;
      }

      let smoothIteration = iteration;
      if (iteration < maxIterations) {
        const logZn = Math.log(zx2 + zy2) / 2;
        const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
        smoothIteration = iteration + 1 - nu;
      }

      const wrapIndex = smoothIteration % paletteLength;
      const baseIndex = Math.floor(wrapIndex);
      const t = wrapIndex - baseIndex;
      const nextIndex = (baseIndex + 1) % paletteLength;

      const baseOffset = baseIndex * 3;
      const nextOffset = nextIndex * 3;

      const redChannel = lerp(palette[baseOffset], palette[nextOffset], t);
      const greenChannel = lerp(palette[baseOffset + 1], palette[nextOffset + 1], t);
      const blueChannel = lerp(palette[baseOffset + 2], palette[nextOffset + 2], t);

      buffer[rowIndex] = Math.round(redChannel);
      buffer[rowIndex + 1] = Math.round(greenChannel);
      buffer[rowIndex + 2] = Math.round(blueChannel);
      buffer[rowIndex + 3] = 255;

      rowIndex += 4;
    }
  }

  self.postMessage(
    {
      type: 'render-result',
      width,
      height,
      buffer,
    },
    [buffer.buffer],
  );
};

