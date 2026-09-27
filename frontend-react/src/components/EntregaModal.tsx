import { useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { api } from "../api";
import type { Pedido } from "../types";

interface Props {
  pedido: Pedido;
  modoInicial?: "incidencia" | "entrega";
  onCerrar: () => void;
  onGuardado: () => Promise<void> | void;
}

function comprimirImagen(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const max = 900;
        let w = img.width;
        let h = img.height;
        if (w > max) {
          h = Math.round((h * max) / w);
          w = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return rechazar(new Error("No se pudo procesar la imagen"));
        ctx.drawImage(img, 0, 0, w, h);
        resolver(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => rechazar(new Error("Imagen inválida"));
      img.src = String(reader.result);
    };
    reader.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(archivo);
  });
}

export default function EntregaModal({ pedido, modoInicial = "entrega", onCerrar, onGuardado }: Props) {
  const [modo, setModo] = useState<"incidencia" | "entrega">(modoInicial);
  const [notaIncidencia, setNotaIncidencia] = useState("");
  const [notaExtra, setNotaExtra] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoNombre, setFotoNombre] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);

  function inicio(evento: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dibujando.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#16202b";
    ctx.moveTo(evento.clientX - r.left, evento.clientY - r.top);
    canvas.setPointerCapture(evento.pointerId);
  }

  function mover(evento: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    ctx.lineTo(evento.clientX - r.left, evento.clientY - r.top);
    ctx.stroke();
  }

  function soltar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFirma(canvas.toDataURL("image/png"));
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setFirma(null);
  }

  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      setFoto(await comprimirImagen(archivo));
      setFotoNombre(archivo.name);
    } catch {
      setError("No se pudo leer la imagen.");
    }
  }

  async function guardar() {
    setError("");
    if (modo === "entrega" && !firma) {
      setError("Necesitás capturar la firma de quien recibe.");
      return;
    }
    if (modo === "incidencia" && !notaIncidencia.trim()) {
      setError("Escribí una nota explicando la incidencia.");
      return;
    }
    setGuardando(true);
    try {
      if (modo === "entrega") {
        await api(`/pedidos/${pedido.id_pedido}/estado`, {
          method: "PUT",
          body: JSON.stringify({
            estado: "ENTREGADO",
            nota: notaExtra.trim() || null,
            foto: foto || null,
            firma: firma || null,
          }),
        });
      } else {
        await api(`/pedidos/${pedido.id_pedido}/estado`, {
          method: "PUT",
          body: JSON.stringify({ estado: "INCIDENCIA", nota: notaIncidencia.trim() }),
        });
      }
      await onGuardado();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecera">
          <div>
            <h3 className="modal-titulo">Pedido #{pedido.id_pedido}</h3>
            <p className="modal-sub">{pedido.direccion}</p>
          </div>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="modal-pestanas">
          <button
            type="button"
            className={"modal-pestana" + (modo === "entrega" ? " activa" : "")}
            onClick={() => { setModo("entrega"); setError(""); }}
          >
            Registrar entrega
          </button>
          <button
            type="button"
            className={"modal-pestana" + (modo === "incidencia" ? " activa" : "")}
            onClick={() => { setModo("incidencia"); setError(""); }}
          >
            Incidencia
          </button>
        </div>

        {modo === "entrega" ? (
          <>
            <div className="modal-campo">
              <label className="modal-label">Firma del receptor *</label>
              <div className="firma-wrap">
                <canvas
                  ref={canvasRef}
                  className="firma-lienzo"
                  width={640}
                  height={180}
                  onPointerDown={inicio}
                  onPointerMove={mover}
                  onPointerUp={soltar}
                />
                <button type="button" className="btn" onClick={limpiarFirma}>
                  Limpiar firma
                </button>
              </div>
            </div>

            <div className="modal-campo">
              <label className="modal-label">Foto de la entrega (evidencia)</label>
              <label className="foto-subida">
                {foto ? (
                  <span className="foto-subida-vista">
                    <img src={foto} alt="Evidencia" />
                    {fotoNombre && <em>{fotoNombre}</em>}
                  </span>
                ) : (
                  <span className="foto-subida-vacio">+ Elegir foto</span>
                )}
                <input type="file" accept="image/*" onChange={elegirFoto} hidden />
              </label>
            </div>
          </>
        ) : (
          <div className="modal-campo">
            <label className="modal-label">Nota de la incidencia *</label>
            <textarea
              className="modal-texto"
              rows={3}
              value={notaIncidencia}
              onChange={(e) => setNotaIncidencia(e.target.value)}
              placeholder="¿Qué pasó? Ej: destinatario ausente, dirección incompleta…"
            />
          </div>
        )}

        <div className="modal-campo">
          <label className="modal-label">Nota adicional (opcional)</label>
          <textarea
            className="modal-texto"
            rows={2}
            value={notaExtra}
            onChange={(e) => setNotaExtra(e.target.value)}
            placeholder="Comentario (solo para entregas)"
            disabled={modo === "incidencia"}
          />
        </div>

        {error && <p className="aviso-banner rojo">{error}</p>}

        <div className="modal-pie">
          <button type="button" className="btn" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-verde"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando
              ? "Guardando…"
              : modo === "entrega"
                ? "Confirmar entrega"
                : "Reportar incidencia"}
          </button>
        </div>
      </div>
    </div>
  );
}