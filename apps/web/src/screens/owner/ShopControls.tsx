import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  ListOrdered,
  Plus,
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
import { Switch } from "@/components/ui/switch";import {
  createAvailability,
  deleteAvailability,
  getServiceAvailability,
  getShopRules,
  getShopStatus,
  getSingletonService,
  toggleShopStatus,
  updateSingletonService,
  type Availability,
  type Service,
  type ShopRule,
} from "@/lib/api";
import { DAY_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";

function SectionIcon({ icon: Icon }: { icon: typeof Store }) {
  return (
    <span className="rounded-lg bg-accent/15 p-1.5 text-accent" aria-hidden="true">
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
        if (shopRes) setShopOpen(shopRes.is_open);
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
        checked ? "Shop is open — accepting new bookings." : "Shop is closed — bookings paused.",
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
      setNotice(`Slot length saved — ${mins} minutes per booking.`);
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
    if (!window.confirm("Remove these hours? Existing bookings are kept.")) return;
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
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight">Shop Controls</h1>
        <p className="text-sm text-muted-foreground">
          Status, service, hours, and house rules — everything clients see.
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
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CircleCheck aria-hidden="true" />
          <AlertDescription className="text-emerald-800">{notice}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="motion-reduce:animate-none">
              <CardContent className="animate-pulse py-5">
                <div className="mb-2 h-5 w-40 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
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
                      ? "Open — accepting new bookings"
                      : "Closed — bookings paused (existing bookings honored)"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    shopOpen
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600",
                  )}
                  role="status"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      shopOpen ? "bg-emerald-500" : "bg-slate-400",
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
                            setError("Duration must be between 5 and 240 minutes.");
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
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Slot length sets the booking grid. Lunch break 12:30–1:30 PM
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
                    <span className="w-24 shrink-0 text-xs font-medium">{name}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(grouped[idx] ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      ) : (
                        (grouped[idx] ?? []).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs tabular-nums"
                          >
                            {a.start_time}–{a.end_time}
                            <button
                              type="button"
                              onClick={() => void handleDeleteAvailability(a.id)}
                              disabled={deletingId === a.id}
                              aria-label={`Remove hours ${a.start_time} to ${a.end_time} on ${name}`}
                              className="rounded p-0.5 text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
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
                <Button type="submit" size="sm" disabled={savingAvail || !service}>
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
                <ol className="list-inside list-decimal space-y-1.5 text-sm text-slate-700">
                  {rules.map((rule) => (
                    <li key={rule.id}>{rule.text}</li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Rule editing needs a backend endpoint — out of scope for this
                pass. Ask your developer to add it next.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
