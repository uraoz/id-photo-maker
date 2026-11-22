export const STRINGS = {
  en: {
    title: 'ID Photo Maker', language: 'Language',
    privacy: 'Works fully offline. Your photo never leaves this device.',
    drop: 'Drag & drop a photo here, or', choose: 'Choose photo',
    step1: '1. Crop', step2: '2. Print sheet', preset: 'Size', zoom: 'Zoom',
    brightness: 'Brightness', contrast: 'Contrast', showGuides: 'Show guides',
    cropHint: 'Drag to move, wheel or slider to zoom. Put the top of the head on the top line and the chin on the lower line.',
    paper: 'Paper', cutlines: 'Cut marks', save: 'Save PNG (300 dpi)', print: 'Print',
    printHint: 'Print at 100% / actual size (no "fit to page").',
    footer: 'No ads, no tracking, no network requests.',
    sheetInfo: '{n} photos ({c}×{r}), {w}×{h} px @300dpi',
    sheetNone: 'This size does not fit on the selected paper.',
    loadError: 'Could not read this image file.',
    'p.resume': 'Resume 40×30 mm (Japan)', 'p.passport': 'Passport / My Number 45×35 mm (Japan)',
    'p.license': "Driver's license 30×24 mm (Japan)", 'p.exam': 'Exam 40×30 mm (Japan)',
    'p.us': 'US passport / visa 2×2 in', 'p.custom': 'Custom (mm)',
  },
  ja: {
    title: '証明写真メーカー', language: '言語',
    privacy: '完全オフラインで動作します。写真が端末の外へ送信されることはありません。',
    drop: '写真をここにドラッグ＆ドロップ、または', choose: '写真を選ぶ',
    step1: '1. 切り抜き', step2: '2. 印刷シート', preset: 'サイズ', zoom: '拡大',
    brightness: '明るさ', contrast: 'コントラスト', showGuides: 'ガイドを表示',
    cropHint: 'ドラッグで移動、ホイールまたはスライダーで拡大縮小。頭頂を上の線、あごを下の線に合わせてください。',
    paper: '用紙', cutlines: 'カットマーク', save: 'PNG保存（300dpi）', print: '印刷',
    printHint: '印刷は「実際のサイズ（100%）」で行ってください（「用紙に合わせる」はオフ）。',
    footer: '広告なし・トラッキングなし・通信なし。',
    sheetInfo: '{n}枚（{c}×{r}）、{w}×{h} px @300dpi',
    sheetNone: 'この規格サイズは選択した用紙に収まりません。',
    loadError: 'この画像ファイルを読み込めませんでした。',
    'p.resume': '履歴書 40×30mm（日本）', 'p.passport': 'パスポート・マイナンバー 45×35mm（日本）',
    'p.license': '運転免許 30×24mm（日本）', 'p.exam': '資格試験 40×30mm（日本）',
    'p.us': '米国パスポート・ビザ 2×2インチ', 'p.custom': 'カスタム（mm指定）',
  },
};
export function detectLang(saved, nav) {
  if (saved && STRINGS[saved]) return saved;
  return /^ja/i.test(nav || '') ? 'ja' : 'en';
}
export const t = (lang, key, vars = {}) =>
  (STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
