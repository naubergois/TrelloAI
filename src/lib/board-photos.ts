export type BoardPhoto = {
  id: string;
  author: string;
  thumb: string;
  full: string;
  category: string;
};

const CURATED: BoardPhoto[] = [
  unsplash("praia", "Praia", "1507525428034-b723cf961d3e"),
  unsplash("mar", "Mar", "1500375592092-40eb2168fd21"),
  unsplash("oceano", "Oceano", "1471922694854-ff1b8b9dfdae"),
  unsplash("lago", "Lago", "1439066615861-d1af74d74000"),
  unsplash("floresta", "Floresta", "1441974231531-c6227db76b6e"),
  unsplash("serra", "Serra", "1464822759023-fed622ff2c3b"),
  unsplash("por-do-sol", "Pôr do sol", "1500534314209-a25ddb2bd429"),
  unsplash("noite", "Noite", "1519681393784-d120267933ba"),
  unsplash("neblina", "Neblina", "1470071459604-3b5ec3a7fe05"),
  unsplash("cidade", "Cidade", "1480714378408-67cf0d13bc1b"),
  unsplash("escritorio", "Escritório", "1497366216548-37526070297c"),
  unsplash("textura", "Textura", "1550684848-fac1c5bdc6fd"),
];

function unsplash(category: string, label: string, photoId: string): BoardPhoto {
  const base = `https://images.unsplash.com/photo-${photoId}`;
  return {
    id: `unsplash-${photoId}`,
    author: label,
    category,
    thumb: `${base}?auto=format&fit=crop&w=400&h=240&q=70`,
    full: `${base}?auto=format&fit=crop&w=1920&q=80`,
  };
}

function picsum(id: number): BoardPhoto {
  return {
    id: `picsum-${id}`,
    author: `Foto ${id}`,
    category: "galeria",
    thumb: `https://picsum.photos/id/${id}/400/240`,
    full: `https://picsum.photos/id/${id}/1600/900`,
  };
}

/** IDs que o Lorem Picsum não serve (404). */
const PICSUM_SKIP = new Set([
  86, 97, 105, 138, 148, 150, 205, 207, 224, 226, 245, 246, 262, 285, 286, 298,
  303, 332, 333, 346, 359, 394, 414, 422, 425, 429, 431, 434, 450, 453, 463,
  470, 489, 540, 561, 578, 584, 587, 589, 592, 595, 597, 601, 624, 632, 636,
  644, 647, 673, 697, 706, 731, 734, 745, 746, 753, 759, 762, 776, 777, 784,
  794, 801, 812, 825, 843, 850, 851, 869, 879, 887, 895, 897, 899, 917, 920,
  934, 956, 969, 972, 999, 1009, 1015,
]);

let cached: BoardPhoto[] | null = null;

export function boardPhotoCatalog(): BoardPhoto[] {
  if (cached) return cached;
  const photos = [...CURATED];
  for (let id = 0; id <= 1200 && photos.length < 420; id++) {
    if (PICSUM_SKIP.has(id)) continue;
    photos.push(picsum(id));
  }
  cached = photos;
  return photos;
}

export function photosByPage(page: number, pageSize = 36): BoardPhoto[] {
  const start = Math.max(0, page) * pageSize;
  return boardPhotoCatalog().slice(start, start + pageSize);
}

export function isUsableBackgroundUrl(value: string) {
  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
