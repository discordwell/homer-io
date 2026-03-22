import type { EcommerceConnector } from './connector.js';
import { ShopifyConnector } from './shopify.js';
import { WooCommerceConnector } from './woocommerce.js';
import { DutchieConnector } from './dutchie.js';
import { FTDConnector } from './ftd.js';
import { TelefloraConnector } from './teleflora.js';
import { PioneerRxConnector } from './pioneerrx.js';
import { SquareConnector } from './square.js';
import { ToastConnector } from './toast.js';
import type { PlatformInfo } from '@homer-io/shared';

export { encrypt, decrypt } from './crypto.js';
export { ShopifyConnector } from './shopify.js';
export { WooCommerceConnector } from './woocommerce.js';
export { DutchieConnector } from './dutchie.js';
export { FTDConnector } from './ftd.js';
export { TelefloraConnector } from './teleflora.js';
export { PioneerRxConnector } from './pioneerrx.js';
export { SquareConnector } from './square.js';
export { ToastConnector } from './toast.js';
export { MetrcConnector, getMetrcStates } from './metrc.js';
export type { EcommerceConnector, ExternalOrder } from './connector.js';
export type { SeedToSaleConnector, MetrcPackage, MetrcTransferInput } from './metrc.js';

const connectors: Record<string, EcommerceConnector> = {
  shopify: new ShopifyConnector(),
  woocommerce: new WooCommerceConnector(),
  dutchie: new DutchieConnector(),
  ftd: new FTDConnector(),
  teleflora: new TelefloraConnector(),
  pioneerrx: new PioneerRxConnector(),
  square: new SquareConnector(),
  toast: new ToastConnector(),
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
    {
      platform: 'ftd',
      name: 'FTD',
      description: 'Import incoming wire orders from FTD Mercury with sender and gift data.',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'FTD Mercury API key' },
        { key: 'shopCode', label: 'Shop Code', type: 'text', placeholder: 'Your FTD shop code' },
      ],
      industryGate: 'florist',
    },
    {
      platform: 'teleflora',
      name: 'Teleflora',
      description: 'Import incoming wire orders from Teleflora with sender and gift data.',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Teleflora API key' },
        { key: 'shopId', label: 'Shop ID', type: 'text', placeholder: 'Your Teleflora shop ID' },
      ],
      industryGate: 'florist',
    },
    {
      platform: 'pioneerrx',
      name: 'PioneerRx',
      description: 'Import prescription delivery orders from PioneerRx pharmacy software (HIPAA-compliant).',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'PioneerRx API key' },
        { key: 'pharmacyId', label: 'Pharmacy ID', type: 'text', placeholder: 'Your PioneerRx pharmacy ID' },
      ],
      industryGate: 'pharmacy',
    },
    {
      platform: 'square',
      name: 'Square',
      description: 'Import delivery orders from Square POS with menu items and delivery notes.',
      requiredCredentials: [
        { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Square access token' },
        { key: 'locationId', label: 'Location ID', type: 'text', placeholder: 'Your Square location ID' },
      ],
      industryGate: 'restaurant',
    },
    {
      platform: 'toast',
      name: 'Toast',
      description: 'Import delivery orders from Toast POS with menu items and delivery windows.',
      requiredCredentials: [
        { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Toast partner API key' },
        { key: 'restaurantGuid', label: 'Restaurant GUID', type: 'text', placeholder: 'Your Toast restaurant GUID' },
      ],
      industryGate: 'restaurant',
    },
  ];
}
