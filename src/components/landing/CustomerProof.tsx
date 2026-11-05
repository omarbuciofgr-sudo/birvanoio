import { customerStories, usageProof } from "@/data/websiteProof";

export function UsageProof() {
  if (!usageProof) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
      {customerStories.length > 0 && <div className="flex -space-x-2">{customerStories.slice(0, 5).map(story => <img key={story.name} src={story.photoUrl} alt={story.name} className="h-8 w-8 rounded-full border-2 border-background object-cover" loading="lazy" />)}</div>}
      <p><strong className="text-foreground">{usageProof.count.toLocaleString()}</strong> {usageProof.label} <span className="text-xs">as of {usageProof.asOf}</span></p>
    </div>
  );
}

export default function CustomerProof() {
  if (customerStories.length === 0) return null;
  return (
    <section className="py-20" aria-labelledby="customer-proof-title">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 id="customer-proof-title" className="mb-10 text-center font-display text-3xl font-bold text-foreground">From owners found to conversations started</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {customerStories.map(story => <figure key={`${story.name}-${story.market}`} className="rounded-lg border border-border bg-card p-6">
            <blockquote className="mb-6 text-foreground">“{story.quote}”</blockquote>
            <figcaption className="flex items-center gap-3"><img src={story.photoUrl} alt={story.name} className="h-12 w-12 rounded-full object-cover" loading="lazy" /><div><p className="font-medium text-foreground">{story.name}</p><p className="text-sm text-muted-foreground">{story.role}, {story.market}</p></div></figcaption>
          </figure>)}
        </div>
      </div>
    </section>
  );
}