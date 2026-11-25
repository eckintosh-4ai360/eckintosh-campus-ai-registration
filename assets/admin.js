'use strict';
const $ = id => document.getElementById(id);
let page = 1, total = 0, pageSize = 50, search = '';
const amount = value => new Intl.NumberFormat('en-GH', {style:'currency',currency:'GHS'}).format(value / 100);
const date = value => value ? new Intl.DateTimeFormat('en-GH', {dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Accra'}).format(new Date(value)) : '—';
function message(id, value) { $(id).textContent = value; $(id).hidden = !value; }
function signedOut() { $('dashboard').hidden = true; $('login-view').hidden = false; $('admin-password').value = ''; }
async function request(url, data) {
  const response = await fetch(url, {method:data ? 'POST' : 'GET', headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data) : undefined, cache:'no-store'});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(result.error || 'Something went wrong. Please try again.'); error.status = response.status; throw error; }
  return result;
}
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }

async function changeStatus(registration, status, getPaymentRef, button, errorNode) {
  if (status === 'cancelled' && !window.confirm('Cancel this pending registration?')) return;
  if (status === 'refunded' && !window.confirm('Mark this payment as refunded?')) return;
  const paymentReference = getPaymentRef ? getPaymentRef() : '';
  button.disabled = true; errorNode.hidden = true;
  try { await request('/api/admin', {action:'update',id:registration.id,status,payment_reference:paymentReference}); await load(); }
  catch (error) { if (error.status === 401) { signedOut(); message('login-error','Your session has expired. Please sign in again.'); } else { errorNode.textContent = error.message; errorNode.hidden = false; } }
  finally { button.disabled = false; }
}

function renderRow(reg) {
  const tr = el('tr');
  const statusLabel = ['pending','paid','cancelled','refunded'].includes(reg.status) ? reg.status : 'unknown';

  tr.append(
    el('td', reg.reference),
    el('td', reg.full_name),
    el('td', reg.phone),
    el('td', reg.programme),
    el('td', reg.study_level),
    el('td', amount(reg.expected_fee_pesewas)),
  );

  const statusTd = el('td');
  statusTd.append(el('span', statusLabel, `admin-status ${statusLabel}`));
  tr.append(statusTd);

  tr.append(el('td', reg.payment_reference || '—'));
  tr.append(el('td', date(reg.created_at)));

  // Actions column
  const actionTd = el('td', undefined, 'actions-cell');
  const errorNode = el('p', undefined, 'admin-error inline-error'); errorNode.hidden = true; errorNode.setAttribute('role','alert');

  if (statusLabel === 'pending') {
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 200; input.placeholder = 'Payment ref'; input.className = 'table-input';

    const paidBtn = el('button', 'Paid', 'btn-sm btn-paid'); paidBtn.type = 'button';
    paidBtn.addEventListener('click', () => changeStatus(reg, 'paid', () => input.value, paidBtn, errorNode));

    const cancelBtn = el('button', 'Cancel', 'btn-sm btn-cancel'); cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => changeStatus(reg, 'cancelled', null, cancelBtn, errorNode));

    actionTd.append(input, paidBtn, cancelBtn);
  } else if (statusLabel === 'paid') {
    const refundBtn = el('button', 'Refund', 'btn-sm btn-refund'); refundBtn.type = 'button';
    refundBtn.addEventListener('click', () => changeStatus(reg, 'refunded', null, refundBtn, errorNode));
    actionTd.append(refundBtn);
  } else {
    actionTd.append(el('span', '—', 'muted'));
  }
  actionTd.append(errorNode);
  tr.append(actionTd);
  return tr;
}

async function load() {
  const params = new URLSearchParams({page:String(page),search});
  try {
    const data = await request(`/api/admin?${params}`); page=data.page;total=data.total;pageSize=data.pageSize;
    $('login-view').hidden=true;$('dashboard').hidden=false;message('dashboard-error','');
    $('registration-count').textContent=`${total} registration${total===1?'':'s'}`;
    const list=$('registration-list');list.replaceChildren();
    if (!data.registrations.length) {
      const tr = el('tr'); const td = el('td','No registrations found.','empty'); td.colSpan = 10; tr.append(td); list.append(tr);
    } else {
      data.registrations.forEach(reg => list.append(renderRow(reg)));
    }
    const pages=Math.max(1,Math.ceil(total/pageSize));$('page-info').textContent=`Page ${page} of ${pages}`;$('previous').disabled=page<=1;$('next').disabled=page>=pages;
  } catch(error) { if(error.status===401) signedOut(); else if($('dashboard').hidden){signedOut();message('login-error',error.message);}else message('dashboard-error',error.message); }
}

$('login-form').addEventListener('submit', async event => { event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; message('login-error',''); try { await request('/api/admin',{action:'login',email:$('admin-email').value,password:$('admin-password').value}); $('admin-password').value = ''; page = 1; await load(); } catch(error) { message('login-error', error.message); } finally { button.disabled = false; } });
$('logout').addEventListener('click', async () => { try { await request('/api/admin',{action:'logout'}); signedOut(); } catch(error) { message('dashboard-error', error.message); } });
$('search-form').addEventListener('submit', event => { event.preventDefault(); search = $('search').value.trim(); page = 1; load(); });
$('previous').addEventListener('click', () => { if (page > 1) { page--; load(); } });
$('next').addEventListener('click', () => { if (page * pageSize < total) { page++; load(); } });
load();
