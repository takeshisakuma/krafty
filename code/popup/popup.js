let headCheckButton = document.getElementById("js-headCheckButton");
let nestCheckButton = document.getElementById("js-nestCheckButton");
let outlineCheckButton = document.getElementById("js-outlineCheckButton");
let altCheckButton = document.getElementById("js-altCheckButton");

headCheckButton.addEventListener("click", () => {

    headCheckButton.classList.toggle("active");

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, (tabs) => {
        chrome.tabs.executeScript(
            tabs[0].id, {
                file: "js/headCheck.js"
            });

    });

});


nestCheckButton.addEventListener("click", (element) => {

    nestCheckButton.classList.toggle("active");

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, (tabs) => {
        chrome.tabs.executeScript(
            tabs[0].id, {
                file: "js/nestCheck.js"
            });

    });

});

outlineCheckButton.addEventListener("click", () => {

    outlineCheckButton.classList.toggle("active");

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, (tabs) => {
        chrome.tabs.executeScript(
            tabs[0].id, {
                file: "js/outlineCheck.js"
            });

    });

});

altCheckButton.addEventListener("click", () => {

    altCheckButton.classList.toggle("active");

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, (tabs) => {
        chrome.tabs.executeScript(
            tabs[0].id, {
                file: "js/altCheck.js"
            });

    });

});
