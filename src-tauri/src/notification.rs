use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationOptions {
    pub title: String,
    pub body: String,
    pub conversation_id: Option<String>,
}

/// Initialize native notification system. Call during app setup.
#[cfg(target_os = "macos")]
pub fn macos_init(app: &AppHandle) {
    macos::init(app);
}

/// Send a notification and handle click to show the app window.
/// On macOS, uses UNUserNotificationCenter with a delegate for click-to-conversation navigation.
/// On Windows, uses WinRT toast notifications with on_activated callback.
#[tauri::command]
pub async fn send_notification(app: AppHandle, options: NotificationOptions) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::send(app, options)
    }

    #[cfg(target_os = "windows")]
    {
        windows::send(app, options)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, options);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{Bool, ProtocolObject};
    use objc2::{define_class, msg_send, MainThreadOnly};
    use objc2_foundation::{NSError, NSObject, NSObjectProtocol, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNMutableNotificationContent, UNNotification,
        UNNotificationPresentationOptions, UNNotificationRequest, UNNotificationResponse,
        UNUserNotificationCenter, UNUserNotificationCenterDelegate,
    };
    use std::sync::OnceLock;

    static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

    define_class!(
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[name = "PipaliNotificationDelegate"]
        struct NotificationDelegate;

        unsafe impl NSObjectProtocol for NotificationDelegate {}

        #[allow(non_snake_case)]
        unsafe impl UNUserNotificationCenterDelegate for NotificationDelegate {
            // Called when the user clicks a delivered notification
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn userNotificationCenter_didReceiveNotificationResponse_withCompletionHandler(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion_handler: &block2::DynBlock<dyn Fn()>,
            ) {
                let content = response.notification().request().content();
                let user_info: Option<Retained<objc2_foundation::NSDictionary>> =
                    unsafe { msg_send![&*content, userInfo] };

                let conv_id_str = user_info.and_then(|info| {
                    let key = NSString::from_str("conversationId");
                    let value: Option<Retained<NSString>> =
                        unsafe { msg_send![&*info, objectForKey: &*key] };
                    value.map(|v| v.to_string())
                });

                if let Some(app) = APP_HANDLE.get() {
                    log::info!("[Notification] Clicked");
                    crate::show_window(app);
                    if let Some(conv_id) = conv_id_str {
                        log::info!("[Notification] Navigating to conversation: {}", conv_id);
                        let _ = app.emit("notification-clicked", conv_id);
                    }
                }

                completion_handler.call(());
            }

            // Called when a notification arrives while the app is in the foreground
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn userNotificationCenter_willPresentNotification_withCompletionHandler(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion_handler: &block2::DynBlock<
                    dyn Fn(UNNotificationPresentationOptions),
                >,
            ) {
                // Show banner even when app is in foreground
                completion_handler.call((
                    UNNotificationPresentationOptions::Banner
                        | UNNotificationPresentationOptions::Sound,
                ));
            }
        }
    );

    impl NotificationDelegate {
        fn new(mtm: objc2::MainThreadMarker) -> Retained<Self> {
            unsafe { msg_send![mtm.alloc::<Self>(), init] }
        }
    }

    pub fn init(app: &AppHandle) {
        APP_HANDLE.set(app.clone()).ok();

        let mtm = unsafe { objc2::MainThreadMarker::new_unchecked() };
        let center = UNUserNotificationCenter::currentNotificationCenter();

        // Request notification authorization
        let options = UNAuthorizationOptions::Alert
            | UNAuthorizationOptions::Sound
            | UNAuthorizationOptions::Badge;

        let completion = RcBlock::new(|granted: Bool, error: *mut NSError| {
            if granted.as_bool() {
                log::info!("[Notification] Authorization granted");
            } else {
                log::warn!("[Notification] Authorization denied");
            }
            if !error.is_null() {
                log::warn!("[Notification] Authorization error: {:?}", unsafe { &*error });
            }
        });
        center.requestAuthorizationWithOptions_completionHandler(options, &completion);

        // Set delegate — leaked so it lives for the app's lifetime
        let delegate = NotificationDelegate::new(mtm);
        let delegate_proto = ProtocolObject::from_ref(&*delegate);
        center.setDelegate(Some(delegate_proto));
        std::mem::forget(delegate);

        log::info!("[Notification] macOS notification delegate initialized");
    }

    pub fn send(app: AppHandle, options: NotificationOptions) -> Result<(), String> {
        APP_HANDLE.set(app).ok();

        log::info!(
            "[Notification] Sending: title={}, body={}",
            options.title,
            options.body
        );

        let center = UNUserNotificationCenter::currentNotificationCenter();
        let content = UNMutableNotificationContent::new();

        content.setTitle(&NSString::from_str(&options.title));
        content.setBody(&NSString::from_str(&options.body));

        // Store conversation ID in userInfo so the delegate can route to the correct conversation
        if let Some(ref conv_id) = options.conversation_id {
            let key = NSString::from_str("conversationId");
            let value = NSString::from_str(conv_id);
            let user_info: Retained<objc2_foundation::NSDictionary> = unsafe {
                msg_send![
                    objc2::runtime::AnyClass::get(c"NSDictionary").unwrap(),
                    dictionaryWithObject: &*value,
                    forKey: &*key
                ]
            };
            let _: () = unsafe { msg_send![&*content, setUserInfo: &*user_info] };
        }

        let request_id = NSString::from_str(&format!(
            "pipali-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ));

        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &request_id,
            &content,
            None,
        );

        let completion = RcBlock::new(|error: *mut NSError| {
            if !error.is_null() {
                log::error!("[Notification] Failed to deliver: {:?}", unsafe { &*error });
            }
        });

        center.addNotificationRequest_withCompletionHandler(&request, Some(&completion));

        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;
    use tauri_winrt_notification::Toast;

    pub fn send(app: AppHandle, options: NotificationOptions) -> Result<(), String> {
        log::info!(
            "[Notification] Sending: title={}, body={}",
            options.title,
            options.body
        );

        let conv_id = options.conversation_id.clone();

        // Toast::new requires the app's AUMID (Application User Model ID).
        // Tauri sets this to the `identifier` from tauri.conf.json during installation.
        // For dev/debug builds, fall back to PowerShell's AUMID so toasts still work.
        let app_id = if cfg!(debug_assertions) {
            Toast::POWERSHELL_APP_ID
        } else {
            "ai.pipali"
        };

        let result = Toast::new(app_id)
            .title(&options.title)
            .text1(&options.body)
            .on_activated({
                let app = app.clone();
                move |_action| {
                    log::info!("[Notification] Clicked");
                    crate::show_window(&app);
                    if let Some(ref conv_id) = conv_id {
                        log::info!("[Notification] Navigating to conversation: {}", conv_id);
                        let _ = app.emit("notification-clicked", conv_id.clone());
                    }
                    Ok(())
                }
            })
            .show();

        if let Err(ref e) = result {
            log::error!("[Notification] Failed to send: {:?}", e);
        }

        result
            .map(|_| ())
            .map_err(|e| format!("Failed to send notification: {:?}", e))
    }
}
