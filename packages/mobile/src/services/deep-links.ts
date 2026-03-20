import { router } from 'expo-router';

/**
 * Handle a push notification tap by deep-linking to the relevant screen.
 */
export function handleNotificationDeepLink(data: Record<string, unknown>): void {
  const type = data.type as string | undefined;
  const routeId = data.routeId as string | undefined;
  const orderId = data.orderId as string | undefined;

  switch (type) {
    case 'delivery_completed':
    case 'delivery_failed':
    case 'route_started':
    case 'route_completed':
      if (routeId && orderId) {
        router.push(`/(driver)/stop/${routeId}/${orderId}`);
      } else {
        router.push('/(driver)/route');
      }
      break;

    case 'driver_offline':
      router.push('/(dispatch)/more/fleet');
      break;

    case 'order_received':
      if (orderId) {
        router.push(`/(dispatch)/orders/${orderId}`);
      } else {
        router.push('/(dispatch)/orders');
      }
      break;

    case 'message':
      router.push('/(dispatch)/chat');
      break;

    default:
      // Unknown notification type — go to notifications list
      router.push('/(dispatch)/more/notifications');
      break;
  }
}
