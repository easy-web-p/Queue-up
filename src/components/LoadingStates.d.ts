/**
 * Types for LoadingStates.jsx.
 *
 * Without these, TypeScript inferred each prop from its default value — so
 * `action = null` typed the prop as `null` and passing a button was an error.
 * Defaults describe the fallback, not the contract.
 */

import type { ReactNode } from 'react';

export declare function Skeleton(props: { className?: string }): JSX.Element;
export declare function FoodCardSkeleton(): JSX.Element;
export declare function FoodGridSkeleton(props: { count?: number; className?: string }): JSX.Element;

export declare function EmptyState(props: {
  /** Rendered as-is; pass an icon element, not a class name. */
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  /** An optional call to action, e.g. a button that seeds the empty collection. */
  action?: ReactNode;
}): JSX.Element;

/**
 * A failed fetch. Deliberately distinct from EmptyState: "there is nothing
 * here" and "we could not find out" are different problems with different
 * answers, and showing the first when the second happened is how a permissions
 * error reads as an empty canteen.
 */
export declare function ErrorState(props: {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
}): JSX.Element;
