/**
 * PauseLock — React + Vite
 *
 * Tich hop:
 *   import PauseLockGate from "../pauselock/pauselock.jsx";
 *   <PauseLockGate><YourApp /></PauseLockGate>
 *
 * Doi mat khau: tao passwordHash (xem pauselock/plan.md), cap nhat PAUSE_LOCK_CONFIG.
 * Tat khoa: enabled: false
 *
 */

import React, { useEffect, useState } from "react";
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

  passwordHash:
    "09539704deca078f1ad26d6de0cd3acedee9483fd88324c8a0df8a371f31d444",

  sessionKey: "operationoverview_pause_unlocked",
  sessionSalt: "operationoverview_pl_v1",

  subtitle: "Thông báo hệ thống",
  title: "Tạm ngưng dịch vụ hỗ trợ",

  paragraphs: [
    <>
      Toàn bộ nỗ lực xây dựng và vận hành CMIT OS (Operation Overview & Berth
      Simulation) đã hoàn tất. Phương (TSV) đã chính thức kết thúc công việc
      tại CMIT vào ngày <strong>22/06/2026</strong>.
    </>,
    <>
      Phía công ty và Bộ phận IT đang có trách nhiệm triển khai, chuẩn bị hạ
      tầng hoặc cung cấp biện pháp thay thế cho anh em để không làm gián đoạn
      công việc.
    </>,
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

const attemptLimiter = createAttemptLimiter();

function PauseLockScreen({ config, onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    setCanSubmit(Boolean(password) && attemptLimiter.canAttempt());
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!attemptLimiter.canAttempt()) {
      const seconds = Math.ceil(attemptLimiter.msUntilRetry() / 1000);
      setError(config.lockoutMessage.replace("{seconds}", String(seconds)));
      return;
    }

    const ok = await verifyPassword(password, config.passwordHash);
    if (ok) {
      attemptLimiter.reset();
      await setPauseLockUnlocked(config);
      onUnlock();
      return;
    }

    attemptLimiter.recordFailure();
    if (!attemptLimiter.canAttempt()) {
      const seconds = Math.ceil(attemptLimiter.msUntilRetry() / 1000);
      setError(config.lockoutMessage.replace("{seconds}", String(seconds)));
      return;
    }

    setError(config.wrongPasswordMessage);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: config.backgroundColor }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-400/40 bg-white/95 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-lock-title"
      >
        <div className="bg-amber-500 px-6 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-950/70">
            {config.subtitle}
          </p>
          <h1
            id="pause-lock-title"
            className="mt-1 text-lg font-bold text-amber-950"
          >
            {config.title}
          </h1>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm leading-relaxed text-slate-700">
          {config.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}

          <form
            onSubmit={handleSubmit}
            className="pt-2 space-y-3 border-t border-slate-200"
          >
            <p className="text-xs font-medium text-slate-500">
              {config.passwordHint}
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder={config.passwordPlaceholder}
              className="w-full p-2.5 border-2 border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
              autoComplete="off"
              autoFocus
            />
            {error ? (
              <p className="text-xs font-medium text-red-600">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-2.5 rounded-lg bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {config.confirmButton}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function PauseLockGate({ children, config = PAUSE_LOCK_CONFIG }) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let active = true;

    (async () => {
      if (!config.enabled) {
        if (active) setState("unlocked");
        return;
      }
      const unlocked = await isPauseLockUnlocked(config);
      if (active) setState(unlocked ? "unlocked" : "locked");
    })();

    return () => {
      active = false;
    };
  }, [config]);

  if (state === "checking") return null;
  if (state === "unlocked") return children;

  return (
    <PauseLockScreen config={config} onUnlock={() => setState("unlocked")} />
  );
}

export default PauseLockGate;
