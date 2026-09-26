import { ESTADO_META } from "../api";
import type { Estado } from "../types";

export default function EstadoPill({ estado }: { estado: Estado }) {
  const meta = ESTADO_META[estado] || {
    etiqueta: estado,
    color: "#64748b",
    fondo: "#f1f5f9",
  };
  return (
    <span className="pill" style={{ color: meta.color, background: meta.fondo }}>
      {meta.etiqueta}
    </span>
  );
}