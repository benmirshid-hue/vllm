export type Role = "guardian" | "adult" | "teen" | "child";

export type Profile = {
  id: string;
  name: string;
  role: Role;
  ageYears: number;
  maxRating: 3 | 7 | 13;
  familyId: string;
};

export type Title = {
  id: string;
  name: string;
  logline: string;
  creatorId: string;
  minutes: number;
  lengthLabel: string;
  rating: 3 | 7 | 13;
  style: string;
  src: string;
  credit: string;
  introEndSec: number;
  chapters: {
    t: number;
    label: string;
    line?: string;
    speakerId?: string;
    pitch?: number;
    rate?: number;
  }[];
  hue: string;
  playback?: "board";
  runtimeSec?: number;
  aliases?: string[];
};

export type Creator = {
  id: string;
  name: string;
  bio: string;
  adShare: number;
  merchantId?: string;
};

export type Merchant = { id: string; name: string };

export type Ad = {
  id: string;
  brand: string;
  line: string;
  cpmSar: number;
  minAge: number;
  maxAge: number;
  merchantId: string;
  surfaces: Array<"preroll" | "feed">;
};

export type ProductCategory = "ملابس" | "حقائب مدرسية" | "أدوات مدرسية" | "مستلزمات بنات";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  ageLabel: string;
  ageMin: number;
  ageMax: number;
  priceSar: number;
  merchantId: string;
  commissionRate: number;
  note: string;
};

export const profiles: Profile[] = [
  { id: "layan", name: "ليان", role: "guardian", ageYears: 31, maxRating: 13, familyId: "house" },
  { id: "fahad", name: "فهد", role: "adult", ageYears: 24, maxRating: 13, familyId: "house" },
  { id: "nora", name: "نورة", role: "teen", ageYears: 15, maxRating: 13, familyId: "house" },
  { id: "mishaal", name: "مشعل", role: "child", ageYears: 6, maxRating: 3, familyId: "house" },
];

export const merchants: Merchant[] = [
  { id: "noor", name: "نور" },
  { id: "madar", name: "مدار" },
  { id: "layla", name: "ليلى" },
];

export const creators: Creator[] = [
  {
    id: "haras",
    name: "استوديو حراس",
    bio: "مغامرة عائلية بشخصيات ثابتة المظهر.",
    adShare: 0.55,
  },
  {
    id: "studio",
    name: "استوديو الدار",
    bio: "أي مسلسل يُجمع هنا من بطاقات مقفلة، ثم يدخل المكتبة.",
    adShare: 0.55,
  },
  {
    id: "noor-studio",
    name: "استوديو نور",
    bio: "رسوم قصيرة مضيئة، ومتجر حقائب وملابس للأطفال.",
    adShare: 0.55,
    merchantId: "noor",
  },
  {
    id: "bandar",
    name: "بندر للرسوم",
    bio: "أفلام مفتوحة للتجربة، بأسلوب سينمائي.",
    adShare: 0.5,
  },
];

export const titles: Title[] = [
  {
    id: "bunny",
    name: "الأرنب باك",
    logline: "أرنب ضخم يستعيد هدوؤه بعد مزحة الغابة. كوميديا قصيرة بلا كلام.",
    creatorId: "noor-studio",
    minutes: 10,
    lengthLabel: "مقتطف ١٠ ث",
    rating: 3,
    style: "كوميديا",
    src: "/media/bunny.mp4",
    credit: "Blender Foundation · Big Buck Bunny · CC BY · مقتطف",
    introEndSec: 2,
    chapters: [
      { t: 0, label: "الغابة" },
      { t: 3, label: "المزحة" },
      { t: 7, label: "الرد" },
    ],
    hue: "#e2b15a",
    aliases: ["الارنب باك", "باك", "ارنب", "ضحك", "مضحك", "كوميديا"],
  },
  {
    id: "elephants",
    name: "حلم الفيلة",
    logline: "آلة حية وشخصيتان داخل حلم ميكانيكي. أول فيلم مفتوح من بندر.",
    creatorId: "bandar",
    minutes: 11,
    lengthLabel: "مقتطف ١٢ ث",
    rating: 7,
    style: "خيال",
    src: "/media/elephants.mp4",
    credit: "Blender Foundation · Elephants Dream · CC BY · مقتطف",
    introEndSec: 2,
    chapters: [
      { t: 0, label: "الاستيقاظ" },
      { t: 4, label: "الآلة" },
      { t: 8, label: "المخرج" },
    ],
    hue: "#d07a5a",
    aliases: ["حلم الفيله", "فيله", "خيال"],
  },
  {
    id: "sintel",
    name: "سينتل",
    logline: "فتاة تلاحق تنينًا صغيرًا عبر الجليد والقرية. للأكبر من 13.",
    creatorId: "haras",
    minutes: 15,
    lengthLabel: "مقتطف ١٠ ث",
    rating: 13,
    style: "مغامرة",
    src: "/media/sintel.mp4",
    credit: "Blender Foundation · Sintel · CC BY · مقتطف",
    introEndSec: 2,
    chapters: [
      { t: 0, label: "الثلج" },
      { t: 4, label: "القرية" },
      { t: 8, label: "المطاردة" },
    ],
    hue: "#8ea4b8",
    aliases: ["سينتل", "مغامره", "ثلج"],
  },
];

