import { cn } from "cn"

// Beyond's four dots: moss, ember, coral, blue. Always these four, in this order.
export function Dots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-grid shrink-0 grid-cols-2 gap-[3px]", className)}>
      <i className="size-2 rounded-full bg-moss" />
      <i className="size-2 rounded-full bg-ember" />
      <i className="size-2 rounded-full bg-coral" />
      <i className="size-2 rounded-full bg-blue" />
    </span>
  )
}

export function Wordmark({ short, className }: { short?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 font-display text-lg font-bold tracking-tight", className)}>
      <Dots />
      {short ? (
        <span>Music</span>
      ) : (
        <span>
          Beyond<sup className="text-[0.55em] font-semibold">™</sup> Music
        </span>
      )}
    </span>
  )
}
