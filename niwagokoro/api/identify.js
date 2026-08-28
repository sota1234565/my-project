// 木や花の写真から名前の候補を調べる（Pl@ntNet API）。
//
// この処理をサーバー側に置いているのは、APIキーを隠すため。
// アプリのコードに書くと誰でも見られてしまい、1日の利用枠を使い切られる恐れがある。
// キーは Vercel の環境変数 PLANTNET_API_KEY から読む。

const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all';
const MAX_RESULTS = 3;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    // キー未設定でもアプリ本体は動かしたいので、判定機能だけ無効として返す
    res.status(200).json({ error: 'not_configured', results: [] });
    return;
  }

  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'no_image', results: [] });
      return;
    }

    // data URL（data:image/jpeg;base64,....）からデータ部分だけ取り出す
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const bytes = Buffer.from(base64, 'base64');

    const form = new FormData();
    form.append('images', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
    form.append('organs', 'auto'); // 花・葉・幹などを自動で判断させる

    const url = `${PLANTNET_ENDPOINT}?api-key=${encodeURIComponent(apiKey)}`
      + `&include-related-images=true&nb-results=${MAX_RESULTS}&lang=ja`;

    const response = await fetch(url, { method: 'POST', body: form });

    if (!response.ok) {
      // 404 = 該当する植物が見つからなかった／429 = 1日の上限に達した
      const error = response.status === 404 ? 'no_match'
        : response.status === 429 ? 'quota_exceeded'
        : response.status === 401 || response.status === 403 ? 'bad_key'
        : 'failed';
      res.status(200).json({ error, results: [] });
      return;
    }

    const data = await response.json();
    const results = (data.results || []).slice(0, MAX_RESULTS).map((item) => ({
      score: item.score ?? 0,
      scientificName: item.species?.scientificNameWithoutAuthor || '',
      commonNames: item.species?.commonNames || [],
      // 見比べてもらうための参考写真
      image: item.images?.[0]?.url?.m || item.images?.[0]?.url?.s || null,
    }));

    res.status(200).json({ results });
  } catch {
    res.status(200).json({ error: 'failed', results: [] });
  }
}
