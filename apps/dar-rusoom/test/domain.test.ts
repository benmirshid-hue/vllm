import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assist,
  prerollFor,
  assessSubmission,
  canCheckout,
  canComment,
  canFollow,
  creatorAdEarnings,
  initialState,
  merchantEarnings,
  profileById,
  reduce,
  splitSale,
  visibleTitles,
  hearArabic,
  mouthCues,
  assembleEpisode,
  episodeTitle,
  guardianCanPay,
  basketFitsChild,
} from "../src/domain.ts";
import { seedSeries } from "../src/data.ts";

function adEarningsCheck(): number {
  return creatorAdEarnings(
    [
      {
        id: "1",
        adId: "bag",
        creatorId: "noor-studio",
        profileId: "layan",
        at: 1,
        skipped: false,
      },
      {
        id: "2",
        adId: "bag",
        creatorId: "noor-studio",
        profileId: "layan",
        at: 2,
        skipped: true,
      },
    ],
    "noor-studio",
    0.55,
  );
}

test("the assistant offers a fit and opens it only after the viewer accepts", () => {
  const layan = profileById("layan");
  const first = assist(layan, "شيء مضحك", []);
  assert.equal(first.openId, null);
  assert.deepEqual(first.offerIds, ["bunny"]);
  assert.equal(first.say.includes("مرحبا"), false);
  const second = assist(layan, "شغّله", first.offerIds);
  assert.equal(second.openId, "bunny");
  const child = assist(profileById("mishaal"), "سينتل", []);
  assert.equal(child.openId, null);
  assert.equal(child.say.includes("فوق عمر"), true);
});

test("guardians still see kids ads they can buy", () => {
  assert.equal(prerollFor(profileById("layan"))?.id, "bag");
  assert.equal(prerollFor(profileById("mishaal"))?.id, "bag");
});

test("child library stays inside the age rating", () => {
  const titles = visibleTitles(profileById("mishaal")).map((title) => title.id);
  assert.deepEqual(titles, ["bunny"]);
});

test("live action is rejected and cannot be approved later", () => {
  const result = assessSubmission({
    title: "مباراة",
    medium: "live-action",
    rights: true,
    rating: 7,
    notes: "",
  });
  assert.equal(result.decision, "reject");
  let state = initialState();
  state = reduce(state, {
    type: "submit",
    submission: { title: "مباراة", medium: "live-action", rights: true, rating: 7, notes: "" },
  });
  const id = state.queue[0]?.id;
  assert.ok(id);
  state = reduce(state, { type: "resolve", id, decision: "approve" });
  assert.equal(state.queue[0]?.decision, "reject");
});

test("animation with rights is approved and a hybrid waits", () => {
  assert.equal(
    assessSubmission({ title: "غيمة", medium: "animation", rights: true, rating: 3, notes: "" })
      .decision,
    "approve",
  );
  assert.equal(
    assessSubmission({ title: "خلف", medium: "hybrid", rights: true, rating: 7, notes: "" })
      .decision,
    "review",
  );
  assert.equal(
    assessSubmission({ title: "بلا حقوق", medium: "anime", rights: false, rating: 7, notes: "" })
      .decision,
    "reject",
  );
});

test("money split and ad share ignore skipped ads", () => {
  assert.deepEqual(splitSale(120, 2, 0.12), { gross: 240, platform: 28.8, merchant: 211.2 });
  assert.equal(adEarningsCheck(), 0.01);
});

test("child comments and follows stay inside the family gate", () => {
  const child = profileById("mishaal");
  assert.equal(canComment(child, "حلو").ok, false);
  assert.equal(canFollow(child, profileById("layan")), true);
  assert.equal(canFollow(child, profileById("fahad")), false);
  assert.equal(canFollow(profileById("fahad"), child), false);
  assert.equal(canCheckout(child), false);
  assert.equal(canCheckout(profileById("layan")), true);
});

test("guardian checkout pays the merchant net and clears the cart", () => {
  let state = initialState();
  state = reduce(state, { type: "addCart", productId: "backpack" });
  state = reduce(state, { type: "checkout" });
  assert.deepEqual(state.cart, {});
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0]?.provider, "ledger");
  const earned = merchantEarnings(state.orders, "noor");
  assert.equal(earned.gross, 189);
  assert.equal(earned.platform, 22.68);
  assert.equal(earned.merchant, 166.32);
});

