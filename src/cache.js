const cache = {
  // cache of cache...
  _cache: null,
  sync () {
    return new Promise((resolve) => {
      chrome.storage.local.get('cache', (result) => {
        this._cache = result.cache || {};
        resolve();
      });
    });
  },
  async get (key, sync = false) {
    if (!this._cache || sync) {
      await this.sync();
    }
    if ( this._cache[key] === undefined ) {
      throw new Error(`${key} is not cached.`);
    }
    return this._cache[key];
  }
}
module.exports = cache;
