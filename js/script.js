const DB_KEY = 'UFMT_SISTEMA_V12';
let disciplinas = [];
let optativas = [];
let grade = JSON.parse(localStorage.getItem(DB_KEY)) || {};
let discSendoAlocada = null;
let cellSendoAlocada = null;
let editandoAulaUid = null;

const horarios = [
    { id: "M1", label: "07:30 - 09:30" }, { id: "M2", label: "09:30 - 11:30" },
    { id: "T1", label: "13:30 - 15:30" }, { id: "T2", label: "15:30 - 17:30" }
];
const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const REGRAS_OFERTA = {
    "2026/1": { "20261": [1], "20251": [2, 4, 6, 8] },
    "2026/2": { "20261": [2], "20251": [3, 5, 7] },
    "2027/1": { "20261": [1, 3], "20251": [4, 6, 8] },
    "2027/2": { "20261": [2, 4], "20251": [5, 7] },
    "2028/1": { "20261": [1, 3, 5], "20251": [6, 8] },
    "2028/2": { "20261": [2, 4, 6], "20251": [7] },
    "2029/1": { "20261": [1, 3, 5, 7], "20251": [8] },
    "2029/2": { "20261": [2, 4, 6, 8], "20251": [] },
    "2030/1": { "20261": [1, 3, 5, 7], "20251": [] },
};

function getColor(s) {
    const cores = { 1: "#e3f2fd", 2: "#f1f8e9", 3: "#fff3e0", 4: "#f3e5f5", 5: "#efebe9", 6: "#e0f2f1", 7: "#fffde7", 8: "#ffebee" };
    return cores[s] || "#f1f5f9";
}

async function carregarDados() {
    try {
        const resOb = await fetch('./data/disciplinas_obrigatorias.json?v=' + Date.now());
        disciplinas = await resOb.json();
        const resOpt = await fetch('./data/disciplinas_optativas.json?v=' + Date.now());
        optativas = await resOpt.json();

        const pSel = document.getElementById('periodoAtual');
        Object.keys(REGRAS_OFERTA).forEach(p => pSel.innerHTML += `<option value="${p}">${p}</option>`);

        const sSel = document.getElementById('filtroSemestre');
        for(let i=1; i<=8; i++) sSel.innerHTML += `<option value="${i}">${i}º Semestre</option>`;

        popularDropdownOptativas();
        mudarFiltros();
    } catch (e) { alert("Erro ao carregar dados."); }
}

function mudarFiltros() {
    carregarListaSidebar();
    salvarEAtualizar();
}

function salvarEAtualizar() {
    localStorage.setItem(DB_KEY, JSON.stringify(grade));
    renderizarGrade();
    renderizarMatrizResumo();
}

function carregarListaSidebar() {
    const ppc = document.getElementById('filtroPPC').value;
    const sem = document.getElementById('filtroSemestre').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';

    const filtradas = disciplinas.filter(d => (d[`ppc_${ppc}`] || d[`PPC_${ppc}`]) == sem);

    filtradas.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card-disc-item';
        div.setAttribute('draggable', true);
        div.innerHTML = `<strong>${d.codigo}</strong><br>${d.nome}`;

        // Logica para Desktop (Arrastar)
        div.ondragstart = () => { discSendoAlocada = d; };

        // Lógica para Tablet (Clique para selecionar)
        div.onclick = (e) => {
            document.querySelectorAll('.card-disc-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            discSendoAlocada = d;
        };

        container.appendChild(div);
    });
}

