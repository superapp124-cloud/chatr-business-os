import { useAutoContactSync } from '@/hooks/useAutoContactSync';
import { useBatteryOptimization } from '@/hooks/useBatteryOptimization';
import { useGeofencing } from '@/hooks/useGeofencing';
import { useOfflineUploadQueue } from '@/hooks/useOfflineUploadQueue';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NativeBackgroundServicesProps {
 userId?: string;
}

export const NativeBackgroundServices = ({ userId }: NativeBackgroundServicesProps) => {
 useAutoContactSync(userId);
 usePushNotifications(userId);
 useBatteryOptimization();
 useOfflineUploadQueue();
 useGeofencing(userId);

 return null;
};
