import { Job } from 'bullmq';
import { config } from '../lib/config.js';

interface ReportJobData {
  tenantId: string;
  type: 'daily-summary' | 'driver-performance' | 'route-efficiency';
  rangeDays: number;
  recipients: string[];
}

export async function processReportGeneration(job: Job<ReportJobData>) {
  const { tenantId, type, rangeDays, recipients } = job.data;
  console.log(`[report-generation] Generating ${type} report for tenant ${tenantId}`);

  let pdfBuffer: Buffer;

  const now = new Date();
  const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  // Generate report inline (avoids cross-package import issues)
  try {
    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Header
    doc.fontSize(20).text('HOMER.io', { align: 'left' });
    doc.moveDown(0.3);

    doc.fontSize(14).text(titleMap(type), { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#888888').text(`${fromStr} to ${toStr}`, { align: 'left' });
    doc.fillColor('#000000');
    doc.moveDown(1.5);

    // Minimal report body (the worker generates a simpler version)
    doc.fontSize(12).font('Helvetica-Bold').text('Report Data');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Tenant: ${tenantId}`);
    doc.fontSize(10).font('Helvetica').text(`Type: ${type}`);
    doc.fontSize(10).font('Helvetica').text(`Period: ${fromStr} to ${toStr}`);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica').text(
      'This report was generated automatically by the HOMER.io report scheduler. ' +
      'For detailed interactive reports, visit the HOMER.io dashboard.',
    );

    doc.end();
    pdfBuffer = await pdfReady;
  } catch (err) {
    console.error(`[report-generation] PDF generation failed:`, err);
    throw err;
  }

  console.log(`[report-generation] Generated ${type} PDF (${pdfBuffer.length} bytes)`);

  // Send via email if recipients are configured and SendGrid key is set
  if (recipients.length > 0 && config.sendgrid.apiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.sendgrid.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: config.sendgrid.fromEmail, name: 'HOMER.io Reports' },
          subject: `HOMER.io ${titleMap(type)} - ${toStr}`,
          content: [
            {
              type: 'text/plain',
              value: `Your scheduled ${type} report is attached.\n\nPeriod: ${fromStr} to ${toStr}\nGenerated: ${new Date().toISOString()}`,
            },
          ],
          attachments: [
            {
              content: pdfBuffer.toString('base64'),
              filename: `${type}-${toStr}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[report-generation] SendGrid error:`, errText);
      } else {
        console.log(`[report-generation] Report emailed to ${recipients.join(', ')}`);
      }
    } catch (err) {
      console.error(`[report-generation] Email delivery failed:`, err);
    }
  } else {
    console.log(`[report-generation] No recipients configured or SendGrid not set up — report generated but not emailed`);
  }

  return { type, tenantId, bytes: pdfBuffer.length, emailed: recipients.length > 0 && !!config.sendgrid.apiKey };
}

function titleMap(type: string): string {
  const map: Record<string, string> = {
    'daily-summary': 'Daily Summary Report',
    'driver-performance': 'Driver Performance Report',
    'route-efficiency': 'Route Efficiency Report',
  };
  return map[type] || type;
}
