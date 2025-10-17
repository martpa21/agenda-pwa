// ======= Storage (localStorage) =======
const KEY = "agenda.pedidos";
const KEY_ID = "agenda.nextId";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
function nextId() {
  let n = parseInt(localStorage.getItem(KEY_ID) || "1", 10);
  localStorage.setItem(KEY_ID, String(n + 1));
  return n;
}
let pedidos = load();

// ======= Utils =======
const $ = sel => document.querySelector(sel);
const fmtPrecio = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(+v);
const parseFloatSafe = s => { const x = parseFloat(String(s).replace(",", ".")); return isNaN(x)? null : x; };
const byDateTime = (a,b) => (a.fecha+b.hora).localeCompare(b.fecha+b.hora);
const hoyISO = () => new Date().toISOString().slice(0,10);
function toDMY(iso){ const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; }
function fromDMY(dmy){ const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return hoyISO(); return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; }
function esc(s){ return String(s||"").replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// ======= Modal (con cierres a prueba de balas) =======
const modal = $("#modal");
const form  = $("#form");
const modalCard = modal ? modal.querySelector(".card") : null;

// Respaldo global (lo llama la X y el botón Cancelar por HTML)
window.closeModalInline = function(){
  if (!modal) return;
  modal.classList.add("hidden");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
};

function showModal() {
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function hideModal() {
  window.closeModalInline(); // usar el mismo cierre “fuerte”
}

function wireModalClosers(){
  $("#btn-nuevo").onclick     = () => openNew();
  const btnCancelar = $("#btn-cancelar");
  if (btnCancelar) btnCancelar.onclick = (e)=>{ e.preventDefault(); hideModal(); };
  const btnX = $("#btn-x");
  if (btnX) btnX.onclick = () => hideModal();

  // cerrar tocando afuera
  modal.addEventListener("click", e => { if (e.target === modal) hideModal(); });
  // evitar que clics dentro cierren
  modalCard.addEventListener("click", e => e.stopPropagation());
  // cerrar con ESC
  window.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) hideModal(); });
}

// ======= Abrir / Cargar formulario =======
function openNew() {
  $("#modal-title").textContent = "Nuevo pedido";
  form.reset();
  $("#id").value = "";
  $("#fecha").value = hoyISO();
  $("#hora").value = new Date().toTimeString().slice(0,5);
  showModal();
}
function openEdit(id) {
  const p = pedidos.find(x => x.id === id);
  if (!p) return;
  $("#modal-title").textContent = "Editar pedido";
  $("#id").value = p.id;
  $("#nombre").value = p.nombre;
  $("#apellido").value = p.apellido || "";
  $("#producto").value = p.producto;
  $("#precio").value = p.precio;
  $("#direccion").value = p.direccion;
  $("#telefono").value = p.telefono;
  $("#fecha").value = p.fecha;
  $("#hora").value = p.hora;
  $("#notas").value = p.notas || "";
  showModal();
}

