import { NavLink, useNavigate } from "react-router-dom";

function Icon({ path, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = {
  dashboard: "M4 13h6V4H4v9zm10 7h6V11h-6v9zM14 4v5h6V4h-6zM4 20h6v-5H4v5z",
  bolt: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
  cloud: "M20 16.5a4.5 4.5 0 0 0-1.7-8.6A6 6 0 0 0 6 9.5a4.5 4.5 0 0 0 0 9h12",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  wallet: "M3 7h18v10H3V7zm14 3h4",
  chart: "M4 19V5m0 14h16M8 15l2-3 3 2 4-6 3 4",
};

const navItems = [
  { to: "/admin", label: "Command Center", icon: "dashboard" },
  { to: "/admin/live-triggers", label: "Live Triggers", icon: "bolt" },
  { to: "/admin/disruptions", label: "Disruptions", icon: "cloud" },
  {
    to: "/admin/fraud/W-0295?trigger_id=TRG-750850&zone=Andheri-W&trigger_type=composite&severity=L3&payout_status=blocked",
    label: "Fraud Detection",
    icon: "shield",
  },
  { to: "/admin/payouts", label: "Payouts", icon: "wallet" },
  { to: "/admin/analytics", label: "Analytics", icon: "chart" },
];

export default function Sidebar({ theme = "dark" }) {
  const isLight = theme === "light";
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem("bhima_admin_token");
    localStorage.removeItem("bhima_admin_id");
    localStorage.removeItem("bhima_admin_name");
    localStorage.removeItem("adminLoggedIn");
    navigate("/admin/login");
  };

  return (
    <aside
      className={
        "fixed left-0 top-0 h-screen w-[220px] border-r flex flex-col z-40 " +
        (isLight
          ? "bg-[#FFFFFF] text-[#000000] border-[#E5E5E5]"
          : "bg-[#0B0B0B] text-[#FFFFFF] border-[#1F1F1F]")
      }
    >
      <div
        className={
          "px-5 py-5 border-b " +
          (isLight ? "border-[#E5E5E5]" : "border-[#1F1F1F]")
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-[0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-20px_rgba(0,0,0,0.9)] " +
              (isLight
                ? "bg-gradient-to-br from-[#FFFFFF] to-[#E5E5E5] border-[#E5E5E5]"
                : "bg-gradient-to-br from-[#111111] to-[#1F1F1F] border-[#2A2A2A]")
            }
          >
            <span className={isLight ? "text-[#000000]" : "text-[#FFFFFF]"}>
              <Icon path={ICONS.shield} size={18} />
            </span>
          </div>
          <div>
            <div className="font-display font-semibold tracking-tight text-[15px] leading-tight">
              BHIMA ASTRA
            </div>
            <div
              className={
                "mt-0.5 text-[10px] " +
                (isLight ? "text-[#666666]" : "text-[#BDBDBD]")
              }
            >
              Admin
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div
          className={
            "text-[10px] font-semibold uppercase tracking-widest px-3 mb-2 " +
            (isLight ? "text-[#666666]" : "text-[#CCCCCC]")
          }
        >
          Main
        </div>

        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              "group relative flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] transition duration-300 " +
              (isActive
                ? isLight
                  ? "bg-[#000000] text-[#FFFFFF] border-[#000000] shadow-[0_1px_0_rgba(255,255,255,0.15),0_16px_40px_-30px_rgba(0,0,0,0.9)]"
                  : "bg-[#FFFFFF] text-[#000000] border-[#FFFFFF] shadow-[0_1px_0_rgba(255,255,255,0.15),0_16px_40px_-30px_rgba(0,0,0,0.9)]"
                : isLight
                  ? "bg-[#FFFFFF] text-[#111111] border-transparent hover:border-[#E5E5E5] hover:bg-[#F7F7F7]"
                  : "bg-[#0B0B0B] text-[#E5E5E5] border-transparent hover:border-[#2A2A2A] hover:bg-[#111111]")
            }
          >
            <span className="flex-shrink-0 opacity-90 group-hover:opacity-100">
              <Icon path={ICONS[it.icon]} />
            </span>
            <span className="flex-1">{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div
        className={
          "px-3 py-4 border-t space-y-2 " +
          (isLight ? "border-[#E5E5E5]" : "border-[#1F1F1F]")
        }
      >
        <div
          className={
            "mx-1 p-3 rounded-xl border shadow-[0_1px_0_rgba(255,255,255,0.06),0_18px_50px_-38px_rgba(0,0,0,1)] " +
            (isLight
              ? "bg-gradient-to-br from-[#FFFFFF] to-[#F2F2F2] border-[#E5E5E5]"
              : "bg-gradient-to-br from-[#111111] to-[#0B0B0B] border-[#1F1F1F]")
          }
        >
          <div
            className={
              "text-[11px] font-semibold " +
              (isLight ? "text-[#111111]" : "text-[#E5E5E5]")
            }
          >
            System Status
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={
                "w-2 h-2 rounded-full animate-pulse " +
                (isLight ? "bg-[#333333]" : "bg-[#CCCCCC]")
              }
            />
            <span
              className={
                "text-[10px] " + (isLight ? "text-[#666666]" : "text-[#BDBDBD]")
              }
            >
              Monitoring
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className={
            "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] transition duration-200 cursor-pointer " +
            (isLight
              ? "bg-[#FFFFFF] text-[#EF4444] border-[#FEE2E2] hover:bg-[#FEF2F2] hover:border-[#EF4444]"
              : "bg-[#0B0B0B] text-[#FF6B6B] border-[#2A1A1A] hover:bg-[#1A0A0A] hover:border-[#FF6B6B]")
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
