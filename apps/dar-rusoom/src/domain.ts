import {
  ads,
  creators,
  merchants,
  products,
  profiles,
  titles,
  type Ad,
  type Creator,
  type Merchant,
  type Product,
  type Profile,
  type Title,
} from "./data.ts";

export type View =
  | "library"
  | "theater"
  | "voice"
  | "studio"
  | "community"
  | "ads"
  | "channels"
  | "market"
  | "moderation"
  | "stack";

export type LayerMode = "foundation" | "enterprise";

export type LayerKey = "video" | "payments" | "moderation" | "analytics";

export type Medium = "animation" | "anime" | "live-action" | "hybrid";

export type Decision = "approve" | "reject" | "review";

export type SubmissionInput = {
  title: string;
  medium: Medium;
  rights: boolean;
  rating: 3 | 7 | 13 | 18;
  notes: string;
};

export type QueueItem = SubmissionInput & {
  id: string;
  decision: Decision;
  reasons: string[];
  at: number;
};

export type Comment = {
  id: string;
  titleId: string;
  profileId: string;
  text: string;
  at: number;
};

export type Order = {
  id: string;
  productId: string;
  qty: number;
  profileId: string;
  forProfileId: string;
  at: number;
  provider: "ledger" | "moyasar";
};

export type AdEvent = {
  id: string;
  adId: string;
  creatorId: string;
  profileId: string;
  at: number;
  skipped: boolean;
};

export type StackLayers = Record<LayerKey, LayerMode>;

export type State = {
  version: 1;
  view: View;
  profileId: string;
  titleId: string;
  channelId: string | null;
  likes: Record<string, string[]>;
  comments: Comment[];
  followsCreators: Record<string, string[]>;
  followsPeople: Record<string, string[]>;
  cart: Record<string, number>;
  orders: Order[];
  queue: QueueItem[];
  adEvents: AdEvent[];
  plays: { titleId: string; profileId: string; at: number }[];
  positions: Record<string, number>;
  prerollSeen: string[];
  layers: StackLayers;
};

export type FeedItem =
  | { kind: "clip"; titleId: string; creatorId: string }
  | { kind: "ad"; adId: string; creatorId: string };

export type Action =
  | { type: "view"; view: View }
  | { type: "profile"; id: string }
  | { type: "open"; titleId: string }
  | { type: "channel"; id: string }
  | { type: "like" }
  | { type: "comment"; text: string }
  | { type: "followCreator"; creatorId: string }
  | { type: "followPerson"; profileId: string }
  | { type: "adComplete"; adId: string; creatorId: string; skipped: boolean }
  | { type: "play" }
  | { type: "position"; titleId: string; seconds: number }
  | { type: "prerollSeen"; titleId: string }
  | { type: "addCart"; productId: string }
  | { type: "setQty"; productId: string; qty: number }
  | { type: "checkout"; forProfileId?: string }
  | { type: "submit"; submission: SubmissionInput }
  | { type: "resolve"; id: string; decision: "approve" | "reject" }
  | { type: "layer"; key: LayerKey; mode: LayerMode }
  | { type: "reset" };

export function profileById(id: string): Profile {
  const found = profiles.find((profile) => profile.id === id);
  if (!found) {
    throw new Error(`unknown profile ${id}`);
  }
  return found;
}

export function titleById(id: string): Title {
  const found = titles.find((title) => title.id === id);
  if (!found) {
    throw new Error(`unknown title ${id}`);
  }
  return found;
}

export function creatorById(id: string): Creator {
  const found = creators.find((creator) => creator.id === id);
  if (!found) {
    throw new Error(`unknown creator ${id}`);
  }
  return found;
}

export function merchantById(id: string): Merchant {
  const found = merchants.find((merchant) => merchant.id === id);
  if (!found) {
    throw new Error(`unknown merchant ${id}`);
  }
  return found;
}

export function productById(id: string): Product {
  const found = products.find((product) => product.id === id);
  if (!found) {
    throw new Error(`unknown product ${id}`);
  }
  return found;
}

export function adById(id: string): Ad {
  const found = ads.find((ad) => ad.id === id);
  if (!found) {
    throw new Error(`unknown ad ${id}`);
  }
  return found;
}

export function visibleTitles(profile: Profile): Title[] {
  return titles.filter((title) => title.rating <= profile.maxRating);
}

