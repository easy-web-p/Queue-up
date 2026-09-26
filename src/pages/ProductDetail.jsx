import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FoodDetailPage } from './customer/FoodDetailPage';
import { useQueue } from '../context/QueueContext';

export default function ProductDetail() {
  const { id } = useParams();
  const { foodItems, setSelectedFood } = useQueue();

  useEffect(() => {
    if (id && foodItems.length > 0) {
      const found = foodItems.find(f => f.id === id);
      if (found) {
        setSelectedFood(found);
      }
    }
  }, [id, foodItems, setSelectedFood]);

  return <FoodDetailPage />;
}
