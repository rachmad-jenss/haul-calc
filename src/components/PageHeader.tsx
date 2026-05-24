import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-medium text-strong">{title}</h1>
        {description ? (
          <p className="text-md text-subtle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
