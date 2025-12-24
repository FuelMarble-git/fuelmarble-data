import fs from "fs";

const STORES = [
  "Birmingham","Bristol","Chester","Coventry","Derby","Edinburgh","Gateshead","Glasgow",
  "Haydock","Leeds","Leicester","Liverpool","Manchester","Oldham","Reading","Sheffield",
  "Southampton","Stevenage","Thurrock","Watford"
].map(slug => ({
  slug,
  url: `https://www.costco.co.uk/store-finder/${slug}`
}));

function pickPrice(text, reList) {
  for (const re of reList) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-GB",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  const items = [];
  const errors = [];

  for (const s of STORES) {
    try {
      await page.goto(s.url, { waitUntil: "networkidle", timeout: 60000 });

      const bodyText = await page.evaluate(() => document.body.innerText || "");
      const text = bodyText.replace(/\s+/g, " ").trim();

      const unleaded = pickPrice(text, [
        /Unleaded\s*Petrol[^0-9]*([0-9]{2,3}\.[0-9])/i,
      ]);

      const diesel = pickPrice(text, [
        /Premium\s*Diesel[^0-9]*([0-9]{2,3}\.[0-9])/i,
      ]);

      const premiumUnleaded = pickPrice(text, [
        /Premium\s*Unleaded\s*Petrol[^0-9]*([0-9]{2,3}\.[0-9])/i,
      ]);

      const pm = text.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i);
      const postcode = pm ? `${pm[1].toUpperCase()} ${pm[2].toUpperCase()}` : "";

      if (unleaded == null && diesel == null && premiumUnleaded == null) {
        errors.push({ store: s.slug, error: "No prices found in rendered text" });
        continue;
      }

      items.push({
        retailer: "Costco",
        site: `Costco ${s.slug}`,
        town: s.slug,
        postcode,
        prices: { unleaded, diesel, super: premiumUnleaded }
      });
    } catch (e) {
      errors.push({ store: s.slug, error: String(e.message || e) });
    }
  }

  await browser.close();

  const out = {
    updatedAt: new Date().toISOString(),
    items,
    errors
  };

  fs.writeFileSync("costco_fuel.json", JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote costco_fuel.json with ${items.length} stores, errors=${errors.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
