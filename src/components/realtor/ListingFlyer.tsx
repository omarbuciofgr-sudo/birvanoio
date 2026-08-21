import { forwardRef } from "react";
import { DEFAULT_TEMPLATE_ID, getTemplate, applyBranding, type FlyerTheme } from "./flyerTemplates";

export type FlyerData = {
  headline: string;
  address: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  description: string;
  highlights: string[];
  photoUrl: string;
  openHouse: string;
  agentName: string;
  agentTitle: string;
  agentPhone: string;
  agentEmail: string;
  /** Branding */
  templateId: string;
  logoUrl: string;
  brandName: string;
  accentColor: string;
  headingFont: string;
};

export const emptyFlyer: FlyerData = {
  headline: "Just Listed",
  address: "",
  price: "",
  beds: "",
  baths: "",
  sqft: "",
  description: "",
  highlights: [],
  photoUrl: "",
  openHouse: "",
  agentName: "",
  agentTitle: "Real Estate Agent",
  agentPhone: "",
  agentEmail: "",
  templateId: DEFAULT_TEMPLATE_ID,
  logoUrl: "",
  brandName: "",
  accentColor: "",
  headingFont: "",
};

function BrandBar({ data, theme }: { data: FlyerData; theme: FlyerTheme }) {
  if (!data.logoUrl && !data.brandName) return null;
  return (
    <div className="flex items-center gap-3">
      {data.logoUrl && (
        <img src={data.logoUrl} alt={data.brandName || "Brand logo"} className="h-10 w-auto object-contain" />
      )}
      {data.brandName && (
        <span
          className="text-sm font-semibold uppercase"
          style={{ letterSpacing: "0.18em", fontFamily: theme.headingFont }}
        >
          {data.brandName}
        </span>
      )}
    </div>
  );
}

/** Print-ready one-pager. Rendered at letter aspect ratio and scaled in the UI. */
export const ListingFlyer = forwardRef<HTMLDivElement, { data: FlyerData }>(function ListingFlyer(
  { data },
  ref,
) {
  const theme = applyBranding(getTemplate(data.templateId), {
    accent: data.accentColor,
    headingFont: data.headingFont,
  });

  const specs = [
    data.beds && `${data.beds} bed`,
    data.baths && `${data.baths} bath`,
    data.sqft && `${data.sqft} sqft`,
  ].filter(Boolean) as string[];

  const eyebrow = (
    <p
      className="text-xs uppercase font-semibold"
      style={{ letterSpacing: theme.eyebrowTracking, color: theme.accent }}
    >
      {data.headline || "Just Listed"}
    </p>
  );

  const title = (
    <h1
      className="mt-3 text-4xl leading-tight break-words"
      style={{ fontFamily: theme.headingFont, fontWeight: 600 }}
    >
      {data.address || "Property address"}
    </h1>
  );

  const priceRow = (
    <div className="mt-4 flex items-end justify-between gap-6">
      <p className="text-3xl font-semibold" style={{ color: theme.accent, fontFamily: theme.headingFont }}>
        {data.price || "Price on request"}
      </p>
      {specs.length > 0 && (
        <p className="text-sm uppercase tracking-wide" style={{ color: theme.muted }}>
          {specs.join("  ·  ")}
        </p>
      )}
    </div>
  );

  const photo = (
    <div
      className="h-[420px] w-full overflow-hidden flex items-center justify-center"
      style={{ background: theme.surface, borderRadius: theme.radius }}
    >
      {data.photoUrl ? (
        <img src={data.photoUrl} alt={data.address || "Property"} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm" style={{ color: theme.muted }}>
          Add a photo URL to feature the property
        </span>
      )}
    </div>
  );

  const header =
    theme.layout === "banner" ? (
      <div className="px-12 pt-10 pb-8" style={{ background: theme.accent, color: theme.accentFg }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase font-semibold" style={{ letterSpacing: theme.eyebrowTracking }}>
              {data.headline || "Just Listed"}
            </p>
            <h1
              className="mt-3 text-4xl leading-tight break-words"
              style={{ fontFamily: theme.headingFont, fontWeight: 700 }}
            >
              {data.address || "Property address"}
            </h1>
            <div className="mt-4 flex items-center gap-5">
              <p className="text-3xl font-semibold" style={{ fontFamily: theme.headingFont }}>
                {data.price || "Price on request"}
              </p>
              {specs.length > 0 && <p className="text-sm uppercase tracking-wide">{specs.join("  ·  ")}</p>}
            </div>
          </div>
          <BrandBar data={data} theme={theme} />
        </div>
      </div>
    ) : theme.layout === "split" ? (
      <div className="px-12 pt-12 pb-6">
        <BrandBar data={data} theme={theme} />
        <div className="mt-6 grid grid-cols-[1.4fr_1fr] gap-8 items-end">
          <div>
            {eyebrow}
            {title}
          </div>
          <div
            className="p-5"
            style={{ background: theme.surface, borderRadius: theme.radius, border: `1px solid ${theme.border}` }}
          >
            <p className="text-2xl font-semibold" style={{ color: theme.accent, fontFamily: theme.headingFont }}>
              {data.price || "Price on request"}
            </p>
            {specs.length > 0 && (
              <p className="mt-1 text-xs uppercase tracking-wide" style={{ color: theme.muted }}>
                {specs.join("  ·  ")}
              </p>
            )}
          </div>
        </div>
      </div>
    ) : (
      <div className="px-12 pt-12 pb-6">
        <BrandBar data={data} theme={theme} />
        <div className={data.logoUrl || data.brandName ? "mt-6" : ""}>
          {eyebrow}
          {title}
          {priceRow}
        </div>
      </div>
    );

  return (
    <div
      ref={ref}
      data-flyer-root
      className="w-[816px] h-[1056px] flex flex-col"
      style={{
        background: theme.bg,
        color: theme.fg,
        fontFamily: theme.bodyFont,
        border: `1px solid ${theme.border}`,
      }}
    >
      {header}

      <div className={theme.layout === "banner" ? "px-12 pt-8" : "px-12"}>{photo}</div>

      <div className="px-12 pt-8 flex-1 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          {data.description && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: theme.muted }}>
              {data.description}
            </p>
          )}
          {data.highlights.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {data.highlights.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: theme.accent }}>◆</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          {data.openHouse && (
            <div
              className="p-4"
              style={{
                borderRadius: theme.radius,
                border: `1px solid ${theme.accent}66`,
                background: `${theme.accent}12`,
              }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: theme.accent }}>
                Open house
              </p>
              <p className="text-sm font-medium mt-1">{data.openHouse}</p>
            </div>
          )}
          <div className="p-4" style={{ background: theme.surface, borderRadius: theme.radius }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: theme.muted }}>
              Presented by
            </p>
            <p className="text-base font-semibold mt-2" style={{ fontFamily: theme.headingFont }}>
              {data.agentName || "Your name"}
            </p>
            <p className="text-xs" style={{ color: theme.muted }}>
              {data.agentTitle}
            </p>
            <div className="mt-3 space-y-1 text-xs">
              {data.agentPhone && <p>{data.agentPhone}</p>}
              {data.agentEmail && <p className="break-all">{data.agentEmail}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-12 pb-10 pt-4">
        <div
          className="pt-4 flex items-center justify-between text-[10px] uppercase tracking-widest"
          style={{ borderTop: `1px solid ${theme.border}`, color: theme.muted }}
        >
          <span>Equal housing opportunity</span>
          <span>Information deemed reliable but not guaranteed</span>
        </div>
      </div>
    </div>
  );
});

export default ListingFlyer;
