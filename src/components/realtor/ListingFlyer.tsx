import { forwardRef } from "react";

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
};

/** Print-ready one-pager. Rendered at letter aspect ratio and scaled in the UI. */
export const ListingFlyer = forwardRef<HTMLDivElement, { data: FlyerData }>(function ListingFlyer(
  { data },
  ref,
) {
  const specs = [
    data.beds && `${data.beds} bed`,
    data.baths && `${data.baths} bath`,
    data.sqft && `${data.sqft} sqft`,
  ].filter(Boolean) as string[];

  return (
    <div
      ref={ref}
      data-flyer-root
      className="bg-background text-foreground w-[816px] h-[1056px] flex flex-col border border-border"
    >
      <div className="px-12 pt-12 pb-6">
        <p className="text-xs tracking-[0.35em] uppercase text-primary font-semibold">
          {data.headline || "Just Listed"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight break-words">
          {data.address || "Property address"}
        </h1>
        <div className="mt-4 flex items-end justify-between gap-6">
          <p className="text-3xl font-semibold text-primary">{data.price || "Price on request"}</p>
          {specs.length > 0 && (
            <p className="text-sm text-muted-foreground uppercase tracking-wide">{specs.join("  ·  ")}</p>
          )}
        </div>
      </div>

      <div className="px-12">
        <div className="h-[420px] w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt={data.address || "Property"} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground">Add a photo URL to feature the property</span>
          )}
        </div>
      </div>

      <div className="px-12 pt-8 flex-1 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          {data.description && (
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {data.description}
            </p>
          )}
          {data.highlights.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {data.highlights.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">◆</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          {data.openHouse && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Open house</p>
              <p className="text-sm font-medium mt-1">{data.openHouse}</p>
            </div>
          )}
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Presented by
            </p>
            <p className="text-base font-semibold mt-2">{data.agentName || "Your name"}</p>
            <p className="text-xs text-muted-foreground">{data.agentTitle}</p>
            <div className="mt-3 space-y-1 text-xs">
              {data.agentPhone && <p>{data.agentPhone}</p>}
              {data.agentEmail && <p className="break-all">{data.agentEmail}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-12 pb-10 pt-4">
        <div className="border-t border-border pt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Equal housing opportunity</span>
          <span>Information deemed reliable but not guaranteed</span>
        </div>
      </div>
    </div>
  );
});

export default ListingFlyer;
