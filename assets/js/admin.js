/*
 * ZS Configurator — admin "Opcije" tab: inline (no page reload) editing.
 *
 * Progressive enhancement over the plain <form method="post"> flow in
 * src/Admin/Screen.php. Every option form (toggle DA/NE, Sačuvaj, Obriši) and
 * the Izmeni / "+ Dodaj" / Otkaži links are intercepted and sent to
 * admin-ajax.php (action=zs_admin → Screen::ajax()); the response carries a
 * freshly rendered HTML fragment for just the touched options group, which is
 * swapped into its <div class="zs-group" data-group="…"> in place. Nothing
 * else on the page moves — no reload, no scroll jump (client, 2026-09-10).
 *
 * If JS is off or a request fails, the native form submit / link navigation
 * still runs (the server flow is unchanged).
 */
(function () {
  'use strict';

  var CFG = window.ZS_ADMIN || {};
  var AJAXABLE = ['save_option', 'delete_option', 'toggle'];

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var root = document.querySelector('.zs-admin');
    if (!root || !CFG.ajax) return;

    root.addEventListener('submit', onSubmit, true);
    root.addEventListener('click', onClick, true);
  });

  function groupOf(el) {
    var g = el.closest('.zs-group');
    return g && g.getAttribute('data-group') ? g : null;
  }

  // ---- form submits (toggle / save / delete) ---------------------------
  function onSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var actionField = form.querySelector('[name="zs_action"]');
    var action = actionField ? actionField.value : '';
    if (AJAXABLE.indexOf(action) === -1) return; // reseed / settings / erp → native submit

    var container = groupOf(form);
    if (!container) return; // no group context — let it submit normally

    e.preventDefault();
    var fd = new FormData(form);
    fd.append('action', 'zs_admin');
    setBusy(container, true);

    post(fd)
      .then(function (data) { applyResult(container, data); })
      .catch(function () { setBusy(container, false); form.submit(); });
  }

  // ---- link clicks (Izmeni / + Dodaj / Otkaži) ------------------------
  function onClick(e) {
    var a = e.target.closest('[data-zs-edit],[data-zs-add],[data-zs-cancel]');
    if (!a) return;
    var container = groupOf(a);
    if (!container) return;

    e.preventDefault();
    var fd = new FormData();
    fd.append('action', 'zs_admin');
    fd.append('_wpnonce', CFG.nonce || '');

    if (a.hasAttribute('data-zs-edit')) {
      fd.append('zs_action', 'edit_form');
      fd.append('id', a.getAttribute('data-zs-edit'));
    } else if (a.hasAttribute('data-zs-add')) {
      fd.append('zs_action', 'edit_form');
      fd.append('add', a.getAttribute('data-zs-add'));
    } else {
      fd.append('zs_action', 'cancel_form');
      fd.append('group_key', a.getAttribute('data-zs-cancel'));
    }

    setBusy(container, true);
    post(fd)
      .then(function (data) { applyResult(container, data); })
      .catch(function () { setBusy(container, false); window.location = a.href; });
  }

  // ---- shared ---------------------------------------------------------
  function post(fd) {
    return fetch(CFG.ajax, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json || !json.success) throw new Error('ajax');
        return json.data || {};
      });
  }

  function applyResult(container, data) {
    setBusy(container, false);
    var target = container.getAttribute('data-group');

    // Option moved to a different group (group_key changed in the form) —
    // rare; a full reload is the safe way to fix both lists.
    if (data.group && target && data.group !== target && data.mode === 'table') {
      window.location.reload();
      return;
    }
    if (typeof data.html === 'string' && data.html !== '') {
      container.innerHTML = data.html;
    }
    if (data.msg) flash(data.msg);
  }

  function setBusy(container, on) {
    container.classList.toggle('zs-busy', !!on);
  }

  var flashTimer = null;
  function flash(code) {
    var map = { saved: 'Sačuvano.', deleted: 'Opcija obrisana.', seeded: 'Podrazumevane opcije dodate.' };
    var msg = map[code] || code;
    var root = document.querySelector('.zs-admin');
    if (!root) return;
    var el = root.querySelector('.zs-flash');
    if (!el) {
      el = document.createElement('div');
      el.className = 'zs-flash';
      root.insertBefore(el, root.firstChild.nextSibling);
    }
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2200);
  }
})();
