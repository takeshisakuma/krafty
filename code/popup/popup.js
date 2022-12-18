let headCheckButton = document.getElementById("js-headCheckButton");
let nestCheckButton = document.getElementById("js-nestCheckButton");
let outlineCheckButton = document.getElementById("js-outlineCheckButton");
let altCheckButton = document.getElementById("js-altCheckButton");
let brightnessButton = document.getElementById("js-brightnessCheckButton");

headCheckButton.addEventListener("click", () => {
  brightnessButton.classList.remove("active");
  headCheckButton.classList.toggle("active");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ["js/headCheck.js"],
      });
    }
  );
});

nestCheckButton.addEventListener("click", (element) => {
  nestCheckButton.classList.toggle("active");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ["js/nestCheck.js"],
      });
    }
  );
});

outlineCheckButton.addEventListener("click", () => {
  outlineCheckButton.classList.toggle("active");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ["js/outlineCheck.js"],
      });
    }
  );
});

altCheckButton.addEventListener("click", () => {
  altCheckButton.classList.toggle("active");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ["js/altCheck.js"],
      });
    }
  );
});

brightnessButton.addEventListener("click", () => {
  headCheckButton.classList.remove("active");
  brightnessButton.classList.toggle("active");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: ["js/brightnessCheck.js"],
      });
    }
  );
});
