document.querySelector('#open-report').addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
  window.close();
});