// ======= Agenda =======
function renderAgenda() {
  pedidos.sort(byDateTime);
  const tbody = $("#tbody-agenda");
  tbody.innerHTML = "";
  for (const p of pedidos) {
    const tr = document.createElement("tr");
    const cliente = [p.nombre, p.apellido].filter(Boolean).join(" ");
    tr.innerHTML = `
      <td>${toDMY(p.fecha)}</td>
      <td>${p.hora}</td>
      <td>${esc(cliente)}</td>
      <td>${esc(p.producto)}</td>
      <td>${fmtPrecio(p.precio)}</td>
      <td><a href="tel:${esc(p.telefono)}">${esc(p.telefono)}</a></td>
      <td>${esc(p.direccion)} <a class="small" target="_blank" href="https://maps.google.com/?q=${encodeURIComponent(p.direccion)}">[Maps]</a></td>
      <td>
        <button data-edit="${p.id}">Editar</button>
        <button data-del="${p.id}" style="color:#b71c1c;border-color:#b71c1c">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  }
}
$("#tbody-agenda").addEventListener("click", (e) => {
  const idEdit = e.target.getAttribute("data-edit");
  const idDel  = e.target.getAttribute("data-del");
  if (idEdit) openEdit(+idEdit);
  if (idDel)  del(+idDel);
});

// ======= Form =======
form.onsubmit = (ev) => {
  ev.preventDefault();
  const id = $("#id").value ? +$("#id").value : null;
  const nombre = $("#nombre").value.trim();
  const producto = $("#producto").value.trim();
  const direccion = $("#direccion").value.trim();
  const telefono = $("#telefono").value.trim();
  const sPrecio = $("#precio").value.trim();
  const fecha = $("#fecha").value;
  const hora  = $("#hora").value;
  if (!nombre || !producto || !direccion || !telefono || !sPrecio || !fecha || !hora) {
    alert("Completá los campos obligatorios (*)");
    return;
  }
  const precio = parseFloatSafe(sPrecio);
  if (precio === null || precio < 0) { alert("Precio inválido"); return; }

  if (id) {
    const p = pedidos.find(x => x.id === id);
    Object.assign(p, {
      nombre,
      apellido: $("#apellido").value.trim(),
      producto,
      direccion,
      telefono,
      precio: +precio,
      fecha,
      hora,
      notas: $("#notas").value.trim()
    });
  } else {
    pedidos.push({
      id: nextId(),
      nombre,
      apellido: $("#apellido").value.trim(),
      producto,
      direccion,
      telefono,
      precio: +precio,
      fecha,
      hora,
      notas: $("#notas").value.trim()
    });
  }
  save(pedidos);
  renderAgenda();
  renderCalendar(currentYM);
  hideModal(); // <- cerrar siempre
};

function del(id) {
  if (!confirm("¿Eliminar este pedido?")) return;
  pedidos = pedidos.filter(x => x.id !== id);
  save(pedidos);
  renderAgenda();
  renderCalendar(currentYM);
}

// ======= Export / Import CSV =======
$("#btn-export").onclick = () => {
  const header = "id\tnombre\tapellido\tproducto\tdireccion\ttelefono\tprecio\tfecha\thora\tnotas\n";
  const lines = pedidos.map(p =>
    [p.id, p.nombre, p.apellido||"", p.producto, p.direccion, p.telefono, p.precio, toDMY(p.fecha), p.hora, (p.notas||"").replace(/\t|\n/g," ")].join("\t")
  ).join("\n");
  const blob = new Blob([header + lines], {type:"text/tab-separated-values;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pedidos.csv";
  a.click();
  URL.revokeObjectURL(a.href);
};
$("#file-import").onchange = async (ev) => {
  const file = ev.target.files[0]; if (!file) return;
  const text = await file.text();
  const rows = text.trim().split(/\r?\n/);
  rows.shift(); // header
  for (const row of rows) {
    const cols = row.split("\t");
    if (cols.length < 10) continue;
    const obj = {
      id: nextId(),
      nombre: cols[1] || "",
      apellido: cols[2] || "",
      producto: cols[3] || "",
      direccion: cols[4] || "",
      telefono: cols[5] || "",
      precio: parseFloatSafe(cols[6]) || 0,
      fecha: fromDMY(cols[7]),
      hora: cols[8] || "00:00",
      notas: cols[9] || ""
    };
    pedidos.push(obj);
  }
  save(pedidos);
  renderAgenda();
  renderCalendar(currentYM);
  ev.target.value = "";
};

// ======= Calendario =======
let currentYM = ymOf(new Date());
const monthName = (ym) => new Date(ym.year, ym.month, 1).toLocaleDateString('es-AR',{month:'long', year:'numeric'});
function ymOf(d){ return {year:d.getFullYear(), month:d.getMonth()}; }
function firstDay(ym){ return new Date(ym.year, ym.month, 1); }
function daysInMonth(ym){ return new Date(ym.year, ym.month+1, 0).getDate(); }

function renderCalendar(ym=currentYM){
  currentYM = ym;
  $("#cal-title").textContent = monthName(ym).replace(/^./, c=>c.toUpperCase());
  const grid = $("#cal-grid");
  grid.innerHTML = "";
  const headers = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  for (const h of headers) grid.appendChild(el("div","muted",h));

  const first = firstDay(ym);
  const shift = ( (first.getDay()+6)%7 ); // 0=Lun
  for (let i=0;i<shift;i++) grid.appendChild(el("div","day muted",""));

  const days = daysInMonth(ym);
  for (let d=1; d<=days; d++){
    const iso = `${ym.year}-${String(ym.month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const count = pedidos.filter(p=>p.fecha===iso).length;
    const box = el("div","day");
    box.innerHTML = `<b>${d}</b>${count? `<span class="pill">${count} ${count===1?'pedido':'pedidos'}</span>`: ""}`;
    box.onclick = () => showDay(iso);
    grid.appendChild(box);
  }
  $("#cal-list").innerHTML = "";
}
function showDay(iso){
  const list = $("#cal-list");
  const items = pedidos.filter(p=>p.fecha===iso).sort(byDateTime);
  if (!items.length){ list.innerHTML = `<p class="muted">— sin pedidos para ${toDMY(iso)} —</p>`; return; }
  const frag = document.createDocumentFragment();
  frag.appendChild(el("h3","",`Pedidos para ${toDMY(iso)}`));
  for (const p of items){
    const div = el("div","item");
    const cliente = [p.nombre, p.apellido].filter(Boolean).join(" ");
    div.innerHTML = `
      <div><b>${p.hora}</b> — ${esc(cliente)} — ${esc(p.producto)} — ${fmtPrecio(p.precio)}</div>
      <div class="small">${esc(p.telefono)} — ${esc(p.direccion)} <a target="_blank" href="https://maps.google.com/?q=${encodeURIComponent(p.direccion)}">[Maps]</a></div>
      ${p.notas? `<div class="small">Notas: ${esc(p.notas)}</div>`: ""}`;
    frag.appendChild(div);
  }
  list.innerHTML = ""; list.appendChild(frag);
}
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }

// Nav
$("#nav-agenda").onclick = () => { $("#nav-agenda").classList.add("active"); $("#nav-cal").classList.remove("active"); $("#view-agenda").classList.remove("hidden"); $("#view-cal").classList.add("hidden"); };
$("#nav-cal").onclick    = () => { $("#nav-cal").classList.add("active"); $("#nav-agenda").classList.remove("active"); $("#view-cal").classList.remove("hidden"); $("#view-agenda").classList.add("hidden"); renderCalendar(currentYM); };
$("#cal-prev").onclick   = () => renderCalendar({year:currentYM.year, month:currentYM.month-1 + (currentYM.month?0:12)});
$("#cal-next").onclick   = () => renderCalendar({year:currentYM.year, month:currentYM.month+1});

// Ajuste overflow de meses
const _renderCalendar = renderCalendar;
renderCalendar = (ym) => {
  let {year,month} = ym;
  if (month<0){ month=11; year-=1; }
  if (month>11){ month=0;  year+=1; }
  _renderCalendar({year,month});
};

// ======= PWA: service worker =======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

// Init
hideModal();           // asegurar que inicia oculto
renderAgenda();
renderCalendar(currentYM);
wireModalClosers();