export const ads: Ad[] = [
  {
    id: "bag",
    brand: "حقيبة نور",
    line: "ظهر خفيف للمدرسة، جيب للألوان.",
    cpmSar: 24,
    minAge: 6,
    maxAge: 18,
    merchantId: "noor",
    surfaces: ["preroll", "feed"],
  },
  {
    id: "coat",
    brand: "معطف سحاب",
    line: "معطف مطر بطبعة غيمة. للأعمار من 3 إلى 10.",
    cpmSar: 20,
    minAge: 3,
    maxAge: 12,
    merchantId: "noor",
    surfaces: ["feed"],
  },
  {
    id: "pens",
    brand: "أقلام مدار",
    line: "علبة اثني عشر لونًا، تغلق وحدها.",
    cpmSar: 16,
    minAge: 6,
    maxAge: 18,
    merchantId: "madar",
    surfaces: ["preroll", "feed"],
  },
  {
    id: "sketch",
    brand: "طقم ليلى",
    line: "دفتر رسم ومشابك شعر للمدرسة.",
    cpmSar: 18,
    minAge: 7,
    maxAge: 18,
    merchantId: "layla",
    surfaces: ["feed"],
  },
];

export const products: Product[] = [
  {
    id: "coat",
    name: "معطف مطر غيمة",
    category: "ملابس",
    ageLabel: "3–8",
    ageMin: 3,
    ageMax: 8,
    priceSar: 129,
    merchantId: "noor",
    commissionRate: 0.12,
    note: "قماش خفيف، إغلاق سحاب.",
  },
  {
    id: "tee",
    name: "تيشيرت شخصية",
    category: "ملابس",
    ageLabel: "6–12",
    ageMin: 6,
    ageMax: 12,
    priceSar: 69,
    merchantId: "noor",
    commissionRate: 0.12,
    note: "قطن، رسمة أرنب مطبوعة.",
  },
  {
    id: "backpack",
    name: "حقيبة ظهر نور",
    category: "حقائب مدرسية",
    ageLabel: "7–14",
    ageMin: 7,
    ageMax: 14,
    priceSar: 189,
    merchantId: "noor",
    commissionRate: 0.12,
    note: "ظهر مبطّن، جيب قارورة.",
  },
  {
    id: "lunch",
    name: "حقيبة غداء",
    category: "حقائب مدرسية",
    ageLabel: "4–10",
    ageMin: 4,
    ageMax: 10,
    priceSar: 79,
    merchantId: "noor",
    commissionRate: 0.12,
    note: "عازلة، تغلق بإبزيم.",
  },
  {
    id: "pencils",
    name: "علبة أقلام مدار",
    category: "أدوات مدرسية",
    ageLabel: "6–18",
    ageMin: 6,
    ageMax: 18,
    priceSar: 24,
    merchantId: "madar",
    commissionRate: 0.1,
    note: "اثنا عشر لونًا.",
  },
  {
    id: "notebooks",
    name: "دفاتر الحصة",
    category: "أدوات مدرسية",
    ageLabel: "7–18",
    ageMin: 7,
    ageMax: 18,
    priceSar: 32,
    merchantId: "madar",
    commissionRate: 0.1,
    note: "ثلاث كراسات مسطّرة.",
  },
  {
    id: "sketch",
    name: "طقم رسم ليلى",
    category: "مستلزمات بنات",
    ageLabel: "7–15",
    ageMin: 7,
    ageMax: 15,
    priceSar: 58,
    merchantId: "layla",
    commissionRate: 0.11,
    note: "دفتر وألوان وممحاة.",
  },
  {
    id: "clips",
    name: "مشابك شعر مدرسية",
    category: "مستلزمات بنات",
    ageLabel: "5–12",
    ageMin: 5,
    ageMax: 12,
    priceSar: 18,
    merchantId: "layla",
    commissionRate: 0.11,
    note: "أربع قطع، بلا حواف حادة.",
  },
];

