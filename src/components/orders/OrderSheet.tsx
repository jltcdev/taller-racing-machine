import { useEffect, useRef } from "react";
import logo from "@/assets/racing-machine-logo.png";
import banner from "@/assets/ktm-ready-to-race.png";
import {
  STATUS_LABEL,
  formatCOP,
  orderTotal,
  type WorkOrder,
} from "@/lib/orders";

function printConditionLabel(condition: string | undefined) {
  switch (condition) {
    case "Nueva Original":
      return "NUEVO ORIGINAL";
    case "Nueva Genérica":
      return "NUEVO GENÉRICO";
    case "Reparada":
      return "REPARADO / RECTIFICADO";
    case "Aftermarket / Lujo":
    case "Repuesto de Lujo":
      return "AFTERMARKET / LUJO";
    default:
      return condition?.toLocaleUpperCase() ?? "";
  }
}

function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section">
      <h2 className="print-section-title">{title}</h2>
      {children}
    </section>
  );
}

function CheckBadge({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="print-check">
      <span>{label}</span>
      <span className="print-check-badges">
        <span className={checked ? "print-badge-yes" : "print-badge-muted"}>
          SÍ
        </span>
        <span className={!checked ? "print-badge-no" : "print-badge-muted"}>
          NO
        </span>
      </span>
    </div>
  );
}

