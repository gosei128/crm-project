import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACCENTS: Record<string, string> = {
  default: "text-foreground",
  amber: "text-bronze",
  blue: "text-oxblood",
  emerald: "text-moss",
  rose: "text-oxblood",
  bronze: "text-bronze",
  moss: "text-moss",
  oxblood: "text-oxblood",
};

export default function StatCard({
  label,
  value,
  sub,
  accent = "default",
  loading = false,
  onClick,
  actionHint,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof ACCENTS | string;
  loading?: boolean;
  onClick?: () => void;
  actionHint?: string;
}) {
  const clickable = typeof onClick === "function";
  return (
    <Card
      className={cn(
        "transition-colors duration-200",
        clickable && "hover:border-accent/50 active:scale-[0.98]",
      )}
    >
      <CardContent
        className={cn("py-4", clickable && "cursor-pointer")}
        onClick={onClick}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={
          clickable
            ? `${label}: ${value}. ${actionHint ?? "View details"}`
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-1.5 h-8 w-16 motion-reduce:animate-none" />
            ) : (
              <p
                className={cn(
                  "mt-0.5 truncate text-4xl font-bold tabular-nums",
                  ACCENTS[accent] ?? ACCENTS.default,
                )}
              >
                {value}
              </p>
            )}
            {sub && !loading && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {sub}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
