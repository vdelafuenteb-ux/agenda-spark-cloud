import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isBefore, addDays, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseStoredDate, formatStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';

function getTrafficLight(dueDateStr: string | null | undefined): { label: string; color: [number, number, number] } {
  if (!dueDateStr) return { label: 'Al día', color: [34, 197, 94] };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { label: 'Al día', color: [34, 197, 94] };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { label: 'Atrasado', color: [239, 68, 68] };
  if (isBefore(dueCopy, addDays(today, 4))) return { label: 'Próximo', color: [234, 179, 8] };
  return { label: 'Al día', color: [34, 197, 94] };
}

function isWithinPeriod(dateStr: string, start: Date, end: Date): boolean {
  try {
    const d = parseISO(dateStr);
    return !isBefore(d, start) && !isAfter(d, end);
  } catch { return false; }
}

interface PdfOptions {
  topics: TopicWithSubtasks[];
  periodStart: Date;
  periodEnd: Date;
  title?: string;
}

export function generateReportPdf({ topics, periodStart, periodEnd, title }: PdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  const periodStr = `${format(periodStart, 'dd MMM yyyy', { locale: es })} — ${format(periodEnd, 'dd MMM yyyy', { locale: es })}`;
  const emittedStr = format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es });
  const reportTitle = title || `Informe Ejecutivo`;

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodStr}`, margin, y);
  y += 5;
  doc.text(`Emitido: ${emittedStr}`, margin, y);
  y = 46;

  doc.setTextColor(30, 41, 59);

  // KPIs
  const totalSubs = topics.reduce((a, t) => a + t.subtasks.length, 0);
  const doneSubs = topics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const delayed = topics.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
  const warning = topics.filter(t => getTrafficLight(t.due_date).label === 'Próximo').length;
  const onTrack = topics.length - delayed - warning;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen de KPIs', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Indicador', 'Valor']],
    body: [
      ['Temas activos', String(topics.length)],
      ['Al día', String(onTrack)],
      ['Próximos a vencer', String(warning)],
      ['Atrasados', String(delayed)],
      ['Subtareas completadas', `${doneSubs}/${totalSubs} (${pct}%)`],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const label = data.cell.raw as string;
        if (label === 'Atrasados') data.cell.styles.textColor = [239, 68, 68];
        if (label === 'Próximos a vencer') data.cell.styles.textColor = [234, 179, 8];
        if (label === 'Al día') data.cell.styles.textColor = [34, 197, 94];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Semáforo table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Semáforo General', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Tema', 'Prioridad', 'Estado', 'Fecha cierre', 'Progreso']],
    body: topics.map(t => {
      const tl = getTrafficLight(t.due_date);
      const done = t.subtasks.filter(s => s.completed).length;
      const total = t.subtasks.length;
      const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—';
      return [t.title, t.priority.charAt(0).toUpperCase() + t.priority.slice(1), tl.label, dueStr, total > 0 ? `${done}/${total}` : '—'];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = data.cell.raw as string;
        if (val === 'Atrasado') data.cell.styles.textColor = [239, 68, 68];
        else if (val === 'Próximo') data.cell.styles.textColor = [234, 179, 8];
        else data.cell.styles.textColor = [34, 197, 94];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Detail per topic
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle por Tema', margin, y);
  y += 8;

  topics.forEach(t => {
    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }

    const tl = getTrafficLight(t.due_date);
    const done = t.subtasks.filter(s => s.completed).length;
    const total = t.subtasks.length;

    // Topic header bar
    doc.setFillColor(...tl.color);
    doc.rect(margin, y - 4, 3, 6, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(t.title, margin + 5, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    const meta = [
      `Prioridad: ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}`,
      `Estado: ${tl.label}`,
      t.due_date ? `Cierre: ${formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es })}` : null,
      total > 0 ? `Progreso: ${done}/${total} (${Math.round((done / total) * 100)}%)` : null,
    ].filter(Boolean).join('  •  ');
    doc.text(meta, margin + 5, y);
    y += 6;

    // Subtasks
    if (t.subtasks.length > 0) {
      doc.setTextColor(30, 41, 59);
      t.subtasks.forEach(s => {
        if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
        const check = s.completed ? '☑' : '☐';
        const isNew = isWithinPeriod(s.created_at, periodStart, periodEnd);
        doc.setFont('helvetica', 'normal');
        doc.text(`  ${check}  ${s.title}${isNew ? '  ★ NUEVO' : ''}`, margin + 5, y);
        y += 4.5;
      });
      y += 2;
    }

    // Progress entries
    const recentEntries = t.progress_entries.filter(e => isWithinPeriod(e.created_at, periodStart, periodEnd));
    const olderEntries = t.progress_entries.filter(e => !isWithinPeriod(e.created_at, periodStart, periodEnd));

    if (recentEntries.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Novedades (este período):', margin + 5, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      recentEntries.forEach(e => {
        if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`★ ${e.content}`, pageW - margin * 2 - 10);
        doc.text(lines, margin + 7, y);
        y += lines.length * 4;
      });
      y += 2;
    }

    if (olderEntries.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Bitácora anterior:', margin + 5, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      olderEntries.forEach(e => {
        if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`• ${e.content}`, pageW - margin * 2 - 10);
        doc.text(lines, margin + 7, y);
        y += lines.length * 4;
      });
      y += 2;
    }

    // Separator
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado automáticamente — ${emittedStr}`, margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 20, doc.internal.pageSize.getHeight() - 8);
  }

  return doc;
}

export function downloadReportPdf(options: PdfOptions) {
  const doc = generateReportPdf(options);
  const fileName = `informe_${format(options.periodStart, 'yyyyMMdd')}_${format(options.periodEnd, 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}

export function downloadPdfFromContent(content: string, title: string, periodStart: string, periodEnd: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y = 40;

  // Content as text
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const lines = doc.splitTextToSize(content, pageW - margin * 2);
  lines.forEach((line: string) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    // Bold headers
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(line.startsWith('# ') ? 14 : line.startsWith('## ') ? 11 : 9);
      doc.text(line.replace(/^#+\s/, ''), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      y += 6;
    } else {
      doc.text(line, margin, y);
      y += 4;
    }
  });

  const fileName = `informe_${periodStart.replace(/-/g, '')}_${periodEnd.replace(/-/g, '')}.pdf`;
  doc.save(fileName);
}
