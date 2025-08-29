/* =======================
   GymBuddy — app.js (Vanilla JS)
   - Inspirado en Hevy, sin backend
   - Estructura: RUTINAS > EJERCICIOS > SERIES (reps, peso)
   - Persistencia: localStorage
   ======================= */

const STORAGE_KEY = "gymbuddy_state_v1";

// --- Estado y persistencia ---
const Store = {
  state: null,

  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { this.state = JSON.parse(saved); }
      catch { this.state = null; }
    }
    if (!this.state) {
      this.state = {
        routines: [],
        library: EXERCISES_SEED,  // desde data.js
        customExercises: [],
        lastOpenedRoutineId: null
      };
      this.save();
    } else {
      // merge defensivo de biblioteca si añadimos nuevos seeds en el futuro
      const libById = new Map(this.state.library.map(e => [e.id, e]));
      EXERCISES_SEED.forEach(e => { if (!libById.has(e.id)) this.state.library.push(e); });
      this.save();
    }
    return this.state;
  },

  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); },

  // helpers
  uid(prefix="id") { return `${prefix}_${Math.random().toString(36).slice(2,10)}`; },

  addRoutine(name){
    const r = { id:this.uid("rut"), name, createdAt:Date.now(), updatedAt:Date.now(), exercises:[] };
    this.state.routines.unshift(r);
    this.state.lastOpenedRoutineId = r.id;
    this.save();
    return r;
  },

  addExerciseToRoutine(routineId, exerciseRef){
    const r = this.state.routines.find(r=>r.id===routineId);
    if(!r) return;
    r.exercises.push({
      id: this.uid("rex"),
      exerciseRef, // {type:"seed"|"custom", id}
      sets: []
    });
    r.updatedAt = Date.now();
    this.save();
  },

  addSet(routineId, rexId, reps=0, peso=0){
    const r = this.state.routines.find(r=>r.id===routineId);
    if(!r) return;
    const ex = r.exercises.find(x=>x.id===rexId);
    if(!ex) return;
    ex.sets.push({ id:this.uid("set"), reps, peso });
    r.updatedAt = Date.now();
    this.save();
  },

  removeSet(routineId, rexId, setId){
    const r = this.state.routines.find(r=>r.id===routineId);
    if(!r) return;
    const ex = r.exercises.find(x=>x.id===rexId);
    if(!ex) return;
    ex.sets = ex.sets.filter(s=>s.id!==setId);
    r.updatedAt = Date.now();
    this.save();
  },

  updateSet(routineId, rexId, setId, field, value){
    const r = this.state.routines.find(r=>r.id===routineId);
    if(!r) return;
    const ex = r.exercises.find(x=>x.id===rexId);
    if(!ex) return;
    const s = ex.sets.find(s=>s.id===setId);
    if(!s) return;
    s[field] = value;
    r.updatedAt = Date.now();
    this.save();
  },

  removeExerciseFromRoutine(routineId, rexId){
    const r = this.state.routines.find(r=>r.id===routineId);
    if(!r) return;
    r.exercises = r.exercises.filter(x=>x.id!==rexId);
    r.updatedAt = Date.now();
    this.save();
  },

  addCustomExercise(payload){
    const ex = {
      id: this.uid("cus"),
      name: payload.name.trim(),
      image: payload.image?.trim() || "",
      bodyPart: payload.bodyPart?.trim() || "Otros",
      primaryMuscles: payload.primaryMuscles || "",
      secondaryMuscles: payload.secondaryMuscles || "",
      equipment: payload.equipment?.trim() || ""
    };
    this.state.customExercises.push(ex);
    this.save();
    return ex;
  },

  getExerciseByRef(ref){
    if(ref.type==="seed"){
      return this.state.library.find(e=>e.id===ref.id);
    }else{
      return this.state.customExercises.find(e=>e.id===ref.id);
    }
  }
};

// --- Render de vistas ---
const appEl = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

const FAB = document.getElementById("fab-add");

function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString(undefined,{ day:"2-digit", month:"short"});
}

