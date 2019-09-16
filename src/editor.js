const saveAs = require('file-saver');

const Writer = require('comic-epub-writer/lib/writer');
const BaseResourceFactory = require('comic-epub-writer/lib/resource-factories/base');

const Book = require('./book');
const cache = require('./cache');


/**
 * Override geting image implementation
 */
class ResourceFactory extends BaseResourceFactory {
  async createImage(id, properties, imageSrc) {
    const cached = await cache.get(imageSrc);
    return {
      id,
      properties,
      href: `images/${id}.${cached.type}`,
      mediaType: cached.mediaType,
      async data() {
        const cached = await cache.get(imageSrc);
        return await fetch(cached.dataUrl).then(res => res.blob());
      },
      width: cached.width,
      height: cached.height,
    }
  }
}

const writer = new Writer('blob', new ResourceFactory());

/**
 * utility
 */
const _ = {
  dom: {
    removeChildren (parent) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
    },
  },
};

/**
 * Main applicaiton
 */
class App {
  constructor (exportButton, resetButton, tocNavigationView, editorContainerView, toastView) {
    this.exportButton = exportButton;
    this.resetButton = resetButton;
    this.tocNavigationView = tocNavigationView;
    this.editorContainerView = editorContainerView;
    this.toastView = toastView;

    // { Integer | undefined } - currently shown chapter. undefined if MetadataEditor is shown.
    this.currentChapterIndex = undefined;

    this.exportButton.addEventListener('click', async () => {
      this.exportButton.setAttribute('disabled', 'disabled');

      const progressBar = document.createElement('progress');
      progressBar.classList.add('inline');
      progressBar.style.width = '100px';
      this.exportButton.appendChild(progressBar);

      try {
        const blob = await writer.write(this.book.data(), (evt) => {
          console.log(evt);
          if (evt.progressHints && evt.progressHints.cur) {
            progressBar.setAttribute('value', evt.progressHints.cur);
          }
          if (evt.progressHints && evt.progressHints.max) {
            progressBar.setAttribute('max', evt.progressHints.max);
          }
        });
        saveAs(blob, `${this.book.title}.epub`);
      } finally {
        this.exportButton.removeAttribute('disabled');
        progressBar.remove();
      }
    });

    this.resetButton.addEventListener('click', () => {
      const c = window.confirm(`Do you want to reset all the data of "${this.book.title}"?`);
      if (c) {
        Book.reset().then((book) => {
          this.book = book;
          this.render();
          this.toastView.showMessage('Reset!');
        });
      }
    });
  }

  load() {
    Book.load().then((book) => {
      this.book = book;
      this.render();
    });
  }

  render() {
    this.tocNavigationView.render(this, this.book);
    this.editorContainerView.render(this, this.book);
  }

  menuDidSelected (event) {
    this.currentChapterIndex = event.target.dataset.chapterIndex;
    this.editorContainerView.render(this, this.book);
  }

  updateMetadata (metadata) {
    Object.assign(this.book, metadata);

    this.book.save();
    this.toastView.showMessage('Saved!');
    this.render();
  }
  updateChapter(chapter) {
    this.book.chapters[this.currentChapterIndex] = chapter;
    this.book.save();
    this.toastView.showMessage('Saved!');
    this.render();
  }
  deleteCurrentChapter() {
    const c = window.confirm('Do you want to delete this chapter?');
    if (c) {
      this.book.chapters.splice(this.currentChapterIndex, 1);
      this.currentChapterIndex = undefined;
      this.book.save();
      this.toastView.showMessage('Deleted!');
      this.render();
    }
  }
}

class TocNavigationView {
  constructor (node) {
    this.node = node;
  }

  render(app, book) {
    _.dom.removeChildren(this.node);

    this.node.appendChild(this._makeMenuLink(book.title, app.menuDidSelected.bind(app)));

    if (book.chapters.length == 0) {
      const messageSpan = document.createElement('span');
      messageSpan.innerText = '-- No Chapter added';
      this.node.appendChild(messageSpan);
    } else {
      book.chapters.forEach((chapter, index) => {
        this.node.appendChild(this._makeMenuLink(
          chapter['title'],
          app.menuDidSelected.bind(app),
          {klass: 'sublink-1', dataset: { chapterIndex: index}}
        ));
      });
    }
  }

