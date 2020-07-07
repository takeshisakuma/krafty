if (document.body) {
  document.body.classList.toggle("kraftyHeadChecker");
}




/* get meta description */
var kraftyDescription;

if (document.getElementsByName("description")[0]) {
  kraftyDescription = document.getElementsByName('description')[0].content;
};

/* get title */
var kraftyPageTitle;

if (document.getElementsByName("document.title")) {
  kraftyPageTitle = document.title;
};

/* get twitter:card */
/*
var kraftyTwitterCard;

if (document.getElementsByName("twitter:card")) {
  console.log("fgrefger");
  kraftyTwitterCard = document.getElementsByName('twitter:card')[0].content;
};
*/

/* get viewport */
var kraftyViewport;

if (document.getElementsByName('viewport')[0]) {
  kraftyViewport = document.getElementsByName('viewport')[0].content;
};








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

  metaGroup.forEach(metaMember => {

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

  linkGroup.forEach(linkMember => {

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








var kraftyMessageArea = document.createElement('div');

kraftyMessageArea.id = "js-kraftyHeadInformation";
kraftyMessageArea.className = "kraftyHeadInformation";



kraftyMessageArea.insertAdjacentHTML("beforeend", "description is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyDescription);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "page title is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyPageTitle);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "OG title is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGTitle);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");
kraftyMessageArea.insertAdjacentHTML("beforeend", "OG type is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGType);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "OG url is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGUrl);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>")

kraftyMessageArea.insertAdjacentHTML("beforeend", "OG image is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGImage);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "OG description is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyOGDescription);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "fb:app_id is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyFBAppId);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");
/*
kraftyMessageArea.insertAdjacentHTML("beforeend", "twitter:card is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyTwitterCard);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");
*/
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
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyFavicon);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

kraftyMessageArea.insertAdjacentHTML("beforeend", "apple touch icon is ");
kraftyMessageArea.insertAdjacentHTML("beforeend", "<br>");
kraftyMessageArea.insertAdjacentHTML("beforeend", kraftyAppleTouchIcon);

kraftyMessageArea.insertAdjacentHTML("beforeend", "<hr>");

document.body.appendChild(kraftyMessageArea);
