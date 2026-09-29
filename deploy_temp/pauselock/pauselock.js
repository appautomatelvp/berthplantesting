/**
 * PauseLock — static HTML / ES module (VBMS, v.v.)
 *
 * Tich hop:
 *   import { waitForPauseLockUnlock } from "./pauselock/pauselock.js";
 *   async function main() {
 *     await waitForPauseLockUnlock();
 *     // ... Firebase, API ...
 *   }
 *
 * Doi mat khau: tao passwordHash (xem pauselock/plan.md), cap nhat PAUSE_LOCK_CONFIG.
 * Tat khoa: enabled: false
 */

import {
  verifyPassword,
  isPauseLockUnlocked,
  setPauseLockUnlocked,
  createAttemptLimiter,
} from "./pauselock-core.js";

// =============================================================================
// CAU HINH — sua cho tung app
// =============================================================================
export const PAUSE_LOCK_CONFIG = {
  enabled: true,

  /** SHA-256 hex cua mat khau — KHONG luu plain text */
  passwordHash:
    "09539704deca078f1ad26d6de0cd3acedee9483fd88324c8a0df8a371f31d444",

  sessionKey: "operationoverview_pause_unlocked",
  sessionSalt: "operationoverview_pl_v1",

  subtitle: "Thông báo hệ thống",
  title: "Tạm ngưng dịch vụ hỗ trợ",

  paragraphs: [
    `Toàn bộ nỗ lực xây dựng và vận hành CMIT OS (Operation Overview & Berth
      Simulation) đã hoàn tất. Phương (TSV) đã chính thức kết thúc công việc
      tại CMIT vào ngày <strong>22/06/2026</strong>.`,
    `Phía công ty và Bộ phận IT đang có trách nhiệm triển khai, chuẩn bị hạ
      tầng hoặc cung cấp biện pháp thay thế cho anh em để không làm gián đoạn
      công việc.`,
  ],

  passwordHint: "Nhập mật khẩu để tiếp tục sử dụng hệ thống",
  passwordPlaceholder: "Mật khẩu truy cập",
  wrongPasswordMessage: "Mật khẩu không đúng. Vui lòng thử lại.",
  lockoutMessage: "Quá nhiều lần thử. Vui lòng đợi {seconds} giây.",
  confirmButton: "Xác nhận",

  backgroundColor: "#06121f",
};

// =============================================================================
// API
// =============================================================================
export { isPauseLockUnlocked, setPauseLockUnlocked };

function revealAppEntry() {
  const loginModal = document.getElementById("loginModal");
  if (loginModal) loginModal.classList.remove("hidden");
}

function removePauseLockOverlay() {
  const overlay = document.getElementById("pause-lock-overlay");
  if (overlay) overlay.remove();
}

function mountPauseLockScreen(config, onUnlock) {
  removePauseLockOverlay();

  const limiter = createAttemptLimiter();

  const overlay = document.createElement("div");
  overlay.id = "pause-lock-overlay";
  overlay.className = "min-h-screen flex items-center justify-center p-4";
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background-color:${config.backgroundColor}`;

  const paragraphsHtml = config.paragraphs
    .map((html) => `<p>${html}</p>`)
    .join("");

  overlay.innerHTML = `
    <div
      class="w-full max-w-lg rounded-2xl border border-amber-400/40 bg-white/95 shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-lock-title"
    >
      <div class="bg-amber-500 px-6 py-4 text-center">
        <p class="text-xs font-semibold uppercase tracking-widest text-amber-950/70">${config.subtitle}</p>
        <h1 id="pause-lock-title" class="mt-1 text-lg font-bold text-amber-950">${config.title}</h1>
      </div>
      <div class="px-6 py-5 space-y-4 text-sm leading-relaxed text-slate-700 normal-case">
        ${paragraphsHtml}
        <form id="pause-lock-form" class="pt-2 space-y-3 border-t border-slate-200">
          <p class="text-xs font-medium text-slate-500">${config.passwordHint}</p>
          <input
            id="pause-lock-password"
            type="password"
            placeholder="${config.passwordPlaceholder}"
            class="w-full p-2.5 border-2 border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            autocomplete="off"
          />
          <p id="pause-lock-error" class="text-xs font-medium text-red-600 hidden"></p>
          <button
            id="pause-lock-submit"
            type="submit"
            disabled
            class="w-full py-2.5 rounded-lg bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >${config.confirmButton}</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector("#pause-lock-form");
  const passwordInput = overlay.querySelector("#pause-lock-password");
  const errorEl = overlay.querySelector("#pause-lock-error");
  const submitBtn = overlay.querySelector("#pause-lock-submit");

  passwordInput.focus();

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  };

  const clearError = () => {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
  };

  passwordInput.addEventListener("input", () => {
    submitBtn.disabled = !passwordInput.value || !limiter.canAttempt();
    clearError();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!limiter.canAttempt()) {
      const seconds = Math.ceil(limiter.msUntilRetry() / 1000);
      showError(
        config.lockoutMessage.replace("{seconds}", String(seconds))
      );
      submitBtn.disabled = true;
      return;
    }

    const ok = await verifyPassword(
      passwordInput.value,
      config.passwordHash
    );

    if (ok) {
      limiter.reset();
      await setPauseLockUnlocked(config);
      removePauseLockOverlay();
      onUnlock();
      return;
    }

    limiter.recordFailure();
    if (!limiter.canAttempt()) {
      const seconds = Math.ceil(limiter.msUntilRetry() / 1000);
      showError(
        config.lockoutMessage.replace("{seconds}", String(seconds))
      );
      submitBtn.disabled = true;
      setTimeout(() => {
        if (passwordInput.value) submitBtn.disabled = false;
      }, limiter.msUntilRetry());
      return;
    }

    showError(config.wrongPasswordMessage);
  });
}

export async function waitForPauseLockUnlock(config = PAUSE_LOCK_CONFIG) {
  const finish = () => {
    revealAppEntry();
  };

  if (!config.enabled) {
    finish();
    return;
  }

  if (await isPauseLockUnlocked(config)) {
    finish();
    return;
  }

  return new Promise((resolve) => {
    mountPauseLockScreen(config, () => {
      finish();
      resolve();
    });
  });
}
