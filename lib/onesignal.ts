export const ONE_SIGNAL_PAGE_SCRIPT_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
export const ONE_SIGNAL_WORKER_PATH = "/OneSignalSDKWorker.js";
export const ONE_SIGNAL_UPDATER_WORKER_PATH = "/OneSignalSDKUpdaterWorker.js";

export type OneSignalConfig = {
  appId: string;
  safariWebId: string;
  notifyButtonEnabled: boolean;
};
