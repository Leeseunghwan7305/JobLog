// 외부 의존성 없이(순수 Node) 익스텐션 아이콘 PNG를 생성한다.
// 브랜드 블루(#3182f6) 라운드 사각형 + 흰 "J". 16/48/128px.
// 실행: node apps/extension/scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function toPng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 안티앨리어싱: 픽셀을 4x4 서브샘플해 커버리지로 알파/혼합 계산
function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const BLUE = [0x31, 0x82, 0xf6];
  const WHITE = [0xff, 0xff, 0xff];
  const r = 0.22; // 라운드 반경(상대)
  const inRounded = (u, v) => {
    const cu = Math.min(Math.max(u, r), 1 - r);
    const cv = Math.min(Math.max(v, r), 1 - r);
    const dx = u - cu;
    const dy = v - cv;
    return dx * dx + dy * dy <= r * r;
  };
  const isJ = (u, v) => {
    const stem = u >= 0.54 && u <= 0.66 && v >= 0.24 && v <= 0.62;
    const cx = 0.44;
    const cy = 0.6;
    const d = Math.hypot(u - cx, v - cy);
    const hook = v >= cy && d >= 0.1 && d <= 0.22;
    return stem || hook;
  };
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (!inRounded(u, v)) continue;
          bg++;
          if (isJ(u, v)) fg++;
        }
      }
      const tot = SS * SS;
      const alpha = Math.round((bg / tot) * 255);
      const fgRatio = bg ? fg / bg : 0;
      const col = [
        Math.round(BLUE[0] + (WHITE[0] - BLUE[0]) * fgRatio),
        Math.round(BLUE[1] + (WHITE[1] - BLUE[1]) * fgRatio),
        Math.round(BLUE[2] + (WHITE[2] - BLUE[2]) * fgRatio),
      ];
      const i = (y * size + x) * 4;
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = alpha;
    }
  }
  return toPng(size, buf);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), render(size));
  console.log(`icon${size}.png`);
}
