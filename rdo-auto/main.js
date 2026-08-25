// RDO Auto — Application Logic
// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = "https://fecskilrtsaeavoznwgi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VjwnlFeGz7zJkZx_KPxukA_GCTRxcgi";
const STORAGE_BUCKET = "fotos";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// AUTH
// ============================================================
let currentUser = null;
let currentProfile = null;
let isLoginMode = true;
let splashTimer = null;

$("#btnAuth").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value.trim();
  const name = $("#authName").value.trim();
  const errEl = $("#authError");
  errEl.style.display = "none";
  if (!email || !password) { errEl.textContent = "Preencha e-mail e senha."; errEl.style.display = "block"; return; }

  if (isLoginMode) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { errEl.textContent = "Email ou senha incorretos."; errEl.style.display = "block"; return; }
    currentUser = data.user;
  } else {
    if (!name) { errEl.textContent = "Preencha o nome completo."; errEl.style.display = "block"; return; }
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { errEl.textContent = error.message; errEl.style.display = "block"; return; }
    currentUser = data.user;
    if (currentUser) {
      await sb.from("profiles").upsert({ user_id: currentUser.id, name, role: "colaborador" });
    }
  }
  if (currentUser) await loadProfile();
});

$("#authToggle").addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  $("#authTitle").textContent = isLoginMode ? "Entrar" : "Cadastro";
  $("#btnAuth").textContent = isLoginMode ? "Entrar" : "Cadastrar";
  $("#authName").style.display = isLoginMode ? "none" : "block";
  $("#authToggleText").textContent = isLoginMode ? "Não tem conta?" : "Já tem conta?";
  $("#authToggle").textContent = isLoginMode ? "Cadastre-se" : "Entrar";
});

$("#btnLogout").addEventListener("click", async () => { doLogout(); });

function toggleUserMenu() {
  const menu = $("#userMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#userMenu") && e.target.id !== "headerUserName") {
    $("#userMenu").style.display = "none";
  }
});

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  showView("authView");
  $("#userMenu").style.display = "none";
}

function goToAdmin() {
  window.location.href = "admin.html";
}

async function loadProfile() {
  const { data } = await sb.from("profiles").select("*").eq("user_id", currentUser.id).maybeSingle();
  currentProfile = data;
  if (!data) {
    // Auto-create profile for existing auth users
    await sb.from("profiles").upsert({ user_id: currentUser.id, name: currentUser.email, role: "colaborador" });
    currentProfile = { role: "colaborador" };
  }
  // Update header user info
  $("#headerUserName").textContent = currentProfile.name || currentUser.email;
  $("#userMenuPhone").textContent = currentUser.email;
  const isPrivileged = currentProfile.role === "admin" || currentProfile.role === "supervisor";
  $("#btnAdmin").style.display = isPrivileged ? "block" : "none";
  showView("splashView");
  splashTimer = setTimeout(() => {
    showView("homeView");
    loadProjects();
  }, 2500);
}

// Check existing session
(async function initAuth() {
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    currentUser = data.session.user;
    await loadProfile();
  }
})();

// ============================================================
// VIEW NAVIGATION
// ============================================================
let currentProjectId = null;
let currentProjectName = "";

function showView(viewId) {
  $$(".view").forEach(v => v.classList.remove("active"));
  const target = $("#" + viewId);
  if (target) target.classList.add("active");

  // Header: show only after splash
  const header = $("#mainHeader");
  if (viewId === "splashView" || viewId === "authView") {
    header.style.display = "none";
  } else {
    header.style.display = "flex";
  }

  // Show/hide form tabs (only when formView active, striplog tab conditional)
  const formTabs = $("#formTabs");
  if (viewId === "formView") {
    formTabs.style.display = "flex";
    $("#stickyFooter").style.display = "block";
  } else {
    formTabs.style.display = "none";
    $("#stickyFooter").style.display = "none";
  }

  // Back button visibility
  const btnBack = $("#btnBack");
  if (viewId === "homeView") {
    btnBack.style.visibility = "hidden";
  } else {
    btnBack.style.visibility = "visible";
  }
}

// ============================================================
// SPLASH
// ============================================================
$("#splashView").addEventListener("click", () => {
  clearTimeout(splashTimer);
  showView("homeView");
  loadProjects();
});
// Auto-dismiss after 2.5s
splashTimer = setTimeout(() => {
  if ($("#splashView").classList.contains("active")) {
    showView("homeView");
    loadProjects();
  }
}, 2500);

// ============================================================
// BACK BUTTON
// ============================================================
$("#btnBack").addEventListener("click", () => {
  const formActive = $("#formView").classList.contains("active");
  const roActive = $("#readonlyView").classList.contains("active");
  if (formActive || roActive) {
    showView("homeView");
    loadRDOs();
  }
});

$("#btnBackFromRO").addEventListener("click", () => {
  showView("homeView");
  loadRDOs();
});

// ============================================================
// DATE REQUIRED — show form body only when date is set
// ============================================================
$("#rdoDate").addEventListener("input", () => {
  const hasDate = !!$("#rdoDate").value;
  $("#formBody").style.display = hasDate ? "block" : "none";
});
$("#rdoDate").addEventListener("change", async () => {
  const hasDate = !!$("#rdoDate").value;
  $("#formBody").style.display = hasDate ? "block" : "none";
  if (hasDate) { await loadLastRDO(); await loadLastStratigraphy(); }
});

// ============================================================
// AUTO-SAVE DRAFT (localStorage every 2 min)
// ============================================================
let draftTimer = null;
let lastDraftTime = null;
const DRAFT_KEY = "rdo_autosave_draft";

function saveLocalDraft() {
  if (!currentProjectId) return;
  const payload = buildPayload("rascunho");
  payload._projectId = currentProjectId;
  payload._savedAt = Date.now();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  lastDraftTime = Date.now();
  // Supabase auto-save disabled (roadmap item)
  // Visual feedback
  const ind = $("#autoSaveIndicator");
  if (ind) {
    ind.textContent = "Rascunho salvo (local)";
    ind.style.opacity = "1";
    clearTimeout(ind._timeout);
    ind._timeout = setTimeout(() => { ind.style.opacity = "0"; }, 2000);
  }
}

function startAutoDraft() {
  // Auto-draft disabled — saves only via localStorage for recovery
  stopAutoDraft();
  lastDraftTime = null;
  // draftTimer = setInterval(saveLocalDraft, 120000); // disabled
}

function stopAutoDraft() {
  if (draftTimer) { clearInterval(draftTimer); draftTimer = null; }
  localStorage.removeItem(DRAFT_KEY);
  lastDraftTime = null;
}

window.addEventListener("beforeunload", (e) => {
  if (!$("#formView").classList.contains("active")) return;
  const secs = lastDraftTime ? Math.floor((Date.now() - lastDraftTime) / 1000) : 120;
  e.preventDefault();
  e.returnValue = "";
  return "";
});

// Check for saved draft on page load (DISABLED — re-enable by setting to true)
const DRAFT_RESTORE_ENABLED = false;
if (!DRAFT_RESTORE_ENABLED) { localStorage.removeItem(DRAFT_KEY); }
(function() {
  if (!DRAFT_RESTORE_ENABLED) return;
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);
    if (draft._projectId && draft._savedAt) {
      const secs = Math.floor((Date.now() - draft._savedAt) / 1000);
      const mins = Math.floor(secs / 60);
      if (confirm(`Há um rascunho não salvo de ${mins > 0 ? mins + ' min' : secs + ' seg'} atrás. Deseja restaurá-lo?`)) {
        clearTimeout(splashTimer); // cancel auto-dismiss
        currentProjectId = draft._projectId;
        delete draft._projectId; delete draft._savedAt;
        // Load project and open draft
        clearTimeout(splashTimer);
        setTimeout(async () => {
          if ($("#splashView").classList.contains("active")) {
            showView("homeView");
          }
          await loadProjects();
          const sel = $("#projectSelect");
          sel.value = currentProjectId;
          currentProjectName = sel.selectedOptions[0]?.text || "";
          $("#headerProjectName").textContent = currentProjectName;
          showView("formView");
          $("#rdoDate").value = draft.data || "";
          $("#formBody").style.display = draft.data ? "block" : "none";
          populateDraftFromPayload(draft);
          startAutoDraft();
          renderPhotoPreview();
        }, 500);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  } catch(_) { localStorage.removeItem(DRAFT_KEY); }
})();

function populateDraftFromPayload(payload) {
  if (payload.striplog && payload.striplog.length > 0) { setToggle("#toggleDrilling", true); }
  if (payload.estratigrafia_mudou && payload.estratigrafia_mudancas) { setToggle("#toggleStratigraphy", true); clearTable("#stratTable"); payload.estratigrafia_mudancas.forEach(s => addStratRow(s.profundidade, s.descricao)); }
  if (payload.revestimento_mudou) { setToggle("#toggleCasing", true); $("#casingMeters").value = payload.revestimento_metros || ""; $("#casingObs").value = payload.revestimento_obs || ""; }
  if (payload.parametros_anomalias && payload.parametros_anomalias.length > 0) {
    setToggle("#toggleAnomaly", true);
    payload.parametros_anomalias.forEach(a => addAnomalyRow(a.parametro, a.descricao));
  }
  if (payload.hseDds) $("#hseDds").checked = true;
  if (payload.hseEpi) $("#hseEpi").checked = true;
  if (payload.hseManHours) $("#hseManHours").value = payload.hseManHours;
  if (payload.hseIncidents) $("#hseIncidents").value = payload.hseIncidents;
  if (payload.hseNearMiss) $("#hseNearMiss").value = payload.hseNearMiss;

  if (payload.obsGeneral) $("#obsGeneral").value = payload.obsGeneral;
  if (payload.planNextShift) $("#planNextShift").value = payload.planNextShift;
  if (payload.turnoHoras) $("#shiftHours").value = payload.turnoHoras;
}

// ============================================================
// FORM TABS (section switching within form)
// ============================================================
$$(".form-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".form-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".formTabContent").forEach(s => s.classList.remove("active"));
    const targetId = tab.dataset.tab;
    const target = document.getElementById(targetId);
    if (target) target.classList.add("active");
    // Show Identificação card only on Equipe tab
    const identCard = document.getElementById("tabIdentificacao");
    if (identCard) {
      identCard.classList.toggle("active", targetId === "tabEquipe");
    }
  });
});

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg, type) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + type + " show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 3500);
}

// ============================================================
// PROJECT MANAGEMENT
// ============================================================
async function loadProjects() {
  const { data, error } = await sb.from("projetos").select("*").order("created_at", { ascending: false });
  const sel = $("#projectSelect");
  if (error || !data || data.length === 0) {
    sel.innerHTML = '<option value="">Nenhum projeto disponivel.</option>';
    return;
  }
  sel.innerHTML = '<option value="">Selecionar projeto...</option>' +
    data.map(p => `<option value="${p.id}">${p.cliente} — ${p.localidade} (${p.sonda})</option>`).join("");
  const savedId = localStorage.getItem("rdo_selected_project");
  if (savedId && data.find(p => p.id === savedId)) {
    sel.value = savedId;
    sel.dispatchEvent(new Event("change"));
  }
}

$("#projectSelect").addEventListener("change", () => {
  const id = $("#projectSelect").value;
  if (!id) return;
  currentProjectId = id;
  currentProjectName = $("#projectSelect").selectedOptions[0]?.text || "";
  localStorage.setItem("rdo_selected_project", id);
  $("#headerProjectName").textContent = currentProjectName;
  $("#rdosList").style.display = "block";
  $("#homeFooter").style.display = "block";
  loadRDOs();
});

// ============================================================
// NEW PROJECT MODAL (admin-only, element may not exist in field app)
// ============================================================
const btnNewProj = $("#btnNewProject");
if (btnNewProj) {
  btnNewProj.addEventListener("click", () => {
    $("#modalNewProject").classList.add("show");
    $("#newStartDate").value = new Date().toISOString().split("T")[0];
  });
}
const btnModalCancel = $("#btnModalCancel");
if (btnModalCancel) btnModalCancel.addEventListener("click", () => $("#modalNewProject").classList.remove("show"));
const modalNewProj = $("#modalNewProject");
if (modalNewProj) modalNewProj.addEventListener("click", (e) => {
  if (e.target === modalNewProj) modalNewProj.classList.remove("show");
});

const btnModalSave = $("#btnModalSave");
if (btnModalSave) btnModalSave.addEventListener("click", async () => {
  const cliente = $("#newClientName").value.trim();
  const localidade = $("#newLocation").value.trim();
  const sonda = $("#newRig").value.trim();
  const dataInicio = $("#newStartDate").value;
  const turno = $("#newShift").value.trim() || "07h x 17h";
  if (!cliente || !localidade || !sonda || !dataInicio) {
    showToast("Preencha todos os campos.", "error"); return;
  }
  const bms = $("#btnModalSave"); if (bms) bms.disabled = true;
  const { data, error } = await sb.from("projetos").insert({ cliente, localidade, sonda, data_inicio: dataInicio, turno }).select().single();
  if (bms) bms.disabled = false;
  if (error) { showToast("Erro: " + error.message, "error"); return; }
  showToast("Projeto criado!", "success");
  $("#modalNewProject").classList.remove("show");
  ["#newClientName","#newLocation","#newRig"].forEach(id => $(id).value = "");
  await loadProjects();
  $("#projectSelect").value = data.id;
  currentProjectId = data.id;
  currentProjectName = `${data.cliente} — ${data.localidade} (${data.sonda})`;
  localStorage.setItem("rdo_selected_project", data.id);
  $("#headerProjectName").textContent = currentProjectName;
  showView("homeView");
  $("#rdosList").style.display = "block";
  $("#homeFooter").style.display = "block";
  loadRDOs();
});

