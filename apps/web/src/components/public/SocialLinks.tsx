import { useEffect, useState } from "react";
import { getShopStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TiktokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.4 2.3 1.9 3.8 4.2 3.9v3.1c-1.6 0-3-.5-4.2-1.3v6.1c0 3.4-2.6 6.2-6 6.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c.3 0 .7 0 1 .1v3.2c-.3-.1-.7-.2-1-.2-1.6 0-2.9 1.3-2.9 3s1.3 3 2.9 3c1.7 0 2.9-1.3 2.9-3.1V3h3.1z" />
    </svg>
  );
}

/**
 * Owner's TikTok + Facebook links (managed in Shop Controls → Social
 * links). Fetches shop status once; renders nothing until loaded or when
 * the owner hasn't set any link.
 */
export default function SocialLinks({
  className,
  iconClassName,
  label = "Follow the shop",
}: {
  className?: string;
  iconClassName?: string;
  label?: string;
}) {
  const [links, setLinks] = useState<{
    facebook_url: string | null;
    tiktok_url: string | null;
  } | null>(null);

  useEffect(() => {
    let dead = false;
    getShopStatus()
      .then((s) => {
        if (!dead)
          setLinks({ facebook_url: s.facebook_url, tiktok_url: s.tiktok_url });
      })
      .catch(() => {
        if (!dead) setLinks({ facebook_url: null, tiktok_url: null });
      });
    return () => {
      dead = true;
    };
  }, []);

  const items = links
    ? [
        links.facebook_url
          ? { href: links.facebook_url, label: "Facebook", Icon: FacebookIcon }
          : null,
        links.tiktok_url
          ? { href: links.tiktok_url, label: "TikTok", Icon: TiktokIcon }
          : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  if (items.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{label}</span>
      {items.map(({ href, label: name, Icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Kabarbers on ${name}`}
          title={`Kabarbers on ${name}`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg bg-cream-ink/10 text-cream-ink transition-colors hover:bg-brass/30 hover:text-brass-bright",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
