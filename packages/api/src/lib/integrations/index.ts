import type { EcommerceConnector } from './connector.js';
import { ShopifyConnector } from './shopify.js';
import { WooCommerceConnector } from './woocommerce.js';
import { DutchieConnector } from './dutchie.js';
import type { PlatformInfo } from '@homer-io/shared';

export { encrypt, decrypt } from './crypto.js';
export { ShopifyConnector } from './shopify.js';
export { WooCommerceConnector } from './woocommerce.js';
export { DutchieConnector } from './dutchie.js';
export { MetrcConnector, getMetrcStates } from './metrc.js';
export type { EcommerceConnector, ExternalOrder } from './connector.js';
export type { SeedToSaleConnector, MetrcPackage, MetrcTransferInput } from './metrc.js';

const connectors: Record<string, EcommerceConnector> = {
  shopify: new ShopifyConnector(),
  woocommerce: new WooCommerceConnector(),
  dutchie: new DutchieConnector(),
};

export function getConnector(platform: string): EcommerceConnector {
  const connector = connectors[platform];
  if (!connector) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return connector;
}

export function getAvailablePlatforms(): PlatformInfo[] {
  return [
    {
      platform: 'shopify',
      name: 'Shopify',
      description: 'Import orders from your Shopify store automatically.',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'Your Shopify API key' },
        { key: 'password', label: 'API Password', type: 'password', placeholder: 'Your Shopify API password' },
      ],
    },
    {
      platform: 'woocommerce',
      name: 'WooCommerce',
      description: 'Import orders from your WooCommerce store automatically.',
      requiredCredentials: [
        { key: 'consumerKey', label: 'Consumer Key', type: 'text', placeholder: 'WooCommerce consumer key' },
        { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', placeholder: 'WooCommerce consumer secret' },
      ],
    },
    {
      platform: 'dutchie',
      name: 'Dutchie',
      description: 'Import cannabis delivery orders from Dutchie with product tracking.',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Dutchie partner API key' },
        { key: 'dispensaryId', label: 'Dispensary ID', type: 'text', placeholder: 'Your Dutchie dispensary ID' },
      ],
      industryGate: 'cannabis',
    },
  ];
}
