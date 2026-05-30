/* Adds a single copy button to each highlighted code block. */
function addCopyButtons() {
  document.querySelectorAll('.highlight').forEach(function (highlight) {
    if (highlight.querySelector('.copy-code-button')) return;
    var code = highlight.querySelector('code');
    if (!code) return;

    var button = document.createElement('button');
    button.className = 'copy-code-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    button.innerText = 'Copy';

    button.addEventListener('click', function () {
      // Copy the code without the inline line-number gutter.
      var clone = code.cloneNode(true);
      clone.querySelectorAll('.ln, .lnt').forEach(function (n) {
        n.remove();
      });
      var text = clone.innerText.replace(/\n$/, '');
      navigator.clipboard.writeText(text).then(
        function () {
          button.innerText = 'Copied';
          button.classList.add('copied');
          button.blur();
          setTimeout(function () {
            button.innerText = 'Copy';
            button.classList.remove('copied');
          }, 2000);
        },
        function () {
          button.innerText = 'Error';
          setTimeout(function () {
            button.innerText = 'Copy';
          }, 2000);
        }
      );
    });

    highlight.appendChild(button);
  });
}

if (document.readyState !== 'loading') {
  addCopyButtons();
} else {
  document.addEventListener('DOMContentLoaded', addCopyButtons);
}
