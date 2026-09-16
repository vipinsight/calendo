//! Menu bar popovers that appear without activating Calendo.

/// Close when a popover is up, it is not pinned, and the click missed it.
pub(crate) fn should_dismiss(over_popover: bool, pinned: bool, visible: bool) -> bool {
    visible && !pinned && !over_popover
}

#[cfg(target_os = "macos")]
mod macos {
    use crate::glass;
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{class, msg_send, sel};
    use objc2_app_kit::NSStatusWindowLevel;
    use objc2_foundation::NSPoint;
    use tauri::WebviewWindow;

    const NONACTIVATING_PANEL: usize = 1 << 7;

    pub(crate) fn as_nonactivating_popover(window: &WebviewWindow) {
        let Some(ns_window) = glass::window_object(window) else {
            return;
        };
        unsafe {
            // Wry's NSWindow subclass is larger than NSPanel, so swapping
            // the class would be UB. The nonactivating bit and the private
            // prevents-activation tag are enough to keep the front app key.
            let panel_class = class!(NSPanel);
            if ns_window.class().instance_size() == panel_class.instance_size() {
                let _ = AnyObject::set_class(ns_window, panel_class);
            }
            let mask: usize = msg_send![ns_window, styleMask];
            let _: () = msg_send![ns_window, setStyleMask: mask | NONACTIVATING_PANEL];
            let prevents = sel!(_setPreventsActivation:);
            let can_prevent: Bool = msg_send![ns_window, respondsToSelector: prevents];
            if can_prevent.as_bool() {
                let _: () = msg_send![ns_window, _setPreventsActivation: Bool::YES];
            }
            let floating = sel!(setFloatingPanel:);
            let can_float: Bool = msg_send![ns_window, respondsToSelector: floating];
            if can_float.as_bool() {
                let _: () = msg_send![ns_window, setFloatingPanel: Bool::YES];
            }
            let _: () = msg_send![ns_window, setHidesOnDeactivate: Bool::NO];
            let _: () = msg_send![ns_window, setLevel: NSStatusWindowLevel];
        }
    }

    /// Maps the window on screen without making it key or activating Calendo.
    pub(crate) fn order_front_without_activating(window: &WebviewWindow) {
        let Some(ns_window) = glass::window_object(window) else {
            return;
        };
        unsafe {
            let _: () = msg_send![ns_window, orderFrontRegardless];
            let _: () = msg_send![ns_window, resignKeyWindow];
        }
    }

    fn collect_window_numbers(ns_window: &AnyObject, numbers: &mut Vec<isize>) {
        let visible: Bool = unsafe { msg_send![ns_window, isVisible] };
        if !visible.as_bool() {
            return;
        }
        let number: isize = unsafe { msg_send![ns_window, windowNumber] };
        if number != 0 {
            numbers.push(number);
        }
        let children: *mut AnyObject = unsafe { msg_send![ns_window, childWindows] };
        if children.is_null() {
            return;
        }
        let count: usize = unsafe { msg_send![children, count] };
        for index in 0..count {
            let child: *mut AnyObject = unsafe { msg_send![children, objectAtIndex: index] };
            if !child.is_null() {
                collect_window_numbers(unsafe { &*child }, numbers);
            }
        }
    }

    pub(crate) fn visible_window_numbers(window: &WebviewWindow) -> Vec<isize> {
        let Some(ns_window) = glass::window_object(window) else {
            return Vec::new();
        };
        let mut numbers = Vec::new();
        collect_window_numbers(ns_window, &mut numbers);
        numbers
    }

    pub(crate) fn mouse_is_over(numbers: &[isize]) -> bool {
        if numbers.is_empty() {
            return false;
        }
        let point: NSPoint = unsafe { msg_send![class!(NSEvent), mouseLocation] };
        let hit: isize = unsafe {
            msg_send![
                class!(NSWindow),
                windowNumberAtPoint: point,
                belowWindowWithWindowNumber: 0isize
            ]
        };
        hit != 0 && numbers.contains(&hit)
    }
}

#[cfg(target_os = "macos")]
pub(crate) use macos::{
    as_nonactivating_popover, mouse_is_over, order_front_without_activating, visible_window_numbers,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_click_on_the_popover_keeps_it_open() {
        assert!(!should_dismiss(true, false, true));
    }

    #[test]
    fn a_click_away_dismisses_it() {
        assert!(should_dismiss(false, false, true));
    }

    #[test]
    fn nothing_visible_is_a_no_op() {
        assert!(!should_dismiss(false, false, false));
    }

    #[test]
    fn a_pinned_calendar_ignores_outside_clicks() {
        assert!(!should_dismiss(false, true, true));
    }
}
