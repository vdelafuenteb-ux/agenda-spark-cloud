import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isBefore, addDays, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseStoredDate, formatStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';

// --- Colors ---
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_50: [number, number, number] = [248, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];
const TEAL: [number, number, number] = [13, 148, 136];

function getTrafficLight(dueDateStr: string | null | undefined): { label: string; color: [number, number, number] } {
  if (!dueDateStr) return { label: 'Al día', color: GREEN };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { label: 'Al día', color: GREEN };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { label: 'Atrasado', color: RED };
  if (isBefore(dueCopy, addDays(today, 4))) return { label: 'Próximo', color: AMBER };
  return { label: 'Al día', color: GREEN };
}

function isWithinPeriod(dateStr: string, start: Date, end: Date): boolean {
  try {
    const d = parseISO(dateStr);
    return !isBefore(d, start) && !isAfter(d, end);
  } catch { return false; }
}

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  seguimiento: 'Seguimiento',
  completado: 'Completado',
  pausado: 'Pausado',
};

export interface PdfOptions {
  topics: TopicWithSubtasks[];
  periodStart: Date;
  periodEnd: Date;
  title?: string;
  authorName?: string;
  authorRole?: string;
  includeCompleted?: boolean;
  includeBitacora?: boolean;
  includeResponsables?: boolean;
}

function drawKpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, value: string, label: string, color: [number, number, number]) {
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  
  // Color accent bar at top
  doc.setFillColor(...color);
  doc.rect(x, y, w, 1.5, 'F');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(value, x + w / 2, y + 12, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_500);
  doc.text(label, x + w / 2, y + 18, { align: 'center' });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    return margin;
  }
  return y;
}