function render(){
  const s = Store.state;
  appEl.innerHTML = `
    <header class="header">
      <div class="title">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M13 3h-2l-1 4H6a2 2 0 0 0-2 2v3h2V9h3l1 4h2l1-4h3v3h2V9a2 2 0 0 0-2-2h-4l-1-4zM4 14v3a2 2 0 0 0 2 2h4l1 4h2l1-4h4a2 2 0 0 0 2-2v-3h-2v3h-4l-1 4h-2l-1-4H6v-3H4z"/>
        </svg>
        <div>
          <div>GymBuddy</div>
          <div class="badge">Entrenamiento funcional • local</div>
        </div>
      </div>
    </header>

    ${s.routines.length===0 ? `
      <div class="empty card">
        <p><strong>¿Sin rutinas aún?</strong></p>
        <p>Crea y registra tus entrenamientos. Se guardan en tu dispositivo.</p>
        <div class="cta"><button class="btn" id="cta-new">Crea tu primera rutina</button></div>
      </div>
    `: `
      <section class="grid">
        ${s.routines.map(r=>RoutineCard(r)).join("")}
      </section>
    `}
  `;

  // eventos
  const cta = document.getElementById("cta-new");
  if(cta) cta.addEventListener("click", openCreateRoutine);
  document.querySelectorAll("[data-open-routine]").forEach(el=>{
    el.addEventListener("click", ()=> openRoutine(el.getAttribute("data-open-routine")));
  });
}

function RoutineCard(r){
  const totalSets = r.exercises.reduce((acc,e)=>acc+e.sets.length,0);
  return `
  <article class="card" role="button" data-open-routine="${r.id}">
    <div class="card-row">
      <div style="width:48px;height:48px;border-radius:14px;background:#101012;display:grid;place-items:center;border:1px solid var(--border)">
        <span class="kbd">${r.exercises.length || 0}</span>
      </div>
      <div style="flex:1">
        <h3>${escapeHtml(r.name)}</h3>
        <p>${totalSets} series registradas • actualizado ${fmtDate(r.updatedAt)}</p>
      </div>
      <button class="icon-btn" aria-label="Abrir">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>
  </article>
  `;
}

function openCreateRoutine(){
  showModal("Nueva rutina", `
    <div class="row" style="gap:10px">
      <input id="rut-name" class="input" placeholder="Nombre de la rutina (p.ej. 'Full body A')" />
      <button id="rut-save" class="btn">Guardar</button>
    </div>
  `, ()=>{
    const inp = document.getElementById("rut-name");
    const btn = document.getElementById("rut-save");
    inp.focus();
    btn.addEventListener("click", ()=>{
      const name = (inp.value||"").trim();
      if(!name){ inp.focus(); return; }
      const r = Store.addRoutine(name);
      closeModal();
      openRoutine(r.id);
      render();
    });
  });
}

function openRoutine(id){
  const r = Store.state.routines.find(x=>x.id===id);
  if(!r) return render();

  Store.state.lastOpenedRoutineId = r.id;
  Store.save();

  appEl.innerHTML = `
    <header class="header">
      <div class="nav">
        <button class="icon-btn" id="back">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <div class="breadcrumb">Rutina</div>
          <div class="title">${escapeHtml(r.name)}</div>
        </div>
        <span style="flex:1"></span>
        <button id="add-ex" class="btn">Añadir ejercicios</button>
      </div>
    </header>

    <section class="grid">
      ${r.exercises.length===0 ? `
        <div class="empty card">
          <p><strong>Ningún ejercicio añadido.</strong></p>
          <p>Usa “Añadir ejercicios” para buscar por grupo muscular o nombre.</p>
        </div>
      `: r.exercises.map(x=>ExerciseCard(r, x)).join("")}
    </section>
  `;

  document.getElementById("back").addEventListener("click", render);
  document.getElementById("add-ex").addEventListener("click", ()=> openExercisePicker(r.id));

  // conectar eventos de inputs de series
  r.exercises.forEach(x=>{
    x.sets.forEach(s=>{
      const reps = document.getElementById(`reps-${s.id}`);
      const peso = document.getElementById(`peso-${s.id}`);
      if(reps) reps.addEventListener("input", (e)=>{
        Store.updateSet(r.id, x.id, s.id, "reps", parseInt(e.target.value||"0",10));
      });
      if(peso) peso.addEventListener("input", (e)=>{
        Store.updateSet(r.id, x.id, s.id, "peso", parseFloat(e.target.value||"0"));
      });
    });
    const addSetBtn = document.getElementById(`add-set-${x.id}`);
    if(addSetBtn) addSetBtn.addEventListener("click", ()=>{
      Store.addSet(r.id, x.id, 0, 0);
      openRoutine(r.id); // re-render
    });
    const delExBtn = document.getElementById(`del-ex-${x.id}`);
    if(delExBtn) delExBtn.addEventListener("click", ()=>{
      Store.removeExerciseFromRoutine(r.id, x.id);
      openRoutine(r.id);
    });
    x.sets.forEach(s=>{
      const rm = document.getElementById(`del-set-${s.id}`);
      if(rm) rm.addEventListener("click", ()=>{
        Store.removeSet(r.id, x.id, s.id);
        openRoutine(r.id);
      });
    });
  });
}