// ============================================================
// RDO LIST
// ============================================================
async function loadRDOs() {
  const container = $("#rdosList");
  container.style.display = "block";
  $("#homeFooter").style.display = "block";
  container.innerHTML = '<div style="text-align:center;padding:1rem;color:#9ca3af;">Carregando...</div>';

  const { data, error } = await sb.from("rdos")
    .select("id,data,tipo_dia,profundidade_inicial,profundidade_final,formacao,status,version")
    .eq("deleted", false)
    .eq("latest", true)
    .eq("projeto_id", currentProjectId)
    .order("data", { ascending: false })
    .limit(50);

  if (error) {
    container.innerHTML = `<div class="empty-state"><div class="icon">!</div><p>Erro ao carregar: ${error.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Nenhum RDO neste projeto ainda.</p><p style="font-size:.75rem;">Toque em "+ Novo RDO" para começar.</p></div>`;
    return;
  }

  container.innerHTML = data.map(r => {
    const badgeClass = 'badge-' + r.status;
    const statusLabels = { rascunho: "Rascunho", em_revisao: "Em Revisão", aprovado: "Aprovado" };
    const badgeText = statusLabels[r.status] || r.status;
    const depthInfo = r.profundidade_final != null
      ? `${r.profundidade_inicial || 0} → ${r.profundidade_final} m`
      : 'Sem perfuração';
    return `
      <div class="rdo-card" data-id="${r.id}" data-status="${r.status}">
        <div class="rdo-info">
          <div class="rdo-date">${r.data} — ${r.tipo_dia || 'N/D'}${r.version > 1 ? ` <span style="font-size:.7rem;color:#a04000;">v${r.version}</span>` : ''}</div>
          <div class="rdo-meta">${depthInfo}${r.formacao ? ' | ' + r.formacao : ''}</div>
        </div>
        <div class="rdo-badge ${badgeClass}">${badgeText}</div>
      </div>`;
  }).join("");

  // Click handlers
  $$(".rdo-card").forEach(card => {
    card.addEventListener("click", async () => {
      const id = card.dataset.id;
      const status = card.dataset.status;
      const { data } = await sb.from("rdos").select("*").eq("id", id).single();
      let authorName = "-";
      if (data && data.user_id) {
        const { data: profile } = await sb.from("profiles").select("name").eq("user_id", data.user_id).maybeSingle();
        if (profile) authorName = profile.name;
      }
      if (!data) return;
      const role = currentProfile?.role || "colaborador";
      // Status-based access:
      // rascunho: anyone can edit
      // em_revisao: colaborador = read-only, supervisor/admin = edit
      // aprovado: always read-only (versioned edit via admin panel)
      if (status === "rascunho") {
        openDraft(data);
      } else if (status === "em_revisao" && (role === "supervisor" || role === "admin")) {
        openDraft(data);
      } else {
        await viewRDO(data);
      }
    });
  });
}

// ============================================================
// NEW RDO
// ============================================================
let lastRDO = null;

async function loadLastRDO() {
  lastRDO = null;
  if (!currentProjectId) { updatePrefillVisibility(); return; }
  const rdoDate = $("#rdoDate").value; // use the form date, not today
  if (!rdoDate) { updatePrefillVisibility(); return; }
  const refDate = new Date(rdoDate + "T00:00:00");
  const prevDate = new Date(refDate);
  prevDate.setDate(refDate.getDate() - 1);
  const refStr = refDate.toISOString().split("T")[0];
  const prevStr = prevDate.toISOString().split("T")[0];

  try {
    // Search same day (other shift) OR previous day — most recent first
    let { data } = await sb.from("rdos")
      .select("*")
      .eq("deleted", false)
      .eq("projeto_id", currentProjectId)
      .in("data", [refStr, prevStr])
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      lastRDO = data[0];
      if (lastRDO.status === "rascunho") {
        showToast(`Atenção: o RDO de ${lastRDO.data} não foi enviado. Use os dados mesmo assim ou finalizá-lo.`, "error");
      }
    } else {
      // Fallback: long stoppage — find most recent RDO ever for this project
        const { data: fallback } = await sb.from("rdos")
        .select("data")
        .eq("deleted", false)
        .eq("projeto_id", currentProjectId)
        .order("data", { ascending: false })
        .limit(1);
      if (fallback && fallback.length > 0) {
        const lastDate = fallback[0].data;
        const { data: full } = await sb.from("rdos")
          .select("*")
          .eq("projeto_id", currentProjectId)
          .eq("data", lastDate)
          .order("created_at", { ascending: false })
          .limit(1);
        lastRDO = (full && full.length > 0) ? full[0] : null;
      }
    }
  } catch (e) {
    console.warn("Could not fetch last RDO:", e.message);
    lastRDO = null;
  }
  updatePrefillVisibility();
}

function updatePrefillVisibility() {
  $$(".prefill-link").forEach(link => {
    link.style.display = lastRDO ? "inline" : "none";
  });
}

async function loadLastStratigraphy() {
  if (!currentProjectId) return;
  const { data } = await sb.from("rdos")
    .select("estratigrafia_descricao, data")
    .eq("projeto_id", currentProjectId)
    .eq("estratigrafia_mudou", true)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();
  const el = $("#lastStratigraphy");
  if (data && data.estratigrafia_descricao) {
    el.textContent = `Última descrição (${data.data}): "${data.estratigrafia_descricao}"`;
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

$("#btnNewRDO").addEventListener("click", async () => {
  $("#rdoId").value = "";
  resetForm();
  showView("formView");
  // Hide form body until date is set
  $("#formBody").style.display = "none";
  startAutoDraft();
  renderPhotoPreview();
});

// ============================================================
// PRE-FILL SECTION HANDLERS
// ============================================================
function confirmStalePrefill() {
  if (!lastRDO) return true;
  const rdoDate = $("#rdoDate").value;
  if (!rdoDate) return true;
  const refDate = new Date(rdoDate + "T00:00:00");
  const lastDate = new Date(lastRDO.data + "T00:00:00");
  const daysAgo = Math.floor((refDate - lastDate) / 86400000);
  if (daysAgo <= 1) return true; // yesterday or same day — no warning needed
  return confirm(
    `O RDO mais recente é do dia ${lastRDO.data.split("-").reverse().join("/")} ` +
    `(${daysAgo} dias atrás). Os dados podem estar desatualizados. Deseja pre-preencher mesmo assim?`
  );
}

$$(".prefill-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!lastRDO) return;
    if (!confirmStalePrefill()) return;
    const section = link.dataset.section;
    if (section === "perfuracao") prefillDrilling();
    else if (section === "fluido") prefillFluid();
    else if (section === "equipe") prefillTeam();
    else if (section === "aprovacao") prefillApproval();
    const note = document.querySelector(`.prefill-note[data-section="${section}"]`);
    if (note) note.classList.add("show");
  });
});

