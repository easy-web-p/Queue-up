import { useState, useEffect } from 'react';
import { orderRepository } from '../repositories/orderRepository';
import { AuthoritativeOrder } from '../types/schema';
import { auth } from '../config/firebase';

export function useCustomerOrders(customerId?: string | null) {
  const [orders, setOrders] = useState<AuthoritativeOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const targetUid = customerId || auth.currentUser?.uid || null;

  useEffect(() => {
    if (!targetUid) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = orderRepository.subscribeCustomerOrders(targetUid, (data) => {
      setOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [targetUid]);

  return { orders, isLoading };
}

export function useCustomerActiveOrders(customerId?: string | null) {
  const [activeOrders, setActiveOrders] = useState<AuthoritativeOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const targetUid = customerId || auth.currentUser?.uid || null;

  useEffect(() => {
    if (!targetUid) {
      setActiveOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = orderRepository.subscribeCustomerActiveOrders(targetUid, (data) => {
      setActiveOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [targetUid]);

  return { activeOrders, isLoading };
}