function ExerciseCard(r, x){
  const ex = Store.getExerciseByRef(x.exerciseRef);
  const img = ex?.image ? `<img class="thumb" src="${ex.image}" alt="${escapeHtml(ex.name)}">` : `<div class="thumb" style="width:56px;height:56px;background:#0d0d10;border-radius:16px;border:1px solid var(--border);display:grid;place-items:center">🏋️</div>`;
  return `
  <article class="card">
    <div class="exercise-card">
      ${img}
      <div class="info">
        <h3>${escapeHtml(ex?.name || "Ejercicio")}</h3>
        <p>${ex?.bodyPart || "—"} • <span class="small">${ex?.equipment || ""}</span></p>
        <div class="small">
          <span class="tag"><span class="dot"></span>${ex?.primaryMuscles || ""}</span>
          ${ex?.secondaryMuscles ? `<span class="tag">${ex.secondaryMuscles}</span>`: ""}
        </div>
      </div>
    </div>
    <div class="sets">
      ${x.sets.map((s,idx)=>`
        <div class="set">
          <input id="reps-${s.id}" inputmode="numeric" pattern="[0-9]*" type="number" min="0" placeholder="Reps" value="${s.reps}">
          <input id="peso-${s.id}" inputmode="decimal" type="number" step="0.5" min="0" placeholder="Peso (kg)" value="${s.peso}">
          <button id="del-set-${s.id}" class="icon-btn" aria-label="Eliminar serie">🗑️</button>
        </div>
      `).join("")}
      <div class="row">
        <button id="add-set-${x.id}" class="btn">Añadir serie</button>
        <button id="del-ex-${x.id}" class="btn secondary">Quitar ejercicio</button>
      </div>
    </div>
  </article>
  `;
}

// --- Selector de ejercicios (modal) ---
function openExercisePicker(routineId){
  const groups = getBodyParts();
  const content = `
    <div class="row" style="gap:8px; margin-bottom:8px">
      <input id="search" class="input" placeholder="Buscar por nombre (p.ej. 'sentadilla', 'press banca')">
    </div>
    <div class="chips" id="chips">
      <span class="chip active" data-group="*">Todos</span>
      ${groups.map(g=>`<span class="chip" data-group="${escapeAttr(g)}">${escapeHtml(g)}</span>`).join("")}
    </div>

    <div class="toolbar">
      <div class="badge">Elige ejercicios de la biblioteca o crea los tuyos</div>
      <button id="new-ex" class="btn secondary">+ Crear ejercicio</button>
    </div>

    <div class="grid" id="ex-grid"></div>

    <div class="footer-note">Fuente de biblioteca: Lyfta (nombre, imagen y músculos). Puedes crear ejercicios personalizados.</div>
  `;

  showModal("Añadir ejercicios", content, ()=>{
    const state = { q:"", group:"*" };
    const search = document.getElementById("search");
    const chips = document.querySelectorAll("#chips .chip");
    const grid = document.getElementById("ex-grid");

    function renderGrid(){
      const list = [...Store.state.library, ...Store.state.customExercises]
        .filter(e => state.group==="*" ? true : (e.bodyPart || "").toLowerCase().includes(state.group.toLowerCase()))
        .filter(e => !state.q ? true : e.name.toLowerCase().includes(state.q));

      grid.innerHTML = list.map(e=>`
        <article class="card">
          <div class="exercise-card">
            ${e.image ? `<img class="thumb" src="${e.image}" alt="${escapeHtml(e.name)}">` : `<div class="thumb" style="width:56px;height:56px;background:#0d0d10;border-radius:16px;border:1px solid var(--border);display:grid;place-items:center">🏋️</div>`}
            <div class="info">
              <h3>${escapeHtml(e.name)}</h3>
              <p>${e.bodyPart || ""} • <span class="small">${e.equipment || ""}</span></p>
              <div class="small">${e.primaryMuscles || ""}${e.secondaryMuscles ? " • "+e.secondaryMuscles : ""}</div>
            </div>
            <div class="actions">
              <button class="btn" data-add="${e.id}" data-type="${Store.state.customExercises.some(c=>c.id===e.id) ? "custom":"seed"}">Añadir</button>
            </div>
          </div>
        </article>
      `).join("");
      grid.querySelectorAll("[data-add]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-add");
          const type = btn.getAttribute("data-type");
          Store.addExerciseToRoutine(routineId, { type, id });
          openRoutine(routineId);
          closeModal();
        });
      });
    }

    search.addEventListener("input", ()=>{ state.q = search.value.trim().toLowerCase(); renderGrid(); });
    chips.forEach(ch=> ch.addEventListener("click", ()=>{
      chips.forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      state.group = ch.getAttribute("data-group");
      renderGrid();
    }));

    document.getElementById("new-ex").addEventListener("click", ()=> openCreateExerciseForm(()=>{
      // tras crear, refrescar grid
      renderGrid();
    }));

    renderGrid();
  });
}

