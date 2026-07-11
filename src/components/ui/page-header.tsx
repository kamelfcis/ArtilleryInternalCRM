interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // optional actions or breadcrumb slot
}

/** Standard page heading block. */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {children && <div className="mb-3">{children}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
