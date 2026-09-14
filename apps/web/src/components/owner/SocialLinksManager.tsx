import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getShopStatus, updateShopSocials } from "@/lib/api";

function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  return v === "" || /^https?:\/\/.+\..+/.test(v);
}

/**
 * Owner editor for the TikTok + Facebook links shown in the footer and
 * on the landing page. Blank clears a link. Live instantly, no redeploy.
 */
export default function SocialLinksManager() {
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    getShopStatus()
      .then((s) => {
        if (dead) return;
        setFacebook(s.facebook_url ?? "");
        setTiktok(s.tiktok_url ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (!dead) setLoaded(true);
      });
    return () => {
      dead = true;
    };
  }, []);

  const fbBad = loaded && !looksLikeUrl(facebook);
  const ttBad = loaded && !looksLikeUrl(tiktok);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (fbBad || ttBad || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateShopSocials({
        facebook_url: facebook.trim(),
        tiktok_url: tiktok.trim(),
      });
      setFacebook(updated.facebook_url ?? "");
      setTiktok(updated.tiktok_url ?? "");
      setNotice("Social links updated — live for all visitors.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="animate-enter-2">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <span
          className="rounded-lg bg-accent-deep/10 p-1.5 text-accent-deep"
          aria-hidden="true"
        >
          <AtSign className="h-4 w-4" />
        </span>
        <div>
          <CardTitle className="text-sm">Social links</CardTitle>
          <p className="text-xs font-normal text-muted-foreground">
            TikTok + Facebook icons in the footer and on the homepage.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-xs text-moss">
              {notice}
            </p>
          )}
          <div>
            <Label htmlFor="social-facebook" className="text-xs">
              Facebook URL
            </Label>
            <Input
              id="social-facebook"
              type="url"
              inputMode="url"
              placeholder="https://facebook.com/kabarbers"
              value={facebook}
              onChange={(e) => {
                setFacebook(e.target.value);
                setNotice(null);
              }}
              disabled={saving}
              aria-invalid={fbBad}
              className="mt-1 font-mono text-xs"
            />
            {fbBad && (
              <p className="mt-1 text-xs text-destructive">
                Must be a full http(s) URL, or blank to hide the icon.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="social-tiktok" className="text-xs">
              TikTok URL
            </Label>
            <Input
              id="social-tiktok"
              type="url"
              inputMode="url"
              placeholder="https://tiktok.com/@kabarbers"
              value={tiktok}
              onChange={(e) => {
                setTiktok(e.target.value);
                setNotice(null);
              }}
              disabled={saving}
              aria-invalid={ttBad}
              className="mt-1 font-mono text-xs"
            />
            {ttBad && (
              <p className="mt-1 text-xs text-destructive">
                Must be a full http(s) URL, or blank to hide the icon.
              </p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={saving || fbBad || ttBad}>
            {saving ? "Saving…" : "Save social links"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Leave a field blank to hide its icon. Changes go live instantly
            for all visitors.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
