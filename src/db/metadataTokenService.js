'use strict';

const ENDPOINT = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';

class MetadataTokenService {
  constructor(fetchImpl = globalThis.fetch, endpoint = ENDPOINT) {
    this.fetch = fetchImpl;
    this.endpoint = endpoint;
    this.token = '';
    this.expiresAt = 0;
    this.pending = null;
  }

  getToken() {
    return this.expiresAt - Date.now() > 60_000 ? this.token : '';
  }

  async initialize() {
    if (this.getToken()) return;
    if (!this.pending) {
      this.pending = this.load().finally(() => {
        this.pending = null;
      });
    }
    await this.pending;
  }

  async load() {
    const response = await this.fetch(this.endpoint, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) throw new Error(`Metadata service returned ${response.status}`);
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token ||
        !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
      throw new Error('Metadata service returned an invalid token response');
    }
    this.token = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
  }
}

module.exports = { MetadataTokenService, ENDPOINT };
