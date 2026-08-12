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
    var honeyField = form.querySelector('[name="_honey"]');

    if (honeyField && honeyField.value) {
      return;
    }

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

    var payload = {
      name: form.querySelector('[name="name"]').value,
      email: form.querySelector('[name="email"]').value,
      topic: form.querySelector('[name="topic"]').value,
      message: form.querySelector('[name="message"]').value,
      _subject: subjectField ? subjectField.value : 'Robi Report — Contact form',
      _template: 'table',
    };

    fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data.message || 'Unable to send message. Please try again.');
          }
          return data;
        });
      })
      .then(function () {
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
