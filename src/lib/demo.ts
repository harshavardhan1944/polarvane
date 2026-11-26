import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Demo mode: a made-up brand ("Lumora Haircare") with sample, pre-labelled comments,
// so Polarvane can be shown without collecting or analyzing anything live.
// Everything is clearly marked as sample data and can be removed in one click.

export const DEMO_DASHBOARD = "Demo · Lumora Haircare (sample data)";
const PREFIX = "demo_lumora_";

type S = "positive" | "neutral" | "negative";
type F = "product" | "creator" | "both" | "other";
// [text, sentiment, focus, topics, likes, replies]
type C = [string, S, F, string[], number, number];

type DemoPost = {
  key: string;
  type: "post" | "reel" | "reddit";
  kind: "brand" | "collaboration" | "other";
  title: string;
  url: string;
  owner: string;
  caption: string;
  likes: number;
  views: number | null;
  daysAgo: number;
  comments: C[];
};

const POSTS: DemoPost[] = [
  {
    key: "bond_launch",
    type: "post",
    kind: "brand",
    title: "Demo: Bond Repair Shampoo launch",
    url: "https://www.instagram.com/p/demo-lumora-1/",
    owner: "lumora.haircare.demo",
    caption: "Meet Bond Repair Shampoo ✨ Made for frizzy, coloured and heat-styled hair. Now live on our website. (Sample post for the Polarvane demo.)",
    likes: 4820,
    views: null,
    daysAgo: 12,
    comments: [
      ["Finally a shampoo for coloured hair that doesn't strip it!", "positive", "product", ["colour protection", "bond repair shampoo"], 112, 2],
      ["Is it sulfate free?", "neutral", "product", ["ingredients"], 64, 0],
      ["Will this work on bleached hair that keeps breaking?", "neutral", "product", ["breakage", "bleached hair"], 58, 0],
      ["Used it for 2 weeks, frizz is so much better 😍", "positive", "product", ["frizz", "results"], 97, 1],
      ["Price?", "neutral", "product", ["price"], 41, 0],
      ["₹899 for 250ml is too much honestly", "negative", "product", ["price"], 73, 3],
      ["Smells amazing, like pears", "positive", "product", ["smell"], 35, 0],
      ["Is it safe for keratin treated hair?", "neutral", "product", ["keratin", "ingredients"], 47, 0],
      ["Where can I buy this in Bangalore? Not on Nykaa yet", "neutral", "product", ["availability"], 38, 0],
      ["My hair felt dry after the first wash, does it get better?", "negative", "product", ["dryness", "results"], 29, 0],
      ["Does it come in a bigger size?", "neutral", "product", ["size", "price"], 18, 0],
      ["Love the packaging 💜", "positive", "product", ["packaging"], 22, 0],
      ["Can men use it too?", "neutral", "product", ["suitability"], 15, 0],
      ["Is this tested on curly hair?", "neutral", "product", ["curly hair", "suitability"], 44, 0],
      ["Best shampoo I've tried this year, my colour lasted way longer", "positive", "product", ["colour protection", "results"], 81, 1],
      ["Does it need a conditioner after or is it 2 in 1?", "neutral", "product", ["routine"], 19, 0],
      ["Ordered! Hope it helps my split ends", "positive", "product", ["split ends"], 12, 0],
      ["Gave me an itchy scalp 😕", "negative", "product", ["scalp irritation"], 26, 2],
      ["How often should I use it?", "neutral", "product", ["routine"], 21, 0],
      ["Is it cruelty free?", "neutral", "product", ["ingredients", "ethics"], 33, 0],
      ["Frizz gone even in Mumbai humidity!!", "positive", "product", ["frizz", "humidity"], 66, 0],
      ["Any offer for first order?", "neutral", "product", ["price", "offers"], 17, 0],
      ["Does it have silicones?", "neutral", "product", ["ingredients"], 28, 0],
      ["My hairdresser recommended this, really good", "positive", "product", ["salon recommendation"], 24, 0],
      ["Too expensive for a shampoo, I'll wait for a sale", "negative", "product", ["price"], 31, 1],
      ["Lather is low compared to normal shampoo, is that normal?", "neutral", "product", ["lather"], 14, 0],
      ["Will it fade my red colour?", "neutral", "product", ["colour protection"], 39, 0],
      ["Shine is unreal after one use ✨", "positive", "product", ["shine", "results"], 45, 0],
      ["Available in Dubai?", "neutral", "product", ["availability"], 11, 0],
      ["Not worth the hype, my hair is still frizzy", "negative", "product", ["frizz", "results"], 20, 1],
      ["Can I use it daily?", "neutral", "product", ["routine"], 16, 0],
      ["Lumora never disappoints 💯", "positive", "product", ["brand love"], 30, 0],
      ["Is it pregnancy safe?", "neutral", "product", ["ingredients", "suitability"], 13, 0],
      ["🔥🔥", "positive", "other", [], 5, 0],
    ],
  },
  {
    key: "creator_reel",
    type: "reel",
    kind: "collaboration",
    title: "Demo: Creator Reel · my frizz routine",
    url: "https://www.instagram.com/reel/demo-lumora-2/",
    owner: "creator.demo",
    caption: "My 3-step frizz routine ft. Lumora Bond Repair 💜 #ad (Sample Reel for the Polarvane demo.)",
    likes: 21300,
    views: 402000,
    daysAgo: 8,
    comments: [
      ["You look so pretty 😍", "positive", "creator", ["appearance"], 210, 1],
      ["Your hair is goals!!", "positive", "creator", ["appearance"], 188, 0],
      ["Queen 👑", "positive", "creator", ["appearance"], 96, 0],
      ["Which shampoo is this? Link please", "neutral", "product", ["availability", "bond repair shampoo"], 140, 0],
      ["Did your frizz really go away or is it the blow dry?", "neutral", "both", ["frizz", "results"], 77, 2],
      ["Where is your top from?", "neutral", "creator", ["fashion"], 64, 0],
      ["Love your vibe ✨", "positive", "creator", ["appearance"], 52, 0],
      ["Is it good for oily scalp?", "neutral", "product", ["oily scalp", "suitability"], 49, 0],
      ["Paid promotion again 🙄", "negative", "creator", ["sponsorship"], 61, 3],
      ["Your skin is glowing, what's your skincare?", "neutral", "creator", ["beauty"], 58, 0],
      ["Price of the shampoo?", "neutral", "product", ["price"], 44, 0],
      ["I tried it after your last video, it actually works on frizz", "positive", "product", ["frizz", "results"], 83, 1],
      ["Please do a curly hair version!", "neutral", "both", ["curly hair"], 37, 0],
      ["Song name?", "neutral", "other", ["music"], 29, 0],
      ["Does it work on 3b curls?", "neutral", "product", ["curly hair", "suitability"], 33, 0],
      ["Your editing is so good", "positive", "creator", ["content"], 26, 0],
      ["Miss your old content", "negative", "creator", ["content"], 18, 0],
      ["Mine came with a broken pump 😕", "negative", "product", ["packaging"], 22, 1],
      ["Omg your hair colour 😍", "positive", "creator", ["appearance"], 47, 0],
      ["Can you show the full routine with heat protection?", "neutral", "both", ["routine", "heat styling"], 31, 0],
      ["Ordered after watching this", "positive", "product", ["purchase intent"], 39, 0],
      ["❤️❤️❤️", "positive", "other", [], 12, 0],
      ["Where do you live? Looks so pretty", "neutral", "creator", ["personal life"], 14, 0],
      ["Is it worth ₹899?", "neutral", "product", ["price"], 28, 0],
      ["Hi from Kerala 💕", "positive", "creator", ["personal life"], 9, 0],
      ["Your voice is so calming", "positive", "creator", ["content"], 21, 0],
      ["Does it smell strong?", "neutral", "product", ["smell"], 17, 0],
      ["Love you didi", "positive", "creator", ["personal life"], 15, 0],
      ["Is it available in Sri Lanka?", "neutral", "product", ["availability"], 10, 0],
      ["Pretty 😍", "positive", "creator", ["appearance"], 8, 0],
    ],
  },
  {
    key: "mask_post",
    type: "post",
    kind: "brand",
    title: "Demo: Color Shield Mask",
    url: "https://www.instagram.com/p/demo-lumora-3/",
    owner: "lumora.haircare.demo",
    caption: "Color Shield Mask: 5 minutes, once a week, for softer coloured hair. (Sample post for the Polarvane demo.)",
    likes: 2140,
    views: null,
    daysAgo: 5,
    comments: [
      ["My hair is breaking more since I started this mask 😞", "negative", "product", ["breakage", "color shield mask"], 52, 3],
      ["Soft hair after 1 use!!", "positive", "product", ["softness", "results"], 47, 0],
      ["Is it protein based? Protein makes my hair brittle", "neutral", "product", ["ingredients", "breakage"], 40, 0],
      ["Leaves my hair greasy at the roots", "negative", "product", ["greasy"], 29, 1],
      ["How long should I keep it on?", "neutral", "product", ["routine"], 25, 0],
      ["Use it with the shampoo, game changer", "positive", "product", ["routine", "results"], 31, 0],
      ["Same here, more hair fall after using it", "negative", "product", ["breakage", "hair fall"], 38, 1],
      ["Does it help with colour fading?", "neutral", "product", ["colour protection"], 22, 0],
      ["Jar is too small for the price", "negative", "product", ["price", "size"], 27, 0],
      ["Smells so good", "positive", "product", ["smell"], 14, 0],
      ["Can I leave it overnight?", "neutral", "product", ["routine"], 19, 0],
      ["Is it safe for henna treated hair?", "neutral", "product", ["suitability", "henna"], 16, 0],
      ["My stylist said avoid heavy masks on fine hair, is this light?", "neutral", "product", ["fine hair", "suitability"], 21, 0],
      ["Works better than my salon mask honestly", "positive", "product", ["results", "salon comparison"], 26, 0],
      ["Mine arrived leaking 😕", "negative", "product", ["packaging"], 12, 1],
      ["Will you launch a leave-in version?", "neutral", "product", ["new product request"], 18, 0],
      ["Not for me, too heavy", "negative", "product", ["greasy", "fine hair"], 11, 0],
      ["Love it 💜", "positive", "product", ["brand love"], 9, 0],
    ],
  },
  {
    key: "reddit_thread",
    type: "reddit",
    kind: "other",
    title: "Demo: Reddit · Is Lumora Bond Repair worth it?",
    url: "https://www.reddit.com/r/demo/comments/demolm1/",
    owner: "r/IndianHaircare (demo)",
    caption: "Is Lumora Bond Repair worth the price? Thinking of switching from my salon brand. (Sample thread for the Polarvane demo.)",
    likes: 312,
    views: null,
    daysAgo: 3,
    comments: [
      ["Used it for a month. Frizz better, but honestly not ₹899 better than cheaper options.", "neutral", "product", ["price", "frizz"], 88, 2],
      ["It's mostly marketing. Check the ingredient list, the bond repair part is low on the list.", "negative", "product", ["ingredients", "marketing claims"], 64, 3],
      ["Worked great on my bleached hair, way less snapping.", "positive", "product", ["breakage", "bleached hair"], 51, 1],
      ["The mask made my fine hair limp and greasy.", "negative", "product", ["greasy", "fine hair"], 37, 0],
      ["Does anyone know if it's actually sulfate free? The site doesn't say clearly.", "neutral", "product", ["ingredients"], 45, 0],
      ["Influencers are pushing it hard, makes me trust it less.", "negative", "both", ["sponsorship", "trust"], 42, 1],
      ["Got it on sale for 30% off, at that price it's worth it.", "positive", "product", ["price", "offers"], 29, 0],
      ["Smells nice but the scent fades fast.", "neutral", "product", ["smell"], 18, 0],
      ["My scalp got itchy after a week, stopped using it.", "negative", "product", ["scalp irritation"], 24, 1],
      ["Colour lasted noticeably longer for me, 6 weeks instead of 4.", "positive", "product", ["colour protection", "results"], 33, 0],
      ["Would love to see before/after photos from real users, not ads.", "neutral", "product", ["proof", "trust"], 39, 0],
      ["For curly hair it's too stripping IMO.", "negative", "product", ["curly hair", "dryness"], 21, 0],
    ],
  },
];

