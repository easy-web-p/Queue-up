/**
 * ============================================================================
 * ⌨️  MAKING A CLICKABLE THING OPERABLE FROM A KEYBOARD
 * ============================================================================
 *
 * Roughly sixty elements in this app were a `<div>` or a `<span>` carrying an
 * `onClick` and a `cursor-pointer` class, and nothing else. They look like
 * controls, they behave like controls under a mouse, and to a keyboard they do
 * not exist: a browser does not put a plain div in the tab order, and pressing
 * Enter on one does nothing because there is nothing there to press.
 *
 * That is not a theoretical population. The whole left-hand navigation of the
 * profile page was seven of them, the tab strips above the order list and the
 * coupon list were three more, the category filter on the home page was
 * another, and the search bar's account menu, cart and scope picker were among
 * thirteen in one file. A student using a keyboard, a switch, or a screen
 * reader could reach almost nothing on the page — and the screen reader would
 * not have announced them as controls even if it could, because a div is not
 * one.
 *
 * Spread the result of `pressableProps(handler)` onto the element:
 *
 *   <div className="tab" {...pressableProps(() => setTab('orders'))}>
 *
 * which supplies the three things the browser gives a `<button>` for free:
 * a role, a place in the tab order, and Enter/Space activation.
 *
 * A `<button>` would be better still, and where an element could become one
 * without disturbing the layout it did. These are the rest: elements whose
 * styling assumes a block container, inside grids and flex rows that a
 * replaced element would re-flow. Correct semantics without a visual change is
 * worth more here than tag purity.
 *
 * Two things this deliberately does NOT do:
 *
 *  - It is not for modal backdrops. A click on the dimmed area behind a dialog
 *    is a mouse shortcut for "close"; its keyboard equivalent is Escape, not a
 *    tab stop announced as "button". Those use `useDialog` instead.
 *  - It does not wrap an element that already contains a real button. Nesting
 *    one control inside another is invalid, and the inner one is the control.
 */

/**
 * The props that turn a clickable element into a real control.
 *
 * @param {(event: object) => void} onActivate - what a click or Enter/Space does
 * @param {object} [options]
 * @param {string} [options.role='button'] - almost always the default. A
 *        `role="tab"` outside a `tablist`, an `option` outside a `listbox` or
 *        a `radio` outside a `radiogroup` is half an announcement: the reader
 *        names the role and then has no set to place the control in. The tab
 *        strips and pickers in this app pass `pressed` instead, which is a
 *        complete statement on its own.
 * @param {boolean} [options.disabled=false] - drops it out of the tab order and
 *        stops both activation paths, the way a disabled button behaves
 * @param {boolean} [options.pressed] - for a control with an on/off or
 *        selected state, such as a tab strip or a filter chip. Supply it and
 *        the state is announced; leave it out and the control is a plain one.
 * @param {number} [options.tabIndex]
 */
export function pressableProps(onActivate, options = {}) {
  const { role = 'button', disabled = false, pressed, tabIndex } = options;

  const activate = (event) => {
    if (disabled) return;
    onActivate(event);
  };

  return {
    role,
    tabIndex: disabled ? -1 : (tabIndex ?? 0),
    'aria-disabled': disabled || undefined,
    // Only when the caller has a state to report. `aria-pressed` on a control
    // that is not a toggle makes every one of them sound like an unchecked
    // switch, which is its own kind of wrong answer.
    'aria-pressed': typeof pressed === 'boolean' ? pressed : undefined,
    onClick: activate,
    onKeyDown: (event) => {
      if (disabled) return;
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      // Space scrolls the page by default, and Enter inside a form submits it.
      // A button suppresses both; so must anything standing in for one.
      event.preventDefault();
      activate(event);
    },
  };
}
