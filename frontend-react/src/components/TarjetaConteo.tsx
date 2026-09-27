import { useEffect, useRef, useState } from "react";

interface Props {
  valor: number;
  etiqueta: string;
  color: string;
}

export default function TarjetaConteo({ valor, etiqueta, color }: Props) {
  const [n, setN] = useState(0);
  const previo = useRef(0);

  useEffect(() => {
    const objetivo = valor;
    const desde = previo.current;
    previo.current = objetivo;
    if (objetivo === desde) return;
    const duracion = 600;
    const inicio = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min((t - inicio) / duracion, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setN(Math.round(desde + (objetivo - desde) * ease));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);

  return (
    <div className="conteo-tarjeta" style={{ "--accio": color } as React.CSSProperties}>
      <span className="conteo-punto" />
      <span className="conteo-numero">{n}</span>
      <span className="conteo-etiqueta">{etiqueta}</span>
    </div>
  );
}