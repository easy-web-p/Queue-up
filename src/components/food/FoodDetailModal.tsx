import React, { useState, useEffect } from 'react';
import { FoodItem } from '../../types';
import { useQueue } from '../../context/QueueContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Minus, Plus, Flame, Clock, Star, ShoppingBag } from 'lucide-react';

interface FoodDetailModalProps {
  food: FoodItem | null;
  onClose: () => void;
}

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({ food, onClose }) => {
  const { addToCart } = useQueue();
  const [quantity, setQuantity] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, { groupName: string; choiceName: string; priceDelta: number }>>({});
  const [specialNote, setSpecialNote] = useState('');

  // Reset state when a new food item is loaded
  useEffect(() => {
    if (food) {
      setQuantity(1);
      setSpecialNote('');
      const defaultChoices: Record<string, { groupName: string; choiceName: string; priceDelta: number }> = {};
      if (food.optionGroups) {
        food.optionGroups.forEach(group => {
          if (group.required && group.choices.length > 0) {
            defaultChoices[group.id] = {
              groupName: group.name,
              choiceName: group.choices[0].name,
              priceDelta: group.choices[0].priceDelta
            };
          }
        });
      }
      setSelectedChoices(defaultChoices);
    }
  }, [food]);

  if (!food) return null;

  const handleChoiceSelect = (groupId: string, groupName: string, choiceName: string, priceDelta: number) => {
    setSelectedChoices(prev => ({
      ...prev,
      [groupId]: { groupName, choiceName, priceDelta }
    }));
  };

  const optionsTotal = Object.values(selectedChoices).reduce((sum, item) => sum + item.priceDelta, 0);
  const unitPrice = food.price + optionsTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addToCart({
      food,
      quantity,
      selectedOptions: Object.values(selectedChoices),
      specialNote
    });
    onClose();
  };

  return (
    <Modal isOpen={Boolean(food)} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4 text-stone-900 dark:text-zinc-100">
        {/* Food Image */}
        <div className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden bg-stone-100 dark:bg-black">
          <img
            src={food.image}
            alt={food.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-bold text-orange-400 border border-orange-400/30">
              {food.storeName}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-bold text-amber-300 border border-white/10">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {food.rating}
            </span>
          </div>
        </div>

        {/* Title & Info */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-white">{food.name}</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{food.nameEn}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400">฿{unitPrice}</span>
              {food.originalPrice && (
                <div className="text-xs text-stone-400 line-through">฿{food.originalPrice}</div>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 mt-2.5 leading-relaxed bg-orange-50/60 dark:bg-zinc-900/60 p-3 rounded-xl border border-orange-200/70 dark:border-zinc-800">
            {food.description}
          </p>

          <div className="flex items-center gap-3 mt-3 text-xs text-stone-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              ระยะเวลาปรุง ~{food.preparationMinutes} นาที
            </span>
            {food.spicyLevel !== undefined && food.spicyLevel > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <Flame className="w-3.5 h-3.5 fill-red-500" />
                ระดับความเผ็ด: {food.spicyLevel}/3
              </span>
            )}
          </div>
        </div>

        {/* Option Groups */}
        {food.optionGroups && food.optionGroups.length > 0 && (
          <div className="flex flex-col gap-3 pt-2 border-t border-orange-100 dark:border-zinc-800">
            {food.optionGroups.map(group => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-stone-800 dark:text-zinc-200">
                    {group.name}
                    {group.required && <span className="text-red-500 ml-1">*จำเป็น</span>}
                  </span>
                  <span className="text-stone-400 dark:text-zinc-500 font-normal">
                    {selectedChoices[group.id]?.choiceName || 'ยังไม่เลือก'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.choices.map(choice => {
                    const isSelected = selectedChoices[group.id]?.choiceName === choice.name;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => handleChoiceSelect(group.id, group.name, choice.name, choice.priceDelta)}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-orange-100 border-orange-400 text-orange-950 font-bold dark:bg-orange-500/20 dark:border-orange-500 dark:text-orange-300'
                            : 'bg-stone-50/60 border-stone-200 text-stone-700 hover:bg-stone-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-850'
                        }`}
                      >
                        <span>{choice.name}</span>
                        {choice.priceDelta > 0 && (
                          <span className={isSelected ? 'text-orange-700 dark:text-orange-400' : 'text-stone-500 dark:text-zinc-400'}>
                            +{choice.priceDelta}฿
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special Instructions */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-orange-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-stone-700 dark:text-zinc-300">
            รายละเอียดเพิ่มเติม / คำขอพิเศษถึงแม่ครัว
          </label>
          <input
            type="text"
            value={specialNote}
            onChange={e => setSpecialNote(e.target.value)}
            placeholder="เช่น ไม่ใส่ผักโรย, แยกน้ำซุป, ไม่ชูรส..."
            className="w-full rounded-xl bg-white border border-stone-300 text-stone-900 text-xs px-3.5 py-2.5 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
          />
        </div>

        {/* Quantity and Add to Cart Action */}
        <div className="flex items-center gap-3 pt-3 border-t border-orange-100 dark:border-zinc-800">
          {/* Quantity Stepper */}
          <div className="flex items-center bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-stone-900 dark:text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(q => q + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white transition-colors dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add CTA */}
          <Button
            className="flex-1 py-3"
            variant="primary"
            onClick={handleAddToCart}
            leftIcon={<ShoppingBag className="w-4 h-4" />}
          >
            ใส่ตะกร้า • ฿{totalPrice}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
