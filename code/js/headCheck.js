if (document.body) {
  document.body.classList.remove("kraftyBrightnessChecker");
  document.body.classList.toggle("kraftyHeadChecker");
}

/* get title */
var kraftyPageTitle = document.title;

/* get meta charset */
var kraftyCharset = document.charset;

/* get meta description */

if (document.getElementsByName("description")[0]) {
  var kraftyDescription = document.getElementsByName("description")[0].content;
}

/* get meta twitter:card */
if (document.getElementsByName("twitter:card")[0]) {
  var kraftyTwitterCard = document.getElementsByName("twitter:card")[0].content;
}

/* get meta viewport */
if (document.getElementsByName("viewport")[0]) {
  var kraftyViewport = document.getElementsByName("viewport")[0].content;
}

/* get meta */
var kraftyOGTitle;
var kraftyOGType;
var kraftyOGUrl;
var kraftyOGImage;
var kraftyOGDescription;
var kraftyFBAppId;

if (document.getElementsByTagName("meta")) {
  var metaGroup = document.getElementsByTagName("meta");

  //HTMLCollection to Array
  metaGroup = Array.from(metaGroup);

  metaGroup.forEach((metaMember) => {
    /* get OG:title */
    if (metaMember.getAttribute("property") === "og:title") {
      kraftyOGTitle = metaMember.getAttribute("content");
    }

    /* get OG:type */
    if (metaMember.getAttribute("property") === "og:type") {
      kraftyOGType = metaMember.getAttribute("content");
    }

    /* get OG:url */
    if (metaMember.getAttribute("property") === "og:url") {
      kraftyOGUrl = metaMember.getAttribute("content");
    }

    /* get OG:image */
    if (metaMember.getAttribute("property") === "og:image") {
      kraftyOGImage = metaMember.getAttribute("content");
    }
    /* get OG:description */
    if (metaMember.getAttribute("property") === "og:description") {
      kraftyOGDescription = metaMember.getAttribute("content");
    }

    /* get fb:app_id */
    if (metaMember.getAttribute("property") === "fb:app_id") {
      kraftyFBAppId = metaMember.getAttribute("content");
    }
  });
}

/* get link */
var kraftyCanonical;
var kraftyFavicon;
var kraftyAppleTouchIcon;

if (document.getElementsByTagName("link")) {
  var linkGroup = document.getElementsByTagName("link");

  //HTMLCollection to Array
  linkGroup = Array.from(linkGroup);

  linkGroup.forEach((linkMember) => {
    /* get canonical */
    if (linkMember.getAttribute("rel") === "canonical") {
      kraftyCanonical = linkMember.getAttribute("href");
    }

    /* get favicon */
    if (linkMember.getAttribute("rel") === "icon") {
      kraftyFavicon = linkMember.getAttribute("href");
    }

    /* get apple-touch-icon */
    if (linkMember.getAttribute("rel") === "apple-touch-icon") {
      kraftyAppleTouchIcon = linkMember.getAttribute("href");
    }
  });
}

var kraftyMessageArea = document.createElement("div");

kraftyMessageArea.id = "js-kraftyHeadInformation";
kraftyMessageArea.className = "kraftyHeadInformation";

kraftyMessageArea.insertAdjacentHTML("beforeend", "title is ");

if (!kraftyPageTitle == "") {
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `　(${kraftyPageTitle.length} characters)`
  );
}
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyPageTitle);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "description is ");

if (!kraftyDescription == "") {
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `　(${kraftyDescription.length} characters)`
  );
}
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyDescription);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "charset is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyCharset);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "og:title is ");

if (!kraftyOGTitle == "") {
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `　(${kraftyOGTitle.length} characters)`
  );
}
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGTitle);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");
kraftyMessageArea.insertAdjacentHTML("beforeend", "og:type is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGType);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "og:url is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGUrl);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "og:image is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");

if (!kraftyOGImage == "") {
  kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `<img src="${kraftyOGImage}" width="200" class="headImage"/>`
  );
  kraftyMessageArea.insertAdjacentHTML("beforeend", "　");
}
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGImage);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "og:description is ");

if (!kraftyOGDescription == "") {
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `　(${kraftyOGDescription.length} characters)`
  );
}
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGDescription);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "fb:app_id is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyFBAppId);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "twitter:card is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyTwitterCard);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "viewport is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyViewport);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "canonical is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyCanonical);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "favicon is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");

if (!kraftyFavicon == "") {
  kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `<img src="${kraftyFavicon}" width="32" class="headImage"/>`
  );
  kraftyMessageArea.insertAdjacentHTML("beforeend", "　");
}

kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyFavicon);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "apple touch icon is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");

if (!kraftyAppleTouchIcon == "") {
  kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
  kraftyMessageArea.insertAdjacentHTML(
    "beforeend",
    `<img src="${kraftyAppleTouchIcon}" width="60" class="headImage"/>`
  );
  kraftyMessageArea.insertAdjacentHTML("beforeend", "　");
}

kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyAppleTouchIcon);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

document.body.appendChild(kraftyMessageArea);
