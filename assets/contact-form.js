(function () {
  var form = document.getElementById('contact-form');
  var success = document.getElementById('form-success');
  var error = document.getElementById('form-error');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var defaultLabel = submitBtn ? submitBtn.textContent : '';
    var topicField = form.querySelector('[name="topic"]');
    var subjectField = form.querySelector('[name="_subject"]');

    if (topicField && subjectField) {
      var topicLabel = topicField.options[topicField.selectedIndex];
      subjectField.value = 'Robi Report — ' + (topicLabel ? topicLabel.text : topicField.value);
    }

    if (success) success.classList.remove('is-visible');
    if (error) error.classList.remove('is-visible');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (data) {
            throw new Error(data.error || 'Unable to send message. Please try again.');
          });
        }
        form.reset();
        if (success) success.classList.add('is-visible');
      })
      .catch(function (err) {
        if (error) {
          error.textContent = err.message || 'Unable to send message. Please try again.';
          error.classList.add('is-visible');
        }
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultLabel;
        }
      });
  });
})();
