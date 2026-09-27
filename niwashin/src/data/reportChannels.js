// 「窓口に伝える」の宛先データ。
//
// 【前提：街路樹に全国共通の窓口は無い】
// 当初は国土交通省の道路緊急ダイヤル #9910 を「全国どこでも使える窓口」として
// 置いていたが、実際にLINEを登録して確かめたところ、通報種別は
//   路面の穴ぼこ・段差／落下物（落石などの自然物以外）／動物の死骸／
//   ガードレール・標識等の損傷／路面の汚れ／落石・土砂流入等の災害
// で、街路樹の項目が無く、落下物は自然物を明示的に除外していた。
// 枯れ枝が落ちていても該当する種別が無い。
//
// 調べ直した結論として、街路樹の管理は道路管理者ごとで、住民の入口は
// 自治体ごとに分かれている。したがって宛先は次の順で決める。
//
//   1段目 MUNI_CHANNELS … 確認できた自治体の窓口。ここが本命
//   2段目 検索リンク      … 表に無い自治体。全国の既定の行き先
//   3段目 EMERGENCY      … #9910 の電話。倒木が道をふさぐなど緊急時のみ
//
// 表に無い自治体でも2段目が必ず働くので「行き先ゼロ」にはならない。

// 連番のコードを作る。政令指定都市は区ごとにコードが振られるため
// （横浜市＝14101〜14118）、1つの窓口を複数のコードに対応づける。
// 実在しない番号が混ざっても、逆ジオコーダーが返さないので害はない。
const range = (from, to) => {
  const out = [];
  for (let i = Number(from); i <= Number(to); i++) out.push(String(i).padStart(5, '0'));
  return out;
};

