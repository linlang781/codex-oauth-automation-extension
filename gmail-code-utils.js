(function gmailCodeUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.GmailCodeUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createGmailCodeUtils() {
  const DEFAULT_GMAIL_CODE_BASE_URL = 'https://gmail.freeopenai.me';
  const DEFAULT_GMAIL_CODE_PROJECT = 'openai';
  const DEFAULT_GMAIL_CODE_TIME_WINDOW = '30m';

  function normalizeGmailCodeBaseUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return DEFAULT_GMAIL_CODE_BASE_URL;
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return DEFAULT_GMAIL_CODE_BASE_URL;
      }
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return DEFAULT_GMAIL_CODE_BASE_URL;
    }
  }

  function normalizeGmailCodeAuthToken(rawValue) {
    return String(rawValue || '').trim();
  }

  function normalizeGmailCodeProject(rawValue) {
    return String(rawValue || '').trim().toLowerCase() || DEFAULT_GMAIL_CODE_PROJECT;
  }

  function normalizeGmailCodeTimeWindow(rawValue) {
    const value = String(rawValue || '').trim().toLowerCase();
    if (/^\d+[mh]$/.test(value)) return value;
    return DEFAULT_GMAIL_CODE_TIME_WINDOW;
  }

  function buildGmailCodeAliasUrl(baseUrl, project, authToken) {
    const url = new URL(`${normalizeGmailCodeBaseUrl(baseUrl)}/api/alias`);
    url.searchParams.set('project', normalizeGmailCodeProject(project));
    url.searchParams.set('auth_token', authToken);
    return url.toString();
  }

  function buildGmailCodeFetchCodeUrl(baseUrl, project, mail, authToken, timeWindow) {
    const url = new URL(`${normalizeGmailCodeBaseUrl(baseUrl)}/api/code`);
    url.searchParams.set('project', normalizeGmailCodeProject(project));
    url.searchParams.set('mail', String(mail || '').trim());
    url.searchParams.set('auth_token', authToken);
    url.searchParams.set('time', normalizeGmailCodeTimeWindow(timeWindow));
    return url.toString();
  }

  function buildGmailCodeMarkAliasUrl(baseUrl) {
    return `${normalizeGmailCodeBaseUrl(baseUrl)}/api/alias/mark`;
  }

  function normalizeGmailCodeAliasResponse(data) {
    if (!data || typeof data !== 'object' || !data.ok) return null;
    const alias = String(data.alias || '').trim().toLowerCase();
    if (!alias) return null;
    return {
      ok: true,
      alias,
      real_email: String(data.real_email || '').trim().toLowerCase(),
      project: String(data.project || DEFAULT_GMAIL_CODE_PROJECT).trim().toLowerCase(),
      request_id: String(data.request_id || '').trim(),
    };
  }

  function normalizeGmailCodeFetchCodeResponse(data) {
    if (!data || typeof data !== 'object') return null;
    if (!data.ok) {
      return {
        ok: false,
        error: String(data.error || 'code_not_found').trim(),
        project: String(data.project || DEFAULT_GMAIL_CODE_PROJECT).trim().toLowerCase(),
        mail: String(data.mail || '').trim().toLowerCase(),
      };
    }
    const code = String(data.code || '').trim();
    if (!code) return null;
    return {
      ok: true,
      code,
      project: String(data.project || DEFAULT_GMAIL_CODE_PROJECT).trim().toLowerCase(),
      mail: String(data.mail || '').trim().toLowerCase(),
      resolved_account: String(data.resolved_account || '').trim().toLowerCase(),
      subject: String(data.subject || '').trim(),
      internal_date: data.internal_date ? String(data.internal_date) : null,
      request_id: String(data.request_id || '').trim(),
    };
  }

  return {
    DEFAULT_GMAIL_CODE_BASE_URL,
    DEFAULT_GMAIL_CODE_PROJECT,
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
  };
});
