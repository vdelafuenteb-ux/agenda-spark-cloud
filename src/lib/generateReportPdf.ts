import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseStoredDate, formatStoredDate } from '@/lib/date';
import type { TopicWithSubtasks } from '@/hooks/useTopics';
import logoIcon from '@/assets/logo_tt_icon.png';

// --- Executive palette: sober & professional ---
const NAVY: [number, number, number] = [30, 41, 59];          // headings
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_300: [number, number, number] = [203, 213, 225];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_100: [number, number, number] = [241, 245, 249];
const SLATE_50: [number, number, number] = [248, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];
const BLUE: [number, number, number] = [37, 99, 235];

function getTrafficLight(dueDateStr: string | null | undefined): { label: string; color: [number, number, number] } {
  if (!dueDateStr) return { label: 'Sin fecha', color: SLATE_400 };
  const dueDate = parseStoredDate(dueDateStr);
  if (!dueDate) return { label: 'Sin fecha', color: SLATE_400 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueCopy = new Date(dueDate);
  dueCopy.setHours(0, 0, 0, 0);
  if (isBefore(dueCopy, today)) return { label: 'Atrasado', color: RED };
  if (isBefore(dueCopy, addDays(today, 4))) return { label: 'Por vencer', color: AMBER };
  return { label: 'Al día', color: GREEN };
}

function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const ax = new Date(a); ax.setHours(0, 0, 0, 0);
  const bx = new Date(b); bx.setHours(0, 0, 0, 0);
  return Math.round((ax.getTime() - bx.getTime()) / ms);
}

export interface PdfOptions {
  topics: TopicWithSubtasks[];
  periodStart: Date;
  periodEnd: Date;
  title?: string;
  authorName?: string;
  authorRole?: string;
  includeBitacora?: boolean;
  includeResponsables?: boolean;
  departments?: { id: string; name: string }[];
  // legacy / unused but kept for backward compatibility:
  includeCompleted?: boolean;
  subtaskFilter?: Record<string, string[]>;
}

// ====================================================
// Page break helper
// ====================================================
function checkPageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 18) {
    doc.addPage();
    return margin;
  }
  return y;
}

// ====================================================
// Big KPI block (executive summary)
// ====================================================
function drawBigKpi(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string, accent: [number, number, number]
) {
  // Card background
  doc.setFillColor(...WHITE);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  // Top accent bar
  doc.setFillColor(...accent);
  doc.rect(x, y, w, 1.4, 'F');

  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...accent);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_500);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 4, { align: 'center' });
}

// ====================================================
// Section title (chapter heading on its own page)
// ====================================================
function drawSectionTitle(doc: jsPDF, sectionNum: number, title: string, subtitle: string, margin: number, contentW: number) {
  let y = 30;
  // Big section number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.setTextColor(...SLATE_200);
  doc.text(`0${sectionNum}`, margin, y);

  // Title beside it
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(title, margin + 28, y - 6);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_500);
  doc.text(subtitle, margin + 28, y);

  // Underline
  y += 6;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + contentW, y);
  return y + 8;
}

