import { useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Image as ImageIcon,
  ListOrdered,
  Plus,
  QrCode,
  Scissors,
  Store,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createAvailability,
  deleteAvailability,
  getServiceAvailability,
  getShopRules,
  getShopStatus,
  getSingletonService,
  resetGcashQr,
  resetHeroImage,
  toggleShopStatus,
  updateShopPayment,
  updateSingletonService,
  uploadGcashQr,
  uploadHeroImage,
  type Availability,
  type Service,
  type ShopRule,
} from "@/lib/api";
import { DAY_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";
import GalleryManager from "@/components/owner/GalleryManager";
import SocialLinksManager from "@/components/owner/SocialLinksManager";
import { PROOF_ACCEPT, validateImageFile } from "@/lib/media";
import { DEFAULT_HERO_IMAGE } from "@/config/site";

function SectionIcon({ icon: Icon }: { icon: typeof Store }) {
  return (
    <span
      className="rounded-lg bg-accent-deep/10 p-1.5 text-accent-deep"
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function ShopControls() {
  const [service, setService] = useState<Service | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [rules, setRules] = useState<ShopRule[]>([]);
  const [shopOpen, setShopOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [togglingShop, setTogglingShop] = useState(false);
  const [duration, setDuration] = useState("30");
  const [savingService, setSavingService] = useState(false);

  const [availDay, setAvailDay] = useState("0");
  const [availStart, setAvailStart] = useState("09:00");
  const [availEnd, setAvailEnd] = useState("12:30");
  const [savingAvail, setSavingAvail] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hero appearance — uploaded file served by the API. Null means the
  // bundled default photo.
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  // GCash downpayment details shown at checkout (Book → success step).
  const [gcashNumber, setGcashNumber] = useState("09550996494");
  const [gcashName, setGcashName] = useState("MA**N D.");
  const [gcashQrUrl, setGcashQrUrl] = useState<string | null>(null);
  const [gcashFile, setGcashFile] = useState<File | null>(null);
  const [gcashPreview, setGcashPreview] = useState<string | null>(null);
  const [gcashBusy, setGcashBusy] = useState(false);
  const [savingGcash, setSavingGcash] = useState(false);
  const gcashInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [shopRes, svcRes, rulesRes] = await Promise.all([
          getShopStatus().catch(() => null),
          getSingletonService().catch(() => null),
          getShopRules().catch(() => [] as ShopRule[]),
        ]);
        if (cancelled) return;
        if (shopRes) {
          setShopOpen(shopRes.is_open);
          setHeroUrl(shopRes.hero_image_url);
          if (shopRes.gcash_number) setGcashNumber(shopRes.gcash_number);
          if (shopRes.gcash_account_name) setGcashName(shopRes.gcash_account_name);
          setGcashQrUrl(shopRes.gcash_qr_url ?? null);
        }
        if (svcRes) {
          setService(svcRes);
          setDuration(String(svcRes.duration_minutes));
          const avails = await getServiceAvailability(svcRes.id).catch(
            () => [] as Availability[],
          );
          if (!cancelled) setAvailabilities(avails);
        }
        setRules([...rulesRes].sort((a, b) => a.order - b.order));
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load controls");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleShopToggle(checked: boolean) {
    setShopOpen(checked);
    setTogglingShop(true);
    setError(null);
    setNotice(null);
    try {
      await toggleShopStatus(checked);
      setNotice(
        checked
          ? "Shop is open. Accepting new bookings."
          : "Shop is closed. Bookings paused.",
      );
    } catch (e: unknown) {
      setShopOpen(!checked);
      setError(e instanceof Error ? e.message : "Failed to update shop status");
    } finally {
      setTogglingShop(false);
    }
  }

  async function handleSaveDuration() {
    if (!service) return;
    const mins = parseInt(duration, 10);
    if (!mins || mins < 5 || mins > 240) {
      setError("Duration must be between 5 and 240 minutes.");
      return;
    }
    setSavingService(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSingletonService({
        name: service.name,
        duration_minutes: mins,
        description: service.description,
      });
      setService(updated);
      setNotice(`Slot length saved. ${mins} minutes per booking.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save duration");
    } finally {
      setSavingService(false);
    }
  }

  async function handleAddAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return;
    if (availEnd <= availStart) {
      setError("End time must be after start time.");
      return;
    }
    setSavingAvail(true);
    setError(null);
    setNotice(null);
    try {
      await createAvailability(service.id, {
        day_of_week: parseInt(availDay, 10),
        start_time: availStart,
        end_time: availEnd,
      });
      const avails = await getServiceAvailability(service.id);
      setAvailabilities(avails);
      setNotice("Hours added.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add hours");
    } finally {
      setSavingAvail(false);
    }
  }

  async function handleDeleteAvailability(id: string) {
    if (!service) return;
    if (!window.confirm("Remove these hours? Existing bookings are kept."))
      return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteAvailability(service.id, id);
      setAvailabilities((prev) => prev.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove hours");
    } finally {
      setDeletingId(null);
    }
  }

  const grouped: Record<number, Availability[]> = {};
  for (const a of availabilities) {
    if (!grouped[a.day_of_week]) grouped[a.day_of_week] = [];
    grouped[a.day_of_week].push(a);
  }

  return (
    <div className="mx-auto w-full space-y-4 p-4 md:p-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight">Shop Controls</h1>
        <p className="text-sm text-muted-foreground">
          Status, service, hours, and house rules. Everything clients see.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="border-moss/40 bg-moss/[0.08] text-espresso">
          <CircleCheck aria-hidden="true" />
          <AlertDescription className="text-moss">
            {notice}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="motion-reduce:animate-none">
              <CardContent className="animate-pulse py-5">
                <div className="mb-2 h-5 w-40 rounded bg-espresso/10" />
                <div className="h-3 w-full rounded bg-espresso/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card className="animate-enter-1">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <SectionIcon icon={Store} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Shop status</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {shopOpen
                      ? "Open. Accepting new bookings"
                      : "Closed. Bookings paused (existing bookings honored)"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    shopOpen
                      ? "bg-moss/15 text-moss"
                      : "bg-espresso/10 text-espresso/60",
                  )}
                  role="status"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      shopOpen ? "bg-moss" : "bg-espresso/40",
                    )}
                    aria-hidden="true"
                  />
                  {shopOpen ? "Open" : "Closed"}
                </span>
                <Switch
                  checked={shopOpen}
                  onCheckedChange={(c) => void handleShopToggle(c)}
                  disabled={togglingShop}
                  aria-label="Toggle shop open or closed"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-enter-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <SectionIcon icon={ImageIcon} />
              <div>
                <CardTitle className="text-sm">Appearance: hero image</CardTitle>
                <p className="text-xs font-normal text-muted-foreground">
                  The big photo on the public homepage.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={heroPreview ?? heroUrl ?? DEFAULT_HERO_IMAGE}
                  alt="Homepage hero preview"
                  className="h-36 w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.25";
                  }}
                />
              </div>
              <div>
                <Label htmlFor="hero-file" className="text-xs">
                  Upload a photo (JPG, PNG, or WEBP · max 5 MB)
                </Label>
                <Input
                  id="hero-file"
                  ref={heroInputRef}
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    if (heroPreview) URL.revokeObjectURL(heroPreview);
                    setHeroPreview(null);
                    setError(null);
                    if (!selected) {
                      setHeroFile(null);
                      return;
                    }
                    const problem = validateImageFile(selected);
                    if (problem) {
                      setHeroFile(null);
                      setError(problem);
                      return;
                    }
                    setHeroFile(selected);
                    setHeroPreview(URL.createObjectURL(selected));
                  }}
                  disabled={heroBusy}
                  className="mt-1 cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-espresso/10 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={heroBusy || !heroFile}
                  onClick={() => {
                    if (!heroFile) return;
                    setHeroBusy(true);
                    setError(null);
                    setNotice(null);
                    uploadHeroImage(heroFile)
                      .then((s) => {
                        setHeroUrl(s.hero_image_url);
                        if (heroPreview) URL.revokeObjectURL(heroPreview);
                        setHeroPreview(null);
                        setHeroFile(null);
                        if (heroInputRef.current)
                          heroInputRef.current.value = "";
                        setNotice("Hero photo updated — live for all visitors.");
                      })
                      .catch((err: unknown) => {
                        setError(
                          err instanceof Error ? err.message : "Upload failed",
                        );
                      })
                      .finally(() => setHeroBusy(false));
                  }}
                >
                  {heroBusy ? "Uploading…" : "Upload hero photo"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={heroBusy || !heroUrl}
                  onClick={() => {
                    setHeroBusy(true);
                    setError(null);
                    setNotice(null);
                    resetHeroImage()
                      .then((s) => {
                        setHeroUrl(s.hero_image_url);
                        setNotice("Hero photo reset to the bundled default.");
                      })
                      .catch((err: unknown) => {
                        setError(
                          err instanceof Error ? err.message : "Reset failed",
                        );
                      })
                      .finally(() => setHeroBusy(false));
                  }}
                >
                  Reset to default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uploads go live instantly for all visitors — no redeploy.
              </p>
            </CardContent>
          </Card>

          <Card className="animate-enter-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <SectionIcon icon={QrCode} />
              <div>
                <CardTitle className="text-sm">Payment: GCash</CardTitle>
                <p className="text-xs font-normal text-muted-foreground">
                  Shown to clients at checkout when payment is required.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="gcash-number" className="text-xs">
                    GCash number
                  </Label>
                  <Input
                    id="gcash-number"
                    value={gcashNumber}
                    onChange={(e) => setGcashNumber(e.target.value)}
                    placeholder="09550996494"
                    inputMode="numeric"
                    className="mt-1 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="gcash-name" className="text-xs">
                    Account name
                  </Label>
                  <Input
                    id="gcash-name"
                    value={gcashName}
                    onChange={(e) => setGcashName(e.target.value)}
                    placeholder="MA**N D."
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={savingGcash}
                onClick={() => {
                  setSavingGcash(true);
                  setError(null);
                  setNotice(null);
                  updateShopPayment({
                    gcash_number: gcashNumber,
                    gcash_account_name: gcashName,
                  })
                    .then((s) => {
                      if (s.gcash_number) setGcashNumber(s.gcash_number);
                      if (s.gcash_account_name) setGcashName(s.gcash_account_name);
                      setNotice("GCash details updated — live at checkout.");
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : "Save failed");
                    })
                    .finally(() => setSavingGcash(false));
                }}
              >
                {savingGcash ? "Saving…" : "Save GCash details"}
              </Button>

              <div className="overflow-hidden rounded-lg border">
                <img
                  src={gcashPreview ?? gcashQrUrl ?? undefined}
                  alt="GCash QR preview shown at checkout"
                  className="h-44 w-full object-contain bg-white"
                  loading="lazy"
                  style={{ display: gcashPreview || gcashQrUrl ? undefined : "none" }}
                  onError={(e) => {
                    e.currentTarget.style.opacity = "0.25";
                  }}
                />
                {!gcashPreview && !gcashQrUrl && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No QR uploaded yet — checkout shows the number with a Copy button.
                    Upload your GCash QR below (the blue InstaPay QR from your screenshot).
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="gcash-file" className="text-xs">
                  Upload QR photo (JPG, PNG, or WEBP · max 5 MB)
                </Label>
                <Input
                  id="gcash-file"
                  ref={gcashInputRef}
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    if (gcashPreview) URL.revokeObjectURL(gcashPreview);
                    setGcashPreview(null);
                    setError(null);
                    if (!selected) {
                      setGcashFile(null);
                      return;
                    }
                    const problem = validateImageFile(selected);
                    if (problem) {
                      setGcashFile(null);
                      setError(problem);
                      return;
                    }
                    setGcashFile(selected);
                    setGcashPreview(URL.createObjectURL(selected));
                  }}
                  disabled={gcashBusy}
                  className="mt-1 cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-espresso/10 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={gcashBusy || !gcashFile}
                  onClick={() => {
                    if (!gcashFile) return;
                    setGcashBusy(true);
                    setError(null);
                    setNotice(null);
                    uploadGcashQr(gcashFile)
                      .then((s) => {
                        setGcashQrUrl(s.gcash_qr_url ?? null);
                        if (gcashPreview) URL.revokeObjectURL(gcashPreview);
                        setGcashPreview(null);
                        setGcashFile(null);
                        if (gcashInputRef.current) gcashInputRef.current.value = "";
                        setNotice("GCash QR updated — live at checkout.");
                      })
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "Upload failed");
                      })
                      .finally(() => setGcashBusy(false));
                  }}
                >
                  {gcashBusy ? "Uploading…" : "Upload QR"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={gcashBusy || !gcashQrUrl}
                  onClick={() => {
                    setGcashBusy(true);
                    setError(null);
                    setNotice(null);
                    resetGcashQr()
                      .then((s) => {
                        setGcashQrUrl(s.gcash_qr_url ?? null);
                        setNotice("GCash QR removed — checkout shows number only.");
                      })
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "Reset failed");
                      })
                      .finally(() => setGcashBusy(false));
                  }}
                >
                  Remove QR
                </Button>
              </div>
            </CardContent>
          </Card>

          <GalleryManager />

          <SocialLinksManager />

          <Card className="animate-enter-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <SectionIcon icon={Scissors} />
              <CardTitle className="text-sm">Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {service ? (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-sm font-medium">{service.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {service.duration_minutes} min slots
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1">
                      <Label htmlFor="service-duration" className="text-xs">
                        Slot length (minutes)
                      </Label>
                      <Input
                        id="service-duration"
                        type="number"
                        min={5}
                        max={240}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        onBlur={() => {
                          const mins = parseInt(duration, 10);
                          if (duration && (!mins || mins < 5 || mins > 240))
                            setError(
                              "Duration must be between 5 and 240 minutes.",
                            );
                        }}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleSaveDuration()}
                      disabled={savingService}
                    >
                      {savingService ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Clock
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Slot length sets the booking grid. Lunch break 12:30-1:30 PM
                    is always blocked.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No service configured yet. It is created automatically on the
                  next server start.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="animate-enter-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <SectionIcon icon={Clock} />
              <div>
                <CardTitle className="text-sm">Weekly hours</CardTitle>
                <p className="text-xs font-normal text-muted-foreground">
                  Clients can only book inside these windows.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                {DAY_NAMES.map((name, idx) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-0"
                  >
                    <span className="w-24 shrink-0 text-xs font-medium">
                      {name}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(grouped[idx] ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Closed
                        </span>
                      ) : (
                        (grouped[idx] ?? []).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 rounded bg-espresso/[0.06] px-2 py-0.5 text-xs tabular-nums"
                          >
                            {a.start_time}-{a.end_time}
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteAvailability(a.id)
                              }
                              disabled={deletingId === a.id}
                              aria-label={`Remove hours ${a.start_time} to ${a.end_time} on ${name}`}
                              className="rounded p-0.5 text-oxblood transition-colors hover:bg-oxblood/10 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => void handleAddAvailability(e)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="avail-day" className="sr-only">
                    Day
                  </Label>
                  <Select value={availDay} onValueChange={setAvailDay}>
                    <SelectTrigger id="avail-day" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((n, i) => (
                        <SelectItem key={n} value={String(i)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="avail-start" className="sr-only">
                    Start time
                  </Label>
                  <Input
                    id="avail-start"
                    type="time"
                    value={availStart}
                    onChange={(e) => setAvailStart(e.target.value)}
                    aria-label="Start time"
                  />
                </div>
                <div>
                  <Label htmlFor="avail-end" className="sr-only">
                    End time
                  </Label>
                  <Input
                    id="avail-end"
                    type="time"
                    value={availEnd}
                    onChange={(e) => setAvailEnd(e.target.value)}
                    aria-label="End time"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingAvail || !service}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {savingAvail ? "Adding…" : "Add"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="animate-enter-3">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <SectionIcon icon={ListOrdered} />
              <div>
                <CardTitle className="text-sm">House rules</CardTitle>
                <p className="text-xs font-normal text-muted-foreground">
                  Shown to clients during booking.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rules configured yet.
                </p>
              ) : (
                <ol className="list-inside list-decimal space-y-1.5 text-sm text-espresso/75">
                  {rules.map((rule) => (
                    <li key={rule.id}>
                      <span className="font-semibold text-espresso">{rule.title}</span>:{" "}
                      {rule.text}
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Rule editing needs a backend endpoint. Out of scope for this
                pass. Ask your developer to add it next.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
