(function () {
  if (window.__HEYNAJ_WIDGET_LOADER_ACTIVE__) return;
  window.__HEYNAJ_WIDGET_LOADER_ACTIVE__ = true;

  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName("script");
    currentScript = scripts[scripts.length - 1];
  }
  if (!currentScript) return;

  var widgetSrc =
    currentScript.getAttribute("data-heynaj-widget-src") ||
    new URL("./widget_embed.html", currentScript.src).toString();

  var webhookUrl =
    currentScript.getAttribute("data-heynaj-webhook") ||
    currentScript.getAttribute("data-webhook-url") ||
    "";

  var containerId = "heynaj-widget-loader-root";
  var mountTargetId =
    currentScript.getAttribute("data-heynaj-container") ||
    currentScript.getAttribute("data-widget-container") ||
    containerId;
  var originalWebhookPattern = /const WEBHOOK_URL = "([^"]+)";/;

  function escapeForJsDoubleQuote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function prepareWidgetHtml(html) {
    if (!webhookUrl) return html;
    if (originalWebhookPattern.test(html)) {
      return html.replace(
        originalWebhookPattern,
        'const WEBHOOK_URL = "' + escapeForJsDoubleQuote(webhookUrl) + '";'
      );
    }
    return html;
  }

  function executeInjectedScripts(container) {
    var scripts = container.querySelectorAll("script");
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(function (attr) {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  function injectWidget(html) {
    var existing = document.getElementById("heynaj-chat-widget");
    if (existing) return;

    var container = document.getElementById(mountTargetId);
    if (!container) {
      container = document.createElement("div");
      container.id = mountTargetId;
      document.body.appendChild(container);
    }

    container.innerHTML = prepareWidgetHtml(html);
    executeInjectedScripts(container);
  }

  fetch(widgetSrc, { credentials: "omit" })
    .then(function (res) {
      if (!res.ok) throw new Error("Widget fetch failed: " + res.status);
      return res.text();
    })
    .then(injectWidget)
    .catch(function (err) {
      console.error("[HeyNaj Loader] Failed to load widget:", err);
    });
})();
