import { useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ConductorPanel from "./pages/ConductorPanel";

function Router() {
  const { sesion, logout } = useAuth();
  const [vista, setVista] = useState<"inicio" | "login">("inicio");
  if (!sesion) {
    if (vista === "login") {
      return <Login onVolver={() => setVista("inicio")} />;
    }
    return <Inicio onEntrar={() => setVista("login")} />;
  }
  if (sesion.rol === "ADMIN") return <AdminDashboard />;
  if (sesion.rol === "CONDUCTOR") return <ConductorPanel />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 text-slate-600">
      <p>Panel {sesion.rol} en construcción.</p>
      <button
        onClick={logout}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}