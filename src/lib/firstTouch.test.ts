import { expect, test } from "bun:test";
import { buildFirstTouch } from "./firstTouch";
test("captures utm and external referrer, blanks same-site referrer", () => {
  const a = buildFirstTouch("https://brivano.io/who-we-help/agents?utm_source=ig&utm_campaign=c1", "https://instagram.com/x");
  expect(a.utm_source).toBe("ig"); expect(a.utm_campaign).toBe("c1"); expect(a.referrer).toBe("https://instagram.com/x"); expect(a.landing_path).toBe("/who-we-help/agents");
  expect(buildFirstTouch("https://brivano.io/", "https://brivano.io/pricing").referrer).toBe("");
});