function renderizarGrade() {
    const corpo = document.getElementById('corpoTabela');
    const periodo = document.getElementById('periodoAtual').value;
    corpo.innerHTML = '';
    horarios.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="background:#f8fafc; font-weight:bold; text-align:center; font-size:10px">${h.label}</td>`;
        dias.forEach(dia => {
            const cellId = `${dia}-${h.id}`;
            const td = document.createElement('td');

            // Eventos de Drop (Desktop)
            td.ondragover = (e) => { e.preventDefault(); td.classList.add('drag-over'); };
            td.ondragleave = () => td.classList.remove('drag-over');
            td.ondrop = (e) => {
                e.preventDefault();
                td.classList.remove('drag-over');
                cellSendoAlocada = cellId;
                abrirModal();
            };

            // Evento de Clique (Tablet)
            td.onclick = () => {
                if (discSendoAlocada) {
                    cellSendoAlocada = cellId;
                    abrirModal();
                }
            };

            if (grade[cellId]) {
                grade[cellId].filter(a => a.periodo === periodo).forEach(aula => {
                    const box = document.createElement('div');
                    box.className = 'aula-box';
                    box.style.backgroundColor = getColor(aula.semestre);
                    box.style.borderLeft = `5px solid var(--primary)`;
                    box.innerHTML = `
                        <span class="turma-tag">${aula.snapshotEtiquetas}</span>
                        <div style="font-weight:bold; color:#003d79;">${aula.codigo} - ${aula.nome}</div>
                        <div class="aula-info" onclick="event.stopPropagation(); editarAula('${cellId}','${aula.uid}')" style="cursor:pointer">
                            P: ${aula.prof}<br>S: ${aula.sala} (${aula.tipo[0]})
                        </div>
                        <button class="btn-del" onclick="event.stopPropagation(); removerAula('${cellId}','${aula.uid}')">×</button>
                    `;
                    td.appendChild(box);
                });
            }
            tr.appendChild(td);
        });
        corpo.appendChild(tr);
    });
}

function confirmarAlocacao() {
    const turmas = document.getElementById('editTurmas').value.trim();
    if (!turmas) return alert("Informe a turma!");
    const prof = document.getElementById('editProf').value || "A definir";
    const sala = document.getElementById('editSala').value || "S/N";
    const tipo = document.getElementById('editTipo').value;
    const ppcAtivo = document.getElementById('filtroPPC').value;
    const periodo = document.getElementById('periodoAtual').value;

    const semDaDisciplina = discSendoAlocada[`ppc_${ppcAtivo}`] || discSendoAlocada[`PPC_${ppcAtivo}`];

    // Choque de Semestre
    const aulasNoSlot = (grade[cellSendoAlocada] || []).filter(a => a.periodo === periodo);
    const choque = aulasNoSlot.find(a => a.ppc === ppcAtivo && a.semestre == semDaDisciplina && a.uid !== editandoAulaUid);
    if (choque) if (!confirm(`CHOQUE: O ${semDaDisciplina}º semestre já tem aula de ${choque.nome} aqui. Continuar?`)) return;

    if (editandoAulaUid) grade[cellSendoAlocada] = grade[cellSendoAlocada].filter(a => a.uid !== editandoAulaUid);
    if (!grade[cellSendoAlocada]) grade[cellSendoAlocada] = [];

    grade[cellSendoAlocada].push({
        uid: editandoAulaUid || "ID" + Date.now(),
        codigo: discSendoAlocada.codigo,
        nome: discSendoAlocada.nome,
        prof, sala, tipo, periodo, ppc: ppcAtivo, semestre: semDaDisciplina,
        snapshotEtiquetas: turmas
    });

    // Limpa a seleção do tablet após alocar
    discSendoAlocada = null;
    document.querySelectorAll('.card-disc-item').forEach(el => el.classList.remove('selected'));

    fecharModal();
    salvarEAtualizar();
}

function abrirModal() {
    document.getElementById('modalAula').style.display = 'flex';
    editandoAulaUid = null;
    document.getElementById('modalTitle').innerText = "Configurar Aula";
}
function fecharModal() { document.getElementById('modalAula').style.display = 'none'; }

function editarAula(cid, uid) {
    const a = grade[cid].find(x => x.uid === uid);
    discSendoAlocada = { codigo: a.codigo, nome: a.nome, [`ppc_${a.ppc}`]: a.semestre };
    cellSendoAlocada = cid;
    editandoAulaUid = uid;
    document.getElementById('editProf').value = a.prof;
    document.getElementById('editTurmas').value = a.snapshotEtiquetas;
    document.getElementById('editSala').value = a.sala;
    document.getElementById('editTipo').value = a.tipo;
    document.getElementById('modalTitle').innerText = "Editar Aula";
    document.getElementById('modalAula').style.display = 'flex';
}

function removerAula(cid, uid) { if(confirm("Remover?")) { grade[cid] = grade[cid].filter(a => a.uid !== uid); salvarEAtualizar(); } }

function renderizarMatrizResumo() {
    const periodo = document.getElementById('periodoAtual').value;
    ['20251', '20261'].forEach(ppc => {
        const cont = document.getElementById('matriz-' + ppc);
        if (!cont) return;
        cont.innerHTML = `<div style="writing-mode: vertical-lr; font-weight:800; padding:10px; background:#003d79; color:#fff; display:flex; align-items:center; justify-content:center; border-radius:4px 0 0 4px">PPC ${ppc}</div>`;
        const sems = REGRAS_OFERTA[periodo]?.[ppc] || [];
        sems.forEach(s => {
            const divSem = document.createElement('div');
            divSem.className = 'col-semestre';
            divSem.style.backgroundColor = getColor(s);
            divSem.innerHTML = `<div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:5px; color:#003d79">${s}º Sem</div>`;
            disciplinas.filter(d => (d[`ppc_${ppc}`] || d[`PPC_${ppc}`]) == s).forEach(d => {
                const ok = Object.values(grade).some(slot => slot.some(a => a.codigo === d.codigo && a.periodo === periodo));
                divSem.innerHTML += `<div class="item-matriz" style="color:${ok?'#059669':'#64748b'}">${ok?'✅':'❌'} ${d.nome.substring(0,18)}</div>`;
            });
            cont.appendChild(divSem);
        });
    });
}

