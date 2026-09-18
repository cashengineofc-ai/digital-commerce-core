import { CheckCircle2, Lock, QrCode } from "lucide-react";
import { Reveal, Section, SectionHeading } from "./primitives";

const highlights = [
  "Fluxo curto, com menos campos e menos abandono",
  "Layout responsivo pensado primeiro para o celular",
  "Métodos de pagamento configuráveis por produto",
  "Status da transação atualizado no painel em tempo real",
];

export function CheckoutSection() {
  return (
    <Section id="negocios">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            align="left"
            label="Checkout"
            title="Um checkout feito para vender."
            description="A etapa mais sensível da venda merece uma interface rápida, clara e previsível — em qualquer dispositivo."
          />
          <ul className="mt-8 space-y-3">
            {highlights.map((highlight, i) => (
              <Reveal key={highlight} delay={i * 0.06}>
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-soft" />
                  <span>{highlight}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={0.1}>
          <div className="surface-card mx-auto w-full max-w-md rounded-2xl p-5 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Checkout Cash Engine PRO</p>
                <p className="text-xs text-muted-foreground">Prévia de uma oferta publicada</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Pix</span>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Método de pagamento</p>
              <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 text-sm">
                <QrCode className="h-5 w-5 text-primary" />
                <div><p className="font-medium">Pix</p><p className="text-xs text-muted-foreground">Código gerado no checkout público</p></div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-surface/50 p-4 text-sm text-muted-foreground">
              Os dados e o valor aparecem somente no checkout real, associado a uma oferta publicada.
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />Esta é uma prévia institucional; nenhum pagamento é iniciado aqui.</p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
