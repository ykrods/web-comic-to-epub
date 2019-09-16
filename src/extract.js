/**
 * Retrive images from current tab and store image data to chrome.storage.local.
 *
 * - Using IIFE to avoid `Identifier 'xxx' has already been declared`
 */
(() => {
  const MIN_IMAGE_WIDTH = 300;

  const createDataURL = (img) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);

    return canvas.toDataURL('image/jpeg', 1.0);
  };

  const images = Array.from(document.querySelectorAll("img")).filter(img => MIN_IMAGE_WIDTH <= img.width);

  chrome.storage.local.get('cache', (result) => {
    const cache = result.cache || {};
    images.forEach((img) => {
      cache[img.src] = {
        width: img.width,
        height: img.height,
        type: 'jpg',
        mediaType: 'image/jpeg',
        dataUrl: createDataURL(img),
      };
    });
    chrome.storage.local.set({'cache': cache });
    console.log(`Current cache size: ${JSON.stringify(cache).length}`);
  });

  // pass urls to callback
  const ret = images.map(img => img.src);
  console.log(`Extract ${ret.length} images.`);

  return ret;
})();