export function generateReportPdf(opts: PdfOptions) {
  const { topics, periodStart, periodEnd, title, authorName, authorRole, includeCompleted = true, includeBitacora = true, includeResponsables = true } = opts;
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  const periodStr = `${format(periodStart, 'dd MMM yyyy', { locale: es })} — ${format(periodEnd, 'dd MMM yyyy', { locale: es })}`;
  const emittedStr = format(new Date(), "dd MMM yyyy 'a las' HH:mm", { locale: es });
  const reportTitle = title || 'Informe Ejecutivo';

  // Classify topics
  const activeTopics = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
  const completedTopics = topics.filter(t => t.status === 'completado');
  const pausedTopics = topics.filter(t => t.status === 'pausado');

  // ==========================================
  // HEADER - Dark bar
  // ==========================================
  const headerH = authorName ? 44 : 38;
  doc.setFillColor(...SLATE_900);
  doc.rect(0, 0, pageW, headerH, 'F');
  
  // Accent line
  doc.setFillColor(...TEAL);
  doc.rect(0, headerH, pageW, 1, 'F');

  y = 16;
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, margin, y);
  y += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodStr}`, margin, y);
  
  if (authorName) {
    y += 5;
    const authorText = authorRole ? `${authorName} — ${authorRole}` : authorName;
    doc.text(authorText, margin, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 210);
    doc.text(`Emitido: ${emittedStr}`, margin, y);
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(180, 190, 210);
    doc.text(`Emitido: ${emittedStr}`, pageW - margin, y, { align: 'right' });
  }

  y = headerH + 8;
  doc.setTextColor(...SLATE_900);

  // ==========================================
  // KPIs
  // ==========================================
  const totalSubs = topics.reduce((a, t) => a + t.subtasks.length, 0);
  const doneSubs = topics.reduce((a, t) => a + t.subtasks.filter(s => s.completed).length, 0);
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const delayed = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
  const warning = activeTopics.filter(t => getTrafficLight(t.due_date).label === 'Próximo').length;
  const onTrack = activeTopics.length - delayed - warning;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', margin, y);
  y += 3;

  // KPI boxes
  const kpiW = (contentW - 12) / 5;
  const kpiH = 22;
  const kpis = [
    { value: String(topics.length), label: 'Temas Totales', color: SLATE_700 },
    { value: String(onTrack), label: 'Al Día', color: GREEN },
    { value: String(warning), label: 'Próximos', color: AMBER },
    { value: String(delayed), label: 'Atrasados', color: RED },
    { value: `${pct}%`, label: 'Avance Subtareas', color: TEAL },
  ];

  kpis.forEach((kpi, i) => {
    drawKpiBox(doc, margin + i * (kpiW + 3), y, kpiW, kpiH, kpi.value, kpi.label, kpi.color as [number, number, number]);
  });

  y += kpiH + 6;

  // Narrative summary
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_700);
  let narrative = `Durante el período evaluado se gestionaron ${topics.length} temas en total.`;
  if (completedTopics.length > 0) narrative += ` Se completaron ${completedTopics.length} exitosamente.`;
  if (delayed > 0) narrative += ` ${delayed} tema(s) presentan atrasos que requieren atención.`;
  narrative += ` El avance global en subtareas es de ${pct}% (${doneSubs}/${totalSubs}).`;
  
  const narrativeLines = doc.splitTextToSize(narrative, contentW);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 3.5 + 6;

  // ==========================================
  // LOGROS DEL PERÍODO (Completados)
  // ==========================================
  if (includeCompleted && completedTopics.length > 0) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_900);
    doc.text('Logros del Período', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema Completado', 'Responsable', 'Prioridad']],
      body: completedTopics.map(t => [
        t.title,
        t.assignee || 'Yo',
        t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: GREEN as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: SLATE_50 as any },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // SEMÁFORO GENERAL (Activos)
  // ==========================================
  if (activeTopics.length > 0) {
    y = checkPageBreak(doc, y, 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_900);
    doc.text('Semáforo General', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema', 'Responsable', 'Prioridad', 'Estado', 'Fecha Cierre', 'Progreso']],
      body: activeTopics.map(t => {
        const tl = getTrafficLight(t.due_date);
        const done = t.subtasks.filter(s => s.completed).length;
        const total = t.subtasks.length;
        const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—';
        return [
          t.title,
          t.assignee || 'Yo',
          t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
          tl.label,
          dueStr,
          total > 0 ? `${done}/${total}` : '—',
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: SLATE_900 as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: SLATE_50 as any },
      columnStyles: {
        0: { cellWidth: 'auto' },
        3: { cellWidth: 22 },
        5: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === 'Atrasado') data.cell.styles.textColor = RED as any;
          else if (val === 'Próximo') data.cell.styles.textColor = AMBER as any;
          else data.cell.styles.textColor = GREEN as any;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // DETALLE POR TEMA
  // ==========================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_900);
  y = checkPageBreak(doc, y, 15, 20);
  doc.text('Detalle por Tema', margin, y);
  y += 7;

  topics.forEach(t => {
    y = checkPageBreak(doc, y, 30, 20);

    const tl = getTrafficLight(t.due_date);
    const done = t.subtasks.filter(s => s.completed).length;
    const total = t.subtasks.length;
    const responsable = t.assignee || 'Yo';
    const statusLabel = STATUS_LABELS[t.status] || t.status;

    // Topic header with color bar
    doc.setFillColor(...tl.color);
    doc.rect(margin, y - 4, 2.5, 6, 'F');
    
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_900);
    doc.text(t.title, margin + 5, y);
    y += 5;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);

    const meta = [
      `Estado: ${statusLabel}`,
      `Responsable: ${responsable}`,
      `Prioridad: ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}`,
      t.due_date ? `Cierre: ${formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es })}` : null,
      total > 0 ? `Progreso: ${done}/${total} (${Math.round((done / total) * 100)}%)` : null,
    ].filter(Boolean).join('  •  ');
    doc.text(meta, margin + 5, y);
    y += 5;

    // Progress bar
    if (total > 0) {
      const barW = 50;
      const barH = 2.5;
      const progress = total > 0 ? done / total : 0;
      doc.setFillColor(...SLATE_200);
      doc.roundedRect(margin + 5, y, barW, barH, 1, 1, 'F');
      if (progress > 0) {
        doc.setFillColor(...tl.color);
        doc.roundedRect(margin + 5, y, barW * progress, barH, 1, 1, 'F');
      }
      y += 5;
    }

    // Subtasks
    if (t.subtasks.length > 0) {
      doc.setTextColor(...SLATE_900);
      t.subtasks.forEach(s => {
        y = checkPageBreak(doc, y, 5, 20);
        const check = s.completed ? '☑' : '☐';
        const isNew = isWithinPeriod(s.created_at, periodStart, periodEnd);
        doc.setFont('helvetica', s.completed ? 'normal' : 'normal');
        doc.setTextColor(s.completed ? ...SLATE_500 : ...SLATE_900);
        doc.setFontSize(7.5);
        doc.text(`  ${check}  ${s.title}${isNew ? '  ★ NUEVO' : ''}`, margin + 5, y);
        y += 4;
      });
      y += 2;
    }

    // Bitácora
    if (includeBitacora) {
      const recentEntries = t.progress_entries.filter(e => isWithinPeriod(e.created_at, periodStart, periodEnd));
      const olderEntries = t.progress_entries.filter(e => !isWithinPeriod(e.created_at, periodStart, periodEnd));

      if (recentEntries.length > 0) {
        y = checkPageBreak(doc, y, 10, 20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...TEAL);
        doc.setFontSize(7.5);
        doc.text('Novedades (este período):', margin + 5, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE_700);
        recentEntries.forEach(e => {
          y = checkPageBreak(doc, y, 5, 20);
          const lines = doc.splitTextToSize(`★ ${e.content}`, contentW - 10);
          doc.text(lines, margin + 7, y);
          y += lines.length * 3.5;
        });
        y += 2;
      }

      if (olderEntries.length > 0) {
        y = checkPageBreak(doc, y, 10, 20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...SLATE_500);
        doc.setFontSize(7.5);
        doc.text('Bitácora anterior:', margin + 5, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        olderEntries.forEach(e => {
          y = checkPageBreak(doc, y, 5, 20);
          const lines = doc.splitTextToSize(`• ${e.content}`, contentW - 10);
          doc.text(lines, margin + 7, y);
          y += lines.length * 3.5;
        });
        y += 2;
      }
    }

    // Separator
    doc.setDrawColor(...SLATE_200);
    doc.line(margin, y, pageW - margin, y);
    y += 7;
  });

  // ==========================================
  // RESUMEN POR RESPONSABLE
  // ==========================================
  if (includeResponsables) {
    const assigneeMap = new Map<string, TopicWithSubtasks[]>();
    topics.forEach(t => {
      const key = t.assignee || 'Yo';
      if (!assigneeMap.has(key)) assigneeMap.set(key, []);
      assigneeMap.get(key)!.push(t);
    });

    if (assigneeMap.size > 0) {
      y = checkPageBreak(doc, y, 20, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SLATE_900);
      doc.text('Resumen por Responsable', margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Responsable', 'Temas', 'Activos', 'Completados', 'Atrasados']],
        body: Array.from(assigneeMap.entries()).map(([name, tList]) => {
          const active = tList.filter(t => t.status === 'activo' || t.status === 'seguimiento').length;
          const completed = tList.filter(t => t.status === 'completado').length;
          const overdue = tList.filter(t => getTrafficLight(t.due_date).label === 'Atrasado').length;
          return [name, String(tList.length), String(active), String(completed), String(overdue)];
        }),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: SLATE_700 as any, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: SLATE_50 as any },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = parseInt(data.cell.raw as string);
            if (val > 0) {
              data.cell.styles.textColor = RED as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ==========================================
  // FOOTER
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    
    // Bottom accent line
    doc.setFillColor(...SLATE_200);
    doc.rect(0, pageH - 12, pageW, 0.5, 'F');
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`Generado automáticamente — ${emittedStr}`, margin, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
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
  const margin = 14;
  let y = 20;

  // Header
  doc.setFillColor(...SLATE_900);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 32, pageW, 1, 'F');
  
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y = 40;

  doc.setTextColor(...SLATE_900);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const lines = doc.splitTextToSize(content, pageW - margin * 2);
  lines.forEach((line: string) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
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
