// 木や花の写真から名前の候補を調べる（Pl@ntNet API）。
//
// この処理をサーバー側に置いているのは、APIキーを隠すため。
// アプリのコードに書くと誰でも見られてしまい、1日の利用枠を使い切られる恐れがある。
// キーは Vercel の環境変数 PLANTNET_API_KEY から読む。
//
// 置き場所メモ：VercelのRoot Directoryはリポジトリの根っこなので、
// 関数もここ（根っこの api/）に置く必要がある。niwagokoro/api では認識されない。

const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all';
const MAX_RESULTS = 5;

// 文字列に日本語（ひらがな・カタカナ・漢字）が含まれるか
function hasJapanese(s) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(s || '');
}

// タイムアウト付きの共通fetch（JSONを返す）
async function fetchJson(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Niwashin-App/1.0 (plant name lookup)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 英語Wikipedia記事 → 日本語版へのリンク（＝日本語名）
async function fromWikipedia(sci) {
  const data = await fetchJson(
    'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks&lllang=ja&redirects=1&titles='
    + encodeURIComponent(sci)
  );
  const pages = data?.query?.pages || {};
  for (const key of Object.keys(pages)) {
    const ll = pages[key]?.langlinks;
    if (ll && ll[0] && ll[0]['*']) return ll[0]['*'];
  }
  return null;
}

// Wikidata：学名で項目を検索し、日本語ラベル（和名）を取る。
// Wikipediaに記事が無い種でも、Wikidataには和名だけある場合が多い。
async function fromWikidata(sci) {
  const s = await fetchJson(
    'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=1&search='
    + encodeURIComponent(sci)
  );
  const id = s?.search?.[0]?.id;
  if (!id) return null;
  const e = await fetchJson(
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=ja&ids=' + id
  );
  return e?.entities?.[id]?.labels?.ja?.value || null;
}

// 学名から日本語名を引く。まずWikipedia、無ければWikidata。
// 最後に「本当に日本語か」を確認し、ラテン語のままなら null（＝学名表示に任せる）。
async function fetchJapaneseName(scientificName) {
  if (!scientificName) return null;
  let name = await fromWikipedia(scientificName);
  if (!name) name = await fromWikidata(scientificName);
  return name && hasJapanese(name) ? name : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    res.status(200).json({ error: 'not_configured', results: [] });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    // 画像は複数受け取れる。images配列（新）と image単数（旧）の両対応。
    // Pl@ntNetは複数枚まとめて送るほど精度が上がる（最大5枚）。
    let images = Array.isArray(body?.images) ? body.images : (body?.image ? [body.image] : []);
    images = images.filter((s) => typeof s === 'string' && s).slice(0, 5);
    if (!images.length) {
      res.status(400).json({ error: 'no_image', results: [] });
      return;
    }

    const form = new FormData();
    for (const img of images) {
      const base64 = img.includes(',') ? img.split(',')[1] : img;
      const bytes = Buffer.from(base64, 'base64');
      form.append('images', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
      form.append('organs', 'auto'); // 画像1枚につき organ を1つ添える
    }

    const url = `${PLANTNET_ENDPOINT}?api-key=${encodeURIComponent(apiKey)}`
      + `&include-related-images=true&nb-results=${MAX_RESULTS}&lang=ja`;

    const response = await fetch(url, { method: 'POST', body: form });

    if (!response.ok) {
      const error = response.status === 404 ? 'no_match'
        : response.status === 429 ? 'quota_exceeded'
        : response.status === 401 || response.status === 403 ? 'bad_key'
        : 'failed';
      res.status(200).json({ error, results: [] });
      return;
    }

    const data = await response.json();
    const base = (data.results || []).slice(0, MAX_RESULTS).map((item) => ({
      score: item.score ?? 0,
      scientificName: item.species?.scientificNameWithoutAuthor || '',
      commonNames: item.species?.commonNames || [],
      image: item.images?.[0]?.url?.m || item.images?.[0]?.url?.s || null,
    }));

    // 各候補に日本語名を付ける。
    // 優先順：Wikipediaの日本語名 ＞ Pl@ntNetの日本語を含む一般名 ＞ なし（学名を使う）
    const results = await Promise.all(base.map(async (r) => {
      const wiki = await fetchJapaneseName(r.scientificName);
      const fromPlantnet = (r.commonNames || []).find(hasJapanese);
      return { ...r, japaneseName: wiki || fromPlantnet || null };
    }));

    res.status(200).json({ results });
  } catch {
    res.status(200).json({ error: 'failed', results: [] });
  }
}
