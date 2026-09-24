// 地図タイルの定義。地図画面（GreenMap）と登録フォーム（AddGreenForm）で共通に使う。
//
// 国土地理院のタイルを使っている。日本国内は公式測量に基づくため精度が高い。
// 利用にあたり出典の表示が義務なので、GSI_ATTRIBUTION は必ず地図に添えること。
export const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';

// 【注意】label と icon は「いま表示しているもの」ではなく「押したら切り替わる先」を表す。
// 例：いま pale（地図）を見ているとき、ボタンには「航空写真」と出て、押すと写真になる。
export const TILE_STYLES = {
  pale: {
    label: '航空写真',
    icon: '🛰',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
  },
  photo: {
    label: '地図',
    icon: '🗺',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
  },
};

// 次に切り替わるスタイルを返す
export const nextTileStyle = (s) => (s === 'pale' ? 'photo' : 'pale');

// 地理院タイルはズーム18まで。それ以上は拡大表示して操作できるようにする。
export const TILE_MAX_NATIVE_ZOOM = 18;
export const TILE_MAX_ZOOM = 19;
