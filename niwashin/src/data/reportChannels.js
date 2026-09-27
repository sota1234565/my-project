// 「市に伝える」の窓口データ。
//
// 【考え方】
// 日本には約1,700の市区町村があり、通報の窓口はLINE・専用フォーム・電話とバラバラで、
// URLも変わる。全部を調べて持ち続けるのは個人には不可能で、古い情報を「ここが窓口です」と
// 出すほうが害になる。そこで3段構えにしている。
//
//   1段目 MUNI_CHANNELS   … 実際に確認できた自治体の窓口。確認できたものだけ載せる
//   2段目 NATIONWIDE      … 国土交通省の道路緊急ダイヤル。全国の道路が対象で、
//                            国が該当する道路管理者へ取り次ぐ。振り分けは国の仕組みに任せる
//   3段目 検索リンク       … 1段目に無い自治体や、道路以外（公園の木など）のとき
//
// 1段目に無い自治体でも2段目が必ず使えるので、全国どこでも「行き先ゼロ」にはならない。

// 窓口が何を受け付けるか。道路の異状と、それ以外（公園の木・剪定など）を区別する。
// 道路緊急ダイヤルは道路が対象なので、公園の木をそこへ送ると誤った窓口に流れる。
export const SCOPE_ROAD = 'road';
export const SCOPE_PARK = 'park';

// 確認できた自治体の窓口。追加は1エントリの追記で済む。
// 載せるときは sourceUrl（根拠のページ）と verifiedOn（確認した日）を必ず書くこと。
export const MUNI_CHANNELS = {
  '14205': {
    muniName: '藤沢市',
    channels: [
      {
        kind: 'line',
        label: '藤沢市LINE「市民レポート」',
        url: 'https://page.line.me/327adlaa',
        scope: [SCOPE_ROAD, SCOPE_PARK],
        note: '街路樹・公園の樹木の不具合を受け付けています。',
        steps: [
          'メニューの「市民レポート」→「レポートを始める」',
          '案内にそって写真・位置情報を送る',
          '状況の欄に貼り付けて送信',
        ],
        sourceUrl: 'https://www.city.fujisawa.kanagawa.jp/dxs/linetsuho.html',
        verifiedOn: '2026-09-27',
      },
    ],
  },
};

// 全国共通の窓口。国土交通省 道路緊急ダイヤル #9910。
// 国道・都道府県道・市区町村道の区別なく受け付け、該当する道路管理者へ取り次がれる。
// 2024年3月29日からLINEでの受付も始まっている。
export const NATIONWIDE_CHANNELS = [
  {
    kind: 'line',
    label: '道路緊急ダイヤル #9910（LINE）',
    url: 'https://line.me/R/ti/p/@mlit_9910',
    scope: [SCOPE_ROAD],
    note: '国道・都道府県道・市区町村道のすべてが対象です。国土交通省が、その道路の管理者へ取り次ぎます。',
    steps: [
      'LINEで「国土交通省道路緊急ダイヤル（#9910）」を友だち追加',
      '「通報種別」と事象の詳細を選ぶ',
      '写真と位置情報を送る',
    ],
    caution: '受付は24時間ですが、内容の確認は平日 8:30〜17:15 に行われます。',
    sourceUrl: 'https://www.mlit.go.jp/road/dia/',
    verifiedOn: '2026-09-27',
  },
  {
    kind: 'phone',
    label: '道路緊急ダイヤル #9910（電話）',
    tel: '#9910',
    scope: [SCOPE_ROAD],
    note: '24時間・通話無料。倒木など急ぐときはこちら。',
    sourceUrl: 'https://www.mlit.go.jp/road/dia/',
    verifiedOn: '2026-09-27',
  },
];

// 複数の自治体が参加している通報サービス。参考として名前を出すだけで、
// 自動では出さない。「都道府県が参加している＝その市も使える」とは限らないため。
export const MULTI_MUNI_SERVICES = [
  { label: 'My City Report（参加している自治体のみ）', url: 'https://www.mycityreport.jp/' },
];
