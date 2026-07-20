
(function () {
  "use strict";

  // ======================================================
  // CONFIGURATION — paste your deployed Apps Script Web App URL here
  // ======================================================
  var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzqve67ZuFVpn9FD4Wy3QZVGq18BLvChn-PnqLCL-KLlKvrGMPRjlKxSOGp9rDjt_vJ/exec";

  var TRADE_OPTIONS = [
    "Site Supervisor","Carpenter","Labourer","Electrician","Plumber",
    "Groundworker","Bricklayer","Plasterer","Painter / Decorator","Roofer",
    "Joiner","Heating Engineer","General Operative","Subcontractor","Other"
  ];

  var workerCount = 0;
  var pendingSubmitOverrides = { discrepancy: false, duplicate: false };

  var form = document.getElementById("workerForm");
  var workersContainer = document.getElementById("workersContainer");
  var addWorkerBtn = document.getElementById("addWorkerBtn");
  var banner = document.getElementById("banner");
  var submitBtn = document.getElementById("submitBtn");

  // ---------- Helpers ----------

  function showBanner(message, type) {
    banner.textContent = message;
    banner.className = "banner show " + type;
    banner.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideBanner() {
    banner.className = "banner";
  }

  function setFieldError(fieldEl, show) {
    if (!fieldEl) return;
    fieldEl.classList.toggle("invalid", show);
    var wrap = fieldEl.closest(".field") || fieldEl.closest(".worker-card");
    if (wrap) {
      var errEl = wrap.querySelector(".field-error");
      if (errEl) errEl.classList.toggle("show", show);
    }
  }

  function setRadioGroupError(groupName, show) {
    var group = form.querySelectorAll('input[name="' + groupName + '"]');
    if (!group.length) return;
    var wrap = group[0].closest(".field");
    var errEl = wrap ? wrap.querySelector(".field-error") : null;
    if (errEl) errEl.classList.toggle("show", show);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function normalizeWorkerName(name) {
    return (name || "").trim().replace(/\s+/g, " ");
  }

  function parseTimeToMinutes(hhmm) {
    if (!hhmm) return null;
    var parts = hhmm.split(":");
    if (parts.length < 2) return null;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return (h * 60) + m;
  }

  // Calculates and displays a single worker's Total Daily Hours.
  // Returns { valid: boolean, hours: number }
  function recalcWorkerHours(wrap) {
    var startEl = wrap.querySelector(".worker-start-time");
    var finishEl = wrap.querySelector(".worker-finish-time");
    var breakEl = wrap.querySelector(".worker-break-minutes");
    var totalEl = wrap.querySelector(".worker-total-hours");
    var errEl = wrap.querySelector(".worker-time-error");

    errEl.textContent = "";
    errEl.classList.remove("show");
    [startEl, finishEl, breakEl].forEach(function (el) { el.classList.remove("invalid"); });

    var startMin = parseTimeToMinutes(startEl.value);
    var finishMin = parseTimeToMinutes(finishEl.value);
    var breakMin = breakEl.value === "" ? NaN : Number(breakEl.value);

    if (startMin === null || finishMin === null || isNaN(breakMin)) {
      totalEl.value = "0.00";
      return { valid: false, hours: 0 };
    }

    if (breakMin < 0) {
      errEl.textContent = "Break duration cannot be negative.";
      errEl.classList.add("show");
      breakEl.classList.add("invalid");
      totalEl.value = "0.00";
      return { valid: false, hours: 0 };
    }

    if (finishMin <= startMin) {
      errEl.textContent = "Finish Time must be later than Start Time. Overnight shifts are not supported.";
      errEl.classList.add("show");
      finishEl.classList.add("invalid");
      totalEl.value = "0.00";
      return { valid: false, hours: 0 };
    }

    var elapsedMinutes = finishMin - startMin;

    if (breakMin >= elapsedMinutes) {
      errEl.textContent = "Break Duration cannot be equal to or greater than the total time worked.";
      errEl.classList.add("show");
      breakEl.classList.add("invalid");
      totalEl.value = "0.00";
      return { valid: false, hours: 0 };
    }

    var netMinutes = elapsedMinutes - breakMin;
    var hours = netMinutes / 60;

    if (hours <= 0) {
      errEl.textContent = "Total Daily Hours must be greater than zero.";
      errEl.classList.add("show");
      totalEl.value = "0.00";
      return { valid: false, hours: 0 };
    }

    totalEl.value = hours.toFixed(2);
    return { valid: true, hours: hours };
  }

  // Recomputes the Total Labour Hours for Today card and the count-mismatch warning.
  function updateDailyTotals() {
    var cards = workersContainer.querySelectorAll(".worker-card");
    var totalHours = 0;
    cards.forEach(function (card) {
      totalHours += Number(card.querySelector(".worker-total-hours").value) || 0;
    });

    var operativeCount = Number(document.getElementById("operativeCount").value) || 0;
    var entryCount = cards.length;

    document.getElementById("dailyTotalHours").textContent = totalHours.toFixed(2);
    document.getElementById("dailyWorkerEntries").textContent = entryCount;
    document.getElementById("dailyOperativeCount").textContent = operativeCount;

    var mismatchEl = document.getElementById("dailyCountMismatch");
    if (operativeCount > 0 && entryCount !== operativeCount) {
      mismatchEl.classList.add("show");
    } else {
      mismatchEl.classList.remove("show");
    }

    return totalHours;
  }

  // ---------- Worker rows ----------

  function addWorker() {
    workerCount++;
    var idx = workerCount;

    var wrap = document.createElement("div");
    wrap.className = "worker-card";
    wrap.setAttribute("data-worker-index", idx);

    wrap.innerHTML =
      '<div class="worker-card-header">' +
        '<h3 class="worker-title">Worker ' + idx + '</h3>' +
        '<button type="button" class="btn-remove-worker">Remove</button>' +
      '</div>' +
      '<div class="field">' +
        '<label>Worker Name<span class="req">*</span></label>' +
        '<input type="text" class="worker-name" placeholder="Full name" required>' +
        '<div class="field-error">Please enter the worker\'s name.</div>' +
      '</div>' +
      '<div class="field">' +
        '<label>Trade / Role<span class="req">*</span></label>' +
        '<select class="worker-trade" required>' +
          '<option value="" disabled selected>Select a trade or role</option>' +
          TRADE_OPTIONS.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") +
        '</select>' +
        '<div class="field-error">Please select a trade or role.</div>' +
        '<div class="conditional worker-trade-other-wrap">' +
          '<label>Please specify the trade or role<span class="req">*</span></label>' +
          '<input type="text" class="worker-trade-other">' +
          '<div class="field-error">Please specify the trade or role.</div>' +
        '</div>' +
      '</div>' +
      '<div class="worker-time-group">' +
        '<div class="two-col">' +
          '<div class="field">' +
            '<label>Start Time<span class="req">*</span></label>' +
            '<input type="time" class="worker-start-time" required>' +
            '<div class="field-error">Please enter a start time.</div>' +
          '</div>' +
          '<div class="field">' +
            '<label>Finish Time<span class="req">*</span></label>' +
            '<input type="time" class="worker-finish-time" required>' +
            '<div class="field-error">Please enter a finish time.</div>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>Break Duration (minutes)<span class="req">*</span></label>' +
          '<input type="number" class="worker-break-minutes" min="0" step="5" value="60" required>' +
          '<div class="helper">Enter the total unpaid break time in minutes.</div>' +
          '<div class="field-error">Please enter a valid break duration.</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>Total Daily Hours</label>' +
          '<input type="text" class="worker-total-hours" readonly tabindex="-1" value="0.00">' +
          '<div class="helper">Calculated automatically as Finish Time minus Start Time minus Break Duration.</div>' +
        '</div>' +
        '<div class="field-error worker-time-error"></div>' +
      '</div>' +
      '<div class="field">' +
        '<label>Summary of Work Completed<span class="req">*</span></label>' +
        '<textarea class="worker-summary" placeholder="e.g. Installed three internal door frames on the first floor." required></textarea>' +
        '<div class="helper">Provide a short and specific summary of the main work completed by this individual today. Avoid vague wording such as &ldquo;Carpentry works.&rdquo;</div>' +
        '<div class="field-error">Please provide a summary of work completed.</div>' +
      '</div>';

    workersContainer.appendChild(wrap);

    wrap.querySelector(".btn-remove-worker").addEventListener("click", function () {
      removeWorker(wrap);
    });

    wrap.querySelector(".worker-trade").addEventListener("change", function () {
      var otherWrap = wrap.querySelector(".worker-trade-other-wrap");
      var isOther = this.value === "Other";
      otherWrap.classList.toggle("show", isOther);
      wrap.querySelector(".worker-trade-other").required = isOther;
      if (!isOther) wrap.querySelector(".worker-trade-other").value = "";
    });

    var timeInputs = [
      wrap.querySelector(".worker-start-time"),
      wrap.querySelector(".worker-finish-time"),
      wrap.querySelector(".worker-break-minutes")
    ];
    timeInputs.forEach(function (el) {
      el.addEventListener("input", function () {
        recalcWorkerHours(wrap);
        updateDailyTotals();
      });
      el.addEventListener("change", function () {
        recalcWorkerHours(wrap);
        updateDailyTotals();
      });
    });

    renumberWorkers();
    recalcWorkerHours(wrap);
    updateDailyTotals();
  }

  function removeWorker(wrap) {
    var cards = workersContainer.querySelectorAll(".worker-card");
    if (cards.length <= 1) {
      showBanner("At least one worker entry is required.", "warning");
      return;
    }
    wrap.remove();
    renumberWorkers();
    updateDailyTotals();
  }

  function renumberWorkers() {
    var cards = workersContainer.querySelectorAll(".worker-card");
    cards.forEach(function (card, i) {
      card.querySelector(".worker-title").textContent = "Worker " + (i + 1);
      card.setAttribute("data-worker-index", i + 1);
    });
    var removeButtons = workersContainer.querySelectorAll(".btn-remove-worker");
    removeButtons.forEach(function (btn) {
      btn.style.visibility = cards.length <= 1 ? "hidden" : "visible";
    });
  }

  addWorkerBtn.addEventListener("click", addWorker);

  // ---------- Conditional field wiring ----------

  function wireRadioConditional(groupName, triggerValue, wrapId, requiredFieldId) {
    var radios = document.querySelectorAll('input[name="' + groupName + '"]');
    radios.forEach(function (r) {
      r.addEventListener("change", function () {
        setRadioGroupError(groupName, false);
        var show = document.querySelector('input[name="' + groupName + '"]:checked').value === triggerValue;
        var wrap = document.getElementById(wrapId);
        wrap.classList.toggle("show", show);
        var field = document.getElementById(requiredFieldId);
        if (field) field.required = show;
        if (!show && field) field.value = "";
      });
    });
  }

  wireRadioConditional("allIncluded", "No", "allIncludedNoWrap", "allIncludedNoReason");
  wireRadioConditional("hasConcerns", "Yes", "hasConcernsYesWrap", "concernsDetail");

  document.querySelectorAll('input[type="radio"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      setRadioGroupError(this.name, false);
    });
  });

  document.getElementById("operativeCount").addEventListener("input", updateDailyTotals);

  document.getElementById("serviceType").addEventListener("change", function () {
    var isOther = this.value === "Other";
    var wrap = document.getElementById("serviceTypeOtherWrap");
    wrap.classList.toggle("show", isOther);
    var field = document.getElementById("serviceTypeOther");
    field.required = isOther;
    if (!isOther) field.value = "";
  });

  // ---------- Validation ----------

  function validateForm() {
    var valid = true;
    hideBanner();

    // Standard required fields (top-level, non-worker)
    var requiredEls = form.querySelectorAll("[required]");
    requiredEls.forEach(function (el) {
      // Skip fields inside worker cards; handled separately
      if (el.closest(".worker-card")) return;

      if (el.type === "radio") {
        var group = form.querySelectorAll('input[name="' + el.name + '"]');
        var checked = Array.prototype.some.call(group, function (g) { return g.checked; });
        if (!checked) {
          valid = false;
          setRadioGroupError(el.name, true);
        } else {
          setRadioGroupError(el.name, false);
        }
        return;
      }

      if (el.type === "checkbox") {
        if (!el.checked) {
          valid = false;
          setFieldError(el, true);
        } else {
          setFieldError(el, false);
        }
        return;
      }

      if (!el.value || (el.type === "number" && Number(el.value) < 1)) {
        valid = false;
        setFieldError(el, true);
      } else {
        setFieldError(el, false);
      }
    });

    // Worker cards
    var cards = workersContainer.querySelectorAll(".worker-card");
    var names = [];
    cards.forEach(function (card) {
      var nameEl = card.querySelector(".worker-name");
      var tradeEl = card.querySelector(".worker-trade");
      var tradeOtherEl = card.querySelector(".worker-trade-other");
      var summaryEl = card.querySelector(".worker-summary");
      var startEl = card.querySelector(".worker-start-time");
      var finishEl = card.querySelector(".worker-finish-time");
      var breakEl = card.querySelector(".worker-break-minutes");

      if (!nameEl.value.trim()) { valid = false; setFieldError(nameEl, true); }
      else { setFieldError(nameEl, false); names.push(normalizeWorkerName(nameEl.value).toLowerCase()); }

      if (!tradeEl.value) { valid = false; setFieldError(tradeEl, true); }
      else { setFieldError(tradeEl, false); }

      if (tradeEl.value === "Other" && !tradeOtherEl.value.trim()) {
        valid = false; setFieldError(tradeOtherEl, true);
      } else if (tradeEl.value === "Other") {
        setFieldError(tradeOtherEl, false);
      }

      if (!startEl.value) { valid = false; setFieldError(startEl, true); }
      else { setFieldError(startEl, false); }

      if (!finishEl.value) { valid = false; setFieldError(finishEl, true); }
      else { setFieldError(finishEl, false); }

      if (breakEl.value === "" || Number(breakEl.value) < 0) { valid = false; setFieldError(breakEl, true); }
      else { setFieldError(breakEl, false); }

      var calc = recalcWorkerHours(card);
      if (!calc.valid) { valid = false; }

      if (!summaryEl.value.trim()) { valid = false; setFieldError(summaryEl, true); }
      else { setFieldError(summaryEl, false); }
    });

    updateDailyTotals();

    return { valid: valid, names: names, cards: cards };
  }

  function hasDuplicateNames(names) {
    var seen = {};
    for (var i = 0; i < names.length; i++) {
      if (seen[names[i]]) return true;
      seen[names[i]] = true;
    }
    return false;
  }

  // ---------- Modals ----------

  function showModal(id) { document.getElementById(id).classList.add("show"); }
  function hideModal(id) { document.getElementById(id).classList.remove("show"); }

  document.getElementById("discrepancyCancel").addEventListener("click", function () { hideModal("discrepancyModal"); });
  document.getElementById("discrepancyContinue").addEventListener("click", function () {
    pendingSubmitOverrides.discrepancy = true;
    hideModal("discrepancyModal");
    form.requestSubmit ? form.requestSubmit() : handleSubmit();
  });

  document.getElementById("duplicateCancel").addEventListener("click", function () { hideModal("duplicateModal"); });
  document.getElementById("duplicateContinue").addEventListener("click", function () {
    pendingSubmitOverrides.duplicate = true;
    hideModal("duplicateModal");
    form.requestSubmit ? form.requestSubmit() : handleSubmit();
  });

  document.getElementById("resetBtn").addEventListener("click", function () { showModal("resetModal"); });
  document.getElementById("resetCancel").addEventListener("click", function () { hideModal("resetModal"); });
  document.getElementById("resetConfirm").addEventListener("click", function () {
    hideModal("resetModal");
    resetFormFully();
  });

  function resetFormFully() {
    form.reset();
    document.querySelectorAll(".conditional").forEach(function (c) { c.classList.remove("show"); });
    workersContainer.innerHTML = "";
    workerCount = 0;
    addWorker();
    document.getElementById("workDate").value = todayISO();
    document.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
    document.querySelectorAll(".field-error.show").forEach(function (el) { el.classList.remove("show"); });
    updateDailyTotals();
    hideBanner();
  }

  // ---------- Submission ----------

  // NOTE: Project Name is currently a free-text field so options can be changed at any time
  // without editing this code. To convert it back to a dropdown later, replace the
  // <input id="projectName"> element with a <select id="projectName"> populated from a
  // fixed list of project names — the rest of this script (payload, validation) needs no changes.
  function collectPayload(cards) {
    var submissionId = uuid();
    var timestamp = new Date().toISOString();

    var projectName = document.getElementById("projectName").value.trim();
    var workDate = document.getElementById("workDate").value;
    var siteManager = document.getElementById("siteManager").value.trim();

    var serviceType = document.getElementById("serviceType").value;
    if (serviceType === "Other") serviceType = document.getElementById("serviceTypeOther").value.trim();

    var workers = [];
    var totalLabourHours = 0;
    cards.forEach(function (card) {
      var trade = card.querySelector(".worker-trade").value;
      if (trade === "Other") trade = card.querySelector(".worker-trade-other").value.trim();
      var hours = Number(card.querySelector(".worker-total-hours").value) || 0;
      totalLabourHours += hours;
      workers.push({
        submissionId: submissionId,
        entryDate: workDate,
        projectName: projectName,
        siteManager: siteManager,
        name: normalizeWorkerName(card.querySelector(".worker-name").value),
        trade: trade,
        startTime: card.querySelector(".worker-start-time").value,
        finishTime: card.querySelector(".worker-finish-time").value,
        breakMinutes: Number(card.querySelector(".worker-break-minutes").value) || 0,
        totalHours: Number(hours.toFixed(2)),
        summary: card.querySelector(".worker-summary").value.trim()
      });
    });

    var main = {
      submissionId: submissionId,
      timestamp: timestamp,
      projectName: projectName,
      serviceType: serviceType,
      workDate: workDate,
      siteManager: siteManager,
      signInChecked: document.querySelector('input[name="signInChecked"]:checked').value,
      operativeCount: document.getElementById("operativeCount").value,
      totalWorkerEntries: cards.length,
      totalLabourHours: Number(totalLabourHours.toFixed(2)),
      allIncluded: document.querySelector('input[name="allIncluded"]:checked').value,
      allIncludedNoReason: document.getElementById("allIncludedNoReason").value.trim(),
      hasConcerns: document.querySelector('input[name="hasConcerns"]:checked').value,
      concernsDetail: document.getElementById("concernsDetail").value.trim(),
      confirmAccuracy: document.getElementById("confirmAccuracy").checked ? "Yes" : "No",
      siteManagerSignature: document.getElementById("siteManagerSignature").value.trim()
    };

    return { main: main, workers: workers };
  }

  function handleSubmit() {
    var result = validateForm();

    if (!result.valid) {
      showBanner("Please complete all required fields highlighted below.", "error");
      var firstInvalid = form.querySelector(".invalid, .field-error.show");
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var operativeCount = Number(document.getElementById("operativeCount").value);
    var workerEntryCount = result.cards.length;

    if (!pendingSubmitOverrides.discrepancy && operativeCount !== workerEntryCount) {
      document.getElementById("discrepancyText").textContent =
        "You logged " + operativeCount + " operative(s) signed in, but " + workerEntryCount +
        " worker entry(ies) completed. Do you want to continue anyway?";
      showModal("discrepancyModal");
      return;
    }

    if (!pendingSubmitOverrides.duplicate && hasDuplicateNames(result.names)) {
      showModal("duplicateModal");
      return;
    }

    // Reset overrides for next submission attempt
    pendingSubmitOverrides = { discrepancy: false, duplicate: false };

    var payload = collectPayload(result.cards);
    submitToSheet(payload);
  }

  function submitToSheet(payload) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Submitting...';
    hideBanner();

    if (!SCRIPT_URL || SCRIPT_URL.indexOf("PASTE_YOUR") === 0) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Daily Workforce Report";
      showBanner("Form is not yet connected to Google Sheets. See setup instructions.", "error");
      console.log("Form payload (not submitted):", payload);
      return;
    }

    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Daily Workforce Report";
        if (data && data.result === "success") {
          if (data.warning) {
            showBanner("Daily workforce activity and hours submitted successfully. Note: " + data.warning, "warning");
          } else {
            showBanner("Daily workforce activity and hours submitted successfully.", "success");
          }
          resetFormFully();
        } else {
          showBanner((data && data.message) ? data.message : "Something went wrong while submitting. Please try again.", "error");
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Daily Workforce Report";
        showBanner("Unable to reach the submission service. Please check your connection and try again.", "error");
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    handleSubmit();
  });

  // ---------- Init ----------

  document.getElementById("workDate").value = todayISO();
  addWorker();
  updateDailyTotals();

})();
