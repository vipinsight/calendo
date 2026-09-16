//! Menu bar popovers that appear without activating Calendo.

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct ScreenRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub(crate) fn point_in_rect(x: f64, y: f64, rect: ScreenRect) -> bool {
    x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height
}

/// A click on a visible popover stays put. Anywhere else dismisses, unless
/// the calendar is pinned.
pub(crate) fn outside_click_should_dismiss(
    x: f64,
    y: f64,
    frames: &[ScreenRect],
    pinned: bool,
) -> bool {
    if pinned || frames.is_empty() {
        return false;
    }
    !frames
        .iter()
        .copied()
        .any(|frame| point_in_rect(x, y, frame))
}

#[cfg(target_os = "macos")]
mod macos {
    use super::ScreenRect;
    use crate::glass;
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{class, msg_send, sel};
    use objc2_app_kit::NSStatusWindowLevel;
    use objc2_foundation::NSRect;
    use tauri::WebviewWindow;

    const NONACTIVATING_PANEL: usize = 1 << 7;

    pub(crate) fn as_nonactivating_popover(window: &WebviewWindow) {
        let Some(ns_window) = glass::window_object(window) else {
            return;
        };
        unsafe {
            let window_class = class!(NSWindow);
            let panel_class = class!(NSPanel);
            if window_class.instance_size() == panel_class.instance_size() {
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

    pub(crate) fn visible_frame(window: &WebviewWindow) -> Option<ScreenRect> {
        if !window.is_visible().ok()? {
            return None;
        }
        let ns_window = glass::window_object(window)?;
        let frame: NSRect = unsafe { msg_send![ns_window, frame] };
        Some(ScreenRect {
            x: frame.origin.x,
            y: frame.origin.y,
            width: frame.size.width,
            height: frame.size.height,
        })
    }

    pub(crate) fn mouse_location() -> (f64, f64) {
        let point: objc2_foundation::NSPoint = unsafe { msg_send![class!(NSEvent), mouseLocation] };
        (point.x, point.y)
    }
}

#[cfg(target_os = "macos")]
pub(crate) use macos::{
    as_nonactivating_popover, mouse_location, order_front_without_activating, visible_frame,
};

#[cfg(test)]
mod tests {
    use super::*;

    const POPOVER: ScreenRect = ScreenRect {
        x: 100.0,
        y: 700.0,
        width: 264.0,
        height: 296.0,
    };

    #[test]
    fn click_inside_the_popover_keeps_it_open() {
        assert!(!outside_click_should_dismiss(
            120.0,
            800.0,
            &[POPOVER],
            false
        ));
    }

    #[test]
    fn click_outside_the_popover_dismisses_it() {
        assert!(outside_click_should_dismiss(10.0, 10.0, &[POPOVER], false));
    }

    #[test]
    fn no_visible_popover_is_a_no_op() {
        assert!(!outside_click_should_dismiss(10.0, 10.0, &[], false));
    }

    #[test]
    fn a_pinned_calendar_ignores_outside_clicks() {
        assert!(!outside_click_should_dismiss(10.0, 10.0, &[POPOVER], true));
    }
}
