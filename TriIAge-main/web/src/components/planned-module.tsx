type Props = {
  title: string;
  summary: string;
  items: string[];
  references: string;
  blocker?: string;
};

// Placeholder das áreas que ainda dependem de endpoints no microsserviço.
export function PlannedModule({ title, summary, items, references, blocker }: Props) {
  return (
    <section className="max-w-3xl">
      <div className="mb-2 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Planejado
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{summary}</p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">O que esta área vai fazer</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{references}</p>
      </div>

      {blocker && (
        <p className="mt-4 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          {blocker}
        </p>
      )}
    </section>
  );
}
