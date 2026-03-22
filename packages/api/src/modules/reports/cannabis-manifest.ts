import PDFDocument from 'pdfkit';
import { uploadFile } from '../../lib/storage/minio.js';

// ---------------------------------------------------------------------------
// Helpers (same pattern as generator.ts)
// ---------------------------------------------------------------------------

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function drawRow(doc: PDFKit.PDFDocument, columns: { text: string; width: number }[], y: number, bold = false) {
  let x = 50;
  for (const col of columns) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    doc.fontSize(9).text(col.text, x, y, { width: col.width, align: 'left' });
    x += col.width;
  }
}

// ---------------------------------------------------------------------------
// Manifest PDF generation
// ---------------------------------------------------------------------------

interface ManifestRecord {
  id: string;
  manifestNumber: string;
  licenseNumber: string | null;
  driverLicenseNumber: string | null;
  vehicleLicensePlate: string | null;
  totalItems: number | null;
  totalValue: string | null;
  totalWeight: string | null;
  items: unknown;
  notes: string | null;
  createdAt: Date;
}

interface ManifestItem {
  orderId: string;
  recipientName: string;
  deliveryAddress?: string;
  products: Array<{
    name: string;
    quantity: number;
    weight?: number;
    trackingTag?: string;
    price?: number;
  }>;
}

export async function generateManifestPdf(tenantId: string, manifest: ManifestRecord): Promise<string> {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const items = (manifest.items ?? []) as ManifestItem[];
  const dateStr = manifest.createdAt.toISOString().split('T')[0];

  // ── Header ────────────────────────────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').text('DELIVERY MANIFEST', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Manifest #${manifest.manifestNumber}`, { align: 'center' });
  doc.text(`Date: ${dateStr}`, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1);

  // ── License & Compliance ──────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').text('Dispensary License: ', { continued: true });
  doc.font('Helvetica').text(manifest.licenseNumber || 'N/A');
  doc.moveDown(0.5);

  // ── Driver & Vehicle ──────────────────────────────────────────────
  const infoY = doc.y;
  doc.fontSize(9);
  doc.font('Helvetica-Bold').text('Driver License: ', 50, infoY, { continued: true });
  doc.font('Helvetica').text(manifest.driverLicenseNumber || 'N/A');
  doc.font('Helvetica-Bold').text('Vehicle Plate: ', 300, infoY, { continued: true });
  doc.font('Helvetica').text(manifest.vehicleLicensePlate || 'N/A');
  doc.moveDown(1.5);

  // ── Divider ───────────────────────────────────────────────────────
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);

  // ── Product Table ─────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').text('Products');
  doc.moveDown(0.5);

  const productCols = [
    { text: 'Item', width: 180 },
    { text: 'Tracking Tag', width: 120 },
    { text: 'Qty', width: 40 },
    { text: 'Weight', width: 60 },
    { text: 'Price', width: 60 },
  ];

  let y = doc.y;
  drawRow(doc, productCols, y, true);
  y += 15;
  doc.moveTo(50, y).lineTo(562, y).stroke('#eeeeee');
  y += 5;

  for (const item of items) {
    for (const product of item.products) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      drawRow(doc, [
        { text: product.name, width: 180 },
        { text: product.trackingTag || '—', width: 120 },
        { text: String(product.quantity), width: 40 },
        { text: product.weight ? `${product.weight} g` : '—', width: 60 },
        { text: product.price ? `$${product.price.toFixed(2)}` : '—', width: 60 },
      ], y);
      y += 14;
    }
  }

  y += 10;
  doc.moveTo(50, y).lineTo(562, y).stroke('#cccccc');
  y += 10;

  // ── Recipients ────────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').text('Recipients', 50, y);
  y += 20;

  const recipientCols = [
    { text: 'Recipient', width: 160 },
    { text: 'Address', width: 250 },
    { text: 'Order ID', width: 100 },
  ];
  drawRow(doc, recipientCols, y, true);
  y += 15;
  doc.moveTo(50, y).lineTo(562, y).stroke('#eeeeee');
  y += 5;

  for (const item of items) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    drawRow(doc, [
      { text: item.recipientName, width: 160 },
      { text: item.deliveryAddress || '—', width: 250 },
      { text: item.orderId.substring(0, 8) + '...', width: 100 },
    ], y);
    y += 14;
  }

  y += 15;
  doc.moveTo(50, y).lineTo(562, y).stroke('#cccccc');
  y += 15;

  // ── Totals ────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`Total Items: ${manifest.totalItems ?? 0}`, 50, y);
  doc.text(`Total Value: $${manifest.totalValue ?? '0.00'}`, 200, y);
  doc.text(`Total Weight: ${manifest.totalWeight ?? '0.00'} g`, 380, y);
  y += 25;

  // ── Notes ─────────────────────────────────────────────────────────
  if (manifest.notes) {
    doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
    y += 14;
    doc.font('Helvetica').text(manifest.notes, 50, y, { width: 500 });
    y += 30;
  }

  // ── Signature Lines ───────────────────────────────────────────────
  if (y > 650) {
    doc.addPage();
    y = 50;
  }
  y += 30;
  doc.moveTo(50, y + 20).lineTo(250, y + 20).stroke('#000000');
  doc.fontSize(8).text('Driver Signature', 50, y + 25);
  doc.moveTo(300, y + 20).lineTo(500, y + 20).stroke('#000000');
  doc.text('Date', 300, y + 25);
  y += 50;
  doc.moveTo(50, y + 20).lineTo(250, y + 20).stroke('#000000');
  doc.text('Dispatcher Signature', 50, y + 25);
  doc.moveTo(300, y + 20).lineTo(500, y + 20).stroke('#000000');
  doc.text('Date', 300, y + 25);

  // ── Compliance Footer ─────────────────────────────────────────────
  y += 60;
  doc.fontSize(7).fillColor('#999999')
    .text(
      'This manifest is a legal document required under state cannabis regulations. ' +
      'All products listed must be accounted for during transport and upon return to the licensed facility. ' +
      'Any discrepancies must be reported immediately to the compliance officer.',
      50, y, { width: 500, align: 'center' },
    );

  // ── Generate & Upload ─────────────────────────────────────────────
  const buffer = await docToBuffer(doc);
  const key = `${tenantId}/manifests/${manifest.manifestNumber}-${Date.now()}.pdf`;
  const url = await uploadFile(key, buffer, 'application/pdf', 'homer-manifests');
  return url;
}