function markInherited(inputs) {
  inputs.forEach(el => {
    el.classList.add("inherited");
    // Remove inherited on edit
    const handler = () => { el.classList.remove("inherited"); el.removeEventListener("input", handler); el.removeEventListener("change", handler); };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
}

function prefillDrilling() {
  const y = lastRDO;
  if (!y || y.profundidade_final == null) return;
  setToggle("#toggleDrilling", true);
  // Copy broca to ATUAL (assume same broca unless user says otherwise)
  if (y.brocas) {
    const b = y.brocas;
    if (b.atual) {
      $("#bitBrandCurrent").value = b.atual.fabricante || ""; $("#bitSerialCurrent").value = b.atual.serie || "";
      $("#bitDiameterCurrent").value = b.atual.diametro || ""; $("#bitModelCurrent").value = b.atual.modelo || "";
      $("#bitJetsCurrent").value = b.atual.jatos || ""; $("#bitDrilledCurrent").value = b.atual.perfurado || "";
      $("#bitHoursCurrent").value = b.atual.oper_hs || ""; $("#bitRopCurrent").value = b.atual.rop || "";
      markInherited(["#bitBrandCurrent","#bitSerialCurrent","#bitDiameterCurrent","#bitModelCurrent","#bitJetsCurrent","#bitDrilledCurrent","#bitHoursCurrent","#bitRopCurrent"].map(id => $(id)));
    }
    // Also fill anterior if yesterday had one (so swap works correctly)
    if (b.anterior && Object.values(b.anterior).some(v => v !== null && v !== "")) {
      $("#bitBrandPrev").value = b.anterior.fabricante || ""; $("#bitSerialPrev").value = b.anterior.serie || "";
      $("#bitDiameterPrev").value = b.anterior.diametro || ""; $("#bitModelPrev").value = b.anterior.modelo || "";
      $("#bitJetsPrev").value = b.anterior.jatos || "";
    }
  }
  $("#bitChanged").checked = false;
  // Copy coluna
  if (y.coluna && y.coluna.length > 0) {
    clearTable("#bhaTable");
    y.coluna.forEach(item => {
      addBHARow(item.item, item.qty, item.id_pol, item.od_pol, item.length_m, item.total_m);
    });
    $$("#bhaTable input").forEach(el => markInherited([el]));
  }
}

function onBitToggle() {
  if ($("#bitChanged").checked) {
    // Move atual → anterior, clear atual
    const fields = ["Fab","Serie","Diam","Mod","Jatos","Perf","Hs","Rop"];
    fields.forEach(f => {
      const antEl = $(`#broca${f}Ant`);
      const atuEl = $(`#broca${f}Atual`);
      antEl.value = atuEl.value;
      antEl.classList.remove("inherited");
      atuEl.value = "";
      atuEl.classList.remove("inherited");
    });
    // Clear inherited markers on anterior since it's now manually set
    fields.forEach(f => $(`#broca${f}Ant`).classList.remove("inherited"));
  } else {
    // Reverted: move anterior → atual, clear anterior
    const fields = ["Fab","Serie","Diam","Mod","Jatos","Perf","Hs","Rop"];
    fields.forEach(f => {
      const atuEl = $(`#broca${f}Atual`);
      const antEl = $(`#broca${f}Ant`);
      atuEl.value = antEl.value;
      antEl.value = "";
    });
  }
}

function prefillFluid() {
  const y = lastRDO;
  if (!y) return;
  setToggle("#toggleFluid", true);
  if (y.fluido) {
    const f = y.fluido;
    $("#fluidDensity").value = f.densidade || ""; $("#fluidViscosity").value = f.viscosidade || "";
    $("#fluidFiltrate").value = f.filtrado || ""; $("#fluidPh").value = f.ph || "";
    $("#fluidFreeWater").value = f.agua_livre || ""; $("#fluidSand").value = f.areia || "";
    $("#fluidApiCake").value = f.api_cake || ""; $("#fluidSolids").value = f.solidos || "";
    markInherited(["#fluidDensity","#fluidViscosity","#fluidFiltrate","#fluidPh","#fluidFreeWater","#fluidSand","#fluidApiCake","#fluidSolids"].map(id => $(id)));
  }
  if (y.insumos) {
    const i = y.insumos;
    $("#supplyWater").value = i.agua || ""; $("#supplySeptic").value = i.limpa_fossa || "";
    $("#supplyBathroom").value = i.limpeza_banheiro || ""; $("#supplyPta").value = i.pta || "";
    $("#supplyMunck").value = i.munck || ""; $("#supplyCrane").value = i.guindaste || "";
    $("#supplyDebrisRemoval").value = i.remocao_cacamba || "";
    markInherited(["#supplyWater","#supplySeptic","#supplyBathroom","#supplyPta","#supplyMunck","#supplyCrane","#supplyDebrisRemoval"].map(id => $(id)));
  }
  if (y.quimicos) {
    if (Array.isArray(y.quimicos)) {
      y.quimicos.forEach(c => {
        const rows = $("#chemTable").rows;
        for (let i = 1; i < rows.length; i++) {
          const sel = rows[i].querySelector(".chemName");
          const name = sel?.value === "Outro" ? (rows[i].querySelector(".chemNameCustom")?.value||"") : (sel?.value||"");
          if (name === c.name) {
            const estEl = rows[i].querySelector(".chemEst");
            if (estEl && c.estoque != null && !estEl.disabled) { estEl.value = c.estoque; markInherited([estEl]); }
            return;
          }
        }
      });
    }
  }
  if (Array.isArray(y.outros_materiais)) {
      y.outros_materiais.forEach(m => {
        const rows = $("#matTable").rows;
        for (let i = 1; i < rows.length; i++) {
          const sel = rows[i].querySelector(".matName");
          const name = sel?.value === "Outro" ? (rows[i].querySelector(".matNameCustom")?.value||"") : (sel?.value||"");
          if (name === m.name) {
            const estEl = rows[i].querySelector(".matEst");
            if (estEl && m.estoque != null && !estEl.disabled) { estEl.value = m.estoque; markInherited([estEl]); }
            return;
          }
        }
      });
  }
}

function prefillTeam() {
  if (!lastRDO || !lastRDO.equipe || lastRDO.equipe.length === 0) return;
  clearTable("#teamTable");
  lastRDO.equipe.forEach(e => addTeamMemberRow(e.funcao, e.nome));
  $$("#teamTable input").forEach(el => markInherited([el]));
}

function prefillApproval() {
  if (!lastRDO) return;
}

// ============================================================
// OPEN DRAFT (edit mode)
// ============================================================
function openDraft(rdo) {
  resetForm();
  $("#rdoId").value = rdo.id;
  populateForm(rdo);
  $("#formBody").style.display = "block";
  startAutoDraft();
  renderPhotoPreview();
  showView("formView");
}

// ============================================================
// VIEW RDO (read-only)
// ============================================================
async function viewRDO(rdo) {
  let authorName = "-";
  if (rdo.user_id) {
    const { data: profile } = await sb.from("profiles").select("name").eq("user_id", rdo.user_id).maybeSingle();
    if (profile) authorName = profile.name;
  }
  const c = $("#readonlyContent");
  const yn = v => v ? '<span style="color:#10b981;">Sim</span>' : '<span style="color:#6b7280;">Não</span>';
  const empty = msg => `<span style="color:#9ca3af;font-size:.82rem;">${msg}</span>`;

  function section(title, body) { return `<div class="ro-section"><h3>${title}</h3>${body}</div>`; }
  function row(label, value) { return `<div class="ro-row"><span class="ro-label">${label}</span><span class="ro-value">${value}</span></div>`; }

  // Stratigraphy
  const stratEntries = rdo.estratigrafia_mudancas || (rdo.estratigrafia_descricao ? [{ profundidade: rdo.estratigrafia_profundidade, descricao: rdo.estratigrafia_descricao }] : []);

  // Striplog
  let striplogHTML = empty("Nenhum registro de striplog.");
  if (rdo.striplog && rdo.striplog.length > 0) {
    striplogHTML = `<table class="ops-table"><tr><th>Prof. (m)</th><th>Inicio</th><th>Termino</th><th>Obs</th></tr>
      ${rdo.striplog.map(s => `<tr><td>${s.profundidade||'-'}</td><td>${s.inicio||s.horario||'-'}</td><td>${s.termino||'-'}</td><td>${s.obs||''}</td></tr>`).join('')}</table>`;
  }

  // Brocas
  let brocaHTML = empty("Nenhum dado de broca preenchido.");
  if (rdo.brocas) {
    const b = rdo.brocas;
    let parts = [];
    if (b.atual && Object.values(b.atual).some(v => v)) {
      parts.push(`<div style="font-size:.78rem;font-weight:600;margin-top:.3rem;">Atual</div><table class="ops-table"><tr><th>Fab.</th><th>Serie</th><th>O</th><th>IADC</th><th>Jatos</th><th>Perf.(m)</th><th>Op.(h)</th><th>ROP</th></tr>
        <tr><td>${b.atual.fabricante||'-'}</td><td>${b.atual.serie||'-'}</td><td>${b.atual.diametro||'-'}</td><td>${b.atual.modelo||'-'}</td><td>${b.atual.jatos||'-'}</td><td>${b.atual.perfurado||'-'}</td><td>${b.atual.oper_hs||'-'}</td><td>${b.atual.rop||'-'}</td></tr></table>`);
    }
    if (b.anterior && Object.values(b.anterior).some(v => v)) {
      parts.push(`<div style="font-size:.78rem;font-weight:600;margin-top:.3rem;">Anterior</div><table class="ops-table"><tr><th>Fab.</th><th>Serie</th><th>O</th><th>IADC</th><th>Jatos</th></tr>
        <tr><td>${b.anterior.fabricante||'-'}</td><td>${b.anterior.serie||'-'}</td><td>${b.anterior.diametro||'-'}</td><td>${b.anterior.modelo||'-'}</td><td>${b.anterior.jatos||'-'}</td></tr></table>`);
    }
    if (parts.length > 0) brocaHTML = parts.join("");
  }

  // BHA
  let bhaHTML = empty("Nenhum item de coluna registrado.");
  if (rdo.coluna && rdo.coluna.length > 0) {
    bhaHTML = `<table class="ops-table"><tr><th>Item</th><th>Qty</th><th>ID</th><th>OD</th><th>L(m)</th><th>Tot(m)</th></tr>
      ${rdo.coluna.map(i => `<tr><td>${i.item||'-'}</td><td>${i.qty||'-'}</td><td>${i.id_pol||'-'}</td><td>${i.od_pol||'-'}</td><td>${i.length_m||'-'}</td><td>${i.total_m||'-'}</td></tr>`).join('')}</table>`;
  }

  // Anomalias
  let anomaliaHTML = empty("Nenhuma anomalia registrada.");
  if (rdo.parametros_anomalias && rdo.parametros_anomalias.length > 0) {
    anomaliaHTML = rdo.parametros_anomalias.map(a => row(a.parametro||'-', a.descricao||'')).join('');
  }

  // Revestimento
  let revestHTML = row("Houve descida?", yn(rdo.revestimento_mudou));
  if (rdo.revestimento_mudou) {
    revestHTML += row("Metros", (rdo.revestimento_metros||'-') + " m");
    if (rdo.revestimento_obs) revestHTML += row("Observacao", rdo.revestimento_obs);
  } else {
    revestHTML += `<div style="font-size:.82rem;color:#9ca3af;margin-top:.2rem;">Não houve descida de revestimento neste dia.</div>`;
  }

  // Pré-filtro
  let preFiltroHTML = row("Houve descida?", yn(rdo.pre_filtro_mudou));
  if (rdo.pre_filtro_mudou && rdo.pre_filtro) {
    const pf = rdo.pre_filtro;
    if (pf.bags != null) preFiltroHTML += row("Bags (aumento de pressão)", pf.bags);
    if (pf.obs) preFiltroHTML += row("Observação", pf.obs);
  } else {
    preFiltroHTML += `<div style="font-size:.82rem;color:#9ca3af;margin-top:.2rem;">Não houve descida de pré-filtro neste dia.</div>`;
  }

  // Limpeza e desenvolvimento
  let desenvHTML = row("Houve limpeza?", yn(rdo.desenvolvimento_mudou));
  if (rdo.desenvolvimento_mudou && rdo.desenvolvimento) {
    const d = rdo.desenvolvimento;
    if (d.metodo === "bomba") {
      desenvHTML += row("Método", "Bomba");
      if (d.nome_bomba) desenvHTML += row("Bomba", d.nome_bomba);
      if (d.potencia) desenvHTML += row("Potência", d.potencia);
      if (d.voltagem) desenvHTML += row("Voltagem", d.voltagem);
      if (d.horas_trabalhadas != null) desenvHTML += row("Horas trabalhadas", d.horas_trabalhadas + " h");
      if (d.abertura_valvula) desenvHTML += row("Abertura da válvula", d.abertura_valvula === "total" ? "Total" : "Parcial");
      if (d.profundidade_instalacao != null) desenvHTML += row("Profundidade de instalação", d.profundidade_instalacao + " m");
      if (d.obs) desenvHTML += row("Observação", d.obs);
    } else {
      if (d.modelo) desenvHTML += row("Compressor", d.modelo);
      if (d.pressao_max != null) desenvHTML += row("Pressão máx.", d.pressao_max);
      if (d.horimetro_inicio != null) desenvHTML += row("Horímetro início", d.horimetro_inicio + " h");
      if (d.horimetro_fim != null) desenvHTML += row("Horímetro fim", d.horimetro_fim + " h");
      if (d.uso && d.uso.length > 0) {
        desenvHTML += `<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">Uso do compressor</div><table class="ops-table"><tr><th>Hora</th><th>Prof. arr. (m)</th><th>P. arr.</th><th>P. trab.</th></tr>
          ${d.uso.map(u => `<tr><td>${u.hora||'-'}</td><td>${u.prof_arranque != null ? u.prof_arranque : '-'}</td><td>${u.pressao_arranque != null ? u.pressao_arranque : '-'}</td><td>${u.pressao_trabalho != null ? u.pressao_trabalho : '-'}</td></tr>`).join('')}</table></div>`;
      }
    }
  } else {
    desenvHTML += `<div style="font-size:.82rem;color:#9ca3af;margin-top:.2rem;">Não houve limpeza e desenvolvimento neste dia.</div>`;
  }

  // Jateamento
  let jateamentoHTML = row("Houve jateamento?", yn(rdo.jateamento_mudou));
  if (rdo.jateamento_mudou && rdo.jateamento && rdo.jateamento.length > 0) {
    jateamentoHTML += `<table class="ops-table" style="margin-top:.3rem;"><tr><th>Início</th><th>Término</th><th>Seção ini. (m)</th><th>Seção fim (m)</th><th>Obs</th></tr>
      ${rdo.jateamento.map(j => `<tr><td>${j.inicio||'-'}</td><td>${j.termino||'-'}</td><td>${j.secao_inicio != null ? j.secao_inicio : '-'}</td><td>${j.secao_fim != null ? j.secao_fim : '-'}</td><td>${j.obs||''}</td></tr>`).join('')}</table>`;
  } else {
    jateamentoHTML += `<div style="font-size:.82rem;color:#9ca3af;margin-top:.2rem;">Não houve jateamento neste dia.</div>`;
  }

  // Fluido
  let fluidoHTML = empty("Nenhum parametro de fluido preenchido.");
  if (rdo.fluido) {
    const entries = Object.entries(rdo.fluido).filter(([k,v]) => v != null);
    if (entries.length > 0) fluidoHTML = entries.map(([k,v]) => row(k, v)).join('');
  }

  // Quimicos — filter rows with actual data (qtd or legacy consumo)
  let quimicosHTML = empty("Nenhum produto quimico utilizado.");
  if (rdo.quimicos && rdo.quimicos.length > 0) {
    const filled = rdo.quimicos.filter(q => (q.qtd != null && q.qtd !== "") || (q.consumo != null && q.consumo !== ""));
    if (filled.length > 0) {
      quimicosHTML = `<table class="ops-table"><tr><th>Produto</th><th>Tipo</th><th>Qtd</th></tr>
        ${filled.map(q => {
          const qtd = q.qtd ?? q.consumo;
          const tipo = q.tipo || "consumo";
          return `<tr><td>${q.name||'-'}</td><td>${tipo === 'reabastecimento' ? 'Reabastecimento' : 'Consumo'}</td><td>${qtd != null ? qtd : '-'}</td></tr>`;
        }).join('')}</table>`;
    }
  }

  // Combustivel
  let fuelHTML = empty("Nenhum consumo de combustivel registrado.");
  if (rdo.combustivel && rdo.combustivel.consumos && rdo.combustivel.consumos.length > 0) {
    fuelHTML = `<table class="ops-table"><tr><th>Equip.</th><th>Tipo</th><th>Litros</th></tr>
      ${rdo.combustivel.consumos.map(f => `<tr><td>${f.equipamento||'-'}</td><td>${f.tipo||'-'}</td><td>${f.litros||'-'}</td></tr>`).join('')}</table>`;
    const s10 = rdo.combustivel.consumos.filter(c => c.tipo === 'S10').reduce((s,c) => s + (c.litros||0), 0);
    const s500 = rdo.combustivel.consumos.filter(c => c.tipo === 'S500').reduce((s,c) => s + (c.litros||0), 0);
    fuelHTML += `<div style="font-size:.78rem;">S10: ${s10.toFixed(1)} L | S500: ${s500.toFixed(1)} L</div>`;
  }
  // Stock always shown, defaults to 0 in red if never filled
  const s10stock = rdo.combustivel?.estoque_s10;
  const s500stock = rdo.combustivel?.estoque_s500;
  fuelHTML += `<div style="font-size:.78rem;margin-top:.2rem;">Estoque: S10 ${s10stock != null ? s10stock + ' L' : '<span style="color:#ef4444;">0 L</span>'} | S500 ${s500stock != null ? s500stock + ' L' : '<span style="color:#ef4444;">0 L</span>'}</div>`;

  // Materiais — filter rows with actual data (qtd or legacy consumo)
  let matHTML = empty("Nenhum material adicional utilizado.");
  if (rdo.outros_materiais && rdo.outros_materiais.length > 0) {
    const filled = rdo.outros_materiais.filter(m => (m.qtd != null && m.qtd !== "") || (m.consumo != null && m.consumo !== ""));
    if (filled.length > 0) {
      matHTML = `<table class="ops-table"><tr><th>Item</th><th>Tipo</th><th>Qtd</th></tr>
        ${filled.map(m => {
          const qtd = m.qtd ?? m.consumo;
          const tipo = m.tipo || "consumo";
          return `<tr><td>${m.name||'-'}</td><td>${tipo === 'reabastecimento' ? 'Reabastecimento' : 'Consumo'}</td><td>${qtd != null ? qtd : '-'}</td></tr>`;
        }).join('')}</table>`;
    }
  }

  // Operacoes
  let opsHTML = empty("Nenhuma operacao registrada.");
  if (rdo.operacoes && rdo.operacoes.length > 0) {
    opsHTML = `<table class="ops-table"><tr><th>Inicio</th><th>Termino</th><th>Tipo</th><th>Descritivo</th></tr>
      ${rdo.operacoes.map(o => `<tr><td>${o.inicio||'-'}</td><td>${o.termino||'-'}</td><td>${o.tipo||'Normal'}</td><td>${o.descritivo||''}</td></tr>`).join('')}</table>`;
  }

  // Equipe
  let eqHTML = empty("Nenhum membro de equipe registrado.");
  if (rdo.equipe && rdo.equipe.length > 0) {
    eqHTML = `<table class="ops-table"><tr><th>Funcao</th><th>Nome</th></tr>
      ${rdo.equipe.map(e => `<tr><td>${e.funcao||'-'}</td><td>${e.nome||'-'}</td></tr>`).join('')}</table>`;
  }

  // Fotos
  let fotosHTML = empty("Nenhuma foto anexada.");
  if (rdo.fotos && rdo.fotos.length > 0) {
    fotosHTML = `<div class="photo-grid">${rdo.fotos.map(url => `<img src="${url}" class="photo-thumb" style="cursor:pointer;max-width:120px;border-radius:6px;" onclick="window.open('${url}')">`).join('')}</div>`;
  }

  c.innerHTML = `
    <div class="card-header">RDO ${rdo.data} — ${rdo.tipo_dia || 'N/D'}</div>

    ${section("Identificacao",
      row("Autor", authorName) +
      row("Data", rdo.data || '-')
    )}

    ${section("Perfuracao",
      row("Houve avanco?", rdo.profundidade_final != null ? yn(true) : yn(false)) +
      (rdo.profundidade_final != null
        ? row("Profundidade", (rdo.profundidade_inicial||0) + " → " + rdo.profundidade_final + " m")
        : row("Profundidade", '<span style="color:#9ca3af;">Não houve avanço na perfuração neste dia.</span>')) +
      (stratEntries.length > 0
        ? stratEntries.map(s => row("Estratigrafia", s.profundidade + "m: " + s.descricao)).join("")
        : row("Estratigrafia", '<span style="color:#9ca3af;">Nenhuma mudanca de formacao registrada.</span>')) +
      '<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">Striplog</div>' + striplogHTML + '</div>' +
      '<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">Brocas</div>' + brocaHTML + '</div>' +
      '<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">BHA</div>' + bhaHTML + '</div>' +
      '<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">Anomalias</div>' + anomaliaHTML + '</div>'
    )}

    ${section("Revestimento", revestHTML)}
    ${section("Pré-filtro", preFiltroHTML)}
    ${section("Limpeza e Desenvolvimento", desenvHTML)}
    ${section("Jateamento", jateamentoHTML)}
    ${section("Fluido", fluidoHTML)}
    ${section("Quimicos", quimicosHTML)}
    ${section("Combustivel", fuelHTML)}
    ${section("Materiais", matHTML)}
    ${section("Operacoes", opsHTML)}
    ${section("Equipe", eqHTML)}

    ${section("Sonda",
      row("Horímetro", rdo.sonda_horimetro != null ? rdo.sonda_horimetro + " h" : empty("Não preenchido")) +
      (rdo.troca_oleo
        ? `<div style="margin-top:.3rem;"><div style="font-size:.78rem;font-weight:600;">Troca de Óleo</div>` +
          row("Tipo / Marca", rdo.troca_oleo.tipo || "-") +
          row("Litros", (rdo.troca_oleo.litros || "-") + " L") +
          row("Horímetro", (rdo.troca_oleo.horimetro || "-") + " h") +
          row("Filtro trocado", rdo.troca_oleo.filtro_trocado ? "Sim" : "Não") + "</div>"
        : row("Troca de óleo", empty("Não houve troca de óleo neste dia.")))
    )}

    ${section("HSE",
      row("DDS", rdo.hse_dds ? "Sim" : "Não") +
      row("EPIs vistoriados", rdo.hse_epis_vistoriados ? "Sim" : "Não") +
      row("HH Expostas", rdo.hse_hh_expostas || "-") +
      (rdo.hse_incidentes
        ? row("Incidentes", rdo.hse_incidentes)
        : row("Incidentes", '<span style="color:#9ca3af;">Nenhum incidente registrado.</span>')) +
      (rdo.hse_quase_acidentes
        ? row("Quase-acidentes", rdo.hse_quase_acidentes)
        : row("Quase-acidentes", '<span style="color:#9ca3af;">Nenhum quase-acidente registrado.</span>'))
    )}

    ${section("Observacoes",
      rdo.observacoes
        ? '<p style="font-size:.82rem;">' + rdo.observacoes + '</p>'
        : empty("Nenhuma observacao registrada.")
    )}

    ${section("Planejamento",
      rdo.planejamento_proximo_turno
        ? '<p style="font-size:.82rem;">' + rdo.planejamento_proximo_turno + '</p>'
        : empty("Nenhum planejamento registrado.")
    )}

    ${section("Fotos", fotosHTML)}

    ${rdo.status === 'aprovado' && !rdo.reopen_requested && currentProfile && currentProfile.role === 'colaborador'
      ? `<button class="btn btn-secondary" onclick="requestReopen('${rdo.id}')" style="margin-top:.5rem;">Solicitar Reabertura</button>`
      : (rdo.reopen_requested ? `<p style="color:#f59e0b;font-size:.78rem;margin-top:.5rem;">Reabertura solicitada — aguardando supervisor</p>` : '')}
  `;
  showView("readonlyView");
}

async function requestReopen(id) {
  const { error } = await sb.from("rdos").update({ reopen_requested: true }).eq("id", id);
  if (error) { showToast("Erro: " + error.message, "error"); return; }
  showToast("Reabertura solicitada!", "success");
  showView("homeView");
  loadRDOs();
}

// ============================================================
// POPULATE FORM (for draft editing)
// ============================================================
function populateForm(rdo) {
  $("#rdoDate").value = rdo.data;
  if (rdo.profundidade_final != null) {
    setToggle("#toggleDrilling", true);
    // Depth is computed from striplog, not manual fields
    // Estratigrafia
    if (rdo.estratigrafia_mudou || (rdo.estratigrafia_mudancas && rdo.estratigrafia_mudancas.length > 0)) {
      setToggle("#toggleStratigraphy", true);
      clearTable("#stratTable");
      if (rdo.estratigrafia_mudancas) {
        rdo.estratigrafia_mudancas.forEach(s => addStratRow(s.profundidade, s.descricao));
      } else if (rdo.estratigrafia_descricao) {
        // backward compat: single entry
        addStratRow(rdo.estratigrafia_profundidade, rdo.estratigrafia_descricao);
      }
    } else {
      setToggle("#toggleStratigraphy", false);
    }
  setToggle("#toggleAnomaly", false);

    if (rdo.brocas) {
      const b = rdo.brocas;
      if (b.atual) {
        $("#bitBrandCurrent").value = b.atual.fabricante || "";
        $("#bitSerialCurrent").value = b.atual.serie || "";
        $("#bitDiameterCurrent").value = b.atual.diametro || "";
        $("#bitModelCurrent").value = b.atual.modelo || "";
        $("#bitJetsCurrent").value = b.atual.jatos || "";
        $("#bitDrilledCurrent").value = b.atual.perfurado || "";
        $("#bitHoursCurrent").value = b.atual.oper_hs || "";
        $("#bitRopCurrent").value = b.atual.rop || "";
      }
      if (b.anterior) {
        $("#bitBrandPrev").value = b.anterior.fabricante || "";
        $("#bitSerialPrev").value = b.anterior.serie || "";
        $("#bitDiameterPrev").value = b.anterior.diametro || "";
        $("#bitModelPrev").value = b.anterior.modelo || "";
        $("#bitJetsPrev").value = b.anterior.jatos || "";
        $("#bitDrilledPrev").value = b.anterior.perfurado || "";
        $("#bitHoursPrev").value = b.anterior.oper_hs || "";
        $("#bitRopPrev").value = b.anterior.rop || "";
      }
    }
    if (rdo.parametros_anomalias && rdo.parametros_anomalias.length > 0) {
      setToggle("#toggleAnomaly", true);
      rdo.parametros_anomalias.forEach(a => addAnomalyRow(a.parametro, a.descricao));
    }
    if (rdo.striplog && rdo.striplog.length > 0) {
      clearTable("#striplogTable");
      rdo.striplog.forEach(s => addStriplogRow(s.mode || "meter", s.profundidade, s.inicio || "", s.termino || "", s.obs));
    }
    if (rdo.coluna) {
      clearTable("#bhaTable");
      rdo.coluna.forEach(item => {
        addBHARow(item.item, item.qty, item.id_pol, item.od_pol, item.length_m, item.total_m);
      });
    } else { addBHARow("","","","","",""); }
  } else {
    setToggle("#toggleDrilling", false);
    if (!hasColunaRows()) addBHARow("","","","","","");
  }

  // Fluido
  // Fluid params (always)
  if (rdo.fluido) {
    const f = rdo.fluido;
    $("#fluidDensity").value = f.densidade || "";
    $("#fluidViscosity").value = f.viscosidade || "";
    $("#fluidFiltrate").value = f.filtrado || "";
    $("#fluidPh").value = f.ph || "";
    $("#fluidFreeWater").value = f.agua_livre || "";
    $("#fluidSand").value = f.areia || "";
    $("#fluidApiCake").value = f.api_cake || "";
    $("#fluidSolids").value = f.solidos || "";
  }
  // Quimicos (toggle)
  if (rdo.quimicos && Array.isArray(rdo.quimicos) && rdo.quimicos.length > 0) {
    setToggle("#toggleFluid", true);
    clearTable("#chemTable");
    rdo.quimicos.forEach(c => addChemicalRow(c.name, c.tipo || "consumo", c.qtd ?? c.consumo));
  }
  // Combustivel (always)
  if (rdo.combustivel) {
    if (rdo.combustivel.consumos && Array.isArray(rdo.combustivel.consumos)) {
      clearTable("#fuelTable");
      rdo.combustivel.consumos.forEach(f => addFuelRow(f.equipamento, f.tipo, f.litros));
    }
    if (rdo.combustivel.estoque_s10 != null) $("#fuelS10Stock").value = rdo.combustivel.estoque_s10;
    if (rdo.combustivel.estoque_s500 != null) $("#fuelS500Stock").value = rdo.combustivel.estoque_s500;
  }
  // Revestimento (standalone tab)
  if (rdo.revestimento_mudou) {
    setToggle("#toggleCasing", true);
    $("#casingMeters").value = rdo.revestimento_metros || "";
    $("#casingObs").value = rdo.revestimento_obs || "";
  } else {
    setToggle("#toggleCasing", false);
  }
  // Pré-filtro
  if (rdo.pre_filtro_mudou && rdo.pre_filtro) {
    setToggle("#togglePreFiltro", true);
    $("#preFiltroBags").value = rdo.pre_filtro.bags || "";
    $("#preFiltroObs").value = rdo.pre_filtro.obs || "";
  } else {
    setToggle("#togglePreFiltro", false);
  }
  // Limpeza e desenvolvimento
  if (rdo.desenvolvimento_mudou && rdo.desenvolvimento) {
    setToggle("#toggleDesenvolvimento", true);
    const d = rdo.desenvolvimento;
    setMetodoDesenvolvimento(d.metodo === "bomba" ? "bomba" : "compressor");
    if (d.metodo === "bomba") {
      $("#bombaNome").value = d.nome_bomba || "";
      $("#bombaPotencia").value = d.potencia || "";
      $("#bombaVoltagem").value = d.voltagem || "";
      $("#bombaHoras").value = d.horas_trabalhadas || "";
      $("#bombaAberturaValvula").value = d.abertura_valvula || "";
      $("#bombaProfundidade").value = d.profundidade_instalacao || "";
      $("#bombaObs").value = d.obs || "";
    } else {
      $("#compressorModelo").value = d.modelo || "";
      $("#compressorPressaoMax").value = d.pressao_max || "";
      $("#compressorHorimetroInicio").value = d.horimetro_inicio || "";
      $("#compressorHorimetroFim").value = d.horimetro_fim || "";
      clearTable("#compressorTable");
      if (d.uso && Array.isArray(d.uso)) {
        d.uso.forEach(u => addCompressorRow(u.hora, u.prof_arranque, u.pressao_arranque, u.pressao_trabalho));
      } else {
        addCompressorRow("","","","");
      }
    }
  } else {
    setToggle("#toggleDesenvolvimento", false);
    setMetodoDesenvolvimento("compressor");
  }
  // Jateamento
  if (rdo.jateamento_mudou && rdo.jateamento && Array.isArray(rdo.jateamento)) {
    setToggle("#toggleJateamento", true);
    clearTable("#jateamentoTable");
    rdo.jateamento.forEach(j => addJateamentoRow(j.inicio, j.termino, j.secao_inicio, j.secao_fim, j.obs));
  } else {
    setToggle("#toggleJateamento", false);
  }
  // Outros Materiais (toggle)
  if (rdo.outros_materiais && Array.isArray(rdo.outros_materiais) && rdo.outros_materiais.length > 0) {
    setToggle("#toggleMateriais", true);
    clearTable("#matTable");
    rdo.outros_materiais.forEach(m => addMaterialRow(m.name, m.tipo || "consumo", m.qtd ?? m.consumo));
  }

  // Insumos (always populated, independent of Fluid toggle)
  if (rdo.insumos) {
    const i = rdo.insumos;
    $("#supplyWater").value = i.agua || ""; $("#supplySeptic").value = i.limpa_fossa || "";
    $("#supplyBathroom").value = i.limpeza_banheiro || ""; $("#supplyPta").value = i.pta || "";
    $("#supplyMunck").value = i.munck || ""; $("#supplyCrane").value = i.guindaste || "";
    $("#supplyDebrisRemoval").value = i.remocao_cacamba || "";
  }

  // Operacoes
  if (rdo.operacoes && rdo.operacoes.length > 0) {
    clearTable("#opsTable");
    rdo.operacoes.forEach(o => addOpRow(o.inicio, o.termino, o.tipo, o.descritivo));
  } else if (!hasOpsRows()) {
    addOpRow("","","","");
  }

  // Equipe
  if (rdo.equipe && rdo.equipe.length > 0) {
    clearTable("#teamTable");
    rdo.equipe.forEach(e => addTeamMemberRow(e.funcao, e.nome));
  }

  // HSE
  $("#hseDds").checked = !!rdo.hse_dds;
  $("#hseEpi").checked = !!rdo.hse_epis_vistoriados;
  $("#hseManHours").value = rdo.hse_hh_expostas || "";
  $("#hseIncidents").value = rdo.hse_incidentes || "";
  $("#hseNearMiss").value = rdo.hse_quase_acidentes || "";

  // Sonda
  $("#sondaHorimetro").value = rdo.sonda_horimetro || "";
  if (rdo.troca_oleo) {
    setToggle("#toggleOilChange", true);
    const o = rdo.troca_oleo;
    $("#oilType").value = o.tipo || "";
    $("#oilLiters").value = o.litros || "";
    $("#oilHorimetro").value = o.horimetro || "";
    $("#oilFilterChanged").checked = !!o.filtro_trocado;
  } else {
    setToggle("#toggleOilChange", false);
  }

  // Clima


  // Obs
  $("#obsGeneral").value = rdo.observacoes || "";
  $("#planNextShift").value = rdo.planejamento_proximo_turno || "";


  // Existing photos
  selectedFiles = [];
  photoInput.value = "";
  if (rdo.fotos && rdo.fotos.length > 0) {
    $("#existingPhotos").innerHTML = `<p style="font-size:.78rem;color:#6b7280;margin-top:.5rem;">Fotos existentes (serao mantidas):</p><div class="photo-grid">${rdo.fotos.map(url => `<img src="${url}" class="photo-thumb">`).join("")}</div>`;
  } else {
    $("#existingPhotos").innerHTML = "";
  }
  renderPhotoPreview();
}

function setToggle(groupId, show) {
  const group = $(groupId);
  group.querySelectorAll(".toggle-btn").forEach(b => {
    b.classList.remove("active-yes", "active-no");
  });
  if (show) {
    group.querySelector('[data-value="yes"]').classList.add("active-yes");
    $(groupId.replace("toggle","section")).classList.add("show");
  } else {
    group.querySelector('[data-value="no"]').classList.add("active-no");
    $(groupId.replace("toggle","section")).classList.remove("show");
  }
}

function clearTable(tableId) {
  const el = $(tableId);
  if (!el) return;
  if (el.rows) {
    while (el.rows.length > 1) el.deleteRow(1);
  } else {
    el.innerHTML = "";
  }
}
function hasOpsRows() { return $("#opsTable").rows.length > 1; }
function hasColunaRows() { return $("#bhaTable").rows.length > 1; }

// ============================================================
// TOGGLE BUTTONS
// ============================================================
function setupToggle(groupId, sectionId) {
  const group = $(groupId);
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    group.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active-yes", "active-no"));
    if (btn.dataset.value === "yes") {
      btn.classList.add("active-yes");
      $(sectionId).classList.add("show");
    } else {
      btn.classList.add("active-no");
      $(sectionId).classList.remove("show");
    }
  });
}
setupToggle("#toggleDrilling", "#sectionDrilling");
// Update striplog tab visibility when drilling toggle changes
setupToggle("#toggleFluid", "#sectionFluid");
setupToggle("#toggleMateriais", "#sectionMateriais");
setupToggle("#toggleStratigraphy", "#sectionStratigraphy");
setupToggle("#toggleCasing", "#sectionCasing");
setupToggle("#togglePreFiltro", "#sectionPreFiltro");
setupToggle("#toggleDesenvolvimento", "#sectionDesenvolvimento");
setupToggle("#toggleJateamento", "#sectionJateamento");
setupToggle("#toggleAnomaly", "#sectionAnomaly");
setupToggle("#toggleOilChange", "#sectionOilChange");

