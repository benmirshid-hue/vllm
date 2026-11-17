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
  chapters: { t: number; label: string }[];
  hue: string;
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

export const harasSeries = {
  name: "حراس الأثير",
  note: "برنامج القصص ما زال سقالة. السيناريو مقفل للحلقات 1 إلى 4، والصورة والصوت لم يُولَّدا. بعد المراجعة تدخل الحلقة المكتبة.",
  stages: [
    "قصة",
    "سيناريو مقفل",
    "مشاهد نحو 90 ثانية",
    "بطاقات شخصيات",
    "صوت عربي محلي",
    "مقاطع",
    "دمج",
    "مراجعة",
    "نشر في المكتبة",
  ],
  characters: [
    { name: "الأميرة ميرال", detail: "9 سنوات" },
    { name: "لمار", detail: "13 سنة" },
    { name: "غنى", detail: "سنتان ونصف" },
    { name: "الأمير محمد", detail: "7 سنوات" },
    { name: "الملك", detail: "بطاقة مظهر ثابتة" },
    { name: "صخروب", detail: "مخلوق" },
    { name: "نوراس", detail: "مخلوق" },
  ],
  episodes: [1, 2, 3, 4].map((number) => ({
    number,
    minutes: 25,
    status: "السيناريو مقفل. لا يوجد ملف فيديو بعد.",
  })),
};

export const categories: ProductCategory[] = [
  "ملابس",
  "حقائب مدرسية",
  "أدوات مدرسية",
  "مستلزمات بنات",
];
