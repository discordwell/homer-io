import type { Job } from 'bullmq';
import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { orders, routes, drivers } from '../lib/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger.js';

interface ReportJobData {
  tenantId: string;
  type: 'daily-summary' | 'driver-performance' | 'route-efficiency';
  rangeDays: number;
  recipients: string[];
}

const log = logger.child({ worker: 'report-generation' });

export async function processReportGeneration(job: Job<ReportJobData>) {
  const { tenantId, type, rangeDays, recipients } = job.data;
  log.info('Generating report', { tenantId, type, rangeDays });

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

    // Report body with real data queries
    switch (type) {
      case 'daily-summary': {
        const [orderStats] = await db.select({
          total: sql<number>`count(*)`,
          delivered: sql<number>`count(*) filter (where status = 'delivered')`,
          failed: sql<number>`count(*) filter (where status = 'failed')`,
        }).from(orders).where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, from)));

        doc.fontSize(12).font('Helvetica-Bold').text('Order Summary');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Total Orders: ${orderStats?.total ?? 0}`);
        doc.text(`Delivered: ${orderStats?.delivered ?? 0}`);
        doc.text(`Failed: ${orderStats?.failed ?? 0}`);
        break;
      }
      case 'driver-performance': {
        const driverStats = await db.select({
          name: drivers.name,
          deliveries: sql<number>`count(*)`,
        }).from(orders)
          .innerJoin(routes, eq(orders.routeId, routes.id))
          .innerJoin(drivers, eq(routes.driverId, drivers.id))
          .where(and(eq(orders.tenantId, tenantId), eq(orders.status, 'delivered'), gte(orders.completedAt, from)))
          .groupBy(drivers.name);

        doc.fontSize(12).font('Helvetica-Bold').text('Driver Performance');
        doc.moveDown(0.5);
        for (const d of driverStats) {
          doc.fontSize(10).font('Helvetica').text(`${d.name}: ${d.deliveries} deliveries`);
        }
        break;
      }
      case 'route-efficiency': {
        const [routeStats] = await db.select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'completed')`,
        }).from(routes).where(and(eq(routes.tenantId, tenantId), gte(routes.createdAt, from)));

        doc.fontSize(12).font('Helvetica-Bold').text('Route Efficiency');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Total Routes: ${routeStats?.total ?? 0}`);
        doc.text(`Completed: ${routeStats?.completed ?? 0}`);
        break;
      }
      default: {
        doc.fontSize(12).font('Helvetica-Bold').text('Report Data');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Type: ${type}`);
        doc.text(`Period: ${fromStr} to ${toStr}`);
      }
    }

    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica').text(
      `Generated: ${new Date().toISOString()} | ` +
      'This report was generated automatically by the HOMER.io report scheduler.',
    );

    doc.end();
    pdfBuffer = await pdfReady;
  } catch (err) {
    log.error('PDF generation failed', { type, error: err instanceof Error ? err.message : 'Unknown error' });
    throw err;
  }

  log.info('Generated PDF', { type, bytes: pdfBuffer.length });

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
        log.error('SendGrid error', { error: errText });
      } else {
        log.info('Report emailed', { recipients: recipients.join(', ') });
      }
    } catch (err) {
      log.error('Email delivery failed', { error: err instanceof Error ? err.message : 'Unknown error' });
    }
  } else {
    log.info('No recipients or SendGrid not configured', { type });
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