// ============================================================
// OPERATIONS TABLE
// ============================================================
function addOpRow(inicio, termino, tipo, descritivo) {
  const tbody = $("#opsTable");
  const row = tbody.insertRow(-1);
  const tipoOpts = ["Normal","Nao Produtiva","Parada","Parada Climatica"];
  const opts = tipoOpts.map(t => `<option value="${t}" ${t === tipo ? "selected" : ""}>${t}</option>`).join("");
  row.innerHTML = `
    <td><input type="time" value="${inicio || ''}" class="opStart"></td>
    <td><input type="time" value="${termino || ''}" class="opEnd"></td>
    <td><select class="opType" style="min-width:100px;font-size:.82rem;padding:.3rem;">${opts}</select></td>
    <td><input type="text" value="${descritivo || ''}" class="opDescription" placeholder="Descreva..."></td>
    <td><button class="btn btn-danger btn-sm opRemove" type="button">&times;</button></td>`;
  row.querySelector(".opRemove").addEventListener("click", () => { row.remove(); updateTimeline(); });
  // Update timeline on input
  row.querySelectorAll("input, select").forEach(el => el.addEventListener("input", updateTimeline));
  row.querySelectorAll("input, select").forEach(el => el.addEventListener("change", updateTimeline));
  updateTimeline();
}
$("#btnAddOp").addEventListener("click", () => addOpRow("","","Normal",""));
addOpRow("","","Normal","");

