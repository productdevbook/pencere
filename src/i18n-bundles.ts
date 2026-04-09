/**
 * Translated string bundles for the dialog chrome.
 *
 * These are bundled as a sub-export so callers who do not use them
 * can tree-shake the whole file away. Coverage:
 *
 * - en, de, fr, es, it, pt-BR, ru, tr, ar, he, ja, zh-CN, zh-TW, ko
 *
 * Community PRs for additional locales are welcome.
 */
import type { PencereStrings } from "./i18n";

const en: PencereStrings = {
  close: "Close",
  previous: "Previous image",
  next: "Next image",
  counter: "Image {index} of {total}",
  loading: "Loading",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset zoom",
  dialogLabel: "Image gallery",
};

const de: PencereStrings = {
  close: "Schließen",
  previous: "Vorheriges Bild",
  next: "Nächstes Bild",
  counter: "Bild {index} von {total}",
  loading: "Wird geladen",
  zoomIn: "Vergrößern",
  zoomOut: "Verkleinern",
  zoomReset: "Zoom zurücksetzen",
  dialogLabel: "Bildergalerie",
};

const fr: PencereStrings = {
  close: "Fermer",
  previous: "Image précédente",
  next: "Image suivante",
  counter: "Image {index} sur {total}",
  loading: "Chargement",
  zoomIn: "Agrandir",
  zoomOut: "Réduire",
  zoomReset: "Réinitialiser le zoom",
  dialogLabel: "Galerie d'images",
};

const es: PencereStrings = {
  close: "Cerrar",
  previous: "Imagen anterior",
  next: "Imagen siguiente",
  counter: "Imagen {index} de {total}",
  loading: "Cargando",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  zoomReset: "Restablecer zoom",
  dialogLabel: "Galería de imágenes",
};

const it: PencereStrings = {
  close: "Chiudi",
  previous: "Immagine precedente",
  next: "Immagine successiva",
  counter: "Immagine {index} di {total}",
  loading: "Caricamento",
  zoomIn: "Ingrandisci",
  zoomOut: "Rimpicciolisci",
  zoomReset: "Reimposta zoom",
  dialogLabel: "Galleria di immagini",
};

const ptBR: PencereStrings = {
  close: "Fechar",
  previous: "Imagem anterior",
  next: "Próxima imagem",
  counter: "Imagem {index} de {total}",
  loading: "Carregando",
  zoomIn: "Aumentar zoom",
  zoomOut: "Diminuir zoom",
  zoomReset: "Redefinir zoom",
  dialogLabel: "Galeria de imagens",
};

const ru: PencereStrings = {
  close: "Закрыть",
  previous: "Предыдущее изображение",
  next: "Следующее изображение",
  counter: "Изображение {index} из {total}",
  loading: "Загрузка",
  zoomIn: "Увеличить",
  zoomOut: "Уменьшить",
  zoomReset: "Сбросить масштаб",
  dialogLabel: "Галерея изображений",
};

const tr: PencereStrings = {
  close: "Kapat",
  previous: "Önceki resim",
  next: "Sonraki resim",
  counter: "{total} resimden {index}.",
  loading: "Yükleniyor",
  zoomIn: "Yakınlaştır",
  zoomOut: "Uzaklaştır",
  zoomReset: "Yakınlaştırmayı sıfırla",
  dialogLabel: "Resim galerisi",
};

const ar: PencereStrings = {
  close: "إغلاق",
  previous: "الصورة السابقة",
  next: "الصورة التالية",
  counter: "الصورة {index} من {total}",
  loading: "جارٍ التحميل",
  zoomIn: "تكبير",
  zoomOut: "تصغير",
  zoomReset: "إعادة ضبط التكبير",
  dialogLabel: "معرض الصور",
};

const he: PencereStrings = {
  close: "סגור",
  previous: "תמונה קודמת",
  next: "תמונה הבאה",
  counter: "תמונה {index} מתוך {total}",
  loading: "טוען",
  zoomIn: "הגדל",
  zoomOut: "הקטן",
  zoomReset: "אפס זום",
  dialogLabel: "גלריית תמונות",
};

const ja: PencereStrings = {
  close: "閉じる",
  previous: "前の画像",
  next: "次の画像",
  counter: "画像 {index}/{total}",
  loading: "読み込み中",
  zoomIn: "拡大",
  zoomOut: "縮小",
  zoomReset: "ズームをリセット",
  dialogLabel: "画像ギャラリー",
};

const zhCN: PencereStrings = {
  close: "关闭",
  previous: "上一张",
  next: "下一张",
  counter: "第 {index} 张，共 {total} 张",
  loading: "加载中",
  zoomIn: "放大",
  zoomOut: "缩小",
  zoomReset: "重置缩放",
  dialogLabel: "图库",
};

const zhTW: PencereStrings = {
  close: "關閉",
  previous: "上一張",
  next: "下一張",
  counter: "第 {index} 張，共 {total} 張",
  loading: "載入中",
  zoomIn: "放大",
  zoomOut: "縮小",
  zoomReset: "重設縮放",
  dialogLabel: "圖庫",
};

const ko: PencereStrings = {
  close: "닫기",
  previous: "이전 이미지",
  next: "다음 이미지",
  counter: "{total}개 중 {index}번째 이미지",
  loading: "로딩 중",
  zoomIn: "확대",
  zoomOut: "축소",
  zoomReset: "확대 초기화",
  dialogLabel: "이미지 갤러리",
};

export const strings = {
  en,
  de,
  fr,
  es,
  it,
  "pt-BR": ptBR,
  ru,
  tr,
  ar,
  he,
  ja,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ko,
} as const satisfies Record<string, PencereStrings>;

export type PencereLocale = keyof typeof strings;

/** Pick a bundle with safe fallback to English. */
export function getStrings(locale: string): PencereStrings {
  if (locale in strings) return strings[locale as PencereLocale];
  const short = locale.split("-")[0];
  if (short && short in strings) return strings[short as PencereLocale];
  return en;
}