export function OrderSheet({ order }: { order: WorkOrder }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fitToPage = () => {
      const content = contentRef.current;
      if (!content) return;

      content.style.removeProperty("--print-scale");
      content.style.removeProperty("--print-width");
      const availableHeight = (280 * 96) / 25.4;
      const scale = Math.min(1, availableHeight / content.scrollHeight);
      content.style.setProperty("--print-scale", String(scale));
      content.style.setProperty("--print-width", `${100 / scale}%`);
    };
    const resetScale = () => {
      contentRef.current?.style.removeProperty("--print-scale");
      contentRef.current?.style.removeProperty("--print-width");
    };

    window.addEventListener("beforeprint", fitToPage);
    window.addEventListener("afterprint", resetScale);
    return () => {
      window.removeEventListener("beforeprint", fitToPage);
      window.removeEventListener("afterprint", resetScale);
    };
  }, []);

  return (
    <article
      className="sheet"
      aria-label={`Orden de trabajo ${order.number}`}
      data-testid="order-sheet"
    >
      <div ref={contentRef} className="sheet-content">
        <header className="print-document-header">
          <div className="print-brand">
            <img src={logo} alt="Racing Machine" />
            <div className="print-brand-copy">
              <h1>Racing Machine</h1>
              <strong>Servicio técnico especializado</strong>
              <span>NIT. 1024542676 | AV. Calle 72 # 72 B 35 - Bogotá</span>
              <span>320 959 0380</span>
            </div>
          </div>
          <img
            src={banner}
            alt="KTM Ready to Race"
            className="print-ktm-banner"
          />
          <div className="print-order-number">
            <span>Orden de trabajo</span>
            <strong>{order.number}</strong>
            <small>{STATUS_LABEL[order.status]}</small>
          </div>
        </header>

        <div className="print-owner-bike">
          <section className="print-info-block">
            <h2>Datos del propietario</h2>
            <p>
              <b>FECHA:</b> {order.date}
            </p>
            <p>
              <b>NOMBRE:</b> {order.owner.name}
            </p>
            <p>
              <b>{order.owner.documentType ?? "CC"}:</b> {order.owner.cc}
            </p>
            <p>
              <b>TELÉFONO:</b> {order.owner.phone}
            </p>
            {order.owner.email && (
              <p>
                <b>CORREO:</b> {order.owner.email}
              </p>
            )}
          </section>

          <section className="print-info-block">
            <h2>Datos de la motocicleta</h2>
            <p>
              <b>PLACA:</b>{" "}
              <strong className="print-plate">{order.bike.plate}</strong>
            </p>
            <p>
              <b>MARCA / REFERENCIA:</b>{" "}
              {[order.bike.brand, order.bike.model].filter(Boolean).join(" ")}
            </p>
            {order.bike.year && (
              <p>
                <b>AÑO:</b> {order.bike.year}
              </p>
            )}
            <p>
              <b>KILOMETRAJE:</b>{" "}
              {Number(order.bike.km || 0).toLocaleString("es-CO")} km
            </p>
            {order.bike.vin && (
              <p>
                <b>VIN / CHASIS:</b> {order.bike.vin}
              </p>
            )}
            {order.bike.engineNumber && (
              <p>
                <b>MOTOR:</b> {order.bike.engineNumber}
              </p>
            )}
            <p>
              <b>TÉCNICO:</b> {order.technician}
            </p>
          </section>
        </div>

        <PrintSection title="Reporte del cliente / Diagnóstico inicial">
          <p className="print-diagnosis">{order.report || "—"}</p>
        </PrintSection>

        <PrintSection title="Novedades (estado de ingreso)">
          <div className="print-check-grid print-inspection-grid">
            {Object.entries(order.inspection).map(([label, checked]) => (
              <CheckBadge key={label} label={label} checked={checked} />
            ))}
          </div>
        </PrintSection>

        <PrintSection title="Inventario de accesorios al recibir">
          <div className="print-check-grid print-accessory-grid">
            {Object.entries(order.accessories).map(([label, checked]) => (
              <CheckBadge key={label} label={label} checked={checked} />
            ))}
          </div>
        </PrintSection>

        <PrintSection title="Cotización de repuestos y servicios">
          <table className="print-items-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Estado / Tipo</th>
                <th>Cant.</th>
                <th>V. Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className={
                    item.kind === "service"
                      ? "print-labor-row bg-orange-100 font-bold text-orange-900"
                      : item.condition === "Aftermarket / Lujo" ||
                          item.condition === "Repuesto de Lujo"
                        ? "print-aftermarket-row text-orange-600"
                        : undefined
                  }
                >
                  <td>
                    {item.code ? `${item.code} · ` : ""}
                    <strong>{item.description}</strong>
                    {item.brand ? ` — ${item.brand}` : ""}
                  </td>
                  <td>
                    {item.kind === "service"
                      ? "MANO DE OBRA"
                      : [
                          printConditionLabel(item.condition),
                          item.category?.toLocaleUpperCase(),
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                        item.partType ||
                        "—"}
                  </td>
                  <td className="print-number-cell">{item.qty}</td>
                  <td className="print-number-cell">
                    {formatCOP(Number(item.unitPrice) || 0)}
                  </td>
                  <td className="print-number-cell">
                    {formatCOP(
                      (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
                    )}
                  </td>
                </tr>
              ))}
              {order.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="print-no-items">
                    Sin repuestos o servicios cotizados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="print-total">
            <span>VALOR TOTAL DE LA REPARACIÓN</span>
            <strong>{formatCOP(orderTotal(order))}</strong>
          </div>
        </PrintSection>

        <div className="print-legal-notice">
          <strong>INFORME DE BODEGAJE:</strong> Tener en cuenta que pasadas 48
          horas después de ser informados que la motocicleta fue reparada, cada
          día de parqueadero tendrá un valor de <strong>$6.000</strong>. Este
          valor se sumará al total de la reparación del vehículo.
        </div>

        <footer className="print-signatures">
          <div>
            <span />
            <strong>TÉCNICO ENCARGADO</strong>
            <small>{order.technician}</small>
          </div>
          <div>
            <span />
            <strong>ACEPTACIÓN DEL CLIENTE</strong>
            <small>{order.owner.name}</small>
          </div>
        </footer>
        <div className="print-footer">
          Orden de Trabajo #{order.number} - Racing Machine Taller Especializado
        </div>
      </div>
    </article>
  );
}