export async function demoLoaded(supabase: SupabaseClient) {
  const { count } = await supabase.from("analyses").select("id", { count: "exact", head: true }).like("shortcode", `${PREFIX}%`);
  return (count ?? 0) > 0;
}

export async function removeDemo(supabase: SupabaseClient) {
  // Comments are deleted with their posts (on delete cascade).
  const { error } = await supabase.from("analyses").delete().like("shortcode", `${PREFIX}%`);
  if (error) throw error;
  await supabase.from("dashboards").delete().eq("name", DEMO_DASHBOARD);
}

export async function loadDemo(supabase: SupabaseClient, userId: string): Promise<{ dashboardId: string | null; skippedReddit: boolean }> {
  await removeDemo(supabase);
  const { data: dash } = await supabase.from("dashboards").insert({ user_id: userId, name: DEMO_DASHBOARD }).select("id").single();
  const dashboardId = (dash?.id as string | undefined) ?? null;
  let skippedReddit = false;
  const now = Date.now();
  const day = 86_400_000;

  for (const p of POSTS) {
    const published = new Date(now - p.daysAgo * day).toISOString();
    const row: Record<string, unknown> = {
      user_id: userId,
      post_url: p.url,
      shortcode: `${PREFIX}${p.key}`,
      post_type: p.type,
      status: "completed",
      comment_limit: 200,
      comments_reported: p.comments.length,
      comments_collected: p.comments.length,
      comments_analyzed: p.comments.length,
      caption: p.caption,
      post_owner: p.owner,
      likes_count: p.likes,
      views_count: p.views,
      post_published_at: published,
      details_status: "done",
      post_kind: p.kind,
      title: p.title,
    };
    if (dashboardId) row.dashboard_id = dashboardId;
    const { data: a, error } = await supabase.from("analyses").insert(row).select("id").single();
    if (error) {
      // Reddit sample needs the Reddit database update; the rest of the demo still works without it.
      if (p.type === "reddit" && (error.code === "23514" || /post_type/i.test(error.message))) {
        skippedReddit = true;
        continue;
      }
      throw error;
    }
    const comments = p.comments.map(([text, sentiment, focus, topics, likes, replies], i) => ({
      analysis_id: a.id,
      user_id: userId,
      external_id: `${PREFIX}${p.key}_${i + 1}`,
      text,
      author_username: null,
      posted_at: new Date(new Date(published).getTime() + (i + 1) * 3_600_000).toISOString(),
      like_count: likes,
      reply_count: replies,
      sentiment,
      sentiment_confidence: 0.9,
      topics,
      focus,
      raw: { demo: true },
    }));
    const { error: cErr } = await supabase.from("comments").insert(comments);
    if (cErr) throw cErr;
  }
  return { dashboardId, skippedReddit };
}
