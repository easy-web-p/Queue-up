/**
 * Types for ClientQueueTicket.jsx.
 *
 * As with LoadingStates: the props default to null/undefined, which TypeScript
 * read as the prop types themselves, so passing a real order was an error.
 */

import type { Order } from '../types';

export declare const ClientQueueTicket: (props: {
  /** The order to display. Omit it and pass `orderId` to have the ticket load one. */
  activeOrder?: Order | null;
  /** Loads the order itself when no `activeOrder` is supplied. */
  orderId?: string;
  onOpenChat?: (order: Order) => void;
  onClose?: () => void;
  compact?: boolean;
}) => JSX.Element;

export default ClientQueueTicket;
