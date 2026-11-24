import { jsPDF } from 'jspdf';
import { bestOffer } from '../../shared/compat';
import { COMPONENT_LABELS, type Build, type BuildComponent, type PriceResult } from '../../shared/types';
import { dateTimeOf, eur } from './format';


export function exportBuildPdf(opts: {
  build: Build;
  counted: BuildComponent[];
  alternatives: BuildComponent[];
  prices: Record<string, PriceResult | undefined>;
  total: number;
  partial: boolean;
}) {
  const { build, counted, alternatives, prices, total, partial } = opts;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const M = 20;
  let y = 0;

  const ensure = (space: number) => {
    if (y + space > H - 20) {
      doc.addPage();
      y = 25;
    }
  };

  // Cabecera
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, W, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('KREAPC', M, 22);
  doc.setTextColor(0, 255, 102);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PRESUPUESTO CON PRECIOS REALES DE TIENDAS ESPAÑOLAS', M, 30);

  y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Presupuesto de hardware', M, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${build.deviceType} · ${build.useCase} · Objetivo ${build.budget}`, M, y);
  y += 5;
  doc.text(`Precios consultados el ${dateTimeOf(new Date().toISOString())}`, M, y);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 10;

  const drawComponent = (c: BuildComponent) => {
    const result = prices[c.id];
    const offers = result?.offers ?? [];
    const best = bestOffer(offers);
    const nameLines = doc.splitTextToSize(c.name, W - 2 * M - 40);
    const skuLines = best?.title && best.title !== c.name ? doc.splitTextToSize(best.title, W - 2 * M - 40) : [];
    ensure(14 + nameLines.length * 5 + (offers.length > 1 ? 5 : 0));

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text(COMPONENT_LABELS[c.type].toUpperCase(), M, y);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(best ? eur(best.price) : '—', W - M, y + 5, { align: 'right' });

    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(nameLines, M, y);
    y += nameLines.length * 5;
    if (skuLines.length) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text(skuLines, M, y);
      y += skuLines.length * 4;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (best) {
      doc.setTextColor(0, 140, 60);
      const label = `${best.store} - ver en la tienda`;
      doc.textWithLink(label, M, y, { url: best.url });
      y += 4.5;
      const others = offers.filter((o) => o !== best).slice(0, 4);
      if (others.length) {
        doc.setTextColor(120, 120, 120);
        doc.text(`Otras tiendas: ${others.map((o) => `${o.store} ${eur(o.price)}`).join(' · ')}`, M, y);
        y += 4.5;
      }
    } else {
      doc.setTextColor(180, 120, 0);
      doc.text('Sin precio comprobado en el momento de la consulta', M, y);
      y += 4.5;
    }
    y += 3;
    doc.setDrawColor(235, 235, 235);
    doc.line(M, y, W - M, y);
    y += 7;
  };

  counted.forEach(drawComponent);

  // Total
  ensure(30);
  y += 2;
  doc.setFillColor(245, 245, 245);
  doc.rect(M, y, W - 2 * M, 20, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(partial ? 'TOTAL PARCIAL' : 'TOTAL', M + 8, y + 13);
  doc.setFontSize(16);
  doc.setTextColor(0, 160, 70);
  doc.text(eur(total), W - M - 8, y + 13.5, { align: 'right' });
  y += 30;

  if (alternatives.length) {
    ensure(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Alternativas', M, y);
    y += 8;
    alternatives.forEach(drawComponent);
  }

  ensure(16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  const note = doc.splitTextToSize(
    'Precios leídos directamente de la ficha de cada producto en la tienda (datos estructurados schema.org). Rendimiento según Tom\'s Hardware. Los precios y el stock pueden cambiar en cualquier momento.',
    W - 2 * M,
  );
  doc.text(note, M, y);

  doc.save('KreaPC_Presupuesto.pdf');
}
