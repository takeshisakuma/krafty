if (document.body) {
  document.body.classList.toggle("kraftyAltChecker");
}

var kraftyAltContentGroup = document.getElementsByClassName("kraftyAltContent");
kraftyAltContentGroup = Array.from(kraftyAltContentGroup);
kraftyAltContentGroup.forEach((kraftyAltContentMember) => {
  kraftyAltContentMember.parentNode.removeChild(kraftyAltContentMember);
});

var kraftyImageGroup = document.getElementsByTagName("img");

kraftyImageGroup = Array.from(kraftyImageGroup);

kraftyImageGroup.forEach((kraftyImageMember) => {
  if (!kraftyImageMember.classList.contains("kraftyNoAlt") == true) {
    kraftyImageMember.insertAdjacentHTML(
      "beforebegin",
      '<p class="kraftyAltContent">alt:' +
        kraftyImageMember.getAttribute("alt") +
        "</p>"
    );
  }
});
