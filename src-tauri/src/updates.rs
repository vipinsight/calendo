//! Finding a newer release, saying so, and installing it.
//!
//! Calendo is not in the App Store, so nothing tells anyone a release
//! happened. It looks for itself every few hours. With "Install updates
//! automatically" on, it installs what it finds and relaunches; with it off,
//! it only says so: a dot on the menu bar icon, an item at the top of the
//! menu, and a pill at the foot of the Settings sidebar.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// First look is delayed so launch is not racing the updater. Later looks
/// are hours apart; GitHub does not need a check on every clock tick.
const FIRST_CHECK_AFTER: Duration = Duration::from_secs(20);
const BETWEEN_CHECKS: Duration = Duration::from_secs(12 * 60 * 60);

/// The newer version the last check found, if any.
///
/// Kept here so the menu bar and a Settings window opened later can both say
/// so: the event announcing it is gone by the time either asks.
static AVAILABLE: Mutex<Option<String>> = Mutex::new(None);

/// Set while an install runs, so a second press cannot start a second
/// download over the first.
static INSTALLING: AtomicBool = AtomicBool::new(false);

/// The version waiting to be installed, if a check has found one.
pub fn available() -> Option<String> {
    AVAILABLE.lock().ok().and_then(|found| found.clone())
}

fn set_available(app: &AppHandle, version: Option<String>) {
    let changed = AVAILABLE
        .lock()
        .map(|mut found| {
            let changed = *found != version;
            *found = version.clone();
            changed
        })
        .unwrap_or(false);
    if changed {
        crate::show_update_available(app, version.as_deref());
        let _ = app.emit("update-available", version);
    }
}

fn auto_update_enabled(app: &AppHandle) -> bool {
    app.state::<crate::AppState>()
        .settings
        .lock()
        .map(|store| store.value().auto_update)
        .unwrap_or(false)
}

/// Looks for a new version in the background for as long as the app runs.
///
/// Calendo starts at login and can sit in the menu bar for weeks, so a check
/// at launch alone would fire once and never again. The setting is read each
/// time round rather than captured, so switching it takes effect on the next
/// pass without a restart.
///
/// Release builds only. A debug `pnpm app` bundle must not replace itself
/// with the GitHub payload, nor badge itself with an update it cannot take.
pub fn spawn_checks(app: AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK_AFTER);
        loop {
            let _ = tauri::async_runtime::block_on(check_then_maybe_install(&app));
            std::thread::sleep(BETWEEN_CHECKS);
        }
    });
}

async fn check_then_maybe_install(app: &AppHandle) -> Result<(), String> {
    if check(app).await?.is_some() && auto_update_enabled(app) {
        install(app).await?;
    }
    Ok(())
}

/// Asks the updater endpoint, which serves the manifest a release publishes.
/// The plugin verifies the manifest's signature against the public key built
/// into the app, so an unsigned or tampered update is refused here.
///
/// `None` means the running build is current. A failed check leaves whatever
/// was found before in place: being unable to ask is not the same as there
/// being nothing to find.
pub async fn check(app: &AppHandle) -> Result<Option<Update>, String> {
    let updater = app.updater().map_err(|error| error.to_string())?;
    let found = updater.check().await.map_err(|error| error.to_string())?;
    set_available(app, found.as_ref().map(|update| update.version.clone()));
    Ok(found)
}

/// An update that will not verify is not a transient failure: this build's
/// public key cannot attribute it to whoever signs releases, and no retry
/// changes that. Say so plainly and point at the disk image.
fn install_failure(error: tauri_plugin_updater::Error) -> String {
    if matches!(error, tauri_plugin_updater::Error::Minisign(_)) {
        return "This update couldn't be verified — download the latest version from GitHub".into();
    }
    error.to_string()
}

/// Downloads the update, replaces the app bundle, and relaunches. Progress
/// goes out as `update-progress` events carrying bytes downloaded of the
/// total, so the window can show something while it works.
///
/// Returns `Ok(false)` when the running build is already current.
pub async fn install(app: &AppHandle) -> Result<bool, String> {
    if INSTALLING.swap(true, Ordering::SeqCst) {
        return Err("An update is already installing".into());
    }
    let outcome = install_once(app).await;
    // Only a failure or "nothing to install" gets here: success relaunches.
    INSTALLING.store(false, Ordering::SeqCst);
    outcome
}

async fn install_once(app: &AppHandle) -> Result<bool, String> {
    let Some(update) = check(app).await? else {
        return Ok(false);
    };

    let progress = app.clone();
    let mut downloaded = 0usize;
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk;
                let _ = progress.emit(
                    "update-progress",
                    serde_json::json!({
                        "downloaded": downloaded,
                        "total": total,
                    }),
                );
            },
            || {},
        )
        .await
        .map_err(install_failure)?;

    // The bundle on disk is the new one now; nothing here survives the swap.
    app.restart();
}
