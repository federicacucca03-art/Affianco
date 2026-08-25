export function BannerHero() {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--accent)] px-6 py-12 sm:px-10 sm:py-14">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 280"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 180 C200 120 350 220 550 160 C750 100 900 200 1200 140 L1200 280 L0 280 Z"
          fill="rgba(255,255,255,0.1)"
        />
        <path
          d="M0 210 C250 150 400 240 600 190 C800 140 950 230 1200 180 L1200 280 L0 280 Z"
          fill="rgba(255,255,255,0.07)"
        />
        <path
          d="M0 40 C180 90 320 10 500 55 C680 100 820 20 1200 70 L1200 0 L0 0 Z"
          fill="rgba(255,255,255,0.06)"
        />
      </svg>

      <div className="relative mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">
          Da dove vuoi partire?
        </h1>
        <p className="mt-2 text-sm text-white/85 sm:text-base">
          Scegli il risultato che deve ottenere il cliente.
        </p>
      </div>
    </section>
  );
}
