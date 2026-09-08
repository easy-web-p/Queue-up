/**
 * ============================================================================
 * ⏳ LOADING, EMPTY AND ERROR STATES
 * ============================================================================
 *
 * Three states every screen that fetches has, and that most of this app did not
 * distinguish. The menu pages held a hardcoded catalogue in their initial state
 * and swapped it for real data when Firestore answered, so "still loading",
 * "nothing here" and "the read failed" all looked identical — like a stocked
 * canteen. A student could tap a dish that did not exist.
 *
 * Kept in one place so the three states look the same wherever they appear, and
 * so a screen adding them does not have to invent a shape.
 *
 * Uses the Warm Dark Canteen tokens (docs/design_system.md) and respects
 * prefers-reduced-motion through the global rule in index.css.
 */

/** A single shimmering placeholder block. */
export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-white/10 ${className}`}
    />
  );
}

/**
 * A placeholder shaped like a food card, so the layout does not jump when the
 * real menu arrives.
 */
export function FoodCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#241C16]">
      <Skeleton className="w-full aspect-4/3 rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * A grid of food-card placeholders.
 *
 * Announced politely rather than silently: a screen reader user otherwise hears
 * nothing at all between navigating and the menu appearing.
 */
export function FoodGridSkeleton({ count = 8, className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}
    >
      <span className="sr-only">กำลังโหลดรายการอาหาร...</span>
      {Array.from({ length: count }, (_, i) => (
        <FoodCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Nothing to show, and that is the truth rather than a fetch still in flight.
 *
 * `action` is what the person can do about it — an empty screen with no way
 * forward is where a session ends.
 */
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="text-center py-12 px-4 space-y-3">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#241C16] flex items-center justify-center mx-auto text-slate-400 dark:text-[#9CA3AF]">
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-['Kanit'] font-bold text-sm text-slate-700 dark:text-[#E5E7EB]">{title}</h3>
        {message && (
          <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 max-w-sm mx-auto leading-relaxed">
            {message}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * The fetch failed. Distinct from empty on purpose: "there is no food today" and
 * "we could not reach the kitchen" are different problems with different answers,
 * and showing the first when the second happened is how a permissions error looks
 * like an empty canteen.
 */
export function ErrorState({ title = 'โหลดข้อมูลไม่สำเร็จ', message, onRetry }) {
  return (
    <div
      role="alert"
      className="text-center py-10 px-4 space-y-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30"
    >
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-2xl">
        ⚠️
      </div>
      <div>
        <h3 className="font-['Kanit'] font-bold text-sm text-red-900 dark:text-red-200">{title}</h3>
        {message && (
          <p className="text-xs text-red-700 dark:text-red-300/90 mt-1 max-w-sm mx-auto leading-relaxed">
            {message}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] px-5 py-3 bg-[#FF7A1A] hover:bg-[#E6680D] text-white font-['Kanit'] font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
        >
          ลองใหม่อีกครั้ง
        </button>
      )}
    </div>
  );
}
