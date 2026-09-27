import { useEffect } from "react";

interface Props {
  url: string;
  titulo?: string;
  onCerrar: () => void;
}

export default function EvidenciaModal({ url, titulo, onCerrar }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div className="evidencia-fondo" onClick={onCerrar}>
      <div className="evidencia-caja" onClick={(e) => e.stopPropagation()}>
        <div className="evidencia-cabecera">
          <span className="evidencia-titulo">{titulo || "Evidencia"}</span>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <img src={url} alt="Evidencia de entrega" className="evidencia-imagen" />
        <a className="btn btn-verde evidencia-abrir" href={url} target="_blank" rel="noreferrer">
          Abrir en pestaña nueva
        </a>
      </div>
    </div>
  );
}