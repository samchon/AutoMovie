/* eslint-disable */
// Encode a numbered sequence of PNG frames into an animated GIF.
// Usage: node frames-to-gif.cjs <framesDir> <prefix> <count> <outGif> [fps]
// Reads <framesDir>/<prefix>NN.png (NN = 0..count-1, zero-padded to 2).
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

const [, , dir, prefix, countStr, out, fpsStr] = process.argv;
const count = Number(countStr);
const fps = Number(fpsStr || "16");
const delay = Math.round(1000 / fps);

const gif = GIFEncoder();
for (let i = 0; i < count; i++) {
  const file = path.join(dir, `${prefix}${String(i).padStart(2, "0")}.png`);
  const { data, width, height } = PNG.sync.read(fs.readFileSync(file));
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  gif.writeFrame(index, width, height, { palette, delay });
}
gif.finish();
fs.writeFileSync(out, Buffer.from(gif.bytes()));
console.log(`wrote ${out} (${count} frames @ ${fps}fps)`);
