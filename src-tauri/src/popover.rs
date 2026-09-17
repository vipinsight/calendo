//! Menu bar popovers that open without taking the front app's focus.
//!
//! An accessory app that calls `set_focus()` on a window activates itself, and
//! the app the user was typing in loses the insertion point. Dropping that call
//! is only half the fix: an ordinary `NSWindow` cannot be *used* by an app that
//! is not active, so a popover that no longer steals focus also stops reacting
//! to the pointer.
//!
//! `NSPanel` with `NSWindowStyleMaskNonactivatingPanel` is the shape AppKit
//! offers for this, and the one system menu extras use. Such a panel can hold
//! key — taking hover, clicks and arrow keys — while its application stays
//! inactive and the front app keeps its caret and its place in the menu bar.
//! It also resigns key the moment the user turns to something else, which is
//! the blur the popovers already close on.

/// Turns a popover window into a nonactivating `NSPanel`.
///
/// Tao builds `TaoWindow : NSWindow` and Tauri gives no say in the class, so
/// the class is changed after the window is built. The object keeps its
/// allocation, so the new class must describe exactly as many bytes as the old
/// one: `NSPanel` adds no storage over `NSWindow`, and [`panel_class`] pads the
/// difference back out. `TaoWindow`'s own overrides are cheap to lose —
/// `canBecomeKeyWindow` and `canBecomeMainWindow` read an ivar the new class
/// does not have, so the subclass answers them itself, and its `sendEvent:`
/// only drags a window by its background, which a popover on a fixed anchor
/// never does.
///
/// Must run *after* the glass material is applied: swapping the class first
/// leaves `setContentView:` to crash on the way through KVO.
///
/// Must run on the main thread. Setup already does.
#[cfg(target_os = "macos")]
pub fn as_nonactivating_panel(window: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2::runtime::{AnyObject, Bool};

    /// `NSWindowStyleMaskNonactivatingPanel`, the one bit a popover needs and
    /// the only one AppKit reads off a borderless panel.
    const NONACTIVATING: usize = 1 << 7;

    let Some(ns_window) = crate::glass::window_object(window) else {
        return;
    };
    let Some(class) = panel_class(ns_window.class().instance_size()) else {
        return;
    };
    unsafe {
        let _ = AnyObject::set_class(ns_window, class);
        let _: () = msg_send![ns_window, setStyleMask: NONACTIVATING];
        // A menu extra stays put when the user turns to another app; the
        // popovers close on their own blur instead.
        let _: () = msg_send![ns_window, setHidesOnDeactivate: Bool::NO];
        // Hover is mouse-moved events, which AppKit withholds unless asked.
        let _: () = msg_send![ns_window, setAcceptsMouseMovedEvents: Bool::YES];
    }
}

/// `NSPanel`, plus the two answers `TaoWindow` used to give from an ivar,
/// padded to `size` so adopting it does not change how large the object claims
/// to be.
///
/// Key but never main: key is what carries hover and clicks, main is what
/// would drag Calendo to the front.
///
/// `None` when the padding cannot work out — an `NSPanel` grown past the
/// window it would replace. Better a popover that keeps the focus fix and
/// loses the pointer than one that writes past its allocation.
#[cfg(target_os = "macos")]
fn panel_class(size: usize) -> Option<&'static objc2::runtime::AnyClass> {
    use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
    use objc2::{class, sel};
    use std::sync::OnceLock;

    extern "C" fn yes(_this: &AnyObject, _sel: Sel) -> Bool {
        Bool::YES
    }
    extern "C" fn no(_this: &AnyObject, _sel: Sel) -> Bool {
        Bool::NO
    }

    static CLASS: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
    *CLASS.get_or_init(|| {
        const NAME: &std::ffi::CStr = c"CalendoPopoverPanel";
        if let Some(existing) = AnyClass::get(NAME) {
            return Some(existing);
        }
        let panel = class!(NSPanel);
        let padding = size.checked_sub(panel.instance_size())?;
        let mut builder = ClassBuilder::new(NAME, panel)?;
        unsafe {
            builder.add_method(sel!(canBecomeKeyWindow), yes as extern "C" fn(_, _) -> _);
            builder.add_method(sel!(canBecomeMainWindow), no as extern "C" fn(_, _) -> _);
        }
        // A byte at a time: `u8` aligns to one, so the ivars pack tight and the
        // class lands on exactly the size asked for.
        for index in 0..padding {
            let name = std::ffi::CString::new(format!("calendo_pad{index}")).ok()?;
            builder.add_ivar::<u8>(&name);
        }
        let class = builder.register();
        (class.instance_size() == size).then_some(class)
    })
}
