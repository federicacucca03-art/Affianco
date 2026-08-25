import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  titolo: string;
  href?: string;
};

export function IntestazioneSezione({ titolo, href = "#" }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-medium text-[var(--ink)]">{titolo}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
      >
        Vedi tutte
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}