// Funções de encargos e relatórios permanecem iguais às suas originais
function processarDadosDocentes() {
    const periodo = document.getElementById('periodoAtual').value;
    const docentes = {};
    Object.keys(grade).forEach(cid => {
        grade[cid].filter(a => a.periodo === periodo).forEach(aula => {
            const prof = aula.prof || "A definir";
            if (prof === "A definir") return;
            if (!docentes[prof]) { docentes[prof] = { totalSlots: 0, atividades: [] }; }
            docentes[prof].totalSlots += 1;
            const jaExiste = docentes[prof].atividades.find(at => at.codigo === aula.codigo && at.tipo === aula.tipo && at.turmas === aula.snapshotEtiquetas);
            if (!jaExiste) { docentes[prof].atividades.push({ codigo: aula.codigo, nome: aula.nome, tipo: aula.tipo, turmas: aula.snapshotEtiquetas }); }
        });
    });
    return Object.keys(docentes).sort().map(nome => {
        const hSemanais = docentes[nome].totalSlots * 2;
        return { nome: nome, hSemanais: hSemanais, hTotalEncargo: hSemanais * 2.5, atividades: docentes[nome].atividades };
    });
}

function imprimirRelatorioEncargos() {
    const periodo = document.getElementById('periodoAtual').value;
    const dados = processarDadosDocentes();
    const win = window.open('', '', 'width=1100,height=850');
    let h = `<html><head><style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:8px;font-size:11px}th{background:#003d79;color:white}.h-destaque{font-weight:bold;background:#f1f5f9}.item-atv{padding:4px 0;border-bottom:1px dashed #eee}</style></head><body><h1>Relatório Encargos - ${periodo}</h1><table><tr><th>Professor</th><th>H/S</th><th>Encargo (x2.5)</th><th>Disciplinas</th></tr>`;
    dados.forEach(d => {
        const listaAtv = d.atividades.map(at => `<div class="item-atv">${at.codigo} - ${at.nome} | <strong>${at.tipo}</strong> (${at.turmas})</div>`).join('');
        h += `<tr><td><strong>${d.nome}</strong></td><td>${d.hSemanais}h</td><td>${d.hTotalEncargo}h</td><td>${listaAtv}</td></tr>`;
    });
    h += `</table><script>window.print();</script></body></html>`;
    win.document.write(h); win.document.close();
}

