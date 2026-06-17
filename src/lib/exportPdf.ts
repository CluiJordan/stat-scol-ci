import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Session, Centre } from '../types';
import { computeRow, computeTotals, pct, admisThreshold } from './calculations';

export function exportListeAdmis(session: Session, format: 'grand' | 'normal', selectionNote?: string) {
  const admis = (session.eleves ?? [])
    .filter((e) => !e.absent && e.points !== null && e.points >= admisThreshold(session.examType))
    .sort((a, b) => {
      const n = a.nom.localeCompare(b.nom, 'fr');
      return n !== 0 ? n : a.prenoms.localeCompare(b.prenoms, 'fr');
    });

  const isGrand = format === 'grand';
  const doc = new jsPDF({ orientation: isGrand ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const headerY = drawHeader(doc, session, selectionNote);
  const pageW = doc.internal.pageSize.getWidth();

  const titleSize = isGrand ? 16 : 13;
  const subSize = isGrand ? 10 : 8.5;

  let y = headerY + 8;
  doc.setFontSize(titleSize);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTE DES ADMIS', pageW / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(subSize);
  doc.setFont('helvetica', 'normal');
  const sessionYear = session.anneeScolaire?.split(/[-–]/).at(-1)?.trim() ?? session.examSession ?? '';
  doc.text(`${session.examType} session ${sessionYear}`, pageW / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.text(`${admis.length} admis`, pageW / 2, y, { align: 'center' });

  const tableStartY = y + 8;

  let tableSize: number;
  let cellPad: number;
  let grandNumW = 16;
  let grandNomW = 0;
  let grandPrenomW = 0;

  if (isGrand) {
    const tableW = pageW - 28;
    const matW = 48; // Matricule toujours fixe

    tableSize = 7;
    grandNumW = 16;
    grandNomW = (tableW - 16 - matW) / 2;
    grandPrenomW = grandNomW;

    outer: for (let size = 24; size >= 7; size -= 0.5) {
      const pad = Math.max(2, size * 0.11);
      doc.setFontSize(size);

      // Largeur minimale pour la colonne N° (ex: "001", "099", "100")
      doc.setFont('helvetica', 'normal');
      const numNeeded = doc.getTextWidth(String(admis.length).padStart(3, '0')) + 2 * pad;

      // Largeur minimale Nom
      doc.setFont('helvetica', 'bold');
      let maxNomW = 0;
      for (const e of admis) {
        const w = doc.getTextWidth(e.nom);
        if (w > maxNomW) maxNomW = w;
      }

      // Largeur minimale Prénoms
      doc.setFont('helvetica', 'normal');
      let maxPrenomW = 0;
      for (const e of admis) {
        const w = doc.getTextWidth(e.prenoms);
        if (w > maxPrenomW) maxPrenomW = w;
      }

      const nomNeeded = maxNomW + 2 * pad;
      const prenomNeeded = maxPrenomW + 2 * pad;

      if (numNeeded + matW + nomNeeded + prenomNeeded > tableW) continue outer;

      tableSize = size;
      grandNumW = numNeeded;
      grandNomW = nomNeeded;
      grandPrenomW = tableW - numNeeded - matW - nomNeeded;
      break;
    }
    cellPad = Math.max(2, tableSize * 0.11);
  } else {
    tableSize = 8.5;
    cellPad = 2.5;
  }

  const body = admis.map((e, i) =>
    isGrand
      ? [String(i + 1).padStart(3, '0'), e.matricule || '—', e.nom, e.prenoms]
      : [String(i + 1).padStart(3, '0'), e.matricule || '—', e.nom, e.prenoms, String(e.points ?? '')]
  );

  autoTable(doc, {
    startY: tableStartY,
    head: [isGrand ? ['N°', 'Matricule', 'Nom', 'Prénoms'] : ['N°', 'Matricule', 'Nom', 'Prénoms', 'Points']],
    body,
    tableWidth: pageW - 28,
    styles: { fontSize: tableSize, cellPadding: cellPad, halign: 'center' },
    headStyles: { fillColor: [28, 43, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { lineWidth: 0.2, lineColor: [180, 180, 180] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: isGrand
      ? {
          0: { halign: 'center', cellWidth: grandNumW },
          1: { halign: 'center', cellWidth: 48 },
          2: { halign: 'left', fontStyle: 'bold', cellWidth: grandNomW },
          3: { halign: 'left', cellWidth: grandPrenomW },
        }
      : {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 35 },
          2: { halign: 'left', fontStyle: 'bold' },
          3: { halign: 'left' },
          4: { halign: 'center', cellWidth: 18 },
        },
  });

  ensureFooterSpace(doc);
  drawDirecteurFooter(doc, session.nomDirecteur);
  const suffix = isGrand ? 'Grand_Format' : 'Format_Normal';
  doc.save(`Liste_Admis_${suffix}_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.pdf`);
}

// Ajoute une page si la dernière ligne du tableau chevauche la zone du footer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureFooterSpace(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const lastY = (doc as any).lastAutoTable?.finalY ?? 0;
  if (lastY > pageH - 44) doc.addPage();
}

function drawDirecteurFooter(doc: jsPDF, nomDirecteur?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = pageW - 22; // recule du bord droit

  // Date (au-dessus)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Fait à _________________________, le _________________________', x, pageH - 38, { align: 'right' });

  // LE DIRECTEUR
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LE DIRECTEUR', x, pageH - 30, { align: 'right' });

  // ~20mm d'espace pour la signature, puis le nom
  if (nomDirecteur) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(nomDirecteur, x, pageH - 10, { align: 'right' });
  }
}

// Returns bottom Y of the header block so callers can position content dynamically
function drawHeader(doc: jsPDF, session: Session, selectionNote?: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  // Wrap at ~90 mm so text fills 2-3 lines; right side holds the ANNEE SCOLAIRE block
  const ministereLines = doc.splitTextToSize(session.ministere || '', 90);
  const lineH = 3.5; // mm per line at fontSize 8

  doc.text(ministereLines, 14, 12);
  if (session.anneeScolaire) {
    doc.text(`ANNEE SCOLAIRE\n${session.anneeScolaire}`, pageW - 14, 12, { align: 'right' });
  }

  const sep1Y = 12 + ministereLines.length * lineH + 0.5;
  doc.setLineWidth(0.3);
  doc.line(14, sep1Y, 110, sep1Y);

  const drenaY = sep1Y + 4;
  if (session.drena) doc.text(session.drena, 14, drenaY);

  const sep2Y = drenaY + 3;
  doc.line(14, sep2Y, 110, sep2Y);

  const etabY = sep2Y + 4;
  if (session.etablissement) doc.text(session.etablissement, 14, etabY);
  if (session.code) doc.text(session.code, 14, etabY + lineH);

  let finalY = etabY + (session.code ? lineH * 2 : lineH) + 2;

  if (selectionNote) {
    doc.setFont('helvetica', 'bolditalic');
    doc.text(`Sélection : ${selectionNote}`, 14, finalY);
    doc.setFont('helvetica', 'normal');
    finalY += lineH + 1;
  }

  return finalY;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyColColors(data: any, garconCols: number[], filleCols: number[], totalRowIndex: number) {
  const isTotal = data.section === 'body' && data.row.index === totalRowIndex;
  const isGarcon = garconCols.includes(data.column.index);
  const isFille = filleCols.includes(data.column.index);

  if (isTotal) {
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fillColor = isGarcon ? [196, 220, 253] : isFille ? [249, 207, 232] : [220, 220, 220];
  } else if (data.section === 'head') {
    if (isGarcon) data.cell.styles.fillColor = [219, 234, 254];
    else if (isFille) data.cell.styles.fillColor = [252, 231, 243];
  } else if (data.section === 'body') {
    if (isGarcon) data.cell.styles.fillColor = [239, 246, 255];
    else if (isFille) data.cell.styles.fillColor = [253, 242, 248];
  }
}

export function exportBEPCGeneral(session: Session, selectionNote?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headerY = drawHeader(doc, session, selectionNote);

  const computed = session.classes.map((c) => computeRow(c, 'BEPC'));
  const totals = computeTotals(computed, 'BEPC');

  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistique générale', pageW / 2, headerY + 7, { align: 'center' });

  const head = [[
    'Classe',
    'Candidats inscrits', 'Candidats Présents', 'Admis', "Taux d'admission",
    'Inscrits Garçon', 'Admis Garçon', "Taux d'admission Garçon",
    'Inscrits Fille', 'Admis Fille', "Taux d'admission Fille",
  ]];

  const body = computed.map((r) => [
    r.name,
    r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
    r.inscritsGarcon, r.admisGarcon, pct(r.tauxGarcon),
    r.inscritsFille, r.admisFille, pct(r.tauxFille),
  ]);
  body.push([
    'TOTAL',
    totals.inscritsTotal, totals.presentsTotal, totals.admisTotal, pct(totals.tauxTotal),
    totals.inscritsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
    totals.inscritsFille, totals.admisFille, pct(totals.tauxFille),
  ]);

  autoTable(doc, {
    startY: headerY + 14,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data) => applyColColors(data, [5, 6, 7], [8, 9, 10], body.length - 1),
  });

  ensureFooterSpace(doc);
  drawDirecteurFooter(doc, session.nomDirecteur);
  doc.save(`BEPC_Statistique_Generale_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.pdf`);
}

export function exportBEPCParEtablissement(session: Session) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headerY = drawHeader(doc, session);

  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistique par établissement', pageW / 2, headerY + 7, { align: 'center' });

  const head = [[
    'Classe',
    'Candidats inscrits', 'Candidats Présents', 'Admis', "Taux d'admission",
    'Inscrits Garçon', 'Admis Garçon', "Taux d'admission Garçon",
    'Inscrits Fille', 'Admis Fille', "Taux d'admission Fille",
  ]];

  let currentY = headerY + 14;
  const allComputed = session.classes.map((c) => computeRow(c, 'BEPC'));

  const centresWithRows: { centre: Centre | null; rows: typeof allComputed }[] = [];
  session.centres.forEach((centre) => {
    const rows = allComputed.filter((r) => r.centreId === centre.id);
    if (rows.length > 0) centresWithRows.push({ centre, rows });
  });
  const unassigned = allComputed.filter((r) => !r.centreId || !session.centres.find((c) => c.id === r.centreId));
  if (unassigned.length > 0) centresWithRows.push({ centre: null, rows: unassigned });

  centresWithRows.forEach(({ centre, rows }) => {
    const groupTotals = computeTotals(rows, 'BEPC');
    const body = rows.map((r) => [
      r.name,
      r.inscritsTotal, r.presentsTotal, r.admisTotal, pct(r.tauxTotal),
      r.inscritsGarcon, r.admisGarcon, pct(r.tauxGarcon),
      r.inscritsFille, r.admisFille, pct(r.tauxFille),
    ]);
    body.push([
      'TOTAL',
      groupTotals.inscritsTotal, groupTotals.presentsTotal, groupTotals.admisTotal, pct(groupTotals.tauxTotal),
      groupTotals.inscritsGarcon, groupTotals.admisGarcon, pct(groupTotals.tauxGarcon),
      groupTotals.inscritsFille, groupTotals.admisFille, pct(groupTotals.tauxFille),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [{ content: centre ? centre.name : 'AUTRE', colSpan: 11, styles: { fillColor: [28, 43, 58], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' as const } }],
        ...head,
      ],
      body,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
      bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
      columnStyles: { 0: { halign: 'left' } },
      didParseCell: (data) => applyColColors(data, [5, 6, 7], [8, 9, 10], body.length - 1),
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  ensureFooterSpace(doc);
  drawDirecteurFooter(doc, session.nomDirecteur);
  doc.save(`BEPC_Statistique_ParEtablissement_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.pdf`);
}

export function exportBACStatistique(session: Session, selectionNote?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headerY = drawHeader(doc, session, selectionNote);

  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`STATISTIQUE ${session.etablissement.toUpperCase()}`, pageW / 2, headerY + 7, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const titleText = `Baccalauréat ${session.examSession}`;
  const titleW = doc.getTextWidth(titleText) + 20;
  doc.setFillColor(28, 43, 58);
  doc.roundedRect(pageW / 2 - titleW / 2, headerY + 10, titleW, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(titleText, pageW / 2, headerY + 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const computed = session.classes.map((c) => computeRow(c, 'BAC'));
  const totals = computeTotals(computed, 'BAC');

  const head = [[
    'Classe & Série',
    'Candidats inscrits', 'Candidats Présents', 'Candidats absents', 'Admis', "Taux d'admission",
    'Inscrits (Garçon)', 'Présents (Garçon)', 'Admis (Garçon)', "Taux d'admission (Garçon)",
    'Inscrits (Fille)', 'Présents (Fille)', 'Admis (Fille)', "Taux d'admission (Fille)",
  ]];

  const body = computed.map((r) => [
    r.name,
    r.inscritsTotal, r.presentsTotal, r.absents, r.admisTotal, pct(r.tauxTotal),
    r.inscritsGarcon, r.presentsGarcon, r.admisGarcon, pct(r.tauxGarcon),
    r.inscritsFille, r.presentsFille, r.admisFille, pct(r.tauxFille),
  ]);
  body.push([
    'TOTAL',
    totals.inscritsTotal, totals.presentsTotal, totals.absents, totals.admisTotal, pct(totals.tauxTotal),
    totals.inscritsGarcon, totals.presentsGarcon, totals.admisGarcon, pct(totals.tauxGarcon),
    totals.inscritsFille, totals.presentsFille, totals.admisFille, pct(totals.tauxFille),
  ]);

  autoTable(doc, {
    startY: headerY + 22,
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data) => applyColColors(data, [6, 7, 8, 9], [10, 11, 12, 13], body.length - 1),
  });

  ensureFooterSpace(doc);
  drawDirecteurFooter(doc, session.nomDirecteur);
  doc.save(`BAC_Statistique_${session.etablissement.replace(/\s+/g, '_')}_${session.anneeScolaire}.pdf`);
}