export type CastMember = {
  id: string;
  name: string;
  detail: string;
  pitch: number;
  rate: number;
  line: string;
};

export type SeriesShot = {
  id: string;
  episode: number;
  seconds: number;
  speakerId: string;
  line: string;
  faceIds: string[];
};

export type Series = {
  id: string;
  name: string;
  creatorId: string;
  rating: 3 | 7 | 13;
  hue: string;
  cast: CastMember[];
  shots: SeriesShot[];
};

const harasCast: CastMember[] = [
  { id: "miral", name: "الأميرة ميرال", detail: "9 سنوات", pitch: 1.45, rate: 0.95, line: "أنا ميرال، أحرس الباب." },
  { id: "lamar", name: "لمار", detail: "13 سنة", pitch: 1.2, rate: 1, line: "لمار ترى الطريق." },
  { id: "ghina", name: "غنى", detail: "سنتان ونصف", pitch: 1.7, rate: 0.9, line: "غنى تضحك." },
  { id: "mohammed", name: "الأمير محمد", detail: "7 سنوات", pitch: 1.15, rate: 1.05, line: "محمد معك." },
  { id: "king", name: "الملك", detail: "بطاقة مظهر ثابتة", pitch: 0.7, rate: 0.85, line: "الملك يثبّت العهد." },
  { id: "sakhrub", name: "صخروب", detail: "مخلوق", pitch: 0.55, rate: 0.8, line: "صخروب يفتح الطريق." },
  { id: "nawras", name: "نوراس", detail: "مخلوق", pitch: 1.55, rate: 1.1, line: "نوراس يضيء." },
];

const harasShots: SeriesShot[] = [
  { id: "e1s1", episode: 1, seconds: 90, speakerId: "miral", line: "أنا ميرال، أحرس الباب.", faceIds: ["miral"] },
  { id: "e1s2", episode: 1, seconds: 90, speakerId: "mohammed", line: "محمد معك.", faceIds: ["mohammed", "miral"] },
  { id: "e1s3", episode: 1, seconds: 90, speakerId: "sakhrub", line: "صخروب يفتح الطريق.", faceIds: ["sakhrub"] },
  { id: "e1s4", episode: 1, seconds: 90, speakerId: "king", line: "الملك يثبّت العهد.", faceIds: ["king", "miral"] },
  { id: "e2s1", episode: 2, seconds: 90, speakerId: "lamar", line: "لمار ترى الطريق.", faceIds: ["lamar"] },
  { id: "e2s2", episode: 2, seconds: 90, speakerId: "ghina", line: "غنى تضحك.", faceIds: ["ghina", "lamar"] },
  { id: "e2s3", episode: 2, seconds: 90, speakerId: "nawras", line: "نوراس يضيء.", faceIds: ["nawras"] },
  { id: "e2s4", episode: 2, seconds: 90, speakerId: "miral", line: "ميرال تكمل الدرب.", faceIds: ["miral", "nawras"] },
  { id: "e3s1", episode: 3, seconds: 90, speakerId: "mohammed", line: "محمد يسأل الملك.", faceIds: ["mohammed"] },
  { id: "e3s2", episode: 3, seconds: 90, speakerId: "king", line: "الملك يثبّت العهد.", faceIds: ["king", "mohammed"] },
  { id: "e3s3", episode: 3, seconds: 90, speakerId: "lamar", line: "لمار تحفظ الاسم.", faceIds: ["lamar"] },
  { id: "e3s4", episode: 3, seconds: 90, speakerId: "sakhrub", line: "صخروب يحرس السور.", faceIds: ["sakhrub", "king"] },
  { id: "e4s1", episode: 4, seconds: 90, speakerId: "ghina", line: "غنى تشير للضوء.", faceIds: ["ghina"] },
  { id: "e4s2", episode: 4, seconds: 90, speakerId: "nawras", line: "نوراس يفتح الأثير.", faceIds: ["nawras", "ghina"] },
  { id: "e4s3", episode: 4, seconds: 90, speakerId: "miral", line: "ميرال تجمع الحراس.", faceIds: ["miral", "lamar", "mohammed"] },
  { id: "e4s4", episode: 4, seconds: 90, speakerId: "king", line: "الملك يغلق الحلقة.", faceIds: ["king", "miral"] },
];

export const seedSeries: Series[] = [
  {
    id: "haras",
    name: "حراس الأثير",
    creatorId: "haras",
    rating: 3,
    hue: "#c4522a",
    cast: harasCast,
    shots: harasShots,
  },
];

export const categories: ProductCategory[] = [
  "ملابس",
  "حقائب مدرسية",
  "أدوات مدرسية",
  "مستلزمات بنات",
];