function updateTimeline() {
  const track = $("#timelineTrack");
  const turnoH = parseFloat($("#shiftHours").value) || 12;
  track.innerHTML = "";
  for (let i = 1; i < $("#opsTable").rows.length; i++) {
    const row = $("#opsTable").rows[i];
    const inicio = row.querySelector(".opStart")?.value;
    const termino = row.querySelector(".opEnd")?.value;
    const tipo = row.querySelector(".opType")?.value || "Normal";
    const desc = row.querySelector(".opDescription")?.value || "";
    if (!inicio || !termino) continue;
    const [ih, im] = inicio.split(":").map(Number);
    const [th, tm] = termino.split(":").map(Number);
    const startMin = ih * 60 + im;
    const endMin = th * 60 + tm;
    if (endMin <= startMin) continue;
    const totalMin = turnoH * 60;
    const leftPct = (startMin / totalMin) * 100;
    const widthPct = ((endMin - startMin) / totalMin) * 100;
    const cls = tipo === "Parada Climatica" ? "timeline-seg-parada-climatica" : tipo === "Parada" ? "timeline-seg-parada" : tipo === "Nao Produtiva" ? "timeline-seg-nao-produtiva" : "timeline-seg-normal";
    const seg = document.createElement("div");
    seg.className = "timeline-segment " + cls;
    seg.style.left = leftPct + "%";
    seg.style.width = widthPct + "%";
    seg.title = `${inicio}-${termino}: ${desc}`;
    track.appendChild(seg);
  }
}
// Update timeline when turno changes
$("#shiftHours").addEventListener("input", updateTimeline);

// ============================================================
// COLUNA TABLE
// ============================================================
const BHA_OPTIONS = ["BR: Broca","NB: Nearbit","DC: Drill Collar","STB: Estabilizador","HW: Heavy Weight","DP: Drill Pipe","RED: Redução","UR: Underreamer","Outro"];

function addBHARow(item, qty, idPol, odPol, lengthM, totalM) {
  const tbody = $("#bhaTable");
  const row = tbody.insertRow(-1);
  const opts = BHA_OPTIONS.map(o => `<option value="${o}" ${o===item||o.startsWith(item)?"selected":""}>${o}</option>`).join("");
  const customVal = BHA_OPTIONS.some(o => o.startsWith(item)) ? "" : (item || "");
  row.innerHTML = `
    <td><select class="bhaItem" style="min-width:100px;font-size:.82rem;" onchange="onBHAItemChange(this)">${opts}</select><input type="text" class="bhaItemCustom" placeholder="Nome da peça" style="display:none;margin-top:2px;min-width:100px;font-size:.8rem;" value="${customVal}"></td>
    <td><input type="number" value="${qty || ''}" class="bhaQty" style="min-width:50px"></td>
    <td><input type="number" step="0.01" value="${idPol || ''}" class="bhaId" style="min-width:60px"></td>
    <td><input type="number" step="0.01" value="${odPol || ''}" class="bhaOd" style="min-width:60px"></td>
    <td><input type="number" step="0.01" value="${lengthM || ''}" class="bhaLength" style="min-width:70px"></td>
    <td><input type="number" step="0.01" value="${totalM || ''}" class="bhaRowTotal" style="min-width:70px"></td>
    <td><button class="btn btn-danger btn-sm bhaRemove" type="button">&times;</button></td>`;
  row.querySelector(".bhaRemove").addEventListener("click", () => { row.remove(); updateBHATotal(); });
  // Update total on input
  row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", updateBHATotal));
  updateBHATotal();
}
$("#btnAddBHA").addEventListener("click", () => addBHARow("","","","","",""));
addBHARow("","","","","","");

function onBHAItemChange(sel) {
  const row = sel.closest("tr");
  const custom = row.querySelector(".bhaItemCustom");
  custom.style.display = sel.value === "Outro" ? "block" : "none";
  updateBHATotal();
}

// ── Striplog ─────────────────────────────────────────────────
function addStriplogRow(mode, depth, inicio, termino, obs) {
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const prevDepth = getLastStriplogDepth();
  const prevTermino = getLastStriplogTermino();
  const prevInicio = getLastStriplogInicio();

  // Compute defaults per mode
  let d = depth || "", ini = inicio || "", ter = termino || "";
  if (mode === "start") {
    d = depth || String(prevDepth > 0 ? prevDepth : "");
    ini = inicio || now;
    ter = ""; // locked
  } else if (mode === "meter") {
    d = depth || String(prevDepth > 0 ? (Math.floor(prevDepth) + 1) : "");
    ini = prevTermino || prevInicio || ""; // locked
    ter = termino || now;
  } else if (mode === "stop") {
    d = depth || String(prevDepth > 0 ? prevDepth : "");
    ini = inicio || now;
    ter = termino || "";
  }

  const depthStep = mode === "meter" ? "0.01" : "0.1";
  const borderColors = { start: "#10b981", meter: "#3b82f6", stop: "#ef4444" };
  const borderColor = borderColors[mode] || "#e5e7eb";
  const modeLabel = { start: "Início", meter: "Metro", stop: "Parada" }[mode] || "Metro";
  const terminoField = mode === "start"
    ? '<span class="sl-locked">—</span>'
    : `<input type="time" value="${ter}" class="slTermino">`;

  const card = document.createElement("div");
  card.className = "striplog-card";
  card.setAttribute("data-mode", mode);
  card.style.borderLeftColor = borderColor;
  card.innerHTML = `
    <div class="sl-body">
      <div class="sl-row">
        <div class="sl-field">
          <span class="sl-label">Início</span>
          <input type="time" value="${ini}" class="slInicio" ${mode === "meter" ? "readonly" : ""}>
        </div>
        <div class="sl-field">
          <span class="sl-label">Término</span>
          ${terminoField}
        </div>
        <div class="sl-field">
          <span class="sl-label">Prof. (m)</span>
          <input type="number" step="${depthStep}" value="${d}" class="slDepth">
        </div>
      </div>
      <div class="sl-row">
        <div class="sl-stat">
          <span class="sl-label">ROP</span>
          <span class="sl-stat-value slROP">—</span>
        </div>
        <div class="sl-stat">
          <span class="sl-label">Δ</span>
          <span class="sl-stat-value slDelta">—</span>
        </div>
        <div class="sl-field sl-field-obs">
          <span class="sl-label">Observação</span>
          <input type="text" value="${obs || ''}" class="slObs" placeholder="${mode === 'stop' ? 'Motivo da parada (obrigatório)' : 'Ex.: parada para manutencao'}" ${mode === "stop" ? "required" : ""}>
        </div>
        <span class="sl-type"><span style="color:${borderColor};">●</span> ${modeLabel}</span>
      </div>
    </div>
    <button class="sl-remove" type="button" title="Remover entrada">&times;</button>`;

  $("#striplogTable").appendChild(card);
  card.querySelector(".sl-remove").addEventListener("click", () => { card.remove(); updateStriplogROP(); });
  card.querySelectorAll("input").forEach(el => el.addEventListener("input", updateStriplogROP));
  updateStriplogROP();
}

function getStriplogCards() {
  return Array.from($("#striplogTable").querySelectorAll(".striplog-card"));
}

function getLastStriplogDepth() {
  const cards = getStriplogCards();
  if (cards.length === 0) return 0;
  const lastInput = cards[cards.length - 1].querySelector(".slDepth");
  return parseFloat(lastInput?.value) || 0;
}

function getLastStriplogTermino() {
  const cards = getStriplogCards();
  if (cards.length === 0) return "";
  return cards[cards.length - 1].querySelector(".slTermino")?.value || "";
}

function getLastStriplogInicio() {
  const cards = getStriplogCards();
  if (cards.length === 0) return "";
  return cards[cards.length - 1].querySelector(".slInicio")?.value || "";
}

