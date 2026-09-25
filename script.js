(() => {
  "use strict";

  const form = document.getElementById("review-form");
  const endpointInput = document.getElementById("endpoint");
  const submitBtn = document.getElementById("submit-btn");
  const submitLabel = submitBtn.querySelector(".btn-review__label");
  const errorEl = document.getElementById("form-error");

  const incomeInput = document.getElementById("person_income");
  const amountInput = document.getElementById("loan_amnt");
  const percentOutput = document.getElementById("loan_percent_income");

  const resultSection = document.getElementById("result");
  const stampEl = document.getElementById("stamp");
  const stampTextEl = document.getElementById("stamp-text");
  const probValueEl = document.getElementById("prob-value");
  const thresholdValueEl = document.getElementById("threshold-value");

  let computedPercentIncome = null;

  // ---- Live "share of income" calculation --------------------
  function updatePercentIncome() {
    const income = parseFloat(incomeInput.value);
    const amount = parseFloat(amountInput.value);

    if (!income || income <= 0 || isNaN(amount)) {
      computedPercentIncome = null;
      percentOutput.textContent = "—";
      return;
    }

    const ratio = amount / income;
    computedPercentIncome = ratio;
    percentOutput.textContent = `${(ratio * 100).toFixed(1)}%`;
  }

  incomeInput.addEventListener("input", updatePercentIncome);
  amountInput.addEventListener("input", updatePercentIncome);

  // ---- Helpers -------------------------------------------------
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitLabel.textContent = isLoading ? "Reviewing file…" : "Assess risk";
  }

  function animateCountUp(el, target, duration = 900) {
    const start = performance.now();
    const from = 0;

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = from + (target - from) * eased;
      el.textContent = value.toFixed(1);
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderVerdict(data) {
    const isHighRisk = data.default_prediction === 1;

    stampEl.classList.remove("is-visible", "is-high-risk");
    resultSection.hidden = false;

    stampTextEl.textContent = isHighRisk ? "High risk" : "Low risk";
    if (isHighRisk) stampEl.classList.add("is-high-risk");

    thresholdValueEl.textContent = (data.threshold * 100).toFixed(0);
    probValueEl.textContent = "0";

    // restart animation on repeated submissions
    void stampEl.offsetWidth;
    requestAnimationFrame(() => {
      stampEl.classList.add("is-visible");
      animateCountUp(probValueEl, data.default_probability * 100);
    });

    resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---- Submit ----------------------------------------------------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const url = `${endpointInput.value.trim()}/predict`;
    if (!url) {
      showError("Enter the model endpoint before submitting.");
      return;
    }

    updatePercentIncome();
    if (computedPercentIncome === null) {
      showError("Enter an annual income above zero to calculate the loan's share of income.");
      return;
    }

    const payload = {
      person_age: Number(document.getElementById("person_age").value),
      person_income: Number(incomeInput.value),
      person_home_ownership: document.getElementById("person_home_ownership").value,
      person_emp_length: Number(document.getElementById("person_emp_length").value),
      loan_intent: document.getElementById("loan_intent").value,
      loan_grade: document.getElementById("loan_grade").value,
      loan_amnt: Number(amountInput.value),
      loan_int_rate: Number(document.getElementById("loan_int_rate").value),
      loan_percent_income: computedPercentIncome,
      cb_person_default_on_file: form.querySelector('input[name="cb_person_default_on_file"]:checked')?.value,
      cb_person_cred_hist_length: Number(document.getElementById("cb_person_cred_hist_length").value),
    };

    if (!payload.cb_person_default_on_file) {
      showError("Choose whether the applicant has a prior default on file.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`The model returned an error (${response.status}). ${detail}`.trim());
      }

      const data = await response.json();
      renderVerdict(data);
    } catch (err) {
      resultSection.hidden = true;
      const isNetworkError = err instanceof TypeError;
      showError(
        isNetworkError
          ? `Couldn't reach the model at ${url}. Check that the API is running and that the endpoint is correct.`
          : err.message
      );
    } finally {
      setLoading(false);
    }
  });
})();