export function visibleAds(profile: Profile, surface: "preroll" | "feed"): Ad[] {
  return ads.filter((ad) => {
    if (!ad.surfaces.includes(surface)) {
      return false;
    }
    if (profile.role === "guardian" || profile.role === "adult") {
      return true;
    }
    return profile.ageYears >= ad.minAge && profile.ageYears <= ad.maxAge;
  });
}

export function prerollFor(profile: Profile): Ad | null {
  return visibleAds(profile, "preroll")[0] ?? null;
}

export function buildFeed(profile: Profile): FeedItem[] {
  const library = visibleTitles(profile);
  const commercials = visibleAds(profile, "feed");
  const items: FeedItem[] = [];
  library.forEach((title, index) => {
    items.push({ kind: "clip", titleId: title.id, creatorId: title.creatorId });
    const ad = commercials[index % commercials.length];
    if (ad) {
      items.push({ kind: "ad", adId: ad.id, creatorId: title.creatorId });
    }
  });
  return items;
}

export function canComment(
  profile: Profile,
  text: string,
): { ok: true } | { ok: false; reason: string } {
  const clean = text.trim();
  if (profile.role === "child") {
    return { ok: false, reason: "تعليق ملف الطفل مغلق. ولي الأمر يفتحه لاحقًا." };
  }
  if (clean.length < 2) {
    return { ok: false, reason: "اكتب جملة قصيرة." };
  }
  if (clean.length > 240) {
    return { ok: false, reason: "التعليق أطول من الحد." };
  }
  if (profile.role !== "adult" && profile.role !== "guardian" && /https?:\/\//i.test(clean)) {
    return { ok: false, reason: "الروابط الخارجية للبالغين فقط." };
  }
  return { ok: true };
}

export function canFollow(actor: Profile, target: Profile): boolean {
  if (actor.id === target.id) {
    return false;
  }
  if (target.role === "child") {
    return false;
  }
  if (actor.role === "child") {
    return target.role === "guardian" && target.familyId === actor.familyId;
  }
  return true;
}

export function canCheckout(profile: Profile): boolean {
  return profile.role === "guardian" || profile.role === "adult";
}

export function assessSubmission(input: SubmissionInput): {
  decision: Decision;
  reasons: string[];
} {
  if (input.medium === "live-action") {
    return {
      decision: "reject",
      reasons: ["الصورة الحية خارج الكتالوج. المنصة للرسوم فقط."],
    };
  }
  if (!input.rights) {
    return { decision: "reject", reasons: ["إثبات الحقوق ناقص."] };
  }
  if (input.medium === "hybrid") {
    return {
      decision: "review",
      reasons: ["المزج مع لقطات حية يحتاج مراجعًا بشريًا."],
    };
  }
  if (input.rating === 18) {
    return { decision: "review", reasons: ["التصنيف 18 لا يُنشر تلقائيًا."] };
  }
  if (/ممثل|تصوير حي|لايف/.test(input.notes)) {
    return { decision: "review", reasons: ["الوصف يذكر تصويرًا حيًا."] };
  }
  if (input.title.trim().length < 2) {
    return { decision: "reject", reasons: ["العنوان ناقص."] };
  }
  return {
    decision: "approve",
    reasons: ["رسم متحرك، وحقوق مثبتة، وتصنيف داخل النطاق."],
  };
}

export function splitSale(
  priceSar: number,
  qty: number,
  commissionRate: number,
): { gross: number; platform: number; merchant: number } {
  const gross = roundMoney(priceSar * qty);
  const platform = roundMoney(gross * commissionRate);
  const merchant = roundMoney(gross - platform);
  return { gross, platform, merchant };
}

export function creatorAdEarnings(events: AdEvent[], creatorId: string, share: number): number {
  const completed = events.filter((event) => event.creatorId === creatorId && !event.skipped);
  const total = completed.reduce((sum, event) => sum + adById(event.adId).cpmSar / 1000, 0);
  return roundMoney(total * share);
}

export function merchantEarnings(
  orders: Order[],
  merchantId: string,
): { gross: number; platform: number; merchant: number } {
  return orders.reduce(
    (sum, order) => {
      const product = productById(order.productId);
      if (product.merchantId !== merchantId) {
        return sum;
      }
      const split = splitSale(product.priceSar, order.qty, product.commissionRate);
      return {
        gross: roundMoney(sum.gross + split.gross),
        platform: roundMoney(sum.platform + split.platform),
        merchant: roundMoney(sum.merchant + split.merchant),
      };
    },
    { gross: 0, platform: 0, merchant: 0 },
  );
}

