const Book = require('./book');

const extract = () => {
  return new Promise((resolve) => {
    chrome.tabs.query({
      active: true,
      currentWindow: true,
      url:[ 'http://*/*', 'https://*/', 'file:///*'], // exclude `chrome://` and `chrome-extension://`
    }, (tabs) => {
      if (tabs.length == 0) {
        resolve();
        return;
      }
      const tab = tabs[0];

      chrome.tabs.executeScript(tab.id, { file: 'extract.js' }, (result) => {
        chrome.tabs.detectLanguage(tab.id, (language) => {
          const value = {
            chapter: {
              title: tab.title,
              sourceUrl: tab.url,
              pages: result[0],
            },
            language,
          };
          resolve(value);
        });
      });
    });
  });
};

const showMessage = (message, time=3000) => {
  const toastContainer = document.querySelector('#toastContainer');
  const span = document.createElement('span');
  span.classList.add('toast');
  span.innerText = message;
  toastContainer.appendChild(span);
  setTimeout(() => span.remove(), time);
};

const refresh = () => {
  Book.load().then((book) => {
    document.getElementById('bookTitle').innerText = book.title;
    document.getElementById('nChapters').innerText = book.chapters.length;
    document.getElementById('nPages').innerText = book.numOfPages;
  });
};

document.addEventListener('DOMContentLoaded', () => {
  refresh();

  const addButton = document.getElementById('addButton');
  addButton.addEventListener('click', async () => {
    addButton.setAttribute('disabled', 'disabled');
    try {
      const { chapter, language } = await extract();

      if (chapter && Array.isArray(chapter.pages)) {
        const book = await Book.load();
        book.language = language;

        book.addChapter(chapter);
        await book.save();
        showMessage(`Added with ${chapter.pages.length} images.`);
        refresh();
      } else {
        showMessage(`Fail to add this page.`);
      }
    } catch(err) {
      showMessage(err);
    } finally {
      addButton.removeAttribute('disabled');
    }

  }, false);

  document.getElementById('editButton').addEventListener('click', async () => {
    chrome.tabs.create({ url: 'editor.html' });
  }, false);

});