function openCreateExerciseForm(onSaved){
  showModal("Crear ejercicio", `
    <div class="grid">
      <div class="card">
        <label>Nombre</label>
        <input id="ex-name" class="input" placeholder="p.ej. Dominadas pronas">
      </div>
      <div class="card">
        <label>URL de imagen</label>
        <input id="ex-img" class="input" placeholder="https://...">
      </div>
      <div class="card">
        <label>Grupo muscular primario (Body Part)</label>
        <input id="ex-body" class="input" placeholder="p.ej. Espalda">
      </div>
      <div class="card">
        <label>Músculos primarios</label>
        <input id="ex-primary" class="input" placeholder="p.ej. Latissimus Dorsi">
      </div>
      <div class="card">
        <label>Músculos secundarios</label>
        <input id="ex-secondary" class="input" placeholder="p.ej. Biceps Brachii">
      </div>
      <div class="card">
        <label>Equipo</label>
        <input id="ex-eq" class="input" placeholder="p.ej. Barra, Mancuernas...">
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button id="save-custom-ex" class="btn">Guardar ejercicio</button>
      <button id="cancel-custom-ex" class="btn secondary">Cancelar</button>
    </div>
  `, ()=>{
    document.getElementById("save-custom-ex").addEventListener("click", ()=>{
      const payload = {
        name: document.getElementById("ex-name").value,
        image: document.getElementById("ex-img").value,
        bodyPart: document.getElementById("ex-body").value,
        primaryMuscles: document.getElementById("ex-primary").value,
        secondaryMuscles: document.getElementById("ex-secondary").value,
        equipment: document.getElementById("ex-eq").value,
      };
      if(!payload.name.trim()){
        document.getElementById("ex-name").focus(); return;
      }
      const ex = Store.addCustomExercise(payload);
      closeModal();
      if(typeof onSaved==="function") onSaved(ex);
    });
    document.getElementById("cancel-custom-ex").addEventListener("click", closeModal);
  });
}

// --- Utilidades de UI ---
function showModal(title, html, onMount){
  modalTitle.textContent = title;
  modalContent.innerHTML = html;
  modalRoot.classList.remove("hidden");
  modalRoot.setAttribute("aria-hidden","false");
  // cerrar
  function tryClose(ev){
    const t = ev.target;
    if(t.id==="modal-close" || t.dataset.close==="true") closeModal();
  }
  modalClose.addEventListener("click", tryClose, { once:true });
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", tryClose, { once:true });
  if(typeof onMount==="function") onMount();
}

function closeModal(){
  modalRoot.classList.add("hidden");
  modalRoot.setAttribute("aria-hidden","true");
}

function escapeHtml(str=""){
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str=""){ return str.replace(/"/g,"&quot;"); }

function getBodyParts(){
  const set = new Set([...Store.state.library, ...Store.state.customExercises].map(e=>e.bodyPart).filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

// --- Arranque ---
Store.load();
render();

// FAB: crear nueva rutina
FAB.addEventListener("click", openCreateRoutine);
