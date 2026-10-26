"use strict";
/* ============================================================
   مولد QR Code — استاندارد QR، سطح تصحیح خطای M، نسخه‌های ۱ تا ۴
   پیاده‌سازی مستقل (بدون وابستگی به اینترنت) — خروجی روی Canvas
   ============================================================ */
const QRCodeGen = (function () {

  /* جدول نسخه‌ها برای سطح M: [تعداد بلاک، بایت داده هر بلاک، بایت تصحیح هر بلاک] */
  const M_BLOCKS = [null, [1, 16, 10], [1, 28, 16], [1, 44, 26], [2, 32, 18]];
  const ALIGN = [null, null, [6, 18], [6, 22], [6, 26]];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 2);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = new Array(divisor.length).fill(0);
    for (const b of data) {
      const factor = (b ^ result[0]) & 0xFF;
      for (let i = 1; i < divisor.length; i++) result[i - 1] = result[i];
      result[divisor.length - 1] = 0;
      for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
    }
    return result;
  }

  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let version = 0;
    for (let v = 1; v <= 4; v++) {
      if (bytes.length + 2 <= M_BLOCKS[v][1] * M_BLOCKS[v][0]) { version = v; break; }
    }
    if (!version) return null; // متن بیش از حد بلند

    const [numBlocks, dataPerBlock, eccPerBlock] = M_BLOCKS[version];
    const cap = numBlocks * dataPerBlock * 8;

    /* بیت‌استریم: حالت بایت + طول + داده + پایان‌گر + پرکننده */
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);               // حالت بایت
    push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    const pad = [0xEC, 0x11]; let pi = 0;
    while (bits.length < cap) { push(pad[pi % 2], 8); pi++; }

    const dataCW = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataCW.push(b);
    }

    /* بلاک‌بندی و کد تصحیح Reed–Solomon */
    const blocks = [], eccs = [];
    for (let b = 0; b < numBlocks; b++) blocks.push(dataCW.slice(b * dataPerBlock, (b + 1) * dataPerBlock));
    const divisor = rsDivisor(eccPerBlock);
    for (const bl of blocks) eccs.push(rsRemainder(bl, divisor));

    /* درهم‌آمیزی کدواژه‌ها */
    const final = [];
    for (let i = 0; i < dataPerBlock; i++) for (let b = 0; b < numBlocks; b++) final.push(blocks[b][i]);
    for (let i = 0; i < eccPerBlock; i++) for (let b = 0; b < numBlocks; b++) final.push(eccs[b][i]);

    return buildMatrix(version, final);
  }

  function buildMatrix(version, codewords) {
    const size = version * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (y, x, v) => { mod[y][x] = !!v; fn[y][x] = true; };

    /* الگوهای finder */
    for (const [cy, cx] of [[3, 3], [3, size - 4], [size - 4, 3]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const y = cy + dy, x = cx + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(y, x, d !== 2 && d !== 4);
      }
    }
    /* الگوهای timing */
    for (let i = 0; i < size; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    /* الگوهای alignment */
    const pos = ALIGN[version] || [6];
    for (let a = 0; a < pos.length; a++) for (let b = 0; b < pos.length; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === pos.length - 1) || (a === pos.length - 1 && b === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(pos[a] + dy, pos[b] + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    /* ماژول تیره همیشگی */
    set(size - 8, 8, true);

    /* کدواژه‌ها به‌صورت زیگزاگ با ماسک ۰ */
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && i < codewords.length * 8) {
            let bit = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
            if ((x + y) % 2 === 0) bit ^= 1; // ماسک ۰
            mod[y][x] = !!bit;
            i++;
          }
        }
      }
    }
    drawFormat(mod, size);
    return { size, modules: mod };
  }

  function drawFormat(mod, size) {
    const data = (0 << 3) | 0; // سطح M (۰۰) + ماسک ۰
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const get = i => (bits >>> i) & 1;
    const put = (y, x, v) => { mod[y][x] = !!v; };
    for (let i = 0; i <= 5; i++) put(8, i, get(i));
    put(8, 7, get(6));
    put(8, 8, get(7));
    put(7, 8, get(8));
    for (let i = 9; i < 15; i++) put(14 - i, 8, get(i));
    for (let i = 0; i < 8; i++) put(size - 1 - i, 8, get(i));
    for (let i = 8; i < 15; i++) put(8, size - 15 + i, get(i));
    put(size - 8, 8, true);
  }

  /* رسم روی canvas با حاشیه سکوت */
  function toCanvas(canvas, text, scale) {
    const qr = encode(text);
    if (!qr) return false;
    scale = scale || 8;
    const quiet = 4;
    const total = (qr.size + quiet * 2) * scale;
    canvas.width = total; canvas.height = total;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = "#1c1408";
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++)
        if (qr.modules[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    return true;
  }

  return { encode, toCanvas };
})();