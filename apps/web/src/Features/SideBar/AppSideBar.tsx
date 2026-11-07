import { FaArrowTrendUp } from "react-icons/fa6";
import { FiTarget } from "react-icons/fi";
import { IoDocumentTextOutline } from "react-icons/io5";
import { LuArrowLeftRight } from "react-icons/lu";
import { MdOutlineDashboard } from "react-icons/md";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";
import Logo from "../../theme/Logo";
import ThemeToggle from "../../theme/ThemeToggle";
import { APP_NAME, APP_TAGLINE } from "../../theme/theme";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from "../../components/ui/sidebar";

export default function AppSideBar() {
  const items = [
    {
      id: "dashboard",
      title: "Dashboard",
      description: "Visão geral do mês",
      path: "/",
      icon: MdOutlineDashboard,
    },
    {
      id: "projeção futura",
      title: "Projeção Futura",
      description: "Planeje os próxims meses",
      path: "/FutureProjection",
      icon: FaArrowTrendUp,
    },
    {
      id: "comparação",
      title: "Comparação",
      description: "Compare seus meses",
      path: "/Comparison",
      icon: LuArrowLeftRight,
    },
    {
      id: "metas",
      title: "Metas",
      description: "Objetivos financeiros",
      path: "/Goals",
      icon: FiTarget,
    },
    {
      id: "relatórios",
      title: "Relatórios",
      description: "Exportar dados",
      path: "/Reports",
      icon: IoDocumentTextOutline,
    },
  ];

  const location = useLocation();
  const { open } = useSidebar();
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar
      className={`
    bg-card
    border-border border-r
    pt-2
    shadow-sm shadow-stone-950
    text-foreground
    h-screen
    flex flex-col
    sticky top-0
    ${open ? "w-64" : "w-16"}
  `}
      collapsible="none"
    >
      <SidebarHeader>
        <section
          className={`flex items-center gap-1 px-3 ${open ? "justify-start" : "justify-center"}`}
        >
          <Logo className={open ? "h-12 w-12 mr-1 mb-3" : "h-9 w-9 mb-3"} />
          {open && (
            <div className="mb-3">
              <h1 className="font-bold text-xl pt-2">{APP_NAME}</h1>
              <p className="text-sm text-muted-foreground pb-1">{APP_TAGLINE}</p>
            </div>
          )}
        </section>
        <hr className="border-border" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link to={item.path} key={item.id}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`
    rounded-2xl px-4 py-3 w-full h-auto text-left flex items-start gap-2
    justify-start text-foreground
    ${isActive ? "bg-primary/20 hover:bg-primary/90" : "hover:bg-secondary"}
  `}
                  >
                    <div
                      className={`flex items-center gap-2 ${open ? "justify-start" : "justify-center"}`}
                    >
                      <Icon className="!w-5 !h-8 text-foreground" />
                      {open && (
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-foreground group-hover:text-foreground">
                            {item.title}
                          </span>
                          <span className="text-xs text-foreground/80 group-hover:text-foreground">
                            {item.description}
                          </span>
                        </div>
                      )}
                    </div>
                  </Button>
                </Link>
              );
            })}
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <hr className="border-border mb-2" />
        <section className="grid grid-rows-2 gap-2 mb-2">
          <ThemeToggle showLabel={open} />
          <div className="hover:bg-secondary hover:border-border font-medium hover:font-bold text-center rounded-lg py-2">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-start gap-2 ml-3 "
            >
              {open ? (
                <RiArrowLeftSLine className="text-2xl" />
              ) : (
                <RiArrowRightSLine className="text-2xl" />
              )}
              {open && <span>Recolher menu</span>}
            </button>
          </div>
        </section>
      </SidebarFooter>
    </Sidebar>
  );
}