// 自治体の窓口。追加は1エントリの追記で済む。
//
// 載せるときの決まり:
//   ・その自治体自身の公式ページで案内されているものだけ
//   ・sourceUrl（根拠ページ）と verifiedOn（確認日）を必ず書く
//   ・確認できない深いリンク（LINEの友だち追加URL等）は使わず、公式の案内ページを指す
//   ・都道府県の窓口を市区町村のコードに紐づけない
//     （大阪府「まいど通報システム」や東京都建設局のMy City Reportは
//       府道・都道が対象で、市道・区道ではない。紐づけると誤った窓口に送ることになる）
const ENTRIES = [
  {
    codes: ['14205'], muniName: '藤沢市',
    label: '藤沢市LINE「市民レポート」',
    url: 'https://page.line.me/327adlaa',
    note: '街路樹・公園の樹木の不具合を受け付けています。',
    steps: [
      'メニューの「市民レポート」→「レポートを始める」',
      '案内にそって写真・位置情報を送る',
      '状況の欄に貼り付けて送信',
    ],
    sourceUrl: 'https://www.city.fujisawa.kanagawa.jp/dxs/linetsuho.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(14101, 14118), muniName: '横浜市',
    label: '横浜市 道路損傷通報システム（LINE）',
    url: 'https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/doro/kanri_senyo/kanri/line.html',
    note: '公式LINEから写真と位置情報で通報できます。',
    sourceUrl: 'https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/doro/kanri_senyo/kanri/line.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(23101, 23116), muniName: '名古屋市',
    label: '名古屋市公式LINE（道路・公園の損傷通報）',
    url: 'https://www.city.nagoya.jp/kurashi/douro/1014728/1014729/1027651.html',
    // 街路樹の項目が明示されている数少ない例。庭心の記録とそのまま噛み合う。
    note: '街路樹の項目があります（枯れ木・枯れ枝・かかり枝／根上り／病害虫／草の繁茂）。',
    sourceUrl: 'https://www.city.nagoya.jp/kurashi/douro/1014728/1014729/1027651.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(28101, 28111), muniName: '神戸市',
    label: '神戸市「道路公園110番」（LINE版）',
    url: 'https://www.city.kobe.lg.jp/z/kensetsukyoku/dorokoenn110.html',
    note: '道路・公園の破損や故障を受け付けています。',
    sourceUrl: 'https://www.city.kobe.lg.jp/z/kensetsukyoku/dorokoenn110.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(40131, 40137), muniName: '福岡市',
    label: '福岡市LINE（道路・河川・公園の不具合）',
    url: 'https://www.city.fukuoka.lg.jp/doro-gesuido/doroiji/hp/line-tsuho.html',
    note: '市が管理する道路・河川・公園の傷みを受け付けています。',
    sourceUrl: 'https://www.city.fukuoka.lg.jp/doro-gesuido/doroiji/hp/line-tsuho.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(40101, 40109), muniName: '北九州市',
    label: '北九州市公式LINE「道路・建物等損傷通報」',
    url: 'https://www.city.kitakyushu.lg.jp/contents/05300024.html',
    note: '市が管理する道路・公園・河川の損傷を受け付けています。',
    sourceUrl: 'https://www.city.kitakyushu.lg.jp/contents/05300024.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(27141, 27147), muniName: '堺市',
    label: '堺市LINE（道路・公園等の損傷）',
    url: 'https://www.city.sakai.lg.jp/kurashi/doro/doboku/kensethukyoku_line/douroline.html',
    sourceUrl: 'https://www.city.sakai.lg.jp/kurashi/doro/doboku/kensethukyoku_line/douroline.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(43101, 43105), muniName: '熊本市',
    label: '熊本市LINE（道路・河川・公園の損傷）',
    url: 'https://www.city.kumamoto.jp/kiji00328238/index.html',
    sourceUrl: 'https://www.city.kumamoto.jp/kiji00328238/index.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(12101, 12106), muniName: '千葉市',
    label: '千葉市「ちばレポ」（My City Report）',
    url: 'https://www.city.chiba.jp/sogoseisaku/shichokoshitsu/kohokocho/chibarepo.html',
    note: 'まちの課題を写真と位置情報で報告できる仕組みです。',
    sourceUrl: 'https://www.city.chiba.jp/sogoseisaku/shichokoshitsu/kohokocho/chibarepo.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: range(22101, 22103), muniName: '静岡市',
    label: '静岡市LINE（道路損傷の通報）',
    url: 'https://www.city.shizuoka.lg.jp/s9428/s001370.html',
    sourceUrl: 'https://www.city.shizuoka.lg.jp/s9428/s001370.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['13112'], muniName: '世田谷区',
    label: '世田谷区 My City Report',
    url: 'https://www.city.setagaya.lg.jp/02401/4617.html',
    sourceUrl: 'https://www.city.setagaya.lg.jp/02401/4617.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['13111'], muniName: '大田区',
    label: '大田区 道路損傷等通報アプリ「My City Report」',
    url: 'https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/douro_kouen_kasen/douro/mycityreport.html',
    sourceUrl: 'https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/douro_kouen_kasen/douro/mycityreport.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['12204'], muniName: '船橋市',
    label: '船橋市 道路損傷通報システム（LINE）',
    url: 'https://www.city.funabashi.lg.jp/machi/douro/003/p107860.html',
    sourceUrl: 'https://www.city.funabashi.lg.jp/machi/douro/003/p107860.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['12224'], muniName: '鎌ケ谷市',
    label: '鎌ケ谷市「MCR for citizens」',
    url: 'https://www.city.kamagaya.chiba.jp/kurashi-tetsuzuki/doro/dorokanri/MyCityReport.html',
    sourceUrl: 'https://www.city.kamagaya.chiba.jp/kurashi-tetsuzuki/doro/dorokanri/MyCityReport.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['46201'], muniName: '鹿児島市',
    label: '鹿児島市LINE（道路損傷の通報）',
    url: 'https://www.city.kagoshima.lg.jp/kensetu/douro/dourokanri/dkan-shido1/linetsuuhousystem.html',
    sourceUrl: 'https://www.city.kagoshima.lg.jp/kensetu/douro/dourokanri/dkan-shido1/linetsuuhousystem.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['27205'], muniName: '吹田市',
    label: '吹田市 不具合通報（LINE）',
    url: 'https://www.city.suita.osaka.jp/shisei/1018880/1018934/1004426.html',
    note: '街路樹を含む道路・公園の損傷を受け付けています。',
    sourceUrl: 'https://www.city.suita.osaka.jp/shisei/1018880/1018934/1004426.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['27214'], muniName: '富田林市',
    label: '富田林市LINE（道路・公園施設の破損）',
    url: 'https://www.city.tondabayashi.lg.jp/site/lineat/20541.html',
    sourceUrl: 'https://www.city.tondabayashi.lg.jp/site/lineat/20541.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['15202'], muniName: '長岡市',
    label: '長岡市LINE（道路・公園等の損傷）',
    url: 'https://www.city.nagaoka.niigata.jp/shisei/cate02/sns-line/report.html',
    sourceUrl: 'https://www.city.nagaoka.niigata.jp/shisei/cate02/sns-line/report.html',
    verifiedOn: '2026-09-27',
  },
  {
    codes: ['11219'], muniName: '上尾市',
    label: '上尾市LINE（道路の損傷）',
    url: 'https://www.city.ageo.lg.jp/page/363933.html',
    sourceUrl: 'https://www.city.ageo.lg.jp/page/363933.html',
    verifiedOn: '2026-09-27',
  },
];

// コード → 窓口 の対応表を組み立てる
export const MUNI_CHANNELS = (() => {
  const map = {};
  for (const e of ENTRIES) {
    const { codes, ...channel } = e;
    for (const c of codes) map[c] = channel;
  }
  return map;
})();

// 緊急時だけの窓口。国土交通省 道路緊急ダイヤル #9910。
// LINEは通報種別に樹木が無いので出さない。電話は、倒木や落ちた枝が道を
// ふさいでいる状況（落石・土砂流入等の災害に相当）で24時間つながる。
export const EMERGENCY_CHANNEL = {
  kind: 'phone',
  label: '道路緊急ダイヤル #9910',
  tel: '#9910',
  note: '国土交通省。24時間・通話無料で、その道路の管理者へ取り次がれます。',
  sourceUrl: 'https://www.mlit.go.jp/road/dia/',
  verifiedOn: '2026-09-27',
};

// 複数の自治体が参加している通報サービス。参考として名前を出すだけで、
// 自動では出さない。「都道府県が参加している＝その市も使える」とは限らないため。
export const MULTI_MUNI_SERVICES = [
  { label: 'My City Report（参加している自治体のみ）', url: 'https://www.mycityreport.jp/' },
];