function updateStriplogROP() {
  const cards = getStriplogCards();
  if (cards.length === 0) { $("#striplogROP").textContent = ""; return; }

  // Compute ROP per card: parada cards use previous meter's depth delta + parada inicio
  const rops = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const mode = card.getAttribute("data-mode");
    const d = parseFloat(card.querySelector(".slDepth")?.value);
    const ini = card.querySelector(".slInicio")?.value;
    const ter = card.querySelector(".slTermino")?.value;
    const prevD = i > 0 ? parseFloat(cards[i - 1].querySelector(".slDepth")?.value) : null;

    if (mode === "stop" && ini && prevD !== null) {
      // Parada: ROP = (current depth - prev depth) / (parada inicio - prev termino)
      const prevTer = i > 0 ? cards[i - 1].querySelector(".slTermino")?.value : null;
      if (prevTer) {
        const [ih, im] = ini.split(":").map(Number);
        const [ph, pm] = prevTer.split(":").map(Number);
        let dt = (ih * 60 + im) - (ph * 60 + pm);
        if (dt < 0) dt += 24 * 60;
        const dm = d - prevD;
        if (dm > 0 && dt > 0) rops.push({ cardIndex: i, rop: (dm / (dt / 60)), dm, dt });
      }
    } else if (ini && ter) {
      // Normal card: ROP = own depth delta / own time
      const [ih, im] = ini.split(":").map(Number);
      const [th, tm] = ter.split(":").map(Number);
      let dt = (th * 60 + tm) - (ih * 60 + im);
      if (dt < 0) dt += 24 * 60; // midnight crossover
      if (dt > 0 && prevD !== null) {
        const dm = d - prevD;
        rops.push({ cardIndex: i, rop: dm > 0 ? (dm / (dt / 60)) : 0, dm, dt });
      }
    }
  }

  // Average ROP
  const validRops = rops.filter(r => r.rop > 0);
  const avgRop = validRops.length > 0 ? validRops.reduce((s, r) => s + r.rop, 0) / validRops.length : 0;

  // Update each card's ROP and delta cells
  for (let i = 0; i < cards.length; i++) {
    const ropCell = cards[i].querySelector(".slROP");
    const deltaCell = cards[i].querySelector(".slDelta");
    if (!ropCell || !deltaCell) continue;
    const r = rops.find(p => p.cardIndex === i);
    if (r && r.rop > 0 && avgRop > 0) {
      ropCell.textContent = r.rop.toFixed(1);
      const pct = Math.floor(Math.abs((r.rop - avgRop) / avgRop * 100));
      if (pct < 1) {
        deltaCell.innerHTML = '<span style="color:#9ca3af;">=0%</span>';
      } else if (r.rop > avgRop) {
        deltaCell.innerHTML = `<span style="color:#10b981;">↑${pct}%</span>`;
      } else {
        deltaCell.innerHTML = `<span style="color:#ef4444;">↓${pct}%</span>`;
      }
    } else {
      ropCell.textContent = r ? "0.0" : "—";
      deltaCell.textContent = "—";
    }
  }

  // Summary line
  if (validRops.length > 0) {
    // Summary: total depth change (all cards) / total elapsed time (excluding stops)
    let totalDm = 0, firstIni = null, totalStopDt = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const mode = card.getAttribute("data-mode");
      const d = parseFloat(card.querySelector(".slDepth")?.value);
      const ini = card.querySelector(".slInicio")?.value;
      const ter = card.querySelector(".slTermino")?.value;
      if (!isNaN(d)) totalDm = d; // track last valid depth
      if (mode === "stop" && ini && ter) {
        const [ih, im] = ini.split(":").map(Number);
        const [th, tm] = ter.split(":").map(Number);
        let sd = (th * 60 + tm) - (ih * 60 + im);
        if (sd < 0) sd += 24 * 60;
        totalStopDt += sd;
      }
      if (ini && mode !== "stop") {
        if (!firstIni) firstIni = ini;
      }
    }
    // Subtract first card depth to get total meters
    const firstD = parseFloat(cards[0]?.querySelector(".slDepth")?.value) || 0;
    totalDm = totalDm - firstD;
    // Use FIRST card's início and LAST card's término (any mode) for elapsed time
    const firstCardIni = cards[0]?.querySelector(".slInicio")?.value || firstIni || "";
    const lastCardTer = cards[cards.length - 1]?.querySelector(".slTermino")?.value || "";
    const [fh, fm] = (firstCardIni || "0:0").split(":").map(Number);
    const [lh, lm] = (lastCardTer || "0:0").split(":").map(Number);
    let totalDt = ((lh * 60 + lm) - (fh * 60 + fm));
    if (totalDt < 0) totalDt += 24 * 60;
    totalDt -= totalStopDt;
    if (totalDt > 0 && totalDm > 0) {
      const avg = (totalDm / (totalDt / 60)).toFixed(1);
      const depthStart = firstD;
      const depthEnd = firstD + totalDm;
      $("#striplogROP").textContent = `${depthStart.toFixed(2)} a ${depthEnd.toFixed(2)} m | ${totalDm.toFixed(1)} m em ${totalDt} min | ROP médio: ${avg} m/h`;
    }
  }
}

$("#btnAddStriplog").addEventListener("click", () => addStriplogRow("meter","","","",""));
$("#btnShiftStart").addEventListener("click", () => addStriplogRow("start","","","","Início/retomada"));
$("#btnShiftStop").addEventListener("click", () => addStriplogRow("stop","","","",""));

function collectStriplog() {
  const items = [];
  for (const card of getStriplogCards()) {
    const depth = parseFloat(card.querySelector(".slDepth")?.value);
    const inicio = card.querySelector(".slInicio")?.value || "";
    const termino = card.querySelector(".slTermino")?.value || "";
    const obs = card.querySelector(".slObs")?.value || "";
    if (!isNaN(depth) && (inicio || termino)) {
      const mode = card.getAttribute("data-mode") || "meter";
      items.push({ profundidade: depth, inicio, termino, obs: obs || null, mode });
    }
  }
  return items.length > 0 ? items : null;
}

function updateBHATotal() {
  let total = 0;
  for (let i = 1; i < $("#bhaTable").rows.length; i++) {
    const row = $("#bhaTable").rows[i];
    const qty = parseFloat(row.querySelector(".bhaQty")?.value) || 0;
    const len = parseFloat(row.querySelector(".bhaLength")?.value) || 0;
    const rowTotal = parseFloat(row.querySelector(".bhaRowTotal")?.value);
    total += rowTotal || (qty * len);
  }
  const el = $("#bhaTotal");
  el.textContent = `Comprimento total da coluna: ${total.toFixed(2)} m`;
  el.style.display = total > 0 ? "block" : "none";
}

// ============================================================
// EQUIPE TABLE
// ============================================================
function addTeamMemberRow(funcao, nome) {
  const tbody = $("#teamTable");
  const row = tbody.insertRow(-1);
  row.innerHTML = `
    <td><input type="text" value="${funcao || ''}" class="teamRole" placeholder="ex: Sondador" style="min-width:100px"></td>
    <td><input type="text" value="${nome || ''}" class="teamName" placeholder="Nome"></td>
    <td><button class="btn btn-danger btn-sm teamRemove" type="button">&times;</button></td>`;
  row.querySelector(".teamRemove").addEventListener("click", () => row.remove());
}
$("#btnAddTeamMember").addEventListener("click", () => addTeamMemberRow("",""));
const DEFAULT_ROLES = ["Sondador","Torrista","Plat. / Auxiliar 1","Plat. / Auxiliar 2","TST","Geólogo","Coordenador"];
DEFAULT_ROLES.forEach(r => addTeamMemberRow(r,""));

// ============================================================
// PHOTOS
// ============================================================
let selectedFiles = [];
$("#photoInput").addEventListener("change", () => {
  selectedFiles = Array.from($("#photoInput").files).slice(0, 3);
  renderPhotoPreview();
});
function renderPhotoPreview() {
  const pg = $("#photoPreview");
  pg.innerHTML = "";
  selectedFiles.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "photo-thumb";
    pg.appendChild(img);
  });
  for (let i = selectedFiles.length; i < 3; i++) {
    const div = document.createElement("div");
    div.className = "photo-placeholder";
    div.textContent = "+";
    pg.appendChild(div);
  }
}

async function uploadPhotos() {
  if (selectedFiles.length === 0) return [];
  const urls = [];
  for (const file of selectedFiles) {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).upload(fileName, file, { cacheControl:"3600", upsert:false });
    if (error) { showToast("Erro ao enviar foto: "+error.message,"error"); continue; }
    const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
    urls.push(urlData.publicUrl);
  }
  return urls;
}

// ============================================================
// DATA COLLECTION
// ============================================================
function getToggleState(groupId) { return !!$(groupId).querySelector(".active-yes"); }
function collectOps() {
  const ops = [];
  for (let i = 1; i < $("#opsTable").rows.length; i++) {
    const row = $("#opsTable").rows[i];
    const inicio = row.querySelector(".opStart")?.value || "";
    const termino = row.querySelector(".opEnd")?.value || "";
    const tipo = row.querySelector(".opType")?.value || "Normal";
    const descritivo = row.querySelector(".opDescription")?.value || "";
    if (inicio || termino || descritivo) ops.push({ inicio, termino, tipo, descritivo });
  }
  return ops.length > 0 ? ops : null;
}
function collectBHA() {
  const items = [];
  for (let i = 1; i < $("#bhaTable").rows.length; i++) {
    const row = $("#bhaTable").rows[i];
    const sel = row.querySelector(".bhaItem");
    const custom = row.querySelector(".bhaItemCustom");
    let item = sel?.value || "";
    if (item === "Outro") item = custom?.value || "";
    if (!item) continue;
    items.push({
      item,
      qty: parseInt(row.querySelector(".bhaQty")?.value) || null,
      id_pol: parseFloat(row.querySelector(".bhaId")?.value) || null,
      od_pol: parseFloat(row.querySelector(".bhaOd")?.value) || null,
      length_m: parseFloat(row.querySelector(".bhaLength")?.value) || null,
      total_m: parseFloat(row.querySelector(".bhaRowTotal")?.value) || null,
    });
  }
  return items.length > 0 ? items : null;
}
// ── N/A toggle for consumables ────────────────────────────────
function toggleNA(checkbox) {
  const key = checkbox.dataset.key;
  const isNA = checkbox.checked;
  // Find related consumo/estoque inputs in the same row
  const row = checkbox.closest("tr");
  const consumo = row.querySelector(".chemConsumption, .matConsumption");
  const estoque = row.querySelector(".chemStock, .matStock");
  if (isNA) {
    if (consumo) { consumo.dataset.prev = consumo.value; consumo.value = "N/A"; consumo.disabled = true; }
    if (estoque) { estoque.dataset.prev = estoque.value; estoque.value = "N/A"; estoque.disabled = true; }
  } else {
    if (consumo) { consumo.value = consumo.dataset.prev || ""; consumo.disabled = false; }
    if (estoque) { estoque.value = estoque.dataset.prev || ""; estoque.disabled = false; }
  }
}

// ── Anomalias de Perfuracao ──────────────────────────────────
const PARAM_OPTIONS = ["Peso sobre Broca","RPM","Torque","SPM","Pressão","Vazão","ROP","Outro"];

function addAnomalyRow(parametro, descricao) {
  const tbody = $("#anomalyTable");
  const row = tbody.insertRow(-1);
  const opts = PARAM_OPTIONS.map(p => `<option value="${p}" ${p === parametro ? "selected" : ""}>${p}</option>`).join("");
  row.innerHTML = `
    <td><select class="anomalyParam" style="min-width:110px;">${opts}</select></td>
    <td><input type="text" value="${descricao || ''}" class="anomalyDesc" placeholder="Descreva a anomalia observada..."></td>
    <td><button class="btn btn-danger btn-sm anomalyRemove" type="button">&times;</button></td>`;
  row.querySelector(".anomalyRemove").addEventListener("click", () => row.remove());
}
$("#btnAddAnomaly").addEventListener("click", () => addAnomalyRow("",""));

// ── Estratigrafia (dynamic, multiple changes per day) ──────────
function addStratRow(depth, desc) {
  const tbody = $("#stratTable");
  const row = tbody.insertRow(-1);
  row.innerHTML = `
    <td><input type="number" step="0.01" value="${depth || ''}" class="stratDepth" style="min-width:70px;"></td>
    <td><input type="text" value="${desc || ''}" class="stratDesc" placeholder="Ex.: Fm. Botucatu, arenito fino"></td>
    <td><button class="btn btn-danger btn-sm stratRemove" type="button">&times;</button></td>`;
  row.querySelector(".stratRemove").addEventListener("click", () => row.remove());
}
$("#btnAddStrat").addEventListener("click", () => addStratRow("",""));

function collectStratigraphy() {
  const items = [];
  for (let i = 1; i < $("#stratTable").rows.length; i++) {
    const row = $("#stratTable").rows[i];
    const d = parseFloat(row.querySelector(".stratDepth")?.value);
    const desc = row.querySelector(".stratDesc")?.value || "";
    if (!isNaN(d) && desc) items.push({ profundidade: d, descricao: desc });
  }
  return items.length > 0 ? items : null;
}

function collectAnomalies() {
  const items = [];
  for (let i = 1; i < $("#anomalyTable").rows.length; i++) {
    const row = $("#anomalyTable").rows[i];
    const parametro = row.querySelector(".anomalyParam")?.value || "";
    const descricao = row.querySelector(".anomalyDesc")?.value || "";
    if (descricao) items.push({ parametro: parametro || null, descricao });
  }
  return items.length > 0 ? items : null;
}
function collectBits() {
  const atual = { fabricante:$("#bitBrandCurrent").value||null, serie:$("#bitSerialCurrent").value||null, diametro:$("#bitDiameterCurrent").value||null, modelo:$("#bitModelCurrent").value||null, jatos:$("#bitJetsCurrent").value||null, perfurado:parseFloat($("#bitDrilledCurrent").value)||null, oper_hs:parseFloat($("#bitHoursCurrent").value)||null, rop:parseFloat($("#bitRopCurrent").value)||null };
  const anterior = { fabricante:$("#bitBrandPrev").value||null, serie:$("#bitSerialPrev").value||null, diametro:$("#bitDiameterPrev").value||null, modelo:$("#bitModelPrev").value||null, jatos:$("#bitJetsPrev").value||null, perfurado:parseFloat($("#bitDrilledPrev").value)||null, oper_hs:parseFloat($("#bitHoursPrev").value)||null, rop:parseFloat($("#bitRopPrev").value)||null };
  const ha = Object.values(atual).some(v=>v!==null&&v!=="");
  const han = Object.values(anterior).some(v=>v!==null&&v!=="");
  if (!ha && !han) return null;
  const r = {};
  if (ha) r.atual = atual;
  if (han) r.anterior = anterior;
  return r;
}
function collectFluid() {
  const f = { densidade:parseFloat($("#fluidDensity").value)||null, viscosidade:parseFloat($("#fluidViscosity").value)||null, filtrado:parseFloat($("#fluidFiltrate").value)||null, ph:parseFloat($("#fluidPh").value)||null, agua_livre:parseFloat($("#fluidFreeWater").value)||null, areia:parseFloat($("#fluidSand").value)||null, api_cake:parseFloat($("#fluidApiCake").value)||null, solidos:parseFloat($("#fluidSolids").value)||null };
  return Object.values(f).some(v=>v!==null) ? f : null;
}
// ── Quimicos (dynamic) ──────────────────────────────────────
const CHEM_OPTIONS = ["Bentonita","CMC","Soda Caustica","Goma Xantana","Sal","Barrilha","Outro"];
const MAT_OPTIONS = ["Camisa Bomba","Válvula","Gaxeta de Swivel","Óleo 40 - Motor","Hexa-T","Outro"];

