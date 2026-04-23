// background-custom.js — 自定义补丁，解耦于上游代码，定期同步上游时无需修改本文件
// 功能：
//   1. gmail-code-api 作为默认邮件服务商
//   2. isGmailCodeProvider / fetchGmailCodeAlias / markGmailCodeAliasUsed / pollGmailCodeVerificationCode
//   3. user_already_exists 时自动调用 markGmailCodeAliasUsed 标记别名

'use strict';

// ── 常量 ──────────────────────────────────────────────────────────────────────

const GMAIL_CODE_PROVIDER = 'gmail-code-api';

const {
  DEFAULT_GMAIL_CODE_BASE_URL,
  DEFAULT_GMAIL_CODE_PROJECT: DEFAULT_GMAIL_CODE_PROJECT_NAME,
  DEFAULT_GMAIL_CODE_TIME_WINDOW,
  buildGmailCodeAliasUrl,
  buildGmailCodeFetchCodeUrl,
  buildGmailCodeMarkAliasUrl,
  normalizeGmailCodeAliasResponse,
  normalizeGmailCodeAuthToken,
  normalizeGmailCodeBaseUrl,
  normalizeGmailCodeFetchCodeResponse,
  normalizeGmailCodeProject,
  normalizeGmailCodeTimeWindow,
} = (typeof self !== 'undefined' ? self : globalThis).GmailCodeUtils || {};

// ── 覆盖默认邮件服务商为 gmail-code-api ──────────────────────────────────────
// PERSISTED_SETTING_DEFAULTS 在 background.js 中定义，这里直接覆盖其值

if (typeof PERSISTED_SETTING_DEFAULTS !== 'undefined') {
  PERSISTED_SETTING_DEFAULTS.mailProvider = GMAIL_CODE_PROVIDER;
  PERSISTED_SETTING_DEFAULTS.gmailCodeApiAuthToken = 'linlang781456868';
  PERSISTED_SETTING_DEFAULTS.gmailCodeApiBaseUrl = '';
}

// ── Provider 判断 ─────────────────────────────────────────────────────────────

function isGmailCodeProvider(stateOrProvider) {
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  return provider === GMAIL_CODE_PROVIDER;
}

// ── GmailCode API 操作 ────────────────────────────────────────────────────────

async function fetchGmailCodeAlias(state) {
  const authToken = normalizeGmailCodeAuthToken(state.gmailCodeApiAuthToken);
  if (!authToken) {
    throw new Error('GmailCode 服务未配置 Auth Token，请在邮箱服务设置中填写。');
  }
  const baseUrl = normalizeGmailCodeBaseUrl(state.gmailCodeApiBaseUrl || DEFAULT_GMAIL_CODE_BASE_URL);
  const project = DEFAULT_GMAIL_CODE_PROJECT_NAME;
  const url = buildGmailCodeAliasUrl(baseUrl, project, authToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  const normalized = normalizeGmailCodeAliasResponse(data);
  if (!normalized) {
    const errorMsg = data?.error || '未知错误';
    throw new Error(`GmailCode 获取别名邮箱失败：${errorMsg}`);
  }
  return normalized;
}

async function markGmailCodeAliasUsed(state, alias) {
  const authToken = normalizeGmailCodeAuthToken(state.gmailCodeApiAuthToken);
  if (!authToken || !alias) return;
  const baseUrl = normalizeGmailCodeBaseUrl(state.gmailCodeApiBaseUrl || DEFAULT_GMAIL_CODE_BASE_URL);
  const markUrl = buildGmailCodeMarkAliasUrl(baseUrl);
  try {
    await fetch(markUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        auth_token: authToken,
        mail: alias,
        project: DEFAULT_GMAIL_CODE_PROJECT_NAME,
        status: '1',
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.warn(`[custom] GmailCode 标记别名已使用失败（${alias}）：${err.message}`);
  }
}

async function pollGmailCodeVerificationCode(step, state, pollPayload = {}) {
  const authToken = normalizeGmailCodeAuthToken(state.gmailCodeApiAuthToken);
  if (!authToken) {
    throw new Error('GmailCode 服务未配置 Auth Token，请在邮箱服务设置中填写。');
  }

  const mail = String(state.email || '').trim();
  if (!mail) {
    throw new Error(`步骤 ${step}：GmailCode 轮询前缺少注册邮箱地址。`);
  }

  const baseUrl = normalizeGmailCodeBaseUrl(state.gmailCodeApiBaseUrl || DEFAULT_GMAIL_CODE_BASE_URL);
  const project = DEFAULT_GMAIL_CODE_PROJECT_NAME;
  const timeWindow = normalizeGmailCodeTimeWindow(pollPayload.timeWindow || '30m');
  const maxAttempts = Math.max(1, Number(pollPayload.maxAttempts) || 5);
  const intervalMs = Math.max(1000, Number(pollPayload.intervalMs) || 3000);

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (typeof throwIfStopped === 'function') throwIfStopped();

    try {
      const url = buildGmailCodeFetchCodeUrl(baseUrl, project, mail, authToken, timeWindow);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      const normalized = normalizeGmailCodeFetchCodeResponse(data);

      if (normalized?.ok && normalized.code) {
        return {
          ok: true,
          code: normalized.code,
          emailTimestamp: Date.now(),
          mailId: normalized.request_id || '',
        };
      }

      lastError = new Error(`GmailCode：${normalized?.error || 'code_not_found'}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError || new Error(`步骤 ${step}：GmailCode 未找到验证码。`);
}

// ── 注入 isGmailCodeProvider / markGmailCodeAliasUsed 到已初始化的 autoRunController
// background.js 中 createAutoRunController 调用时已通过 deps 传入这两个函数（见 background.js 第 5730/5734 行）
// 本文件只需确保这两个函数在 global 作用域可被引用即可，无需额外注入。

// ── 暴露到 globalThis 供其他模块使用 ─────────────────────────────────────────

Object.assign(typeof self !== 'undefined' ? self : globalThis, {
  customGmailCode: {
    GMAIL_CODE_PROVIDER,
    isGmailCodeProvider,
    fetchGmailCodeAlias,
    markGmailCodeAliasUsed,
    pollGmailCodeVerificationCode,
  },
});
