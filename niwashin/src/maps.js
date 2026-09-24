// 外部の地図アプリへの引き渡し。
// Googleマップに「徒歩でここまで」を渡す。iPhoneではアプリが入っていればアプリが開き、
// 無ければブラウザ版が開く。本物のナビ（音声・リアルタイム）はこちらに任せる。
export function googleMapsDirUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

// 不動産表示の基準「徒歩1分＝80m」で所要時間を出す。
// 無料の経路サービスは車の速度で時間を返してくるため、距離から自前で計算する。
export function walkMinutes(distanceM) {
  return Math.max(1, Math.ceil(distanceM / 80));
}

export function formatDistance(distanceM) {
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${Math.round(distanceM)}m`;
}

// 場所そのものを指すGoogleマップのリンク（経路ではなく地点）。
// 通報の文面に入れると、受け取った市の担当者がその場所をすぐ開ける。
export function googleMapsPlaceUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
