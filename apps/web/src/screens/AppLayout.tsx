import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Logo from "../../src/assets/images/kabarbers-logo.jpg";
import {
  CalendarCheckIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { getShopStatus, ownerListBookings } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboardIcon;
  badge?: number;
  badgeLabel?: string;
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bookings": "Bookings",
  "/controls": "Shop Controls",
};

function OwnerNavButton({ item, active }: { item: NavItem; active: boolean }) {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();

  function handleClick() {
    if (isMobile) setOpenMobile(false);
    navigate(item.url);
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        aria-current={active ? "page" : undefined}
        tooltip={item.title}
        onClick={handleClick}
        className="h-10 active:scale-[0.98] md:h-8"
      >
        <item.icon aria-hidden="true" />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {typeof item.badge === "number" && item.badge > 0 && (
        <SidebarMenuBadge>
          {item.badge}
          <span className="sr-only">{item.badgeLabel ?? "pending items"}</span>
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function OwnerSidebar({
  overviewNav,
  manageNav,
}: {
  overviewNav: NavItem[];
  manageNav: NavItem[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { logout } = useAuth();

  function handleLogout() {
    if (!window.confirm("Log out of the owner workspace?")) return;
    if (isMobile) setOpenMobile(false);
    logout();
    navigate("/login");
  }

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(url + "/");

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <button
          type="button"
          onClick={() => {
            if (isMobile) setOpenMobile(false);
            navigate("/dashboard");
          }}
          className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition-colors duration-200 hover:bg-sidebar-accent"
          aria-label="Kabarbers owner workspace. Go to dashboard"
        >
          <span className="flex h-12 w-12 shrink-0 border items-center justify-center rounded-lg text-brass-bright">
            <img src={Logo} alt="" className="rounded-xl " />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm leading-tight font-semibold">
              Kabarbers
            </span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              Owner workspace
            </span>
          </span>
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {overviewNav.map((item) => (
                <OwnerNavButton
                  key={item.url}
                  item={item}
                  active={isActive(item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageNav.map((item) => (
                <OwnerNavButton
                  key={item.url}
                  item={item}
                  active={isActive(item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log out"
              onClick={handleLogout}
              className="h-10 active:scale-[0.98] md:h-8"
            >
              <LogOutIcon aria-hidden="true" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

const AppLayout = () => {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [shopOpen, setShopOpen] = useState(true);
  const [shopLoaded, setShopLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ownerListBookings({ status: "pending" })
      .then((r) => {
        if (!cancelled) setPendingCount(r.length);
      })
      .catch(() => {});
    getShopStatus()
      .then((s) => {
        if (!cancelled) {
          setShopOpen(s.is_open);
          setShopLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const overviewNav: NavItem[] = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
    {
      title: "Bookings",
      url: "/bookings",
      icon: CalendarCheckIcon,
      badge: pendingCount,
      badgeLabel: "pending payments",
    },
  ];
  const manageNav: NavItem[] = [
    { title: "Shop Controls", url: "/controls", icon: SlidersHorizontalIcon },
  ];

  const title = TITLES[location.pathname] ?? "Dashboard";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <SidebarProvider>
      <OwnerSidebar overviewNav={overviewNav} manageNav={manageNav} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="min-w-0 flex-1">
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Owner / {title}
            </p>
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {title}
            </h1>
          </div>
          {shopLoaded && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                shopOpen
                  ? "bg-moss/15 text-moss"
                  : "bg-espresso/10 text-espresso/60",
              )}
              role="status"
              title={
                shopOpen
                  ? "Shop is open. Accepting new bookings"
                  : "Shop is closed. Bookings paused"
              }
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  shopOpen ? "bg-moss" : "bg-espresso/40",
                )}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {shopOpen ? "Open" : "Closed"}
              </span>
              <span className="sr-only sm:hidden">
                {shopOpen ? "Shop open" : "Shop closed"}
              </span>
            </span>
          )}
          <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums lg:block">
            {todayLabel}
          </span>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