function popularDropdownOptativas() {
    const sel = document.getElementById('selectOptativas');
    sel.innerHTML = '<option value="">-- Escolha --</option>';
    optativas.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(o => sel.innerHTML += `<option value="${o.codigo}">${o.nome}</option>`);
}

function selecionarOptativa(cod) { if(!cod) return; discSendoAlocada = optativas.find(o => o.codigo === cod); }

function exportarJSON() {
    const blob = new Blob([JSON.stringify(grade, null, 2)], {type : 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'grade.json'; a.click();
}

function exportarExcel() {
    const periodo = document.getElementById('periodoAtual').value;
    const dados = [["Dia", "Horário", "Código", "Disciplina", "Tipo", "Professor", "Sala", "Turma"]];
    Object.keys(grade).forEach(cid => {
        const [dia, hora] = cid.split('-');
        grade[cid].filter(a => a.periodo === periodo).forEach(a => { dados.push([dia, hora, a.codigo, a.nome, a.tipo, a.prof, a.sala, a.snapshotEtiquetas]); });
    });
    const ws = XLSX.utils.aoa_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grade");
    XLSX.writeFile(wb, "Grade_UFMT.xlsx");
}

function exportarEncargosExcel() {
    const periodo = document.getElementById('periodoAtual').value;
    const dados = processarDadosDocentes();
    const rows = [["Professor", "H/S Total", "Encargo Total (x2.5)", "Código", "Disciplina", "Tipo", "Turmas"]];
    dados.forEach(d => {
        d.atividades.forEach((at, index) => { rows.push([index === 0 ? d.nome : "", index === 0 ? d.hSemanais : "", index === 0 ? d.hTotalEncargo : "", at.codigo, at.nome, at.tipo, at.turmas]); });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Encargos");
    XLSX.writeFile(wb, "Encargos_Docentes.xlsx");
}

function importarJSON(input) {
    const reader = new FileReader();
    reader.onload = (e) => { grade = JSON.parse(e.target.result); mudarFiltros(); };
    reader.readAsText(input.files[0]);
}

function imprimirRelatorioCompleto() {
    const periodo = document.getElementById('periodoAtual').value;
    const rel = {};
    Object.keys(grade).forEach(cid => {
        const [dia, horaId] = cid.split('-');
        const hLabel = horarios.find(h => h.id === horaId).label;
        grade[cid].filter(a => a.periodo === periodo).forEach(a => {
            if(!rel[a.ppc]) rel[a.ppc] = {};
            if(!rel[a.ppc][a.semestre]) rel[a.ppc][a.semestre] = [];
            rel[a.ppc][a.semestre].push({...a, dia, hLabel});
        });
    });
    const win = window.open('', '', 'width=1100,height=850');
    let h = `<html><head><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:8px;font-size:11px}th{background:#003d79;color:white}</style></head><body><h1>Relatório UFMT - ${periodo}</h1>`;
    Object.keys(rel).sort().forEach(ppc => {
        h += `<h2>PPC ${ppc}</h2>`;
        Object.keys(rel[ppc]).sort().forEach(sem => {
            h += `<h3>${sem}º Semestre</h3><table><tr><th>Dia</th><th>Hora</th><th>Código</th><th>Disciplina</th><th>Tipo</th><th>Prof</th><th>Sala</th><th>Turma</th></tr>`;
            rel[ppc][sem].forEach(a => { h += `<tr><td>${a.dia}</td><td>${a.hLabel}</td><td>${a.codigo}</td><td>${a.nome}</td><td>${a.tipo}</td><td>${a.prof}</td><td>${a.sala}</td><td>${a.snapshotEtiquetas}</td></tr>`; });
            h += `</table>`;
        });
    });
    h += `<script>window.print();</script></body></html>`;
    win.document.write(h); win.document.close();
}

function resetAbsoluto() { if(confirm("Limpar tudo?")) { localStorage.clear(); location.reload(); } }

carregarDados();