export function sar(value: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toggle(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function seededQueue(): QueueItem[] {
  const samples: SubmissionInput[] = [
    {
      title: "حلقة الغيمة",
      medium: "animation",
      rights: true,
      rating: 3,
      notes: "رسوم ثنائية، شخصيات أصلية.",
    },
    {
      title: "مباراة الحي",
      medium: "live-action",
      rights: true,
      rating: 7,
      notes: "تصوير ملعب.",
    },
    {
      title: "خلف الكواليس",
      medium: "hybrid",
      rights: true,
      rating: 7,
      notes: "رسوم مع لقطة استوديو.",
    },
    {
      title: "ليل طويل",
      medium: "anime",
      rights: true,
      rating: 18,
      notes: "أنمي بتصنيف مرتفع.",
    },
  ];
  return samples.map((sample, index) => {
    const result = assessSubmission(sample);
    return {
      ...sample,
      ...result,
      id: `seed-${index}`,
      at: 1_700_000_000_000 + index,
    };
  });
}

export function initialState(): State {
  return {
    version: 1,
    view: "library",
    profileId: "layan",
    titleId: "bunny",
    channelId: null,
    likes: {
      bunny: ["layan", "nora", "mishaal"],
      elephants: ["layan"],
      sintel: ["fahad"],
    },
    comments: [
      {
        id: "c1",
        titleId: "bunny",
        profileId: "nora",
        text: "الضحك في مشهد الفراشة يضبط الإيقاع.",
        at: 1_700_000_100_000,
      },
      {
        id: "c2",
        titleId: "sintel",
        profileId: "fahad",
        text: "الثلاث عشرة مناسبة. الثلج في البداية سينما.",
        at: 1_700_000_200_000,
      },
    ],
    followsCreators: { layan: ["haras", "noor-studio"], fahad: ["bandar"] },
    followsPeople: { layan: ["fahad"], fahad: ["nora"], mishaal: ["layan"] },
    cart: {},
    orders: [],
    queue: seededQueue(),
    adEvents: [
      {
        id: "ae1",
        adId: "bag",
        creatorId: "noor-studio",
        profileId: "layan",
        at: 1_700_000_300_000,
        skipped: false,
      },
    ],
    plays: [{ titleId: "bunny", profileId: "layan", at: 1_700_000_050_000 }],
    positions: {},
    prerollSeen: [],
    layers: {
      video: "foundation",
      payments: "foundation",
      moderation: "foundation",
      analytics: "foundation",
    },
  };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, view: action.view, channelId: null };
    case "profile": {
      const next = profileById(action.id);
      const allowed = visibleTitles(next);
      const titleId = allowed.some((title) => title.id === state.titleId)
        ? state.titleId
        : allowed[0]?.id ?? state.titleId;
      return { ...state, profileId: next.id, titleId };
    }
    case "open": {
      const profile = profileById(state.profileId);
      if (!visibleTitles(profile).some((title) => title.id === action.titleId)) {
        return state;
      }
      return { ...state, titleId: action.titleId, view: "theater" };
    }
    case "channel":
      return { ...state, view: "channels", channelId: action.id };
    case "like": {
      const likes = { ...state.likes };
      likes[state.titleId] = toggle(likes[state.titleId], state.profileId);
      return { ...state, likes };
    }
    case "comment": {
      const profile = profileById(state.profileId);
      if (!canComment(profile, action.text).ok) {
        return state;
      }
      const comment: Comment = {
        id: crypto.randomUUID(),
        titleId: state.titleId,
        profileId: profile.id,
        text: action.text.trim(),
        at: Date.now(),
      };
      return { ...state, comments: [comment, ...state.comments] };
    }
    case "followCreator": {
      const followsCreators = { ...state.followsCreators };
      followsCreators[state.profileId] = toggle(followsCreators[state.profileId], action.creatorId);
      return { ...state, followsCreators };
    }
    case "followPerson": {
      const actor = profileById(state.profileId);
      const target = profileById(action.profileId);
      if (!canFollow(actor, target)) {
        return state;
      }
      const followsPeople = { ...state.followsPeople };
      followsPeople[actor.id] = toggle(followsPeople[actor.id], target.id);
      return { ...state, followsPeople };
    }
    case "adComplete": {
      const event: AdEvent = {
        id: crypto.randomUUID(),
        adId: action.adId,
        creatorId: action.creatorId,
        profileId: state.profileId,
        at: Date.now(),
        skipped: action.skipped,
      };
      return { ...state, adEvents: [event, ...state.adEvents] };
    }
    case "play":
      return {
        ...state,
        plays: [
          { titleId: state.titleId, profileId: state.profileId, at: Date.now() },
          ...state.plays,
        ],
      };
    case "position":
      return {
        ...state,
        positions: { ...state.positions, [action.titleId]: action.seconds },
      };
    case "prerollSeen":
      return state.prerollSeen.includes(action.titleId)
        ? state
        : { ...state, prerollSeen: [...state.prerollSeen, action.titleId] };
    case "addCart":
      return {
        ...state,
        cart: { ...state.cart, [action.productId]: (state.cart[action.productId] ?? 0) + 1 },
      };
    case "setQty": {
      const cart = { ...state.cart };
      if (action.qty <= 0) {
        delete cart[action.productId];
      } else {
        cart[action.productId] = action.qty;
      }
      return { ...state, cart };
    }
    case "checkout": {
      const payer = profileById(state.profileId);
      const beneficiary = profileById(action.forProfileId ?? payer.id);
      const lines = Object.entries(state.cart).filter(([, qty]) => qty > 0);
      if (!guardianCanPay(payer, beneficiary) || lines.length === 0) {
        return state;
      }
      if (!basketFitsChild(beneficiary, lines.map(([productId]) => productId))) {
        return state;
      }
      const provider = state.layers.payments === "enterprise" ? "moyasar" : "ledger";
      const orders: Order[] = lines.map(([productId, qty]) => ({
        id: crypto.randomUUID(),
        productId,
        qty,
        profileId: payer.id,
        forProfileId: beneficiary.id,
        at: Date.now(),
        provider,
      }));
      return { ...state, cart: {}, orders: [...orders, ...state.orders] };
    }
    case "submit": {
      const result = assessSubmission(action.submission);
      const item: QueueItem = {
        ...action.submission,
        ...result,
        id: crypto.randomUUID(),
        at: Date.now(),
      };
      return { ...state, queue: [item, ...state.queue] };
    }
    case "resolve":
      return {
        ...state,
        queue: state.queue.map((item) => {
          if (item.id !== action.id) {
            return item;
          }
          if (action.decision === "approve" && (item.medium === "live-action" || !item.rights)) {
            return item;
          }
          const note = action.decision === "approve" ? "موافقة مراجع." : "رفض مراجع.";
          return {
            ...item,
            decision: action.decision,
            reasons: item.reasons.includes(note) ? item.reasons : [...item.reasons, note],
          };
        }),
      };
    case "layer":
      return { ...state, layers: { ...state.layers, [action.key]: action.mode } };
    case "reset":
      return initialState();
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

export function sharedWatchers(titleId: string, likes: Record<string, string[]>, actorId: string): Profile[] {
  const ids = likes[titleId] ?? [];
  return ids.filter((id) => id !== actorId).map((id) => profileById(id));
}

export function playCount(state: State, titleId: string): number {
  return state.plays.filter((play) => play.titleId === titleId).length;
}

export type AssistResult = {
  say: string;
  offerIds: string[];
  openId: string | null;
};

export type Mouth = "open" | "round" | "closed";

export type EpisodeCut =
  | { ok: true; seconds: number; shotIds: string[] }
  | { ok: false; reason: string };

export function hearArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export function mouthCues(line: string): Mouth[] {
  const cues: Mouth[] = [];
  for (const mark of hearArabic(line)) {
    if (mark === " " || mark === "،" || mark === ".") {
      continue;
    }
    if (mark === "ا" || mark === "و") {
      cues.push("round");
    } else if ("يبمف".includes(mark)) {
      cues.push("closed");
    } else if (/[\u0600-\u06FF]/.test(mark)) {
      cues.push("open");
    }
  }
  return cues.length > 0 ? cues : ["closed"];
}

export function assembleEpisode(
  episode: number,
  shots: { id: string; episode: number; seconds: number; faceIds: string[] }[],
  lockedIds: string[],
): EpisodeCut {
  const mine = shots.filter((shot) => shot.episode === episode);
  if (mine.length === 0) {
    return { ok: false, reason: "لا لقطات لهذه الحلقة." };
  }
  const stranger = mine.find((shot) => shot.faceIds.some((face) => !lockedIds.includes(face)));
  if (stranger) {
    return { ok: false, reason: "لقطة بوجه خارج البطاقات المقفلة." };
  }
  return {
    ok: true,
    seconds: mine.reduce((sum, shot) => sum + shot.seconds, 0),
    shotIds: mine.map((shot) => shot.id),
  };
}

export function guardianCanPay(payer: Profile, beneficiary: Profile): boolean {
  return canCheckout(payer) && payer.familyId === beneficiary.familyId;
}

export function basketFitsChild(beneficiary: Profile, productIds: string[]): boolean {
  if (beneficiary.role !== "child") {
    return true;
  }
  return productIds.every((id) => {
    const product = productById(id);
    return beneficiary.ageYears >= product.ageMin && beneficiary.ageYears <= product.ageMax;
  });
}

export function assist(profile: Profile, text: string, offeredIds: string[]): AssistResult {
  const library = visibleTitles(profile);
  const said = hearArabic(text);
  const blocked = titles.find(
    (title) => title.rating > profile.maxRating && aliasHit(title.id, said),
  );
  if (blocked) {
    return {
      say: `${blocked.name} فوق عمر هذا الملف. أقدر أفتح لك اللي يناسبه.`,
      offerIds: library.map((title) => title.id),
      openId: null,
    };
  }
  const named = library.find((title) => aliasHit(title.id, said));
  if (wantsPlay(said)) {
    const pick = named ?? (offeredIds.length > 0 ? indexPick(said, offeredIds, library) : null);
    if (pick) {
      return { say: `أفتح ${pick.name}.`, offerIds: [pick.id], openId: pick.id };
    }
  }
  const mood = moodOf(said);
  if (!mood && !named) {
    return { say: "تبغى ضحك، ولا خيال، ولا مغامرة؟", offerIds: [], openId: null };
  }
  const pool = named ? [named] : library.filter((title) => title.style === styleFor(mood));
  if (pool.length === 0) {
    return {
      say: "هذا النوع فوق عمر الملف. هذا اللي يناسبه.",
      offerIds: library.map((title) => title.id),
      openId: null,
    };
  }
  const lines = pool
    .map((title, index) => `${index + 1}. ${title.name}. ${title.lengthLabel}. ${title.logline}`)
    .join(" ");
  return {
    say: `${lines} إذا ارتحت قول شغّله.`,
    offerIds: pool.map((title) => title.id),
    openId: null,
  };
}

function aliasHit(titleId: string, said: string): boolean {
  const words: Record<string, string[]> = {
    bunny: ["الارنب باك", "باك", "ارنب", "ضحك", "مضحك", "كوميديا"],
    elephants: ["حلم الفيله", "فيله", "خيال"],
    sintel: ["سينتل", "مغامره", "ثلج"],
  };
  const heard = hearArabic(said);
  return (words[titleId] ?? []).some((word) => heard.includes(hearArabic(word)));
}

function wantsPlay(said: string): boolean {
  return /شغ|خلاص|الأول|الاول|الثاني|الثالث/.test(said);
}

function moodOf(said: string): "comedy" | "fantasy" | "adventure" | null {
  if (/ضحك|مضحك|كوميد|أرنب|باك/.test(said)) {
    return "comedy";
  }
  if (/خيال|فيلة|حلم/.test(said)) {
    return "fantasy";
  }
  if (/مغامر|سينتل|ثلج/.test(said)) {
    return "adventure";
  }
  return null;
}

function styleFor(mood: "comedy" | "fantasy" | "adventure" | null): string {
  switch (mood) {
    case "comedy":
      return "كوميديا";
    case "fantasy":
      return "خيال";
    case "adventure":
      return "مغامرة";
    case null:
      return "";
    default: {
      const unreachable: never = mood;
      return unreachable;
    }
  }
}

function indexPick(said: string, offeredIds: string[], library: Title[]): Title | null {
  const ids = offeredIds.length > 0 ? offeredIds : library.map((title) => title.id);
  let index = 0;
  if (/الثاني|2/.test(said)) {
    index = 1;
  } else if (/الثالث|3/.test(said)) {
    index = 2;
  }
  const id = ids[index];
  return library.find((title) => title.id === id) ?? null;
}
