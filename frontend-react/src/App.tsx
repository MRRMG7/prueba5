import { useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ConductorPanel from "./pages/ConductorPanel";
import RegistroConductor from "./pages/RegistroConductor";

function Router() {
  const { sesion, logout } = useAuth();
  const [vista, setVista] = useState<"inicio" | "login" | "registro">("inicio");
  if (!sesion) {
    if (vista === "registro") {
      return <RegistroConductor onVolver={() => setVista("login")} />;
    }
    if (vista === "login") {
      return (
        <Login
          onVolver={() => setVista("inicio")}
          onRegistro={() => setVista("registro")}
        />
      );
    }
    return <Inicio onEntrar={() => setVista("login")} />;
  }
  if (sesion.rol === "ADMIN") return <AdminDashboard />;
  if (sesion.rol === "CONDUCTOR") return <ConductorPanel />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ background: "var(--papel-100)", color: "var(--tinta-500)" }}>
      <p>Panel {sesion.rol} en construcción.</p>
      <button
        onClick={logout}
        className="rounded-md border px-4 py-2 text-sm font-medium transition"
        style={{ borderColor: "var(--linea-borde)", color: "var(--tinta-500)", background: "transparent" }}
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