import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { LayoutDashboardIcon, LogOutIcon, StoreIcon } from "lucide-react";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboardIcon, url: "/dashboard" },
  { title: "Services", icon: StoreIcon, url: "/services" },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">My CMS</h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.url}
                      onClick={() => navigate(item.url)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => navigate("/")}>
                <LogOutIcon />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-2xl font-bold text-accent">Dashboard</h1>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