  /**
   * @param {String} title
   * @param {function} onClick - Click event listener
   * @param {Object} options
   * @param {String} options.klass - CSS class for generated element
   * @param {String} options.dataset - dataset for generated element
   */
  _makeMenuLink (title, onClick, options={}) {
    const link = document.createElement('a');
    link.innerText = title;
    link.addEventListener('click', onClick);

    if (options.klass) {
      link.classList.add(options.klass);
    }
    if (options.dataset) {
      Object.assign(link.dataset, options.dataset);
    }
    return link;
  }
}

class EditorContainerView {
  constructor(node, metadataEditorTemplate, chapterEditorTemplate) {
    this.node = node;
    this.metadataEditorTemplate = metadataEditorTemplate;
    this.chapterEditorTemplate = chapterEditorTemplate;
  }

  render (app, book) {
    _.dom.removeChildren(this.node);

    if (app.currentChapterIndex === undefined) {
      this.node.appendChild(this._makeMetadataEditor(book));

      this.node.querySelector('#saveButton').addEventListener('click', () => {
        // TODO validation か何か
        // app 直で参照するよりメッセージでやりとりした方がそれっぽい気もするが実質変わらない感も
        app.updateMetadata({
          title: this.node.querySelector('#bookTitle').value,
          author: this.node.querySelector('#author').value,
          direction: this.node.querySelector('#direction').value,
          language: this.node.querySelector('#language').value,
          pageWidth: this.node.querySelector('#pageWidth').value,
          pageHeight: this.node.querySelector('#pageHeight').value,
          pageBgColor: this.node.querySelector('#pageBgColor').value,
        });
      });
    } else {
      const chapter = book.chapters[app.currentChapterIndex];
      this.node.appendChild(this._makeChapterEditor(chapter));
      this.node.querySelector('#saveButton').addEventListener('click', () => {
        // TODO validation か何か
        const pages = Array.from(this.node.querySelectorAll('#pageList > li > a'), a => a.innerText);
        app.updateChapter({
          title:  this.node.querySelector('#chapterTitle').value,
          pages,
        });
      });
      this.node.querySelector('#deleteButton').addEventListener('click', () => {
        app.deleteCurrentChapter();
      });
    }
  }

  _makeMetadataEditor (book) {
    const view = document.importNode(this.metadataEditorTemplate.content, true);

    view.querySelector('#nChapters').innerText = book.chapters.length;
    view.querySelector('#nPages').innerText = book.numOfPages;
    book.summarizeSizes().then((sizes) => {
      _.dom.removeChildren(document.querySelector('#sizesTableBody'));
      sizes.forEach((size) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td data-label="Size (width, height)>">${size.size}</td><td data-label="count">${size.count}</td>`;
        document.querySelector('#sizesTableBody').appendChild(row);
      });
    });

    view.querySelector('#bookTitle').value = book.title;
    view.querySelector('#author').value = book.author;
    view.querySelector(`#direction option[value=${book.direction}]`).setAttribute('selected', 'selected');
    view.querySelector('#language').value = book.language;
    view.querySelector('#pageWidth').value = book.pageWidth;
    view.querySelector('#pageHeight').value = book.pageHeight;
    view.querySelector('#pageBgColor').value = book.pageBgColor;

    return view;
  }

  _makeChapterEditor (chapter) {
    const view = document.importNode(this.chapterEditorTemplate.content, true);
    view.querySelector('#chapterTitle').value = chapter.title;
    const pageList = view.querySelector('#pageList');
    chapter['pages'].forEach((url) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.innerText= url;
      li.appendChild(a);
      pageList.appendChild(li);
    });
    return view;
  }
}

class ToastView {
  constructor(node) {
    this.node = node;
  }
  showMessage(message, time=3000) {
    const span = document.createElement('span');
    span.classList.add('toast');
    span.innerText = message;
    this.node.appendChild(span);
    setTimeout(() => span.remove(), time);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App(
    document.querySelector('#exportButton'),
    document.querySelector('#resetButton'),
    new TocNavigationView(
      document.querySelector('#tocNavigation'),
    ),
    new EditorContainerView(
      document.querySelector('#editorContainer'),
      document.querySelector('#metadataEditor'),
      document.querySelector('#chapterEditor'),
    ),
    new ToastView(
      document.querySelector('#toastContainer'),
    ),
  );
  app.load();
});