// ====================================================
// MAIN
// ====================================================
export function generateReportPdf(opts: PdfOptions) {
  const {
    topics,
    periodStart,
    periodEnd,
    title,
    authorName,
    authorRole,
    includeBitacora = false,
    includeResponsables = true,
  } = opts;

  const ownerName = authorName || 'Administración';
  const reportTitle = title || 'Informe Ejecutivo';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;

  const periodStr = `${format(periodStart, "dd 'de' MMMM yyyy", { locale: es })} — ${format(periodEnd, "dd 'de' MMMM yyyy", { locale: es })}`;
  const emittedStr = format(new Date(), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es });

  // --- Bucket topics ---
  // ACTIVOS = activo + seguimiento (incluye archivados que tienen estos status)
  const activeTopics = topics.filter(t => t.status === 'activo' || t.status === 'seguimiento');
  const pausedTopics = topics.filter(t => t.status === 'pausado');
  // CERRADOS filtrados por rango de fechas (closed_at dentro de periodo)
  const closedTopics = topics.filter(t => {
    if (t.status !== 'completado') return false;
    if (!t.closed_at) return true; // include if no closed_at recorded
    const closed = new Date(t.closed_at);
    return closed >= periodStart && closed <= addDays(periodEnd, 1);
  });

  // ===================================================================
  // PAGE 1 - EXECUTIVE SUMMARY
  // ===================================================================
  let y = 18;

  // --- Header ---
  try { doc.addImage(logoIcon, 'PNG', margin, y - 4, 11, 11); } catch (_e) {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  doc.text('INFORME EJECUTIVO', pageW - margin, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_400);
  doc.text(emittedStr, pageW - margin, y + 4, { align: 'right' });

  y += 18;

  // --- Title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...NAVY);
  doc.text(reportTitle, margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...SLATE_500);
  doc.text(periodStr, margin, y);
  y += 5;

  if (authorName) {
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_400);
    const who = authorRole ? `${authorName} · ${authorRole}` : authorName;
    doc.text(who, margin, y);
    y += 5;
  }

  // Separator
  y += 3;
  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // --- KPIs ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...SLATE_500);
  doc.text('INDICADORES GENERALES', margin, y);
  y += 5;

  const kpiW = (contentW - 12) / 4;
  const kpiH = 28;
  const kpis: { value: string; label: string; color: [number, number, number] }[] = [
    { value: String(topics.length), label: 'Temas Totales', color: NAVY },
    { value: String(activeTopics.length), label: 'Activos', color: BLUE },
    { value: String(pausedTopics.length), label: 'Pausados', color: AMBER },
    { value: String(closedTopics.length), label: 'Cerrados', color: GREEN },
  ];
  kpis.forEach((k, i) => {
    drawBigKpi(doc, margin + i * (kpiW + 4), y, kpiW, kpiH, k.value, k.label, k.color);
  });
  y += kpiH + 10;

  // --- Critical alerts: overdue + due-soon ---
  const overdue = activeTopics
    .filter(t => getTrafficLight(t.due_date).label === 'Atrasado')
    .sort((a, b) => {
      const da = parseStoredDate(a.due_date!)!.getTime();
      const db = parseStoredDate(b.due_date!)!.getTime();
      return da - db;
    });
  const dueSoon = activeTopics
    .filter(t => getTrafficLight(t.due_date).label === 'Por vencer')
    .sort((a, b) => {
      const da = parseStoredDate(a.due_date!)!.getTime();
      const db = parseStoredDate(b.due_date!)!.getTime();
      return da - db;
    });

  if (overdue.length > 0 || dueSoon.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...SLATE_500);
    doc.text('ALERTAS CRÍTICAS', margin, y);
    y += 4;

    const top = [...overdue, ...dueSoon].slice(0, 5);
    const today = new Date();

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tema', 'Responsable', 'Vence', 'Estado']],
      body: top.map(t => {
        const tl = getTrafficLight(t.due_date);
        const due = parseStoredDate(t.due_date!);
        const days = due ? daysBetween(today, due) : 0;
        const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yyyy', { locale: es }) : '—';
        const status = tl.label === 'Atrasado'
          ? `${tl.label} (${days}d)`
          : `${tl.label} (en ${-days}d)`;
        return [t.title, t.assignee || ownerName, dueStr, status];
      }),
      styles: { fontSize: 8.5, cellPadding: 2.8, lineColor: SLATE_200 as any, lineWidth: 0.15, textColor: SLATE_700 as any },
      headStyles: { fillColor: NAVY as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
      alternateRowStyles: { fillColor: SLATE_50 as any },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 38 },
        2: { cellWidth: 28 },
        3: { cellWidth: 32, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const v = data.cell.raw as string;
          if (v.startsWith('Atrasado')) data.cell.styles.textColor = RED as any;
          else if (v.startsWith('Por vencer')) data.cell.styles.textColor = AMBER as any;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- Resumen por responsable (compact) ---
  if (includeResponsables) {
    const assigneeMap = new Map<string, TopicWithSubtasks[]>();
    topics.forEach(t => {
      const key = t.assignee || ownerName;
      if (!assigneeMap.has(key)) assigneeMap.set(key, []);
      assigneeMap.get(key)!.push(t);
    });

    if (assigneeMap.size > 0) {
      y = checkPageBreak(doc, y, 30, margin);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...SLATE_500);
      doc.text('RESUMEN POR RESPONSABLE', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Responsable', 'Activos', 'Atrasados', 'Pausados', 'Cerrados', 'Total']],
        body: Array.from(assigneeMap.entries())
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([name, list]) => {
            const a = list.filter(t => t.status === 'activo' || t.status === 'seguimiento').length;
            const p = list.filter(t => t.status === 'pausado').length;
            const c = list.filter(t => t.status === 'completado').length;
            const od = list.filter(t =>
              (t.status === 'activo' || t.status === 'seguimiento') &&
              getTrafficLight(t.due_date).label === 'Atrasado'
            ).length;
            return [name, String(a), String(od), String(p), String(c), String(list.length)];
          }),
        styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: SLATE_200 as any, lineWidth: 0.15, halign: 'center', textColor: SLATE_700 as any },
        headStyles: { fillColor: SLATE_700 as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: SLATE_50 as any },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold', textColor: NAVY as any },
          1: { cellWidth: 22 },
          2: { cellWidth: 24 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20, fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            const v = parseInt(data.cell.raw as string);
            if (v > 0) {
              data.cell.styles.textColor = RED as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // --- Page 1 footer note ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_400);
  const note = 'El detalle de cada sección se presenta en las páginas siguientes.';
  doc.text(note, margin, pageH - 18);

  // ===================================================================
  // DETAIL BY DEPARTMENT
  // Each department: Activos → Pausados → Cerrados, then page break.
  // ===================================================================
  const deptMap = new Map<string, { id: string; name: string }>();
  (opts.departments || []).forEach(d => deptMap.set(d.id, d));
  const NO_DEPT_KEY = '__no_dept__';

  // Build a unified set of department keys present across the 3 buckets
  const allDeptKeys = new Set<string>();
  const keyOf = (t: TopicWithSubtasks) =>
    t.department_id && deptMap.has(t.department_id) ? t.department_id : NO_DEPT_KEY;
  [...activeTopics, ...pausedTopics, ...closedTopics].forEach(t => allDeptKeys.add(keyOf(t)));

  const sortedDeptKeys = Array.from(allDeptKeys).sort((a, b) => {
    if (a === NO_DEPT_KEY) return 1;
    if (b === NO_DEPT_KEY) return -1;
    const an = deptMap.get(a)?.name || '';
    const bn = deptMap.get(b)?.name || '';
    return an.localeCompare(bn, 'es');
  });

  const sortByAssigneeThenOrder = (a: TopicWithSubtasks, b: TopicWithSubtasks) => {
    const aa = (a.assignee || ownerName).localeCompare(b.assignee || ownerName, 'es');
    if (aa !== 0) return aa;
    const eo = (a.execution_order ?? 999) - (b.execution_order ?? 999);
    if (eo !== 0) return eo;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  };

  if (sortedDeptKeys.length === 0) {
    doc.addPage();
    y = drawSectionTitle(doc, 1, 'Detalle por Departamento', 'Sin temas para mostrar', margin, contentW);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_400);
    doc.text('No hay temas registrados en el período.', margin, y + 6);
  } else {
    sortedDeptKeys.forEach((deptKey, deptIdx) => {
      const deptName = deptKey === NO_DEPT_KEY
        ? 'Sin departamento'
        : (deptMap.get(deptKey)?.name || 'Sin departamento');

      const deptActive = activeTopics.filter(t => keyOf(t) === deptKey).sort(sortByAssigneeThenOrder);
      const deptPaused = pausedTopics.filter(t => keyOf(t) === deptKey).sort(sortByAssigneeThenOrder);
      const deptClosed = closedTopics.filter(t => keyOf(t) === deptKey).sort(sortByAssigneeThenOrder);

      // New page per department
      doc.addPage();
      y = 22;

      // Department header banner
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentW, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...WHITE);
      doc.text(deptName.toUpperCase(), margin + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE_200);
      doc.text(
        `${deptActive.length} activo(s) · ${deptPaused.length} pausado(s) · ${deptClosed.length} cerrado(s)`,
        margin + 4, y + 11
      );
      // Section number badge (top-right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...SLATE_300);
      doc.text(`${String(deptIdx + 1).padStart(2, '0')} / ${String(sortedDeptKeys.length).padStart(2, '0')}`, pageW - margin - 4, y + 9, { align: 'right' });
      y += 18;

      // -------- ACTIVOS sub-section --------
      if (deptActive.length > 0) {
        y = checkPageBreak(doc, y, 14, margin);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['#', 'Tema', 'Responsable', 'Inicio', 'Vence', 'Estado', 'Avance']],
          body: deptActive.map((t, i) => {
            const tl = getTrafficLight(t.due_date);
            const done = t.subtasks.filter(s => s.completed).length;
            const total = t.subtasks.length;
            const avance = total > 0 ? `${done}/${total} (${Math.round((done / total) * 100)}%)` : '—';
            const startStr = t.start_date ? formatStoredDate(t.start_date, 'dd MMM yy', { locale: es }) : '—';
            const dueStr = t.due_date ? formatStoredDate(t.due_date, 'dd MMM yy', { locale: es }) : '—';
            return [String(i + 1), t.title, t.assignee || ownerName, startStr, dueStr, tl.label, avance];
          }),
          styles: { fontSize: 8.5, cellPadding: 2.6, overflow: 'linebreak', lineColor: SLATE_200 as any, lineWidth: 0.15, textColor: SLATE_700 as any, valign: 'middle' },
          headStyles: { fillColor: NAVY as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 8.5 },
          alternateRowStyles: { fillColor: SLATE_50 as any },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center', textColor: SLATE_400 as any },
            1: { cellWidth: 'auto', fontStyle: 'bold', textColor: NAVY as any },
            2: { cellWidth: 32 },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
            6: { cellWidth: 24, halign: 'center' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              const v = data.cell.raw as string;
              if (v === 'Atrasado') data.cell.styles.textColor = RED as any;
              else if (v === 'Por vencer') data.cell.styles.textColor = AMBER as any;
              else if (v === 'Al día') data.cell.styles.textColor = GREEN as any;
              else data.cell.styles.textColor = SLATE_400 as any;
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // -------- PAUSADOS sub-section --------
      if (deptPaused.length > 0) {
        y = checkPageBreak(doc, y, 14, margin);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['#', 'Tema', 'Responsable', 'Pausado desde', 'Razón']],
          body: deptPaused.map((t, i) => {
            const pausedAt = t.paused_at ? format(new Date(t.paused_at), 'dd MMM yyyy', { locale: es }) : '—';
            return [String(i + 1), t.title, t.assignee || ownerName, pausedAt, t.pause_reason || '—'];
          }),
          styles: { fontSize: 8.5, cellPadding: 2.6, overflow: 'linebreak', lineColor: SLATE_200 as any, lineWidth: 0.15, textColor: SLATE_700 as any, valign: 'middle' },
          headStyles: { fillColor: AMBER as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 8.5 },
          alternateRowStyles: { fillColor: SLATE_50 as any },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center', textColor: SLATE_400 as any },
            1: { cellWidth: 60, fontStyle: 'bold', textColor: NAVY as any },
            2: { cellWidth: 32 },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 'auto' },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // -------- CERRADOS sub-section --------
      if (deptClosed.length > 0) {
        y = checkPageBreak(doc, y, 14, margin);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...GREEN);
        doc.text(`▸ Cerrados (${deptClosed.length})`, margin, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['#', 'Tema', 'Responsable', 'Vencía', 'Cerrado el', 'Cumplimiento']],
          body: deptClosed.map((t, i) => {
            const closedDate = t.closed_at ? new Date(t.closed_at) : null;
            const dueDate = t.due_date ? parseStoredDate(t.due_date) : null;
            let compliance = '—';
            if (closedDate && dueDate) {
              const diff = daysBetween(closedDate, dueDate);
              if (diff <= 0) compliance = `A tiempo${diff < 0 ? ` (${-diff}d antes)` : ''}`;
              else compliance = `Atrasado (${diff}d)`;
            } else if (closedDate && !dueDate) {
              compliance = 'Sin plazo';
            }
            return [
              String(i + 1),
              t.title,
              t.assignee || ownerName,
              dueDate ? format(dueDate, 'dd MMM yy', { locale: es }) : '—',
              closedDate ? format(closedDate, 'dd MMM yy', { locale: es }) : '—',
              compliance,
            ];
          }),
          styles: { fontSize: 8.5, cellPadding: 2.6, overflow: 'linebreak', lineColor: SLATE_200 as any, lineWidth: 0.15, textColor: SLATE_700 as any, valign: 'middle' },
          headStyles: { fillColor: GREEN as any, textColor: WHITE as any, fontStyle: 'bold', fontSize: 8.5 },
          alternateRowStyles: { fillColor: SLATE_50 as any },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center', textColor: SLATE_400 as any },
            1: { cellWidth: 'auto', fontStyle: 'bold', textColor: NAVY as any },
            2: { cellWidth: 32 },
            3: { cellWidth: 22, halign: 'center' },
            4: { cellWidth: 22, halign: 'center' },
            5: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              const v = data.cell.raw as string;
              if (v.startsWith('A tiempo')) data.cell.styles.textColor = GREEN as any;
              else if (v.startsWith('Atrasado')) data.cell.styles.textColor = RED as any;
              else data.cell.styles.textColor = SLATE_500 as any;
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Optional bitácora notes per active topic in this department
      if (includeBitacora) {
        for (const t of deptActive) {
          if (!t.progress_entries || t.progress_entries.length === 0) continue;
          const last = t.progress_entries[t.progress_entries.length - 1];
          y = checkPageBreak(doc, y, 14, margin);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...NAVY);
          doc.text(`▸ ${t.title}`, margin, y);
          y += 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...SLATE_700);
          const lines = doc.splitTextToSize(`Último avance: ${last.content}`, contentW - 4);
          doc.text(lines, margin + 4, y);
          y += lines.length * 4 + 2;
        }
      }
    });
  }

  // ===================================================================
  // FOOTERS on every page
  // ===================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_400);
    doc.text(`Confidencial · ${reportTitle}`, margin, pageH - 7);
    doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  return doc;
}

export function downloadReportPdf(options: PdfOptions) {
  const doc = generateReportPdf(options);
  const baseName = (options.title || 'Informe Ejecutivo').replace(/[\/\\:*?"<>|]/g, '_').trim();
  doc.save(`${baseName}.pdf`);
}

export function downloadPdfFromContent(content: string, title: string, _periodStart: string, _periodEnd: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 22;

  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y += 6;
  doc.setDrawColor(...SLATE_200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setTextColor(...SLATE_700);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const lines = doc.splitTextToSize(content, pageW - margin * 2);
  lines.forEach((line: string) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(line.startsWith('# ') ? 14 : line.startsWith('## ') ? 11 : 10);
      doc.setTextColor(...NAVY);
      doc.text(line.replace(/^#+\s/, ''), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...SLATE_700);
      y += 6;
    } else {
      doc.text(line, margin, y);
      y += 4;
    }
  });

  const baseName = (title || 'Informe Ejecutivo').replace(/[\/\\:*?"<>|]/g, '_').trim();
  doc.save(`${baseName}.pdf`);
}
