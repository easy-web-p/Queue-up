import { useState, useEffect } from 'react';
import { orderRepository } from '../repositories/orderRepository';
import { AuthoritativeOrder } from '../types/schema';

export function useStoreActiveQueues(storeId?: string | null) {
  const [queues, setQueues] = useState<AuthoritativeOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!storeId) {
      setQueues([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = orderRepository.subscribeStoreActiveQueues(storeId, (data) => {
      setQueues(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  return { queues, isLoading };
}
