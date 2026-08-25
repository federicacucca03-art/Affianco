type Props = {
  titolo: string;
  children: React.ReactNode;
  className?: string;
};

export function MockBrowser({ titolo, children, className = "" }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_20px_50px_rgba(26,26,26,0.08)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[#f7f8fa] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
        <span className="ml-2 truncate rounded-md bg-white px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
          {titolo}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
