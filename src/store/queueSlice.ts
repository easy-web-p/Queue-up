import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Order, OrderStatus, QueueStatus } from '../types';

export interface QueueState {
  activeTickets: Order[];
  selectedTicket: Order | null;
  soundAlertPending: boolean;
  lastNotifiedStatus: string | null;
}

const initialState: QueueState = {
  activeTickets: [],
  selectedTicket: null,
  soundAlertPending: false,
  lastNotifiedStatus: null,
};

export const queueSlice = createSlice({
  name: 'queue',
  initialState,
  reducers: {
    setActiveTickets: (state, action: PayloadAction<Order[]>) => {
      state.activeTickets = action.payload;
    },

    setSelectedTicket: (state, action: PayloadAction<Order | null>) => {
      state.selectedTicket = action.payload;
    },

    updateTicketStatus: (
      state,
      action: PayloadAction<{
        orderId: string;
        newStatus: OrderStatus;
        newQueueStatus: QueueStatus;
      }>
    ) => {
      const { orderId, newStatus, newQueueStatus } = action.payload;
      const idx = state.activeTickets.findIndex((t) => t.id === orderId || t.orderId === orderId);
      if (idx !== -1) {
        state.activeTickets[idx].status = newStatus;
        state.activeTickets[idx].queueStatus = newQueueStatus;

        if (newQueueStatus === 'ready' || newStatus === 'READY') {
          state.soundAlertPending = true;
          state.lastNotifiedStatus = 'READY';
        }
      }

      if (
        state.selectedTicket &&
        (state.selectedTicket.id === orderId || state.selectedTicket.orderId === orderId)
      ) {
        state.selectedTicket.status = newStatus;
        state.selectedTicket.queueStatus = newQueueStatus;
      }
    },

    clearSoundAlert: (state) => {
      state.soundAlertPending = false;
    },
  },
});

export const {
  setActiveTickets,
  setSelectedTicket,
  updateTicketStatus,
  clearSoundAlert,
} = queueSlice.actions;

export const selectActiveTickets = (state: { queue: QueueState }) => state.queue.activeTickets;
export const selectSelectedTicket = (state: { queue: QueueState }) => state.queue.selectedTicket;
export const selectSoundAlertPending = (state: { queue: QueueState }) => state.queue.soundAlertPending;

export default queueSlice.reducer;
