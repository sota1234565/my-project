// アイコンの画像を書き出す。形の定義は icon.mjs にある。
//
// 【使い方】
// sharp は書き出しのときにしか要らないので、アプリの依存には入れていない。
// 作業用のディレクトリに入れて、そこを見に行かせる形で実行する。
//
//   mkdir -p /tmp/iconbuild && cd /tmp/iconbuild
//   npm init -y && npm i sharp
//   cd <リポジトリ>/niwashin
//   NODE_PATH=/tmp/iconbuild/node_modules node tools/make-icons.mjs
//
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { iconSvg } from './icon.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const OUT = new URL('../public/', import.meta.url);
const png = (name, svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(new URL(name, OUT).pathname);

// タブ用。SVGのまま置く（拡大しても崩れない）
writeFileSync(new URL('favicon.svg', OUT), iconSvg({ size: 64 }) + '\n');

await Promise.all([
  png('icon-192.png', iconSvg({ size: 512 }), 192),
  png('icon-512.png', iconSvg({ size: 512 }), 512),

  // Android は中央の円（直径80%）の外を切り落とし、角丸も自前で付ける。
  // こちらで丸めると二重になるので丸めず、形は小さめにして切られても欠けないようにする。
  png('icon-512-maskable.png', iconSvg({ size: 512, scale: 0.46, rounded: false }), 512),

  // iOS は角丸を自前で付けるので、こちらでは丸めず全面に地を敷く。
  png('apple-touch-icon.png', iconSvg({ size: 512, rounded: false }), 180),
]);

console.log('書き出しました:', ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png'].join(', '));