test("arabic hearing folds the same word into the offer", () => {
  const heard = hearArabic("أَرْنَبٌ");
  assert.equal(heard, "ارنب");
  const offer = assist(profileById("layan"), "أَرْنَب", []);
  assert.equal(offer.openId, null);
  assert.ok(offer.offerIds.includes("bunny"));
});

test("each cast keeps a distinct pitch and the mouth follows the line", () => {
  const series = seedSeries[0];
  assert.ok(series);
  const pitches = series.cast.map((member) => member.pitch);
  assert.equal(new Set(pitches).size, pitches.length);
  assert.deepEqual(mouthCues("ميرال"), ["closed", "closed", "open", "round", "open"]);
});

test("any series stitches its own faces and rejects a stranger", () => {
  const series = seedSeries[0];
  assert.ok(series);
  const locked = series.cast.map((member) => member.id);
  const cut = assembleEpisode(1, series.shots, locked);
  assert.equal(cut.ok, true);
  if (cut.ok) {
    assert.equal(cut.seconds, 360);
  }
  const title = episodeTitle(series, 1);
  assert.equal(title?.id, "haras-1");
  const broken = assembleEpisode(1, [{ id: "x", episode: 1, seconds: 90, faceIds: ["guest"] }], locked);
  assert.equal(broken.ok, false);
});

test("a second series is built, locked, and published with the same tools", () => {
  let state = reduce(initialState(), { type: "createSeries", name: "غيمة", rating: 3 });
  const created = state.series.find((series) => series.name === "غيمة");
  assert.ok(created);
  assert.equal(created.creatorId, "studio");
  state = reduce(state, {
    type: "addCast",
    seriesId: created.id,
    name: "سما",
    detail: "8 سنوات",
    line: "سما تطير.",
  });
  state = reduce(state, {
    type: "addCast",
    seriesId: created.id,
    name: "قمر",
    detail: "10 سنوات",
    line: "قمر ينير.",
  });
  const cast = state.series.find((series) => series.id === created.id)?.cast ?? [];
  assert.equal(cast.length, 2);
  assert.notEqual(cast[0]?.pitch, cast[1]?.pitch);
  const first = cast[0];
  const second = cast[1];
  assert.ok(first && second);
  state = reduce(state, {
    type: "addShot",
    seriesId: created.id,
    episode: 1,
    speakerId: first.id,
    line: "سما تطير.",
    faceIds: [first.id, "ghost"],
  });
  assert.equal(state.series.find((series) => series.id === created.id)?.shots.length, 0);
  state = reduce(state, {
    type: "addShot",
    seriesId: created.id,
    episode: 1,
    speakerId: first.id,
    line: "سما تطير.",
    faceIds: [first.id, second.id],
  });
  assert.equal(state.series.find((series) => series.id === created.id)?.shots.length, 1);
  state = reduce(state, { type: "release", seriesId: created.id, episode: 1 });
  const library = visibleTitles(profileById("mishaal"), state.catalog);
  assert.ok(library.some((title) => title.name.startsWith("غيمة")));
  const offer = assist(profileById("mishaal"), "غيمة", [], state.catalog);
  assert.equal(offer.offerIds[0], `${created.id}-1`);
});

test("a guardian pays for the child when the goods fit that age", () => {
  const layan = profileById("layan");
  const child = profileById("mishaal");
  assert.equal(guardianCanPay(layan, child), true);
  assert.equal(guardianCanPay(profileById("nora"), child), false);
  assert.equal(basketFitsChild(child, ["coat"]), true);
  assert.equal(basketFitsChild(child, ["notebooks"]), false);
  let state = reduce(initialState(), { type: "addCart", productId: "notebooks" });
  state = reduce(state, { type: "checkout", forProfileId: "mishaal" });
  assert.equal(state.orders.length, 0);
  state = reduce(initialState(), { type: "addCart", productId: "coat" });
  state = reduce(state, { type: "checkout", forProfileId: "mishaal" });
  assert.equal(state.orders[0]?.forProfileId, "mishaal");
  assert.equal(state.orders[0]?.profileId, "layan");
});

test("enterprise payments label the order as Moyasar without charging a card", () => {
  let state = reduce(initialState(), { type: "layer", key: "payments", mode: "enterprise" });
  state = reduce(state, { type: "profile", id: "mishaal" });
  state = reduce(state, { type: "addCart", productId: "pencils" });
  state = reduce(state, { type: "checkout" });
  assert.equal(state.orders.length, 0);
  state = reduce(state, { type: "profile", id: "layan" });
  state = reduce(state, { type: "checkout" });
  assert.equal(state.orders[0]?.provider, "moyasar");
});
