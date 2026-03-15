import PDFDocument from 'pdfkit';
import { db } from '../../lib/db/index.js';
import { orders, routes, drivers } from '../../lib/db/schema/index.js';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';

// ── Helpers ─────────────────────────────────────────────────────────

function createDoc(title: string, dateRange: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });
  doc.fontSize(20).text('HOMER.io', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(14).text(title, { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#888888').text(dateRange, { align: 'left' });
  doc.fillColor('#000000');
  doc.moveDown(1.5);
  return doc;
}

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function drawTableRow(doc: PDFKit.PDFDocument, columns: { text: string; width: number }[], y: number, bold = false) {
  let x = 50;
  for (const col of columns) {
    if (bold) doc.font('Helvetica-Bold');
    else doc.font('Helvetica');
    doc.fontSize(9).text(col.text, x, y, { width: col.width, align: 'left' });
    x += col.width;
  }
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function parseDateRange(from?: string, to?: string): { start: Date; end: Date; label: string } {
  const endDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const startDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const label = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
  return { start: startDate, end: endDate, label };
}

// ── Daily Summary ───────────────────────────────────────────────────

export async function generateDailySummaryPDF(tenantId: string, date?: string): Promise<Buffer> {
  const targetDate = date || today();
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

  // Total orders for the day
  const [orderStats] = await db
    .select({
      total: count(),
      delivered: count(sql`CASE WHEN ${orders.status} = 'delivered' THEN 1 END`),
      failed: count(sql`CASE WHEN ${orders.status} = 'failed' THEN 1 END`),
      inTransit: count(sql`CASE WHEN ${orders.status} = 'in_transit' THEN 1 END`),
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, dayStart),
        lte(orders.createdAt, dayEnd),
      ),
    );

  // Route stats
  const [routeStats] = await db
    .select({
      total: count(),
      completed: count(sql`CASE WHEN ${routes.status} = 'completed' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${routes.status} = 'in_progress' THEN 1 END`),
    })
    .from(routes)
    .where(
      and(
        eq(routes.tenantId, tenantId),
        gte(routes.createdAt, dayStart),
        lte(routes.createdAt, dayEnd),
      ),
    );

  // Top drivers by completed deliveries
  const topDrivers = await db
    .select({
      driverName: drivers.name,
      deliveries: count(),
    })
    .from(orders)
    .innerJoin(routes, eq(orders.routeId, routes.id))
    .innerJoin(drivers, eq(routes.driverId, drivers.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'delivered'),
        gte(orders.completedAt, dayStart),
        lte(orders.completedAt, dayEnd),
      ),
    )
    .groupBy(drivers.name)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  const totalOrders = Number(orderStats.total) || 0;
  const delivered = Number(orderStats.delivered) || 0;
  const successRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(1) : '0.0';

  // Build PDF
  const doc = createDoc('Daily Summary Report', targetDate);

  doc.fontSize(12).font('Helvetica-Bold').text('Order Summary');
  doc.moveDown(0.5);

  const summaryItems = [
    `Total Orders: ${totalOrders}`,
    `Delivered: ${delivered}`,
    `Failed: ${Number(orderStats.failed) || 0}`,
    `In Transit: ${Number(orderStats.inTransit) || 0}`,
    `Success Rate: ${successRate}%`,
  ];
  for (const item of summaryItems) {
    doc.fontSize(10).font('Helvetica').text(item);
  }

  doc.moveDown(1);
  doc.fontSize(12).font('Helvetica-Bold').text('Route Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(`Total Routes: ${Number(routeStats.total) || 0}`);
  doc.fontSize(10).font('Helvetica').text(`Completed: ${Number(routeStats.completed) || 0}`);
  doc.fontSize(10).font('Helvetica').text(`In Progress: ${Number(routeStats.inProgress) || 0}`);

  doc.moveDown(1);
  doc.fontSize(12).font('Helvetica-Bold').text('Top Drivers');
  doc.moveDown(0.5);

  if (topDrivers.length > 0) {
    const headerY = doc.y;
    drawTableRow(doc, [
      { text: 'Rank', width: 50 },
      { text: 'Driver', width: 200 },
      { text: 'Deliveries', width: 100 },
    ], headerY, true);
    doc.moveDown(0.8);

    for (let i = 0; i < topDrivers.length; i++) {
      const y = doc.y;
      drawTableRow(doc, [
        { text: `${i + 1}`, width: 50 },
        { text: topDrivers[i].driverName, width: 200 },
        { text: `${Number(topDrivers[i].deliveries)}`, width: 100 },
      ], y);
      doc.moveDown(0.7);
    }
  } else {
    doc.fontSize(10).font('Helvetica').text('No delivery data for this date.');
  }

  return docToBuffer(doc);
}

// ── Driver Performance ──────────────────────────────────────────────

export async function generateDriverPerformancePDF(tenantId: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
  const { start, end, label } = parseDateRange(dateFrom, dateTo);

  const driverStats = await db
    .select({
      driverName: drivers.name,
      totalDeliveries: count(),
      onTime: count(
        sql`CASE WHEN ${orders.completedAt} <= ${orders.timeWindowEnd} THEN 1 END`,
      ),
      avgTimeMinutes: sql<number>`
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (${orders.completedAt} - ${routes.actualStartAt})) / 60),
          0
        )
      `.as('avg_time_minutes'),
    })
    .from(orders)
    .innerJoin(routes, eq(orders.routeId, routes.id))
    .innerJoin(drivers, eq(routes.driverId, drivers.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.status, 'delivered'),
        gte(orders.completedAt, start),
        lte(orders.completedAt, end),
      ),
    )
    .groupBy(drivers.name)
    .orderBy(sql`count(*) DESC`);

  const doc = createDoc('Driver Performance Report', label);

  doc.fontSize(12).font('Helvetica-Bold').text('Per-Driver Statistics');
  doc.moveDown(0.5);

  if (driverStats.length > 0) {
    const headerY = doc.y;
    drawTableRow(doc, [
      { text: 'Driver', width: 150 },
      { text: 'Deliveries', width: 80 },
      { text: 'On-Time %', width: 80 },
      { text: 'Avg Time (min)', width: 100 },
    ], headerY, true);
    doc.moveDown(0.8);

    for (const stat of driverStats) {
      const total = Number(stat.totalDeliveries) || 0;
      const onTime = Number(stat.onTime) || 0;
      const onTimePct = total > 0 ? ((onTime / total) * 100).toFixed(1) : 'N/A';
      const avgMin = Number(stat.avgTimeMinutes) || 0;

      const y = doc.y;
      drawTableRow(doc, [
        { text: stat.driverName, width: 150 },
        { text: `${total}`, width: 80 },
        { text: `${onTimePct}%`, width: 80 },
        { text: avgMin > 0 ? `${avgMin.toFixed(1)}` : 'N/A', width: 100 },
      ], y);
      doc.moveDown(0.7);

      // Page break if needed
      if (doc.y > 700) {
        doc.addPage();
      }
    }
  } else {
    doc.fontSize(10).font('Helvetica').text('No driver performance data for this period.');
  }

  return docToBuffer(doc);
}

// ── Route Efficiency ────────────────────────────────────────────────

export async function generateRouteEfficiencyPDF(tenantId: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
  const { start, end, label } = parseDateRange(dateFrom, dateTo);

  const routeStats = await db
    .select({
      routeName: routes.name,
      driverName: drivers.name,
      totalStops: routes.totalStops,
      completedStops: routes.completedStops,
      totalDistance: routes.totalDistance,
      totalDuration: routes.totalDuration,
      status: routes.status,
    })
    .from(routes)
    .leftJoin(drivers, eq(routes.driverId, drivers.id))
    .where(
      and(
        eq(routes.tenantId, tenantId),
        gte(routes.createdAt, start),
        lte(routes.createdAt, end),
      ),
    )
    .orderBy(routes.createdAt);

  const doc = createDoc('Route Efficiency Report', label);

  doc.fontSize(12).font('Helvetica-Bold').text('Per-Route Metrics');
  doc.moveDown(0.5);

  if (routeStats.length > 0) {
    const headerY = doc.y;
    drawTableRow(doc, [
      { text: 'Route', width: 120 },
      { text: 'Driver', width: 100 },
      { text: 'Stops', width: 60 },
      { text: 'Completed', width: 70 },
      { text: 'Distance', width: 70 },
      { text: 'Efficiency', width: 70 },
    ], headerY, true);
    doc.moveDown(0.8);

    for (const route of routeStats) {
      const totalStops = Number(route.totalStops) || 0;
      const completed = Number(route.completedStops) || 0;
      const efficiency = totalStops > 0 ? ((completed / totalStops) * 100).toFixed(1) : 'N/A';
      const distance = route.totalDistance ? `${Number(route.totalDistance).toFixed(1)} mi` : 'N/A';

      const y = doc.y;
      drawTableRow(doc, [
        { text: route.routeName, width: 120 },
        { text: route.driverName || 'Unassigned', width: 100 },
        { text: `${totalStops}`, width: 60 },
        { text: `${completed}`, width: 70 },
        { text: distance, width: 70 },
        { text: `${efficiency}%`, width: 70 },
      ], y);
      doc.moveDown(0.7);

      if (doc.y > 700) {
        doc.addPage();
      }
    }

    // Summary
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    const totalRoutes = routeStats.length;
    const completedRoutes = routeStats.filter((r) => r.status === 'completed').length;
    const avgEfficiency =
      routeStats.reduce((sum, r) => {
        const ts = Number(r.totalStops) || 0;
        const cs = Number(r.completedStops) || 0;
        return sum + (ts > 0 ? (cs / ts) * 100 : 0);
      }, 0) / (totalRoutes || 1);

    doc.fontSize(10).font('Helvetica').text(`Total Routes: ${totalRoutes}`);
    doc.fontSize(10).font('Helvetica').text(`Completed Routes: ${completedRoutes}`);
    doc.fontSize(10).font('Helvetica').text(`Average Efficiency: ${avgEfficiency.toFixed(1)}%`);
  } else {
    doc.fontSize(10).font('Helvetica').text('No route data for this period.');
  }

  return docToBuffer(doc);
}
