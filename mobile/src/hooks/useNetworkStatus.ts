/**
 * useNetworkStatus Hook
 *
 * Monitors network connectivity and provides offline handling.
 * Uses @react-native-community/netinfo.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: NetInfoStateType;
  isOffline: boolean;
  isWifi: boolean;
  isCellular: boolean;
}

interface UseNetworkStatusResult {
  status: NetworkStatus;
  refresh: () => Promise<void>;
}

const defaultStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: null,
  type: NetInfoStateType.unknown,
  isOffline: false,
  isWifi: false,
  isCellular: false,
};

export function useNetworkStatus(): UseNetworkStatusResult {
  const [status, setStatus] = useState<NetworkStatus>(defaultStatus);
  const isMountedRef = useRef(true);

  const updateStatus = useCallback((state: NetInfoState) => {
    if (!isMountedRef.current) return;
    setStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isOffline: !state.isConnected || state.isInternetReachable === false,
      isWifi: state.type === NetInfoStateType.wifi,
      isCellular: state.type === NetInfoStateType.cellular,
    });
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    updateStatus(state);
  }, [updateStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    // Initial fetch
    NetInfo.fetch().then(updateStatus);

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(updateStatus);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [updateStatus]);

  return { status, refresh };
}

/**
 * Simple hook for just getting offline status
 */
export function useIsOffline(): boolean {
  const { status } = useNetworkStatus();
  return status.isOffline;
}

export default useNetworkStatus;
