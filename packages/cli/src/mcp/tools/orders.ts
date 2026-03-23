import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult } from '../util.js';

export function registerOrderTools(server: McpServer): void {
  server.tool(
    'homer_orders_list',
    'List delivery orders with optional status filter',
    {
      status: z.string().optional().describe('Filter by status (e.g. pending, assigned, in_transit, delivered, cancelled)'),
      limit: z.number().optional().describe('Max results to return (default 50)'),
    },
    async ({ status, limit }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        const path = `/api/orders${qs ? '?' + qs : ''}`;

        const data = await api.get<Record<string, unknown>[] | { orders: Record<string, unknown>[] }>(path);
        const list = Array.isArray(data) ? data : (data as { orders: Record<string, unknown>[] }).orders || [];

        return textResult({ total: list.length, orders: list });
      } catch (err) {
        return errorResult(`Failed to list orders: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_orders_create',
    'Create a new delivery order',
    {
      recipientName: z.string().describe('Recipient full name'),
      street: z.string().describe('Street address'),
      city: z.string().describe('City'),
      state: z.string().describe('State abbreviation (e.g. CA, NY)'),
      zip: z.string().describe('ZIP code'),
      phone: z.string().optional().describe('Recipient phone number'),
      notes: z.string().optional().describe('Delivery notes'),
      giftMessage: z.string().optional().describe('Gift message to include'),
      senderName: z.string().optional().describe('Sender name'),
    },
    async ({ recipientName, street, city, state, zip, phone, notes, giftMessage, senderName }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const body: Record<string, unknown> = {
          recipientName,
          street,
          city,
          state,
          zip,
        };
        if (phone) body.phone = phone;
        if (notes) body.notes = notes;
        if (giftMessage) body.giftMessage = giftMessage;
        if (senderName) body.senderName = senderName;

        const order = await api.post<Record<string, unknown>>('/api/orders', body);
        return textResult(order);
      } catch (err) {
        return errorResult(`Failed to create order: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_orders_count',
    'Count orders, optionally filtered by status',
    {
      status: z.string().optional().describe('Filter by status (e.g. pending, assigned, delivered)'),
    },
    async ({ status }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const qs = params.toString();
        const path = `/api/orders${qs ? '?' + qs : ''}`;

        const data = await api.get<Record<string, unknown>[] | { orders: Record<string, unknown>[] }>(path);
        const list = Array.isArray(data) ? data : (data as { orders: Record<string, unknown>[] }).orders || [];

        return textResult({ status: status || 'all', count: list.length });
      } catch (err) {
        return errorResult(`Failed to count orders: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_orders_import_csv',
    'Import orders from CSV content. Pass the CSV data as a string.',
    {
      csvContent: z.string().describe('CSV content with headers: recipientName, street, city, state, zip, phone, notes, giftMessage'),
    },
    async ({ csvContent }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const importResult = await api.post<Record<string, unknown>>(
          '/api/orders/import/csv',
          csvContent,
          'text/csv',
        );
        return textResult(importResult);
      } catch (err) {
        return errorResult(`Failed to import CSV: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
