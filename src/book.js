const cache = require('./cache');

/**
 * Data model of a book. Stored in chrome.storage and used for writer arguments.
 *
 * # Example of stored data
 * ```
 * {
 *   title: "New Book",
 *   author: 'Author',
 *   language: "jp",
 *   direction: 'rtl';
 *   pageWidth: 800;
 *   pageHeight: 1200;
 *   pageBgColor: '#FFFFFF';
 *   chapters: [
 *     {
 *       title: 'title of the chapter',
 *       sourceUrl: 'http://foo/bar/1.html',
 *       pages: [
 *         'http://foo/bar/1/1.jpg',
 *         'http://foo/bar/1/2.jpg',
 *       ]
 *     },
 *   ]
 * }
 * ```
 */
class Book {
  constructor (data) {
    this.title = data.title || 'New Book';
    this.author = data.author || '';
    this._language = data.language;
    this.chapters = data.chapters || [];
    this.direction = data.direction || 'rtl';
    this.pageWidth = data.pageWidth || 800;
    this.pageHeight = data.pageHeight || 1200;
    this.pageBgColor = data.pageBgColor || '#FFFFFF';
  }
  static load () {
    return new Promise((resolve) => {
      chrome.storage.local.get('book', (result) => resolve(new Book(result.book || {})) );
    });
  }
  static reset () {
    return new Promise((resolve) => {
      // XXX: involve in image caches
      chrome.storage.local.clear(() => resolve(new Book({})) );
    });
  }
  get numOfPages() {
    return this.chapters.reduce((acc, cur) => acc + cur.pages.length, 0);
  }
  async summarizeSizes() {
    const data = {};
    for (const chapter of this.chapters) {
      for (const page of chapter.pages) {
        const c = await cache.get(page);
        const size = `${c.width},${c.height}`;
        data[size] = (data[size] || 0) + 1;
      }
    }
    return Object.keys(data).map(size => { return { size, count: data[size] } }).sort((a, b) => (b.count - a.count));
  }

  data() {
    return {
      title: this.title,
      author: this.author,
      direction: this.direction,
      language: this._language,
      chapters: this.chapters,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      pageBgColor: this.pageBgColor,
    }
  }
  get language () {
    return this._language || '';
  }
  set language (l) {
    if (l === 'und') {
      return;
    }
    this._language = l || this._language;
  }
  addChapter(chapter) {
    this.chapters.push({
      title: chapter.title,
      sourceUrl: chapter.sourceUrl,
      pages: chapter.pages,
    });
  }
  save() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ book: this.data()}, () => resolve() );
    });
  }
}

module.exports = Book;
