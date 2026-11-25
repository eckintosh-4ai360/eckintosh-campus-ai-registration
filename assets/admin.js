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
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function detail(list, label, value) { const box = element('div'); box.append(element('dt',label),element('dd',value || '—')); list.append(box); }
async function changeStatus(registration, status, paymentReference, button, errorNode) {
  if (status === 'cancelled' && !window.confirm('Cancel this pending registration?')) return;
  if (status === 'refunded' && !window.confirm('Mark this payment as refunded?')) return;
  button.disabled = true; errorNode.hidden = true;
  try { await request('/api/admin', {action:'update',id:registration.id,status,payment_reference:paymentReference}); await load(); }
  catch (error) { if (error.status === 401) { signedOut(); message('login-error','Your session has expired. Please sign in again.'); } else { errorNode.textContent = error.message; errorNode.hidden = false; } }
  finally { button.disabled = false; }
}
function renderCard(registration) {
  const card = element('article',undefined,'registration-card'), head = element('div',undefined,'card-head'), identity = element('div');
  identity.append(element('h2',registration.full_name),element('p',`${registration.reference} · ${date(registration.created_at)}`));
  const status = ['pending','paid','cancelled','refunded'].includes(registration.status) ? registration.status : 'unknown';
  head.append(identity,element('span',status,`admin-status ${status}`)); card.append(head);
  const details = element('dl',undefined,'registration-details');
  detail(details,'Phone / WhatsApp',registration.phone); detail(details,'Programme',registration.programme); detail(details,'Level',registration.study_level); detail(details,'Workshop fee',amount(registration.expected_fee_pesewas));
  if (registration.payment_reference) detail(details,'Payment reference',registration.payment_reference);
  if (registration.payment_verified_at) detail(details,'Payment verified',date(registration.payment_verified_at));
  card.append(details);
  if (status === 'pending' || status === 'paid') {
    const actions=element('div',undefined,'card-actions'), errorNode=element('p',undefined,'admin-error'); errorNode.hidden=true; errorNode.setAttribute('role','alert');
    if (status === 'pending') {
      const field=element('div',undefined,'payment-field'), label=element('label','Payment transaction reference'), input=element('input');
      const fieldId=`payment-${registration.id}`;label.htmlFor=fieldId;input.id=fieldId;input.type='text';input.maxLength=200;input.placeholder='Enter verified payment reference';field.append(label,input);
      const paid=element('button','Mark as paid','secondary');paid.type='button';paid.addEventListener('click',()=>changeStatus(registration,'paid',input.value,paid,errorNode));
      const cancel=element('button','Cancel registration','secondary');cancel.type='button';cancel.addEventListener('click',()=>changeStatus(registration,'cancelled','',cancel,errorNode));
      actions.append(field,paid,cancel);
    } else {
      const refund=element('button','Mark as refunded','secondary');refund.type='button';refund.addEventListener('click',()=>changeStatus(registration,'refunded','',refund,errorNode));actions.append(refund);
    }
    card.append(actions,errorNode);
  }
  return card;
}
async function load() {
  const params = new URLSearchParams({page:String(page),search});
  try {
    const data = await request(`/api/admin?${params}`); page=data.page;total=data.total;pageSize=data.pageSize;
    $('login-view').hidden=true;$('dashboard').hidden=false;message('dashboard-error','');
    $('registration-count').textContent=`${total} registration${total===1?'':'s'}`;
    const list=$('registration-list');list.replaceChildren();
    if (!data.registrations.length) list.append(element('p','No registrations found.','empty'));
    else data.registrations.forEach(registration=>list.append(renderCard(registration)));
    const pages=Math.max(1,Math.ceil(total/pageSize));$('page-info').textContent=`Page ${page} of ${pages}`;$('previous').disabled=page<=1;$('next').disabled=page>=pages;
  } catch(error) { if(error.status===401) signedOut(); else if($('dashboard').hidden){signedOut();message('login-error',error.message);}else message('dashboard-error',error.message); }
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;message('login-error','');try{await request('/api/admin',{action:'login',email:$('admin-email').value,password:$('admin-password').value});$('admin-password').value='';page=1;await load();}catch(error){message('login-error',error.message);}finally{button.disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await request('/api/admin',{action:'logout'});signedOut();}catch(error){message('dashboard-error',error.message);}});
$('search-form').addEventListener('submit',event=>{event.preventDefault();search=$('search').value.trim();page=1;load();});
$('previous').addEventListener('click',()=>{if(page>1){page--;load();}});
$('next').addEventListener('click',()=>{if(page*pageSize<total){page++;load();}});
load();
