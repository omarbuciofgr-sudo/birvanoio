import { jsPDF } from "jspdf";

export type Comparable = {
  address: string; price: number | null; bedrooms: number | null; bathrooms: number | null;
  square_footage?: number | null; distance: number | null;
};

export type MarketReportData = {
  address: string;
  cityLine: string;
  rental: boolean;
  asking: number | null;
  estimate: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  photo: string | null; // data URL
  comparables: Comparable[];
  summary: string;
  agent: { name: string; brokerage: string; phone: string; email: string; photo: string | null };
};

const money = (n?: number | null, rental = false) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}${rental ? "/mo" : ""}`;

/** Fetch an image and return a data URL, or null if it can't be loaded (e.g. blocked by the host). */
export async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imgFormat(dataUrl: string) {
  return dataUrl.startsWith("data:image/png") ? "PNG" : dataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
}

/** One-page, US Letter market report. */
export function buildMarketReportPdf(d: MarketReportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const ink: [number, number, number] = [23, 23, 23];
  const muted: [number, number, number] = [110, 110, 115];
  const accent: [number, number, number] = [37, 99, 235];
  const line: [number, number, number] = [225, 225, 230];

  // Header band
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...accent);
  doc.text(d.rental ? "RENTAL MARKET REPORT" : "HOME VALUE REPORT", M, 34);
  doc.setFont("helvetica", "normal").setTextColor(...muted);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), W - M, 34, { align: "right" });

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...ink);
  const addrLines = doc.splitTextToSize(d.address, W - 2 * M);
  doc.text(addrLines.slice(0, 2), M, 60);
  let y = 60 + (Math.min(addrLines.length, 2) - 1) * 22;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...muted);
  doc.text(d.cityLine, M, y + 16);
  y += 32;

  // Photo + estimate
  const photoW = 250, photoH = 165;
  if (d.photo) {
    try { doc.addImage(d.photo, imgFormat(d.photo), M, y, photoW, photoH, undefined, "FAST"); }
    catch { d.photo = null; }
  }
  if (!d.photo) {
    doc.setFillColor(244, 244, 246).rect(M, y, photoW, photoH, "F");
    doc.setFontSize(9).setTextColor(...muted).text("No photo available", M + photoW / 2, y + photoH / 2, { align: "center" });
  }
  const bx = M + photoW + 20, bw = W - M - bx;
  doc.setDrawColor(...line).setLineWidth(1).roundedRect(bx, y, bw, photoH, 6, 6, "S");
  doc.setFontSize(9).setTextColor(...muted).text(d.rental ? "Estimated market rent" : "Estimated market value", bx + 16, y + 26);
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...ink).text(money(d.estimate, d.rental), bx + 16, y + 58);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  if (d.rangeLow && d.rangeHigh) doc.text(`Range ${money(d.rangeLow, d.rental)} to ${money(d.rangeHigh, d.rental)}`, bx + 16, y + 76);
  doc.setDrawColor(...line).line(bx + 16, y + 92, bx + bw - 16, y + 92);
  doc.text("Asking price", bx + 16, y + 112);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ink).text(money(d.asking, d.rental), bx + bw - 16, y + 112, { align: "right" });
  const facts = [d.beds != null ? `${d.beds} bd` : null, d.baths != null ? `${d.baths} ba` : null, d.sqft ? `${d.sqft.toLocaleString("en-US")} sqft` : null].filter(Boolean).join("  ·  ");
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  if (facts) doc.text(facts, bx + 16, y + 140);
  y += photoH + 28;

  // Summary
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ink).text("Summary", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink);
  const sum = doc.splitTextToSize(d.summary.trim() || "—", W - 2 * M).slice(0, 12);
  doc.text(sum, M, y, { lineHeightFactor: 1.4 });
  y += sum.length * 14 + 18;

  // Comparables
  doc.setFont("helvetica", "bold").setFontSize(12).text("Comparable nearby properties", M, y);
  y += 16;
  const cols = [M, M + 280, M + 370, M + 440];
  doc.setFontSize(8).setTextColor(...muted);
  ["ADDRESS", d.rental ? "RENT" : "PRICE", "BEDS / BATHS", "DISTANCE"].forEach((h, i) => doc.text(h, cols[i], y));
  y += 6;
  doc.setDrawColor(...line).line(M, y, W - M, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ink);
  const comps = d.comparables.slice(0, 5);
  if (!comps.length) {
    y += 16;
    doc.setTextColor(...muted).text("No comparable properties were available for this address.", M, y);
  }
  for (const c of comps) {
    y += 17;
    doc.text(doc.splitTextToSize(c.address, 270)[0], cols[0], y);
    doc.text(money(c.price, d.rental), cols[1], y);
    doc.text(`${c.bedrooms ?? "—"} / ${c.bathrooms ?? "—"}`, cols[2], y);
    doc.text(c.distance != null ? `${c.distance.toFixed(2)} mi` : "—", cols[3], y);
    doc.setDrawColor(240, 240, 243).line(M, y + 6, W - M, y + 6);
  }

  // Agent footer
  const H = doc.internal.pageSize.getHeight();
  const fy = H - 110;
  doc.setDrawColor(...line).line(M, fy - 14, W - M, fy - 14);
  let tx = M;
  if (d.agent.photo) {
    try { doc.addImage(d.agent.photo, imgFormat(d.agent.photo), M, fy, 64, 64, undefined, "FAST"); tx = M + 80; } catch { /* skip */ }
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ink).text(d.agent.name || "Your agent", tx, fy + 16);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...muted);
  if (d.agent.brokerage) doc.text(d.agent.brokerage, tx, fy + 32);
  doc.setTextColor(...ink).text([d.agent.phone, d.agent.email].filter(Boolean).join("   |   "), tx, fy + 50);
  doc.setFontSize(7).setTextColor(...muted).text(
    "Estimates and comparables come from third-party data and are not an appraisal. Actual value or rent may differ.",
    M, H - 26,
  );
  return doc;
}
