import { FaArrowTrendUp, FaWallet } from "react-icons/fa6";
import { FiTarget } from "react-icons/fi";
import { IoDocumentTextOutline } from "react-icons/io5";
import { LuArrowLeftRight, LuMoon } from "react-icons/lu";
import { MdOutlineDashboard } from "react-icons/md";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/button";

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
    [--sidebar-background:theme(colors.slate.900)]
    bg-slate-900
    border-slate-600 border-r
    pt-2
    shadow-sm shadow-stone-950
    text-white
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
          <div className="bg-green-950 text-emerald-600 border border-emerald-600 px-2 py-2 rounded-2xl mr-1 mb-3">
            <FaWallet className={`${open ? "text-3xl" : "text-xl"}`} />
          </div>
          {open && (
            <div className="mb-3">
              <h1 className="font-bold text-xl pt-2">Meu Bolso</h1>
              <p className="font-serif text-lg pb-1">Controle Financeiro</p>
            </div>
          )}
        </section>
        <hr className="border-slate-400" />
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
    justify-start text-white
    ${isActive ? "bg-green-900 hover:bg-green-800" : "hover:bg-slate-800"}
  `}
                  >
                    <div
                      className={`flex items-center gap-2 ${open ? "justify-start" : "justify-center"}`}
                    >
                      <Icon className="!w-5 !h-8 text-white" />
                      {open && (
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-white group-hover:text-white">
                            {item.title}
                          </span>
                          <span className="text-xs text-slate-300 group-hover:text-slate-200">
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
        <hr className="border-slate-400 mb-2" />
        <section className="grid grid-rows-2 gap-2 mb-2">
          <div className="hover:bg-slate-800 hover:border-slate-800 font-medium hover:font-bold text-center rounded-lg py-2">
            <section className="flex items-center justify-start gap-2 ml-4">
              <LuMoon className="text-lg" />
              {open && <span>Modo escuro</span>}
            </section>
          </div>
          <div className="hover:bg-slate-800 hover:border-slate-800 font-medium hover:font-bold text-center rounded-lg py-2">
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
