import { useMemo } from "react";
import type { Pedido } from "../../types";

interface Props {
  pedidos: Pedido[];
}

interface DiaConteo {
  etiqueta: string;
  cantidad: number;
}

function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

function diasSemana(): { clave: string; etiqueta: string }[] {
  const dias: { clave: string; etiqueta: string }[] = [];
  const hoy = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    dias.push({ clave: claveDia(d), etiqueta: d.toLocaleDateString("es-SV", { weekday: "short" }) });
  }
  return dias;
}

function formatearHoras(minutos: number): string {
  if (minutos <= 0) return "—";
  const hs = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (hs <= 0) return `${min} min`;
  return `${hs} h ${min} min`;
}

export default function GraficosResumen({ pedidos }: Props) {
  const { dias, promedioMin, cantidadDiaMax } = useMemo(() => {
    const dias = diasSemana().map((d) => ({ ...d, cantidad: 0 }));
    const porClave: Record<string, DiaConteo & { clave: string }> = {};
    for (const d of dias) porClave[d.clave] = d;

    let totalMin = 0;
    let conTiempo = 0;

    for (const p of pedidos) {
      if (p.estado === "ENTREGADO" && p.entregado_at) {
        const f = new Date(p.entregado_at);
        const c = porClave[claveDia(f)];
        if (c) c.cantidad += 1;

        if (p.created_at) {
          const creado = new Date(p.created_at);
          const entregado = new Date(p.entregado_at);
          const min = (entregado.getTime() - creado.getTime()) / 60000;
          if (min > 0 && Number.isFinite(min)) {
            totalMin += min;
            conTiempo += 1;
          }
        }
      }
    }

    const cantidadDiaMax = Math.max(1, ...dias.map((d) => d.cantidad));
    const promedioMin = conTiempo > 0 ? totalMin / conTiempo : 0;
    return { dias, promedioMin, cantidadDiaMax };
  }, [pedidos]);

  const totalEntregas = dias.reduce((acc, d) => acc + d.cantidad, 0);

  return (
    <div className="fila-graficos">
      <section className="tarjeta grafico-tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Entregas por día</h2>
          <p>Últimos 7 días · {totalEntregas} entregas realizadas.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="grafico-barras" role="img" aria-label="Entregas por día">
            {dias.map((d) => (
              <div className="grafico-barra-col" key={d.clave}>
                <span className="grafico-barra-num">{d.cantidad}</span>
                <div
                  className="grafico-barra"
                  style={{ height: `${Math.max(4, (d.cantidad / cantidadDiaMax) * 100)}%` }}
                />
                <span className="grafico-barra-etiqueta">{d.etiqueta}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tarjeta grafico-tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Tiempo promedio de entrega</h2>
          <p>Desde la creación del pedido hasta su entrega.</p>
        </div>
        <div className="cuerpo-tarjeta">
          <div className="grafico-metrica">
            <span className="grafico-metrica-valor">{formatearHoras(promedioMin)}</span>
            <span className="grafico-metrica-sub">
              {promedioMin > 0 ? "promedio por pedido entregado" : "Sin entregas con datos todavía"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}