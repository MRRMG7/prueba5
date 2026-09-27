import type { Cliente, Conductor, Pedido, Proveedor, Vehiculo } from "../../types";
import MapaTab from "./MapaTab";
import PedidosTab from "./PedidosTab";

interface Props {
  pedidos: Pedido[];
  clientes: Cliente[];
  conductores: Conductor[];
  vehiculos: Vehiculo[];
  proveedores?: Proveedor[];
  onCambio: () => Promise<void>;
}

export default function PaquetesTab({ pedidos, clientes, conductores, vehiculos, proveedores = [], onCambio }: Props) {
  return (
    <div className="grid gap-4">
      <MapaTab
        pedidos={pedidos}
        clientes={clientes}
        conductores={conductores}
        vehiculos={vehiculos}
        onCambio={onCambio}
      />
      <PedidosTab
        pedidos={pedidos}
        clientes={clientes}
        conductores={conductores}
        proveedores={proveedores}
        onCambio={onCambio}
      />
    </div>
  );
}