function addChemicalRow(name, tipo, qtd) {
  const tbody = $("#chemTable");
  const row = tbody.insertRow(-1);
  const opts = '<option value="">Selecionar...</option>' + CHEM_OPTIONS.map(c => `<option value="${c}" ${c===name?"selected":""}>${c}</option>`).join("");
  const tipoSel = tipo === "reabastecimento" ? "reabastecimento" : "consumo";
  row.innerHTML = `
    <td><select class="chemName" style="min-width:100px;font-size:.82rem;" onchange="onChemNameChange(this)">${opts}</select><input type="text" class="chemNameCustom" placeholder="Nome do químico" style="display:none;margin-top:2px;min-width:100px;font-size:.8rem;" value="${CHEM_OPTIONS.includes(name) ? '' : (name||'')}"></td>
    <td><select class="chemTipo" style="min-width:70px;font-size:.8rem;"><option value="consumo" ${tipoSel==='consumo'?'selected':''}>Consumo</option><option value="reabastecimento" ${tipoSel==='reabastecimento'?'selected':''}>Reabastecimento</option></select></td>
    <td><input type="number" step="0.1" class="chemQtd" value="${qtd||''}" style="min-width:55px;"></td>
    <td><input type="checkbox" class="chemNA" onchange="toggleChemNA(this)"></td>
    <td><button class="btn btn-danger btn-sm chemRemove" type="button">&times;</button></td>`;
  row.querySelector(".chemRemove").addEventListener("click", () => row.remove());
}
$("#btnAddChem").addEventListener("click", () => addChemicalRow("","",""));
function onChemNameChange(sel) {
  const row = sel.closest("tr");
  const custom = row.querySelector(".chemNameCustom");
  custom.style.display = sel.value === "Outro" ? "block" : "none";
}

function toggleChemNA(cb) {
  const row = cb.closest("tr");
  const tipo = row.querySelector(".chemTipo");
  const qtd = row.querySelector(".chemQtd");
  if (cb.checked) {
    tipo.dataset.prev = tipo.value; tipo.value = "consumo"; tipo.disabled = true;
    qtd.dataset.prev = qtd.value; qtd.value = "N/A"; qtd.disabled = true;
  } else {
    tipo.value = tipo.dataset.prev || "consumo"; tipo.disabled = false;
    qtd.value = qtd.dataset.prev || ""; qtd.disabled = false;
  }
}

function collectChemicals() {
  const items = [];
  for (let i = 1; i < $("#chemTable").rows.length; i++) {
    const row = $("#chemTable").rows[i];
    const sel = row.querySelector(".chemName");
    const custom = row.querySelector(".chemNameCustom");
    let name = sel?.value || "";
    if (name === "Outro") name = custom?.value || "";
    if (!name) continue;
    const qtd = row.querySelector(".chemQtd")?.value;
    if (qtd === "N/A" || qtd === "") continue;
    const tipo = row.querySelector(".chemTipo")?.value || "consumo";
    items.push({ name, tipo, qtd: parseFloat(qtd) || null });
  }
  return items.length > 0 ? items : null;
}

// ── Materiais (dynamic) ─────────────────────────────────────
function addMaterialRow(name, tipo, qtd) {
  const tbody = $("#matTable");
  const row = tbody.insertRow(-1);
  const opts = '<option value="">Selecionar...</option>' + MAT_OPTIONS.map(m => `<option value="${m}" ${m===name?"selected":""}>${m}</option>`).join("");
  const tipoSel = tipo === "reabastecimento" ? "reabastecimento" : "consumo";
  row.innerHTML = `
    <td><select class="matName" style="min-width:110px;font-size:.82rem;" onchange="onMatNameChange(this)">${opts}</select><input type="text" class="matNameCustom" placeholder="Nome do material" style="display:none;margin-top:2px;min-width:110px;font-size:.8rem;" value="${MAT_OPTIONS.includes(name) ? '' : (name||'')}"></td>
    <td><select class="matTipo" style="min-width:70px;font-size:.8rem;"><option value="consumo" ${tipoSel==='consumo'?'selected':''}>Consumo</option><option value="reabastecimento" ${tipoSel==='reabastecimento'?'selected':''}>Reabastecimento</option></select></td>
    <td><input type="number" step="0.1" class="matQtd" value="${qtd||''}" style="min-width:55px;"></td>
    <td><input type="checkbox" class="matNA" onchange="toggleMatNA(this)"></td>
    <td><button class="btn btn-danger btn-sm matRemove" type="button">&times;</button></td>`;
  row.querySelector(".matRemove").addEventListener("click", () => row.remove());
}
$("#btnAddMat").addEventListener("click", () => addMaterialRow("","",""));

function onMatNameChange(sel) {
  const row = sel.closest("tr");
  const custom = row.querySelector(".matNameCustom");
  custom.style.display = sel.value === "Outro" ? "block" : "none";
}

function toggleMatNA(cb) {
  const row = cb.closest("tr");
  const tipo = row.querySelector(".matTipo");
  const qtd = row.querySelector(".matQtd");
  if (cb.checked) {
    tipo.dataset.prev = tipo.value; tipo.value = "consumo"; tipo.disabled = true;
    qtd.dataset.prev = qtd.value; qtd.value = "N/A"; qtd.disabled = true;
  } else {
    tipo.value = tipo.dataset.prev || "consumo"; tipo.disabled = false;
    qtd.value = qtd.dataset.prev || ""; qtd.disabled = false;
  }
}

function collectMaterials() {
  const items = [];
  for (let i = 1; i < $("#matTable").rows.length; i++) {
    const row = $("#matTable").rows[i];
    const sel = row.querySelector(".matName");
    const custom = row.querySelector(".matNameCustom");
    let name = sel?.value || "";
    if (name === "Outro") name = custom?.value || "";
    if (!name) continue;
    const qtd = row.querySelector(".matQtd")?.value;
    if (qtd === "N/A" || qtd === "") continue;
    const tipo = row.querySelector(".matTipo")?.value || "consumo";
    items.push({ name, tipo, qtd: parseFloat(qtd) || null });
  }
  return items.length > 0 ? items : null;
}

function collectSupplies() {
  const i = { agua:$("#supplyWater").value||null, limpa_fossa:$("#supplySeptic").value||null, limpeza_banheiro:$("#supplyBathroom").value||null, pta:$("#supplyPta").value||null, munck:$("#supplyMunck").value||null, guindaste:$("#supplyCrane").value||null, remocao_cacamba:$("#supplyDebrisRemoval").value||null };
  return Object.values(i).some(v=>v!==null&&v!=="") ? i : null;
}

function collectOilChange() {
  if (!getToggleState("#toggleOilChange")) return null;
  const tipo = $("#oilType").value.trim() || null;
  const litros = parseFloat($("#oilLiters").value) || null;
  const horimetro = parseInt($("#oilHorimetro").value) || null;
  const filtro = $("#oilFilterChanged").checked;
  if (!tipo && !litros && !horimetro) return null;
  return { tipo, litros, horimetro, filtro_trocado: filtro };
}

// ── Pré-filtro ──────────────────────────────────────────────
function collectPreFiltro() {
  if (!getToggleState("#togglePreFiltro")) return null;
  const bags = parseFloat($("#preFiltroBags").value) || null;
  const obs = $("#preFiltroObs").value.trim() || null;
  if (bags == null && !obs) return null;
  return { bags, obs };
}

// ── Limpeza e Desenvolvimento (método + compressor) ──────────────────
function getMetodoDesenvolvimento() {
  const btn = $("#toggleMetodoDesenvolvimento").querySelector(".active-yes");
  return btn ? btn.dataset.value : "compressor";
}
function setMetodoDesenvolvimento(metodo) {
  const group = $("#toggleMetodoDesenvolvimento");
  group.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active-yes", "active-no"));
  const btn = group.querySelector(`[data-value="${metodo}"]`) || group.querySelector('[data-value="compressor"]');
  if (btn) btn.classList.add("active-yes");
  const isBomba = metodo === "bomba";
  $("#sectionMetodoCompressor").classList.toggle("show", !isBomba);
  $("#sectionMetodoBomba").classList.toggle("show", isBomba);
}
$("#toggleMetodoDesenvolvimento").addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-btn");
  if (!btn) return;
  setMetodoDesenvolvimento(btn.dataset.value);
});

function addCompressorRow(hora, profArranque, pressaoArranque, pressaoTrabalho) {
  const tbody = $("#compressorTable");
  const row = tbody.insertRow(-1);
  row.innerHTML = `
    <td><input type="time" value="${hora || ''}" class="compHora" style="min-width:72px;width:72px;"></td>
    <td><input type="number" step="0.01" value="${profArranque || ''}" class="compProf" style="min-width:60px;width:70px;"></td>
    <td><input type="number" step="0.01" value="${pressaoArranque || ''}" class="compPressaoArr" style="min-width:55px;width:65px;"></td>
    <td><input type="number" step="0.01" value="${pressaoTrabalho || ''}" class="compPressaoTrab" style="min-width:55px;width:65px;"></td>
    <td><button class="btn btn-danger btn-sm compRemove" type="button">&times;</button></td>`;
  row.querySelector(".compRemove").addEventListener("click", () => row.remove());
}
$("#btnAddCompressor").addEventListener("click", () => addCompressorRow("","","",""));

function collectCompressorUso() {
  const items = [];
  for (let i = 1; i < $("#compressorTable").rows.length; i++) {
    const row = $("#compressorTable").rows[i];
    const hora = row.querySelector(".compHora")?.value || "";
    const prof = row.querySelector(".compProf")?.value || "";
    const pArr = row.querySelector(".compPressaoArr")?.value || "";
    const pTrab = row.querySelector(".compPressaoTrab")?.value || "";
    if (!hora && !prof && !pArr && !pTrab) continue;
    items.push({
      hora: hora || null,
      prof_arranque: parseFloat(prof) || null,
      pressao_arranque: parseFloat(pArr) || null,
      pressao_trabalho: parseFloat(pTrab) || null,
    });
  }
  return items.length > 0 ? items : null;
}

function collectDesenvolvimento() {
  if (!getToggleState("#toggleDesenvolvimento")) return null;
  if (getMetodoDesenvolvimento() === "bomba") {
    const nome_bomba = $("#bombaNome").value.trim() || null;
    const potencia = $("#bombaPotencia").value.trim() || null;
    const voltagem = $("#bombaVoltagem").value.trim() || null;
    const horas_trabalhadas = parseFloat($("#bombaHoras").value) || null;
    const abertura_valvula = $("#bombaAberturaValvula").value || null;
    const profundidade_instalacao = parseFloat($("#bombaProfundidade").value) || null;
    const obs = $("#bombaObs").value.trim() || null;
    if (!nome_bomba && !potencia && !voltagem && !horas_trabalhadas && !abertura_valvula && !profundidade_instalacao && !obs) return null;
    return { metodo: "bomba", nome_bomba, potencia, voltagem, horas_trabalhadas, abertura_valvula, profundidade_instalacao, obs };
  }
  const modelo = $("#compressorModelo").value.trim() || null;
  const pressao_max = parseFloat($("#compressorPressaoMax").value) || null;
  const horimetro_inicio = parseInt($("#compressorHorimetroInicio").value) || null;
  const horimetro_fim = parseInt($("#compressorHorimetroFim").value) || null;
  const uso = collectCompressorUso();
  if (!modelo && !pressao_max && !horimetro_inicio && !horimetro_fim && !uso) return null;
  return { metodo: "compressor", modelo, pressao_max, horimetro_inicio, horimetro_fim, uso };
}

// ── Jateamento ──────────────────────────────────────────────
function addJateamentoRow(inicio, termino, secaoInicio, secaoFim, obs) {
  const tbody = $("#jateamentoTable");
  const row = tbody.insertRow(-1);
  row.innerHTML = `
    <td><input type="time" value="${inicio || ''}" class="jatInicio" style="min-width:72px;width:72px;"></td>
    <td><input type="time" value="${termino || ''}" class="jatTermino" style="min-width:72px;width:72px;"></td>
    <td><input type="number" step="0.01" value="${secaoInicio || ''}" class="jatSecIni" style="min-width:60px;width:70px;"></td>
    <td><input type="number" step="0.01" value="${secaoFim || ''}" class="jatSecFim" style="min-width:60px;width:70px;"></td>
    <td><input type="text" value="${obs || ''}" class="jatObs" placeholder="Obs" style="min-width:90px;"></td>
    <td><button class="btn btn-danger btn-sm jatRemove" type="button">&times;</button></td>`;
  row.querySelector(".jatRemove").addEventListener("click", () => row.remove());
}
$("#btnAddJateamento").addEventListener("click", () => addJateamentoRow("","","","",""));

function collectJateamento() {
  if (!getToggleState("#toggleJateamento")) return null;
  const items = [];
  for (let i = 1; i < $("#jateamentoTable").rows.length; i++) {
    const row = $("#jateamentoTable").rows[i];
    const inicio = row.querySelector(".jatInicio")?.value || "";
    const termino = row.querySelector(".jatTermino")?.value || "";
    const secIni = row.querySelector(".jatSecIni")?.value || "";
    const secFim = row.querySelector(".jatSecFim")?.value || "";
    const obs = row.querySelector(".jatObs")?.value || "";
    if (!inicio && !termino && !secIni && !secFim && !obs) continue;
    items.push({
      inicio: inicio || null,
      termino: termino || null,
      secao_inicio: parseFloat(secIni) || null,
      secao_fim: parseFloat(secFim) || null,
      obs: obs || null,
    });
  }
  return items.length > 0 ? items : null;
}
// ── Combustivel (dynamic) ───────────────────────────────────
const FUEL_EQUIP = ["Gerador","Compressor","Sonda","Bomba","Outro"];
const FUEL_TYPES = ["S10","S500"];

function addFuelRow(equip, tipo, litros) {
  const tbody = $("#fuelTable");
  const row = tbody.insertRow(-1);
  const eqOpts = FUEL_EQUIP.map(e => `<option value="${e}" ${e===equip?"selected":""}>${e}</option>`).join("");
  const tpOpts = FUEL_TYPES.map(t => `<option value="${t}" ${t===tipo?"selected":""}>${t}</option>`).join("");
  row.innerHTML = `
    <td><select class="fuelEquip" style="min-width:90px;font-size:.82rem;">${eqOpts}</select></td>
    <td><select class="fuelType" style="min-width:70px;font-size:.82rem;">${tpOpts}</select></td>
    <td><input type="number" step="0.1" class="fuelLiters" value="${litros||''}" style="min-width:60px;"></td>
    <td><button class="btn btn-danger btn-sm fuelRemove" type="button">&times;</button></td>`;
  row.querySelector(".fuelRemove").addEventListener("click", () => { row.remove(); updateFuelTotals(); });
  row.querySelectorAll("input, select").forEach(el => el.addEventListener("input", updateFuelTotals));
  row.querySelectorAll("input, select").forEach(el => el.addEventListener("change", updateFuelTotals));
  updateFuelTotals();
}
$("#btnAddFuel").addEventListener("click", () => addFuelRow("Gerador","S10",""));
addFuelRow("Sonda","S10","");

function updateFuelTotals() {
  let s10 = 0, s500 = 0;
  for (let i = 1; i < $("#fuelTable").rows.length; i++) {
    const row = $("#fuelTable").rows[i];
    const tipo = row.querySelector(".fuelType")?.value;
    const litros = parseFloat(row.querySelector(".fuelLiters")?.value) || 0;
    if (tipo === "S10") s10 += litros;
    else if (tipo === "S500") s500 += litros;
  }
  $("#fuelS10Total").textContent = s10.toFixed(1);
  $("#fuelS500Total").textContent = s500.toFixed(1);
  $("#fuelTotals").style.display = "block";
}

function collectFuel() {
  const items = [];
  for (let i = 1; i < $("#fuelTable").rows.length; i++) {
    const row = $("#fuelTable").rows[i];
    const equip = row.querySelector(".fuelEquip")?.value || "";
    const tipo = row.querySelector(".fuelType")?.value || "";
    const litros = parseFloat(row.querySelector(".fuelLiters")?.value) || 0;
    if (equip && litros > 0) items.push({ equipamento: equip, tipo, litros });
  }
  const s10Stock = parseFloat($("#fuelS10Stock").value) || null;
  const s500Stock = parseFloat($("#fuelS500Stock").value) || null;
  if (items.length === 0 && !s10Stock && !s500Stock) return null;
  return { consumos: items.length > 0 ? items : null, estoque_s10: s10Stock, estoque_s500: s500Stock };
}
function collectTeam() {
  const m = [];
  for (let i = 1; i < $("#teamTable").rows.length; i++) {
    const row = $("#teamTable").rows[i];
    const funcao = row.querySelector(".teamRole")?.value || "";
    const nome = row.querySelector(".teamName")?.value || "";
    if (funcao || nome) m.push({ funcao:funcao||null, nome:nome||null });
  }
  return m.length>0 ? m : null;
}

// ============================================================
// BUILD PAYLOAD
// ============================================================
function buildPayload(status) {
  const perfOn = getToggleState("#toggleDrilling");
  const fluOn = getToggleState("#toggleFluid");
  const p = {
    user_id: (currentUser && currentUser.id) || null,
    projeto_id: currentProjectId,
    data: $("#rdoDate").value || new Date().toISOString().split("T")[0],
      hse_dds: $("#hseDds").checked,
    hse_incidentes: $("#hseIncidents").value || null,
    hse_quase_acidentes: $("#hseNearMiss").value || null,
    hse_hh_expostas: parseFloat($("#hseManHours").value) || null,
    hse_epis_vistoriados: $("#hseEpi").checked,
    sonda_horimetro: parseInt($("#sondaHorimetro").value) || null,
    observacoes: $("#obsGeneral").value || null,
    planejamento_proximo_turno: $("#planNextShift").value || null,

    operacoes: collectOps(),
    equipe: collectTeam(),
    status: status,
  };
  if (perfOn) {
    const sl = collectStriplog();
    if (sl && sl.length > 0) {
      const depths = sl.map(r => r.profundidade).sort((a,b) => a - b);
      p.profundidade_inicial = depths[0];
      p.profundidade_final = depths[depths.length - 1];
    }
    p.estratigrafia_mudou = getToggleState("#toggleStratigraphy");
    if (p.estratigrafia_mudou) {
      p.estratigrafia_mudancas = collectStratigraphy();
    }
    p.brocas = collectBits();
    p.parametros_anomalias = collectAnomalies();
    p.striplog = collectStriplog();
    p.coluna = collectBHA();
  }
  if (fluOn) {
    p.quimicos = collectChemicals();
  }
  // Revestimento (standalone tab, not inside perfOn)
  p.revestimento_mudou = getToggleState("#toggleCasing");
  if (p.revestimento_mudou) {
    p.revestimento_metros = parseFloat($("#casingMeters").value) || null;
    p.revestimento_obs = $("#casingObs").value || null;
  }
  // Pré-filtro
  p.pre_filtro_mudou = getToggleState("#togglePreFiltro");
  if (p.pre_filtro_mudou) {
    p.pre_filtro = collectPreFiltro();
  }
  // Limpeza e desenvolvimento
  p.desenvolvimento_mudou = getToggleState("#toggleDesenvolvimento");
  if (p.desenvolvimento_mudou) {
    p.desenvolvimento = collectDesenvolvimento();
  }
  // Jateamento
  p.jateamento_mudou = getToggleState("#toggleJateamento");
  if (p.jateamento_mudou) {
    p.jateamento = collectJateamento();
  }
  const materiaisOn = getToggleState("#toggleMateriais");
  if (materiaisOn) {
    p.outros_materiais = collectMaterials();
  }
  p.fluido = collectFluid();  // always collected
  p.troca_oleo = collectOilChange();
  p.combustivel = collectFuel();
  // Strip nulls
  Object.keys(p).forEach(k => { if (p[k]===null||p[k]===undefined) delete p[k]; });
  return p;
}

// ============================================================
// SAVE DRAFT
// ============================================================
$("#btnSaveDraft").addEventListener("click", async () => {
  if (!currentProjectId) { showToast("Selecione um projeto.","error"); return; }
  $("#btnSaveDraft").disabled = true;
  $("#btnSubmit").disabled = true;
  try {
    const payload = buildPayload("rascunho");
    const rdoId = $("#rdoId").value;
    let result;
    if (rdoId) {
      result = await sb.from("rdos").update(payload).eq("id", rdoId).select().single();
    } else {
      result = await sb.from("rdos").insert(payload).select().single();
    }
    if (result.error) { showToast("Erro: "+result.error.message,"error"); return; }
    $("#rdoId").value = result.data.id;
    showToast("Rascunho salvo!","success");
  } catch(e) { showToast("Erro: "+e.message,"error"); }
  finally { $("#btnSaveDraft").disabled = false; $("#btnSubmit").disabled = false; }
});

// ============================================================
// SUBMIT RDO
// ============================================================
$("#btnSubmit").addEventListener("click", async () => {
  if (!currentProjectId) { showToast("Selecione um projeto.","error"); return; }
  $("#btnSaveDraft").disabled = true;
  $("#btnSubmit").disabled = true;
  $("#btnSubmit").innerHTML = '<span class="spinner"></span> Enviando...';
  try {
    const photoUrls = await uploadPhotos();
    const payload = buildPayload("em_revisao");
    payload.submitted_at = new Date().toISOString();
    // Merge new photos with existing ones
    const existingUrls = [];
    $$("#existingPhotos img").forEach(img => existingUrls.push(img.src));
    payload.fotos = [...existingUrls, ...photoUrls];
    if (payload.fotos.length === 0) delete payload.fotos;

    const rdoId = $("#rdoId").value;
    let result;
    if (rdoId) {
      result = await sb.from("rdos").update(payload).eq("id", rdoId).select().single();
    } else {
      result = await sb.from("rdos").insert(payload).select().single();
    }
    if (result.error) { showToast("Erro: "+result.error.message,"error"); return; }
    showToast("RDO enviado com sucesso!","success");
    stopAutoDraft();
    resetForm();
    showView("homeView");
    $("#rdosList").style.display = "block";
    $("#homeFooter").style.display = "block";
    loadRDOs();
  } catch(e) { showToast("Erro: "+e.message,"error"); }
  finally {
    $("#btnSaveDraft").disabled = false;
    $("#btnSubmit").disabled = false;
    $("#btnSubmit").textContent = "Enviar RDO";
  }
});

// ============================================================
// RESET FORM
// ============================================================
function resetForm() {
  const today = new Date().toISOString().split("T")[0];
  $("#rdoDate").value = "";
  $("#rdoDate").max = today;
  $("#formBody").style.display = "none";
  setToggle("#toggleDrilling", false);
  setToggle("#toggleFluid", false);
  setToggle("#toggleMateriais", false);
  setToggle("#toggleStratigraphy", false);
  setToggle("#toggleCasing", false);
  setToggle("#togglePreFiltro", false);
  setToggle("#toggleDesenvolvimento", false);
  setToggle("#toggleJateamento", false);
  setToggle("#toggleAnomaly", false);
  setToggle("#toggleOilChange", false);
  $$("input[type='text'], input[type='number'], textarea").forEach(el => {
    if (!["rdoDate","projectSelect"].includes(el.id)) el.value = "";
  });
  $$("input[type='checkbox']").forEach(el => { el.checked = false; });
  $("#bitChanged").checked = false;
  clearTable("#opsTable"); addOpRow("","","","");
  clearTable("#anomalyTable");
  clearTable("#stratTable");
  clearTable("#striplogTable");
  clearTable("#chemTable"); addChemicalRow("","","");
  clearTable("#matTable"); addMaterialRow("","","");
  clearTable("#fuelTable"); addFuelRow("Sonda","S10","");
  $("#fuelS10Stock").value = ""; $("#fuelS500Stock").value = "";
  $("#fuelTotals").style.display = "block";
  clearTable("#bhaTable"); addBHARow("","","","","","");
  clearTable("#compressorTable"); addCompressorRow("","","","");
  setMetodoDesenvolvimento("compressor");
  $("#bombaNome").value = ""; $("#bombaPotencia").value = ""; $("#bombaVoltagem").value = "";
  $("#bombaHoras").value = ""; $("#bombaAberturaValvula").value = ""; $("#bombaProfundidade").value = "";
  $("#bombaObs").value = "";
  clearTable("#jateamentoTable"); addJateamentoRow("","","","","");
  clearTable("#teamTable"); DEFAULT_ROLES.forEach(r => addTeamMemberRow(r,""));
  selectedFiles = [];
  $("#photoInput").value = "";
  $("#existingPhotos").innerHTML = "";
  renderPhotoPreview();

  // Clear pre-fill notes, inherited markers, and last stratigraphy
  $$(".prefill-note").forEach(n => n.classList.remove("show"));
  $("#lastStratigraphy").style.display = "none";
  lastRDO = null;
  updatePrefillVisibility();
}

// ============================================================
// INIT
// ============================================================
// ============================================================
// URL PARAM: edit=<id> — open RDO for editing
// ============================================================
(function initEditMode() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  if (!editId) return;
  // Wait for splash to dismiss, then load
  setTimeout(async () => {
    if ($("#splashView").classList.contains("active")) showView("homeView");
    await loadProjects();
    const { data } = await sb.from("rdos").select("*,projetos(id)").eq("id", editId).single();
    if (!data || !data.projeto_id) return;
    currentProjectId = data.projeto_id;
    $("#projectSelect").value = currentProjectId;
    currentProjectName = $("#projectSelect").selectedOptions[0]?.text || "";
    $("#headerProjectName").textContent = currentProjectName;
    openDraft(data);
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
  }, 1000);
})();
